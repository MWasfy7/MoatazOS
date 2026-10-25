import { describe, expect, it } from "vitest";
import {
  classifyAuthError,
  decideTriggerEvidence,
  verifyLogAttribution,
  type Attribution,
  type AuthErrorLike,
  type TriggerEvidenceInput,
} from "./helpers/donnaTriggerEvidence";

// Pure tests of the evidence rules used by the hosted trigger test. They run locally and prove the
// RULES, not the hosted project. Two kinds of evidence are kept apart on purpose:
//   - API observations (what the Auth endpoints returned), and
//   - verified log attribution (a Postgres log line naming DONNA_SIGNUP_NOT_ALLOWED inside the attempt window).
// Only the second can attribute a refusal to the trigger, so PASS requires it.

const RATE: AuthErrorLike = { status: 429, code: "over_request_rate_limit", message: "Request rate limit reached" };
const EMAIL_RATE: AuthErrorLike = { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" };
const NET: AuthErrorLike = { status: 0, name: "AuthRetryableFetchError", message: "Failed to fetch" };
const DISABLED: AuthErrorLike = { status: 422, code: "signup_disabled", message: "Signups not allowed for this instance" };
const DB: AuthErrorLike = { status: 500, code: "unexpected_failure", message: "Database error saving new user" };
const GENERIC_500: AuthErrorLike = { status: 500, code: "unexpected_failure", message: "Internal server error" };
const MAIL: AuthErrorLike = { status: 500, code: "unexpected_failure", message: "Error sending confirmation email" };
const WEAK: AuthErrorLike = { status: 422, code: "weak_password", message: "Password should be at least 12 characters" };
const BADMAIL: AuthErrorLike = { status: 400, code: "email_address_invalid", message: "Email address is invalid" };
const EXISTS: AuthErrorLike = { status: 422, code: "user_already_exists", message: "User already registered" };
const BADLOGIN: AuthErrorLike = { status: 400, code: "invalid_credentials", message: "Invalid login credentials" };
const UNCONFIRMED: AuthErrorLike = { status: 400, code: "email_not_confirmed", message: "Email not confirmed" };

// What the first version of the live test accepted as proof: any non-null error.
const legacyAccepts = (error: AuthErrorLike | null) => error !== null;

const ATTEMPTED_AT = "2026-10-26T12:00:00.000Z";
const NONE: Attribution = { status: "NOT_SUPPLIED" };
const VERIFIED = verifyLogAttribution(`2026-10-26T12:00:03.100Z ERROR: DONNA_SIGNUP_NOT_ALLOWED\nCONTEXT: PL/pgSQL function donna_block_unlisted_user()`, ATTEMPTED_AT);

const input = (unlisted: { signUpError: AuthErrorLike | null; userId?: string | null }): TriggerEvidenceInput => ({
  control: { signUpError: null, userId: "uuid-control", signInError: null, signedInOk: true },
  unlisted: { signUpError: unlisted.signUpError, userId: unlisted.userId ?? null },
  unlistedSignIn: { error: BADLOGIN, signedInOk: false },
});
const GOOD = input({ signUpError: DB });

describe("Donna hosted trigger evidence: error classification", () => {
  it("recognises each class of failure", () => {
    expect(classifyAuthError(null)).toBe("NO_ERROR");
    expect(classifyAuthError(RATE)).toBe("RATE_LIMITED");
    expect(classifyAuthError(EMAIL_RATE)).toBe("RATE_LIMITED");
    expect(classifyAuthError(NET)).toBe("NETWORK");
    expect(classifyAuthError({ status: 503, message: "upstream" })).toBe("NETWORK");
    expect(classifyAuthError({ message: "TypeError: fetch failed" })).toBe("NETWORK");
    expect(classifyAuthError(DISABLED)).toBe("PLATFORM_SIGNUP_DISABLED");
    expect(classifyAuthError(MAIL)).toBe("EMAIL_DELIVERY");
    expect(classifyAuthError(WEAK)).toBe("INVALID_INPUT");
    expect(classifyAuthError(BADMAIL)).toBe("INVALID_INPUT");
    expect(classifyAuthError(EXISTS)).toBe("ALREADY_REGISTERED");
    expect(classifyAuthError(BADLOGIN)).toBe("INVALID_CREDENTIALS");
    expect(classifyAuthError(UNCONFIRMED)).toBe("EMAIL_NOT_CONFIRMED");
    expect(classifyAuthError(DB)).toBe("DATABASE_REJECTION");
    expect(classifyAuthError({ status: 418, message: "teapot" })).toBe("OTHER");
  });

  it("a generic 500 / unexpected_failure is a GENERIC_SERVER_ERROR, never a database rejection", () => {
    expect(classifyAuthError(GENERIC_500)).toBe("GENERIC_SERVER_ERROR");
    expect(classifyAuthError({ status: 500, code: "unexpected_failure", message: null })).toBe("GENERIC_SERVER_ERROR");
    expect(classifyAuthError({ status: 500, code: "unexpected_failure", message: "{}" })).toBe("GENERIC_SERVER_ERROR");
    expect(classifyAuthError({ status: 500, message: "Internal Server Error" })).toBe("GENERIC_SERVER_ERROR");
    expect(classifyAuthError(MAIL)).toBe("EMAIL_DELIVERY");
  });
});

describe("Donna hosted trigger evidence: a generic 500 is never a PASS (reviewer's reproduction)", () => {
  // Control signs up and signs in; the unlisted sign-up returns a generic 500 "Internal server error";
  // the unlisted sign-in is refused. That is exactly what ANY server fault would also produce.
  const reproduction = input({ signUpError: GENERIC_500 });

  it("is INCONCLUSIVE with no attribution", () => {
    const decision = decideTriggerEvidence(reproduction);
    expect(decision.verdict).not.toBe("PASS");
    expect(decision.verdict).toBe("INCONCLUSIVE");
    expect(decision.attribution.status).toBe("NOT_SUPPLIED");
  });

  it("stays INCONCLUSIVE when the supplied logs do not attribute it (no marker, or marker outside the window)", () => {
    for (const logs of ["2026-10-26T12:00:02Z ERROR: some other failure", "", "2026-10-26T09:00:00Z ERROR: DONNA_SIGNUP_NOT_ALLOWED", "ERROR: DONNA_SIGNUP_NOT_ALLOWED (no timestamp)"]) {
      const decision = decideTriggerEvidence(reproduction, verifyLogAttribution(logs, ATTEMPTED_AT));
      expect(decision.verdict, logs).toBe("INCONCLUSIVE");
    }
  });

  it("a generic 500 for a refusal that ALSO has a database-class message is still not a pass on its own", () => {
    for (const unlisted of [GENERIC_500, DB]) {
      expect(decideTriggerEvidence(input({ signUpError: unlisted })).verdict).toBe("INCONCLUSIVE");
    }
  });
});

describe("Donna hosted trigger evidence: API observations and log attribution are separate", () => {
  it("the old rule (any error) wrongly accepted unrelated failures; the new rule does not, with or without logs", () => {
    for (const unrelated of [RATE, EMAIL_RATE, NET, DISABLED, MAIL, WEAK, BADMAIL, EXISTS]) {
      expect(legacyAccepts(unrelated), `legacy accepted ${unrelated.code ?? unrelated.message}`).toBe(true);
      for (const attribution of [NONE, VERIFIED]) {
        const decision = decideTriggerEvidence(input({ signUpError: unrelated }), attribution);
        expect(decision.verdict, `${unrelated.code ?? unrelated.message}: ${decision.reason}`).toBe("INCONCLUSIVE");
        expect(decision.api.observation).toBe("INCONCLUSIVE");
      }
    }
  });

  it("consistent API observations alone are INCONCLUSIVE: the cause is not attributed", () => {
    const decision = decideTriggerEvidence(GOOD);
    expect(decision.api.observation).toBe("CONSISTENT");
    expect(decision.attribution.status).toBe("NOT_SUPPLIED");
    expect(decision.verdict).toBe("INCONCLUSIVE");
    expect(decision.reason).toContain("not attributed");
  });

  it("PASS needs consistent API observations AND a verified log line naming DONNA_SIGNUP_NOT_ALLOWED in the window", () => {
    expect(VERIFIED.status).toBe("VERIFIED");
    const decision = decideTriggerEvidence(GOOD, VERIFIED);
    expect(decision.verdict).toBe("PASS");
    expect(decision.reason).toContain("DONNA_SIGNUP_NOT_ALLOWED");
    expect(decision.api.observation).toBe("CONSISTENT");
  });

  it("verified logs never rescue broken API observations", () => {
    // control could not be created
    const noControl = { ...GOOD, control: { signUpError: RATE, userId: null, signInError: null, signedInOk: false } };
    expect(decideTriggerEvidence(noControl, VERIFIED).verdict).toBe("INCONCLUSIVE");
    // control created but cannot sign in
    const controlNoSignIn = { ...GOOD, control: { signUpError: null, userId: "u", signInError: UNCONFIRMED, signedInOk: false } };
    const d = decideTriggerEvidence(controlNoSignIn, VERIFIED);
    expect(d.verdict).toBe("INCONCLUSIVE");
    expect(d.reason).toContain("Confirm email");
    // unlisted address was accepted: a log line does not change that
    expect(decideTriggerEvidence(input({ signUpError: null, userId: "uuid-stranger" }), VERIFIED).verdict).toBe("FAIL");
    expect(decideTriggerEvidence(input({ signUpError: null }), VERIFIED).verdict).toBe("FAIL");
    expect(decideTriggerEvidence(input({ signUpError: DB, userId: "uuid-stranger" }), VERIFIED).verdict).toBe("FAIL");
  });

  it("requires proof that no account exists for the unlisted address", () => {
    const base = GOOD;
    expect(decideTriggerEvidence({ ...base, unlistedSignIn: { error: null, signedInOk: true } }, VERIFIED).verdict).toBe("FAIL");
    for (const error of [RATE, NET, UNCONFIRMED]) {
      expect(decideTriggerEvidence({ ...base, unlistedSignIn: { error, signedInOk: false } }, VERIFIED).verdict).toBe("INCONCLUSIVE");
    }
  });
});

describe("Donna hosted trigger evidence: verifying a Postgres log excerpt", () => {
  it("no excerpt supplied is NOT_SUPPLIED, not a rejection and not a pass", () => {
    for (const logs of [null, undefined, "", "  \n "]) expect(verifyLogAttribution(logs, ATTEMPTED_AT)).toEqual({ status: "NOT_SUPPLIED" });
  });

  it("rejects an excerpt without the marker", () => {
    const result = verifyLogAttribution("2026-10-26T12:00:02Z LOG: connection received\n2026-10-26T12:00:03Z ERROR: duplicate key", ATTEMPTED_AT);
    expect(result.status).toBe("REJECTED");
  });

  it("verifies an ISO timestamp inside the window and rejects one outside it", () => {
    expect(verifyLogAttribution("2026-10-26T12:00:03.5Z ERROR: DONNA_SIGNUP_NOT_ALLOWED", ATTEMPTED_AT).status).toBe("VERIFIED");
    expect(verifyLogAttribution("2026-10-26 11:59:30+00 ERROR: DONNA_SIGNUP_NOT_ALLOWED", ATTEMPTED_AT).status).toBe("VERIFIED"); // 30 s before is tolerated
    expect(verifyLogAttribution("2026-10-26T12:02:30Z ERROR: DONNA_SIGNUP_NOT_ALLOWED", ATTEMPTED_AT).status).toBe("REJECTED"); // 150 s after: outside the window
  });

  it("the window is 60 s before to 120 s after the attempt", () => {
    const at = (offsetSeconds: number) => new Date(Date.parse(ATTEMPTED_AT) + offsetSeconds * 1000).toISOString();
    expect(verifyLogAttribution(`${at(-61)} DONNA_SIGNUP_NOT_ALLOWED`, ATTEMPTED_AT).status).toBe("REJECTED");
    expect(verifyLogAttribution(`${at(-59)} DONNA_SIGNUP_NOT_ALLOWED`, ATTEMPTED_AT).status).toBe("VERIFIED");
    expect(verifyLogAttribution(`${at(119)} DONNA_SIGNUP_NOT_ALLOWED`, ATTEMPTED_AT).status).toBe("VERIFIED");
    expect(verifyLogAttribution(`${at(121)} DONNA_SIGNUP_NOT_ALLOWED`, ATTEMPTED_AT).status).toBe("REJECTED");
  });

  it("reads epoch timestamps (microseconds and milliseconds), as a log export may carry", () => {
    const ms = Date.parse(ATTEMPTED_AT) + 2000;
    expect(verifyLogAttribution(`{"timestamp": ${ms * 1000}, "event_message": "ERROR: DONNA_SIGNUP_NOT_ALLOWED"}`, ATTEMPTED_AT).status).toBe("VERIFIED");
    expect(verifyLogAttribution(`{"timestamp": ${ms}, "event_message": "ERROR: DONNA_SIGNUP_NOT_ALLOWED"}`, ATTEMPTED_AT).status).toBe("VERIFIED");
  });

  it("rejects a marker line with no readable timestamp", () => {
    const result = verifyLogAttribution("ERROR: DONNA_SIGNUP_NOT_ALLOWED", ATTEMPTED_AT);
    expect(result.status).toBe("REJECTED");
  });

  it("does not let one line's marker borrow another line's timestamp", () => {
    const result = verifyLogAttribution("2026-10-26T12:00:03Z LOG: unrelated\nERROR: DONNA_SIGNUP_NOT_ALLOWED", ATTEMPTED_AT);
    expect(result.status).toBe("REJECTED");
  });
});
