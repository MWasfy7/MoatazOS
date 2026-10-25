/**
 * Evidence rules for the hosted allowlist-trigger test.
 *
 * Two kinds of evidence are kept apart on purpose:
 *  1. API OBSERVATIONS: what the Auth endpoints returned for an allow-listed control and for an unlisted
 *     address. These can show "the unlisted address was refused where the control was not". They can
 *     NEVER show WHY: a generic 500 / unexpected_failure / "Internal server error", a rate limit, a network
 *     fault or an email problem all look like a refusal, and so would any server fault.
 *  2. VERIFIED LOG ATTRIBUTION: a Postgres log line that names DONNA_SIGNUP_NOT_ALLOWED (the exception raised
 *     by the trigger) and falls inside the unlisted attempt's time window. Only this attributes the
 *     refusal to the trigger.
 * PASS requires both. Consistent API observations without verified attribution are INCONCLUSIVE, and the
 * live test treats INCONCLUSIVE as a failure: it never passes on weak evidence.
 */
export interface AuthErrorLike {
  status?: number | null;
  code?: string | null;
  message?: string | null;
  name?: string | null;
}

export type ErrorClass =
  | "NO_ERROR"
  | "NETWORK"
  | "RATE_LIMITED"
  | "PLATFORM_SIGNUP_DISABLED"
  | "EMAIL_DELIVERY"
  | "ALREADY_REGISTERED"
  | "EMAIL_NOT_CONFIRMED"
  | "INVALID_CREDENTIALS"
  | "INVALID_INPUT"
  /** A 500 whose body names a database failure while creating the user. Still not attributable to OUR trigger. */
  | "DATABASE_REJECTION"
  /** Any other 5xx (generic 500, unexpected_failure, "Internal server error", empty body). Could be any server fault. */
  | "GENERIC_SERVER_ERROR"
  | "OTHER";

export function classifyAuthError(error: AuthErrorLike | null | undefined): ErrorClass {
  if (!error) return "NO_ERROR";
  const status = error.status ?? undefined;
  const code = (error.code ?? "").toLowerCase();
  const message = error.message ?? "";

  if (
    status === 0 ||
    (status !== undefined && [502, 503, 504].includes(status)) ||
    /failed to fetch|fetch failed|network|econn|enotfound|etimedout|timeout/i.test(message)
  ) {
    return "NETWORK";
  }
  if (status === 429 || /rate_limit/.test(code) || /rate limit|too many requests|for security purposes/i.test(message)) {
    return "RATE_LIMITED";
  }
  if (code === "signup_disabled" || /signups? not allowed/i.test(message)) return "PLATFORM_SIGNUP_DISABLED";
  if (/error sending|sending (confirmation|magic link|recovery|invite)/i.test(message) || code === "email_provider_disabled") {
    return "EMAIL_DELIVERY";
  }
  if (code === "user_already_exists" || code === "email_exists" || /already registered|already been registered/i.test(message)) {
    return "ALREADY_REGISTERED";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) return "EMAIL_NOT_CONFIRMED";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) return "INVALID_CREDENTIALS";
  if (["weak_password", "validation_failed", "email_address_invalid", "bad_json"].includes(code) || status === 422) {
    return "INVALID_INPUT";
  }
  // A failing trigger on user creation is reported as a 500 "Database error saving new user", but ANY
  // database failure produces that message, so even this class is not attributable to our trigger.
  if (status === 500 && /database error saving new user/i.test(message)) return "DATABASE_REJECTION";
  if (status !== undefined && status >= 500) return "GENERIC_SERVER_ERROR";
  if (code === "unexpected_failure") return "GENERIC_SERVER_ERROR";
  return "OTHER";
}

export interface TriggerEvidenceInput {
  /** Sign-up of an address that IS on the allowlist and is not yet a user. */
  control: { signUpError: AuthErrorLike | null; userId: string | null; signInError: AuthErrorLike | null; signedInOk: boolean };
  /** Sign-up of an address that is NOT on the allowlist. */
  unlisted: { signUpError: AuthErrorLike | null; userId: string | null };
  /** Password sign-in with the unlisted address's credentials afterwards. */
  unlistedSignIn: { error: AuthErrorLike | null; signedInOk: boolean };
}

/** Log attribution, checked separately from the API observations. */
export type Attribution =
  | { status: "NOT_SUPPLIED" }
  | { status: "REJECTED"; reason: string }
  | { status: "VERIFIED"; matchedLine: string; at: string };

export const TRIGGER_LOG_MARKER = "DONNA_SIGNUP_NOT_ALLOWED";
const WINDOW_BEFORE_MS = 60_000;
const WINDOW_AFTER_MS = 120_000;

const ISO_TIME = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?/g;
const EPOCH_TIME = /(?<!\d)(\d{16}|\d{13})(?!\d)/g;

function timesIn(line: string): number[] {
  const out: number[] = [];
  for (const match of line.matchAll(ISO_TIME)) {
    let text = match[0].replace(" ", "T");
    if (!/(Z|[+-]\d{2}(:?\d{2})?)$/.test(text)) text += "Z";
    else if (/[+-]\d{2}$/.test(text)) text += ":00";
    else if (/[+-]\d{4}$/.test(text)) text = text.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    const ms = Date.parse(text);
    if (!Number.isNaN(ms)) out.push(ms);
  }
  for (const match of line.matchAll(EPOCH_TIME)) {
    const digits = match[1] as string;
    out.push(digits.length === 16 ? Math.floor(Number(digits) / 1000) : Number(digits));
  }
  return out;
}

/**
 * Check an exported Postgres log excerpt: some single line must name DONNA_SIGNUP_NOT_ALLOWED and carry a
 * timestamp inside [attempt - 60 s, attempt + 120 s]. A marker line without a readable timestamp, or one
 * outside the window, does not attribute anything. (The real export format is unobserved; ISO and epoch
 * timestamps are accepted.)
 */
export function verifyLogAttribution(logText: string | null | undefined, attemptedAt: string): Attribution {
  if (!logText || logText.trim() === "") return { status: "NOT_SUPPLIED" };
  const attempt = Date.parse(attemptedAt);
  if (Number.isNaN(attempt)) return { status: "REJECTED", reason: "the attempt time is not a valid timestamp" };
  const markerLines = logText.split(/\r?\n/).filter((line) => line.includes(TRIGGER_LOG_MARKER));
  if (markerLines.length === 0) return { status: "REJECTED", reason: `no log line contains ${TRIGGER_LOG_MARKER}` };
  for (const line of markerLines) {
    const hit = timesIn(line).find((t) => t >= attempt - WINDOW_BEFORE_MS && t <= attempt + WINDOW_AFTER_MS);
    if (hit !== undefined) return { status: "VERIFIED", matchedLine: line.trim().slice(0, 300), at: new Date(hit).toISOString() };
  }
  return {
    status: "REJECTED",
    reason: `${markerLines.length} log line(s) contain ${TRIGGER_LOG_MARKER}, but none carries a readable timestamp within 60 s before to 120 s after the attempt at ${attemptedAt}`,
  };
}

export interface ApiObservation {
  observation: "CONSISTENT" | "INCONCLUSIVE" | "FAIL";
  reason: string;
}

export interface TriggerVerdict {
  verdict: "PASS" | "FAIL" | "INCONCLUSIVE";
  reason: string;
  /** What the Auth API showed. Never attributes a cause. */
  api: ApiObservation;
  /** What the log check showed. The only evidence that can attribute the cause. */
  attribution: Attribution;
}

const CONTROL_ADVICE: Partial<Record<ErrorClass, string>> = {
  NETWORK: "network problem reaching the project",
  RATE_LIMITED: "the Auth service rate-limited the request; wait and run again",
  PLATFORM_SIGNUP_DISABLED: "dashboard sign-up is still OFF, so nothing about the trigger can be shown",
  EMAIL_DELIVERY: "the project tried to send a confirmation email; turn 'Confirm email' OFF for this run",
  ALREADY_REGISTERED: "the control user already exists; delete it in the dashboard (or use a fresh allow-listed address) and run again",
  EMAIL_NOT_CONFIRMED: "the control user needs email confirmation; turn 'Confirm email' OFF for this run",
  INVALID_CREDENTIALS: "the control credentials were rejected",
  INVALID_INPUT: "the control address or password was rejected as invalid input",
  DATABASE_REJECTION: "the allow-listed control address was rejected by the database: the control address is probably not on the allowlist",
  GENERIC_SERVER_ERROR: "the project returned a generic server error for the control address",
  OTHER: "an unrecognised error",
};

function observeApi(input: TriggerEvidenceInput): { observation: ApiObservation; failed: boolean } {
  const { control, unlisted, unlistedSignIn } = input;
  const inconclusive = (reason: string) => ({ observation: { observation: "INCONCLUSIVE" as const, reason }, failed: false });
  const fail = (reason: string) => ({ observation: { observation: "FAIL" as const, reason }, failed: true });

  // 1. The control must succeed completely (same conditions: sign-up open, no rate limit, API path works).
  if (control.signUpError || !control.userId) {
    const cls = classifyAuthError(control.signUpError);
    return inconclusive(`control sign-up of the ALLOW-LISTED address did not succeed (${cls}): ${CONTROL_ADVICE[cls] ?? "no user returned"}`);
  }
  if (control.signInError || !control.signedInOk) {
    const cls = classifyAuthError(control.signInError);
    return inconclusive(`control user could not sign in (${cls}): ${CONTROL_ADVICE[cls] ?? "no session"}`);
  }

  // 2. The unlisted sign-up must have failed and created no user.
  if (!unlisted.signUpError) {
    return fail(unlisted.userId
      ? "an account was CREATED for the unlisted address: the allowlist did not stop it"
      : "sign-up of the unlisted address reported no error: nothing refused it");
  }
  const cls = classifyAuthError(unlisted.signUpError);
  if (cls !== "DATABASE_REJECTION" && cls !== "GENERIC_SERVER_ERROR") {
    return inconclusive(`the unlisted sign-up failed, but not with a server-side refusal (${cls}); this is not evidence about the trigger`);
  }
  if (unlisted.userId) return fail("the sign-up reported a server error but a user id was returned");

  // 3. No account exists for the unlisted address.
  if (unlistedSignIn.signedInOk || !unlistedSignIn.error) return fail("the unlisted address CAN sign in: an account exists");
  const signInClass = classifyAuthError(unlistedSignIn.error);
  if (signInClass !== "INVALID_CREDENTIALS") {
    return inconclusive(`could not confirm that no account exists: sign-in failed with ${signInClass}, not invalid credentials`);
  }

  return {
    observation: {
      observation: "CONSISTENT",
      reason: `the allow-listed control succeeded; the unlisted address got a ${cls === "DATABASE_REJECTION" ? "database-class" : "generic"} server error (${unlisted.signUpError.status} ${unlisted.signUpError.code ?? ""}: ${unlisted.signUpError.message ?? ""}) and no account exists. This is what the trigger would produce, and also what any server fault would produce`,
    },
    failed: false,
  };
}

/**
 * Combine the two kinds of evidence. FAIL when the API shows the unlisted address got in. PASS only when
 * the API observations are consistent AND the log attribution is VERIFIED. Everything else is INCONCLUSIVE.
 */
export function decideTriggerEvidence(input: TriggerEvidenceInput, attribution: Attribution = { status: "NOT_SUPPLIED" }): TriggerVerdict {
  const { observation, failed } = observeApi(input);
  const result = (verdict: TriggerVerdict["verdict"], reason: string): TriggerVerdict => ({ verdict, reason, api: observation, attribution });

  if (failed) return result("FAIL", observation.reason);
  if (observation.observation === "INCONCLUSIVE") return result("INCONCLUSIVE", observation.reason);

  if (attribution.status === "VERIFIED") {
    return result("PASS", `${observation.reason}. A log line naming ${TRIGGER_LOG_MARKER} at ${attribution.at} falls inside the attempt window, which attributes the refusal to the trigger: ${attribution.matchedLine}`);
  }
  if (attribution.status === "REJECTED") {
    return result("INCONCLUSIVE", `${observation.reason}. The supplied log excerpt does not attribute it: ${attribution.reason}`);
  }
  return result("INCONCLUSIVE", `${observation.reason}. The cause is not attributed: supply the Postgres log excerpt showing ${TRIGGER_LOG_MARKER} for the attempt time (DON-02-SETUP.md section 9) and verify it`);
}

/**
 * Raw HTTP to the Auth endpoints, NOT the SDK. In the pinned supabase-js (2.109.0) every HTTP 500 is wrapped
 * as `AuthRetryableFetchError` with the response body DISCARDED (message "{}", no code), so a trigger-caused
 * 500 cannot be told apart from an outage or an email failure through the SDK. The evidence therefore reads
 * the real response body. (`DonnaTriggerEvidenceSdk.test.ts` pins that SDK behaviour.)
 */
export interface AuthTransport {
  signUp(credentials: { email: string; password: string }): Promise<AuthOutcome>;
  signInWithPassword(credentials: { email: string; password: string }): Promise<AuthOutcome>;
}

export interface AuthOutcome {
  error: AuthErrorLike | null;
  userId: string | null;
  hasSession: boolean;
}

export function createHttpAuth(baseUrl: string, anonKey: string, fetchImpl: typeof fetch = fetch): AuthTransport {
  async function call(path: string, credentials: { email: string; password: string }): Promise<AuthOutcome> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${anonKey}` },
        body: JSON.stringify(credentials),
      });
    } catch (cause) {
      return { error: { status: 0, code: null, message: `fetch failed: ${String((cause as Error)?.message ?? cause)}` }, userId: null, hasSession: false };
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (!response.ok) {
      const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : null);
      return {
        error: { status: response.status, code: text("error_code") ?? text("error"), message: text("msg") ?? text("message") ?? text("error_description") ?? `HTTP ${response.status}` },
        userId: null,
        hasSession: false,
      };
    }
    const user = (body.user ?? null) as { id?: unknown } | null;
    const userId = typeof user?.id === "string" ? user.id : typeof body.id === "string" ? (body.id as string) : null;
    return { error: null, userId, hasSession: typeof body.access_token === "string" };
  }
  return {
    signUp: (credentials) => call("/auth/v1/signup", credentials),
    signInWithPassword: (credentials) => call("/auth/v1/token?grant_type=password", credentials),
  };
}

/**
 * Runs the control sign-up/sign-in, then the unlisted sign-up/sign-in, and returns the raw
 * observations for {@link decideTriggerEvidence}.
 */
export async function collectTriggerEvidence(
  auth: AuthTransport,
  control: { email: string; password: string },
  unlisted: { email: string; password: string },
): Promise<TriggerEvidenceInput & { unlistedAttemptedAt: string }> {
  const controlUp = await auth.signUp(control);
  const controlIn = !controlUp.error && controlUp.userId ? await auth.signInWithPassword(control) : null;
  const unlistedAttemptedAt = new Date().toISOString();
  const unlistedUp = await auth.signUp(unlisted);
  const unlistedIn = await auth.signInWithPassword(unlisted);
  return {
    control: {
      signUpError: controlUp.error,
      userId: controlUp.userId,
      signInError: controlIn?.error ?? null,
      signedInOk: Boolean(controlIn?.hasSession),
    },
    unlisted: { signUpError: unlistedUp.error, userId: unlistedUp.userId },
    unlistedSignIn: { error: unlistedIn.error, signedInOk: unlistedIn.hasSession },
    unlistedAttemptedAt,
  };
}
