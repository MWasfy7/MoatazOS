/**
 * Classification of Supabase Auth errors for the hosted allowlist-trigger test.
 *
 * Why this exists: "sign-up returned some error" is NOT evidence about the database trigger.
 * Rate limits, network failures, email-delivery problems and plain bad input all produce
 * errors too. The test therefore needs (1) a CONTROL (an allow-listed address that succeeds
 * under the same conditions), (2) a refusal that is a database-class rejection, and (3) proof
 * that no account exists. Anything else is INCONCLUSIVE, and the live test treats
 * INCONCLUSIVE as a failure: it never passes on weak evidence.
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
  | "DATABASE_REJECTION"
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
  // GoTrue reports a failing database trigger on user creation as a 500 "Database error saving new user".
  if (status === 500 && (code === "unexpected_failure" || /database error saving new user/i.test(message))) {
    return "DATABASE_REJECTION";
  }
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

export type TriggerVerdict = { verdict: "PASS" | "FAIL" | "INCONCLUSIVE"; reason: string };

const inconclusive = (reason: string): TriggerVerdict => ({ verdict: "INCONCLUSIVE", reason });
const fail = (reason: string): TriggerVerdict => ({ verdict: "FAIL", reason });

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
  OTHER: "an unrecognised error",
};

/**
 * Decide whether the run shows that the DATABASE refused the unlisted address.
 * PASS requires all of: the allowed control was created and can sign in (same conditions, so
 * sign-up is open, there is no rate limit or network problem, and the API path works); the unlisted
 * sign-up failed with a database-class rejection and created no user; and the unlisted
 * credentials cannot sign in. Everything else is FAIL (an account was created) or INCONCLUSIVE.
 */
export function decideTriggerEvidence(input: TriggerEvidenceInput): TriggerVerdict {
  const { control, unlisted, unlistedSignIn } = input;

  // 1. The control must succeed completely.
  if (control.signUpError || !control.userId) {
    const cls = classifyAuthError(control.signUpError);
    return inconclusive(`control sign-up of the ALLOW-LISTED address did not succeed (${cls}): ${CONTROL_ADVICE[cls] ?? "no user returned"}`);
  }
  if (control.signInError || !control.signedInOk) {
    const cls = classifyAuthError(control.signInError);
    return inconclusive(`control user could not sign in (${cls}): ${CONTROL_ADVICE[cls] ?? "no session"}`);
  }

  // 2. The unlisted sign-up must be refused by the database, and create no user.
  if (!unlisted.signUpError) {
    return fail(unlisted.userId
      ? "an account was CREATED for the unlisted address: the allowlist trigger did not stop it"
      : "sign-up of the unlisted address reported no error: the trigger did not refuse it");
  }
  const cls = classifyAuthError(unlisted.signUpError);
  if (cls !== "DATABASE_REJECTION") {
    return inconclusive(`the unlisted sign-up failed, but not with a database-class rejection (${cls}); this is not evidence about the trigger`);
  }
  if (unlisted.userId) return fail("the sign-up reported a database error but a user id was returned");

  // 3. No account exists for the unlisted address.
  if (unlistedSignIn.signedInOk || !unlistedSignIn.error) return fail("the unlisted address CAN sign in: an account exists");
  const signInClass = classifyAuthError(unlistedSignIn.error);
  if (signInClass !== "INVALID_CREDENTIALS") {
    return inconclusive(`could not confirm that no account exists: sign-in failed with ${signInClass}, not invalid credentials`);
  }

  return {
    verdict: "PASS",
    reason:
      "allow-listed control succeeded under the same conditions; the unlisted address got a database-class rejection and no account exists. " +
      "Attribute the cause to the trigger by finding DONNA_SIGNUP_NOT_ALLOWED in the Postgres logs for this time (DON-02-SETUP.md section 9).",
  };
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
