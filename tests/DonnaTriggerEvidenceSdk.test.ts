// @vitest-environment node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { classifyAuthError, collectTriggerEvidence, createHttpAuth, decideTriggerEvidence } from "./helpers/donnaTriggerEvidence";

// MOCK SERVER: a local fake of the Auth endpoints. The response bodies are the shapes I EXPECT from
// Supabase Auth (GoTrue), written from memory, NOT observed from a real project. What this does prove:
// (1) the pinned supabase-js SDK HIDES the body of HTTP 500 responses, so the evidence must be read over
// raw HTTP, and (2) over raw HTTP those shapes are classified and decided correctly. Whether the real
// service sends these shapes is exactly what the hosted run must show.
const CONTROL = { email: "control@example.test", password: "control-password-1" };
const UNLISTED = { email: "stranger@example.test", password: "stranger-password-1" };

type Reply = { status: number; body: unknown };
type Behaviour = { signup: (email: string) => Reply; token: (email: string) => Reply };

const session = (email: string): Reply => ({
  status: 200,
  body: { access_token: "t", token_type: "bearer", expires_in: 3600, refresh_token: "r", user: { id: `id-${email}`, email, aud: "authenticated" } },
});
const error = (status: number, error_code: string, msg: string): Reply => ({ status, body: { code: status, error_code, msg } });

const GOOD: Behaviour = {
  signup: (email) => (email === CONTROL.email ? session(email) : error(500, "unexpected_failure", "Database error saving new user")),
  token: (email) => (email === CONTROL.email ? session(email) : error(400, "invalid_credentials", "Invalid login credentials")),
};

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
const run = async (behaviour: Behaviour) => decideTriggerEvidence(await collectTriggerEvidence(transport(await start(behaviour)), CONTROL, UNLISTED));

describe("why the evidence is read over raw HTTP and not through the SDK", () => {
  it("pinned supabase-js hides the body of an HTTP 500: a database error is indistinguishable from an outage", async () => {
    const url = await start(GOOD);
    const client = createClient(url, "anon-key", { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signUp(UNLISTED);
    expect(error?.status).toBe(500);
    expect(error?.message).not.toMatch(/database error saving new user/i); // the body is gone
    expect((error as { code?: string } | null)?.code).toBeUndefined();
    expect(classifyAuthError(error as never)).not.toBe("DATABASE_REJECTION"); // so SDK errors can never count as trigger evidence
  });

  it("the raw response keeps the body, and classifies as a database rejection", async () => {
    const outcome = await transport(await start(GOOD)).signUp(UNLISTED);
    expect(outcome.error).toMatchObject({ status: 500, code: "unexpected_failure", message: "Database error saving new user" });
    expect(classifyAuthError(outcome.error)).toBe("DATABASE_REJECTION");
  });
});

describe("hosted trigger evidence over raw HTTP against a MOCK auth server", () => {
  it("PASS: control succeeds, unlisted gets a database-class 500, no account exists", async () => {
    const verdict = await run(GOOD);
    expect(verdict.verdict, verdict.reason).toBe("PASS");
  });

  it("INCONCLUSIVE, never PASS, when the unlisted sign-up is merely rate limited", async () => {
    const verdict = await run({ ...GOOD, signup: (e) => (e === CONTROL.email ? session(e) : error(429, "over_request_rate_limit", "Request rate limit reached")) });
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("RATE_LIMITED");
  });

  it("INCONCLUSIVE when the unlisted sign-up fails for an email-delivery reason (500 that is not the database)", async () => {
    const verdict = await run({ ...GOOD, signup: (e) => (e === CONTROL.email ? session(e) : error(500, "unexpected_failure", "Error sending confirmation email")) });
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("EMAIL_DELIVERY");
  });

  it("INCONCLUSIVE when the control is rate limited (nothing is shown about the unlisted refusal)", async () => {
    const verdict = await run({ ...GOOD, signup: (e) => (e === CONTROL.email ? error(429, "over_email_send_rate_limit", "email rate limit exceeded") : error(500, "unexpected_failure", "Database error saving new user")) });
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("control sign-up");
  });

  it("INCONCLUSIVE when dashboard sign-up is still off (the platform refuses both)", async () => {
    const verdict = await run({ ...GOOD, signup: () => error(422, "signup_disabled", "Signups not allowed for this instance") });
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("PLATFORM_SIGNUP_DISABLED");
  });

  it("INCONCLUSIVE when the control user already exists", async () => {
    const verdict = await run({ ...GOOD, signup: (e) => (e === CONTROL.email ? error(422, "user_already_exists", "User already registered") : error(500, "unexpected_failure", "Database error saving new user")) });
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("ALREADY_REGISTERED");
  });

  it("INCONCLUSIVE when the project cannot be reached at all", async () => {
    const url = await start(GOOD);
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
    const verdict = decideTriggerEvidence(await collectTriggerEvidence(transport(url), CONTROL, UNLISTED));
    expect(verdict.verdict).toBe("INCONCLUSIVE");
    expect(verdict.reason).toContain("NETWORK");
  });

  it("FAIL when the unlisted address is accepted and can sign in", async () => {
    const verdict = await run({ signup: (e) => session(e), token: (e) => session(e) });
    expect(verdict.verdict).toBe("FAIL");
  });

  it("INCONCLUSIVE when no-account cannot be confirmed (sign-in is rate limited)", async () => {
    const verdict = await run({ ...GOOD, token: (e) => (e === CONTROL.email ? session(e) : error(429, "over_request_rate_limit", "Request rate limit reached")) });
    expect(verdict.verdict).toBe("INCONCLUSIVE");
  });
});
