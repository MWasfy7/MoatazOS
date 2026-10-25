import { describe, expect, it } from "vitest";
import {
  classifyAuthError,
  decideTriggerEvidence,
  type AuthErrorLike,
  type TriggerEvidenceInput,
} from "./helpers/donnaTriggerEvidence";

// Pure tests of the evidence rules used by the hosted trigger test. They run locally and
// prove the RULES, not the hosted project.

const RATE: AuthErrorLike = { status: 429, code: "over_request_rate_limit", message: "Request rate limit reached" };
const EMAIL_RATE: AuthErrorLike = { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" };
const NET: AuthErrorLike = { status: 0, name: "AuthRetryableFetchError", message: "Failed to fetch" };
const DISABLED: AuthErrorLike = { status: 422, code: "signup_disabled", message: "Signups not allowed for this instance" };
const DB: AuthErrorLike = { status: 500, code: "unexpected_failure", message: "Database error saving new user" };
const MAIL: AuthErrorLike = { status: 500, code: "unexpected_failure", message: "Error sending confirmation email" };
const WEAK: AuthErrorLike = { status: 422, code: "weak_password", message: "Password should be at least 12 characters" };
const BADMAIL: AuthErrorLike = { status: 400, code: "email_address_invalid", message: "Email address is invalid" };
const EXISTS: AuthErrorLike = { status: 422, code: "user_already_exists", message: "User already registered" };
const BADLOGIN: AuthErrorLike = { status: 400, code: "invalid_credentials", message: "Invalid login credentials" };
const UNCONFIRMED: AuthErrorLike = { status: 400, code: "email_not_confirmed", message: "Email not confirmed" };

// What the previous version of the live test accepted as proof: any non-null error.
const legacyAccepts = (error: AuthErrorLike | null) => error !== null;

const GOOD: TriggerEvidenceInput = {
  control: { signUpError: null, userId: "uuid-control", signInError: null, signedInOk: true },
  unlisted: { signUpError: DB, userId: null },
  unlistedSignIn: { error: BADLOGIN, signedInOk: false },
};
const withUnlisted = (signUpError: AuthErrorLike | null, userId: string | null = null): TriggerEvidenceInput => ({
  ...GOOD,
  unlisted: { signUpError, userId },
});

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

  it("does not mistake an email-delivery 500 for a database rejection", () => {
    expect(classifyAuthError(MAIL)).not.toBe("DATABASE_REJECTION");
  });
});

describe("Donna hosted trigger evidence: what counts as proof", () => {
  it("the old rule (any error) wrongly accepted unrelated failures; the new rule does not", () => {
    for (const unrelated of [RATE, EMAIL_RATE, NET, DISABLED, MAIL, WEAK, BADMAIL, EXISTS]) {
      expect(legacyAccepts(unrelated), `legacy accepted ${unrelated.code ?? unrelated.message}`).toBe(true);
      const decision = decideTriggerEvidence(withUnlisted(unrelated));
      expect(decision.verdict, `${unrelated.code ?? unrelated.message}: ${decision.reason}`).not.toBe("PASS");
      expect(decision.verdict).toBe("INCONCLUSIVE");
    }
  });

  it("passes only with an allowed control that works, a database-class refusal, and no resulting account", () => {
    const decision = decideTriggerEvidence(GOOD);
    expect(decision.verdict).toBe("PASS");
    expect(decision.reason).toContain("DONNA_SIGNUP_NOT_ALLOWED"); // the cause is confirmed in the Postgres logs
  });

  it("is not a pass when the allow-listed control cannot be created (any reason)", () => {
    for (const controlError of [RATE, NET, DISABLED, MAIL, EXISTS, DB, WEAK]) {
      const decision = decideTriggerEvidence({ ...GOOD, control: { signUpError: controlError, userId: null, signInError: null, signedInOk: false } });
      expect(decision.verdict, controlError.code ?? controlError.message ?? "").toBe("INCONCLUSIVE");
    }
    expect(decideTriggerEvidence({ ...GOOD, control: { signUpError: null, userId: null, signInError: null, signedInOk: false } }).verdict).toBe("INCONCLUSIVE");
  });

  it("is not a pass when the control was created but cannot sign in", () => {
    const decision = decideTriggerEvidence({ ...GOOD, control: { signUpError: null, userId: "u", signInError: UNCONFIRMED, signedInOk: false } });
    expect(decision.verdict).toBe("INCONCLUSIVE");
    expect(decision.reason).toContain("Confirm email");
    expect(decideTriggerEvidence({ ...GOOD, control: { signUpError: null, userId: "u", signInError: RATE, signedInOk: false } }).verdict).toBe("INCONCLUSIVE");
  });

  it("FAILS when the unlisted address was accepted (the trigger did not stop it)", () => {
    expect(decideTriggerEvidence(withUnlisted(null, "uuid-stranger")).verdict).toBe("FAIL");
    expect(decideTriggerEvidence(withUnlisted(null, null)).verdict).toBe("FAIL");
    expect(decideTriggerEvidence(withUnlisted(DB, "uuid-stranger")).verdict).toBe("FAIL");
  });

  it("requires proof that no account exists for the unlisted address", () => {
    const base = withUnlisted(DB);
    expect(decideTriggerEvidence({ ...base, unlistedSignIn: { error: null, signedInOk: true } }).verdict).toBe("FAIL");
    expect(decideTriggerEvidence({ ...base, unlistedSignIn: { error: RATE, signedInOk: false } }).verdict).toBe("INCONCLUSIVE");
    expect(decideTriggerEvidence({ ...base, unlistedSignIn: { error: NET, signedInOk: false } }).verdict).toBe("INCONCLUSIVE");
    expect(decideTriggerEvidence({ ...base, unlistedSignIn: { error: UNCONFIRMED, signedInOk: false } }).verdict).toBe("INCONCLUSIVE");
  });
});
