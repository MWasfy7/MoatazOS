// @vitest-environment node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { AuthClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyAuthError,
  collectTriggerEvidence,
  createHttpAuth,
  decideTriggerEvidence,
  verifyLogAttribution,
  type Attribution,
} from "./helpers/donnaTriggerEvidence";

// MOCK SERVER: a local fake of the Auth endpoints. The response bodies are the shapes I EXPECT from
// Supabase Auth (GoTrue), written from memory, NOT observed from a real project. What this does prove:
// (1) the pinned supabase-js auth client HIDES the body of HTTP 500 responses, so the evidence must be
// read over raw HTTP, and (2) over raw HTTP those shapes are classified and decided correctly, with API
// observations and log attribution kept separate. Whether the real service sends these shapes is exactly
// what the hosted run must show.
//
// Node 20 note: `createClient()` also builds the realtime client, which needs a global WebSocket that
// Node 20 lacks. The auth client below is the SAME class createClient uses for `supabase.auth`
// (SupabaseAuthClient extends AuthClient) and needs no WebSocket, so this test runs on Node 20 and 22.
const CONTROL = { email: "control@example.test", password: "control-password-1" };
const UNLISTED = { email: "stranger@example.test", password: "stranger-password-1" };

type Reply = { status: number; body: unknown };
type Behaviour = { signup: (email: string) => Reply; token: (email: string) => Reply };

const session = (email: string): Reply => ({
  status: 200,
  body: { access_token: "t", token_type: "bearer", expires_in: 3600, refresh_token: "r", user: { id: `id-${email}`, email, aud: "authenticated" } },
});
const error = (status: number, error_code: string, msg: string): Reply => ({ status, body: { code: status, error_code, msg } });

const refuseUnlisted = (reply: Reply): Behaviour => ({
  signup: (email) => (email === CONTROL.email ? session(email) : reply),
  token: (email) => (email === CONTROL.email ? session(email) : error(400, "invalid_credentials", "Invalid login credentials")),
});
const GOOD = refuseUnlisted(error(500, "unexpected_failure", "Database error saving new user"));
const GENERIC_500 = refuseUnlisted(error(500, "unexpected_failure", "Internal server error"));

let server: Server | null = null;

async function start(behaviour: Behaviour): Promise<string> {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const email = (JSON.parse(raw || "{}") as { email?: string }).email ?? "";
      const reply = req.url?.startsWith("/auth/v1/signup") ? behaviour.signup(email) : behaviour.token(email);
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

const transport = (url: string) => createHttpAuth(url, "anon-key");
const collect = async (behaviour: Behaviour) => collectTriggerEvidence(transport(await start(behaviour)), CONTROL, UNLISTED);
const logsFor = (attemptedAt: string, marker = "DONNA_SIGNUP_NOT_ALLOWED"): Attribution =>
  verifyLogAttribution(`${new Date(Date.parse(attemptedAt) + 1500).toISOString()} ERROR: ${marker}`, attemptedAt);

describe("why the evidence is read over raw HTTP and not through the SDK", () => {
  it("the pinned supabase-js auth client hides the body of an HTTP 500: a database error is indistinguishable from an outage", async () => {
    const url = await start(GOOD);
    const client = new AuthClient({
      url: `${url}/auth/v1`,
      headers: { apikey: "anon-key", authorization: "Bearer anon-key" },
      autoRefreshToken: false,
      persistSession: false,
    });
    const { error: sdkError } = await client.signUp(UNLISTED);
    expect(sdkError?.status).toBe(500);
    expect(sdkError?.message).not.toMatch(/database error saving new user/i); // the body is gone
    expect((sdkError as { code?: string } | null)?.code).toBeUndefined();
    expect(classifyAuthError(sdkError as never)).not.toBe("DATABASE_REJECTION"); // so SDK errors can never count as trigger evidence
  });

  it("the raw response keeps the body, and classifies as a database rejection", async () => {
    const outcome = await transport(await start(GOOD)).signUp(UNLISTED);
    expect(outcome.error).toMatchObject({ status: 500, code: "unexpected_failure", message: "Database error saving new user" });
    expect(classifyAuthError(outcome.error)).toBe("DATABASE_REJECTION");
  });
});

describe("hosted trigger evidence over raw HTTP against a MOCK auth server", () => {
  it("API observations alone are INCONCLUSIVE, even when everything looks right", async () => {
    const evidence = await collect(GOOD);
    const decision = decideTriggerEvidence(evidence);
    expect(decision.api.observation).toBe("CONSISTENT");
    expect(decision.verdict).toBe("INCONCLUSIVE");
    expect(decision.reason).toContain("not attributed");
  });

  it("PASS only when a log line naming DONNA_SIGNUP_NOT_ALLOWED is verified inside the attempt window", async () => {
    const evidence = await collect(GOOD);
    const decision = decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt));
    expect(decision.verdict, decision.reason).toBe("PASS");
    // A log from some other failure does not attribute it.
    expect(decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt, "some unrelated error")).verdict).toBe("INCONCLUSIVE");
  });

  it("reviewer's reproduction, end to end: a generic 500 'Internal server error' never produces PASS", async () => {
    // Control signs up and signs in; the unlisted sign-up gets a generic 500; the unlisted sign-in is refused.
    const evidence = await collect(GENERIC_500);
    expect(evidence.control.userId).not.toBeNull();
    expect(evidence.control.signedInOk).toBe(true);
    expect(evidence.unlisted.signUpError).toMatchObject({ status: 500, code: "unexpected_failure", message: "Internal server error" });
    expect(classifyAuthError(evidence.unlisted.signUpError)).toBe("GENERIC_SERVER_ERROR");
    expect(evidence.unlistedSignIn.error).toMatchObject({ code: "invalid_credentials" });
    expect(decideTriggerEvidence(evidence).verdict).toBe("INCONCLUSIVE");
    // ... and logs that do not name the trigger do not change that.
    expect(decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt, "FATAL: out of memory")).verdict).toBe("INCONCLUSIVE");
  });

  it("INCONCLUSIVE, never PASS, when the unlisted sign-up is merely rate limited", async () => {
    const evidence = await collect(refuseUnlisted(error(429, "over_request_rate_limit", "Request rate limit reached")));
    const verdict = decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt));
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("RATE_LIMITED");
  });

  it("INCONCLUSIVE when the unlisted sign-up fails for an email-delivery reason (a 500 that is not the database)", async () => {
    const evidence = await collect(refuseUnlisted(error(500, "unexpected_failure", "Error sending confirmation email")));
    const verdict = decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt));
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("EMAIL_DELIVERY");
  });

  it("INCONCLUSIVE when the control is rate limited (nothing is shown about the unlisted refusal)", async () => {
    const evidence = await collect({
      ...GOOD,
      signup: (e) => (e === CONTROL.email ? error(429, "over_email_send_rate_limit", "email rate limit exceeded") : error(500, "unexpected_failure", "Database error saving new user")),
    });
    const verdict = decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt));
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("control sign-up");
  });

  it("INCONCLUSIVE when dashboard sign-up is still off (the platform refuses both)", async () => {
    const evidence = await collect({ ...GOOD, signup: () => error(422, "signup_disabled", "Signups not allowed for this instance") });
    const verdict = decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt));
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("PLATFORM_SIGNUP_DISABLED");
  });

  it("INCONCLUSIVE when the control user already exists", async () => {
    const evidence = await collect({
      ...GOOD,
      signup: (e) => (e === CONTROL.email ? error(422, "user_already_exists", "User already registered") : error(500, "unexpected_failure", "Database error saving new user")),
    });
    const verdict = decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt));
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("ALREADY_REGISTERED");
  });

  it("INCONCLUSIVE when the project cannot be reached at all", async () => {
    const url = await start(GOOD);
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
    const evidence = await collectTriggerEvidence(transport(url), CONTROL, UNLISTED);
    const verdict = decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt));
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("NETWORK");
  });

  it("FAIL when the unlisted address is accepted and can sign in, whatever the logs say", async () => {
    const evidence = await collect({ signup: (e) => session(e), token: (e) => session(e) });
    expect(decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt)).verdict).toBe("FAIL");
  });

  it("INCONCLUSIVE when no-account cannot be confirmed (sign-in is rate limited)", async () => {
    const evidence = await collect({ ...GOOD, token: (e) => (e === CONTROL.email ? session(e) : error(429, "over_request_rate_limit", "Request rate limit reached")) });
    expect(decideTriggerEvidence(evidence, logsFor(evidence.unlistedAttemptedAt)).verdict).toBe("INCONCLUSIVE");
  });
});
