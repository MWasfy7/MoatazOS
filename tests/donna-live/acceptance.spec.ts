/**
 * DON-02 acceptance against a REAL Supabase project (see playwright.donna-live.config.ts).
 *
 * Save an outcome, reload, then open a second authenticated browser context:
 * both show the same record. Retry and conflicting writes create no duplicate
 * outcomes. A different account cannot access the records. Sign-up is refused
 * by the server.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { DonnaStoreError, type DonnaRemote } from "@/lib/donna";
import { createSupabaseRemoteFromConfig } from "@/lib/donna/remote/supabaseStore";
import { CONTRACT_SCENARIOS } from "../helpers/donnaStoreContract";

const env = (name: string) => process.env[name] as string;
const CONFIG = { url: env("NEXT_PUBLIC_DONNA_SUPABASE_URL"), anonKey: env("NEXT_PUBLIC_DONNA_SUPABASE_ANON_KEY") };
const A = { email: env("DONNA_LIVE_USER_A_EMAIL"), password: env("DONNA_LIVE_USER_A_PASSWORD") };
const B = { email: env("DONNA_LIVE_USER_B_EMAIL"), password: env("DONNA_LIVE_USER_B_PASSWORD") };
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const UI_CALL = `live-${RUN}-ui`;
const NOTE = `Synthetic acceptance note ${RUN}`;

async function signedIn(user: { email: string; password: string }): Promise<DonnaRemote> {
  const remote = createSupabaseRemoteFromConfig(CONFIG);
  const code = await remote.auth.signInWithPassword(user.email, user.password);
  expect(code, `sign-in as ${user.email}`).toBeNull();
  return remote;
}

async function signInUi(page: Page, user: { email: string; password: string }) {
  await page.goto("/app-studio/donna");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("donna-sync-ready")).toContainText(user.email.toLowerCase());
}

test.describe.serial("DON-02 live acceptance (real database)", () => {
  let remoteA: DonnaRemote;
  let followUp: string;

  test.beforeAll(async () => {
    remoteA = await signedIn(A);
    followUp = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // A fresh, already-due synthetic call, so the UI shows exactly one new unresolved question.
    await remoteA.store.upsertCall({ id: UI_CALL, clientId: "cl-alpha", dueAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() });
  });

  for (const scenario of CONTRACT_SCENARIOS) {
    test(`database contract: ${scenario.name}`, async () => {
      await scenario.run({
        store: remoteA.store,
        now: () => new Date().toISOString(),
        newId: () => crypto.randomUUID(),
        callId: (tag) => `live-${RUN}-${tag}`,
      });
    });
  }

  test("save an outcome, reload, then a second authenticated browser context shows the same record", async ({ browser }) => {
    // Device 1
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await signInUi(page1, A);
    const card = page1.getByTestId(`donna-question-${UI_CALL}`);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Spoke" }).click();
    await card.getByLabel(/What happened/).fill(NOTE);
    await card.getByLabel(/Internal follow-up date/).check();
    await card.getByLabel("Follow-up date").fill(followUp);
    await card.getByRole("button", { name: "Save outcome" }).click();
    await expect(page1.getByTestId("donna-ack")).toContainText("confirmed by the database");
    const record1 = page1.getByTestId(`donna-record-${UI_CALL}`);
    await expect(record1).toContainText(NOTE);
    await expect(page1.getByTestId(`donna-next-${UI_CALL}`)).toContainText(`Internal follow-up (not agreed with the client): ${followUp}`);

    // Reload: the session and the record survive.
    await page1.reload();
    await expect(page1.getByTestId("donna-sync-ready")).toBeVisible();
    await expect(page1.getByTestId(`donna-record-${UI_CALL}`)).toContainText(NOTE);
    await expect(page1.getByTestId(`donna-question-${UI_CALL}`)).toHaveCount(0);

    // Device 2: a separate browser context (separate storage), same account.
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await signInUi(page2, A);
    await expect(page2.getByTestId(`donna-record-${UI_CALL}`)).toContainText(NOTE);
    await expect(page2.getByTestId(`donna-next-${UI_CALL}`)).toContainText(followUp);
    await expect(page2.getByTestId(`donna-question-${UI_CALL}`)).toHaveCount(0);

    // Exactly one outcome row, read straight from the database.
    const outcomes = (await remoteA.store.load()).events.filter((e) => e.type === "OUTCOME_RECORDED" && e.callId === UI_CALL);
    expect(outcomes).toHaveLength(1);
    await ctx1.close();
    await ctx2.close();
  });

  test("retry and conflicting writes create no duplicate outcome", async () => {
    const at = new Date(Date.now() - 60 * 1000).toISOString();
    const conflicting = { type: "OUTCOME_RECORDED" as const, callId: UI_CALL, at, outcome: "SPOKE" as const, originalInput: NOTE, nextAction: null };
    await expect(remoteA.store.appendEvent(crypto.randomUUID(), conflicting)).rejects.toMatchObject({ code: "ALREADY_RESOLVED" });
    await expect(
      remoteA.store.appendEvent(crypto.randomUUID(), { ...conflicting, outcome: "NO_ANSWER", originalInput: "" }),
    ).rejects.toMatchObject({ code: "ALREADY_RESOLVED" });
    const outcomes = (await remoteA.store.load()).events.filter((e) => e.type === "OUTCOME_RECORDED" && e.callId === UI_CALL);
    expect(outcomes).toHaveLength(1);
  });

  test("a different account cannot see or write against the records", async ({ browser }) => {
    const remoteB = await signedIn(B);
    const seenByB = await remoteB.store.load();
    expect(seenByB.calls.filter((c) => c.id.startsWith(`live-${RUN}`))).toHaveLength(0);
    expect(seenByB.events.filter((e) => e.callId.startsWith(`live-${RUN}`))).toHaveLength(0);
    await expect(
      remoteB.store.appendEvent(crypto.randomUUID(), { type: "QUESTION_DISMISSED", callId: UI_CALL, at: new Date(Date.now() - 1000).toISOString() }),
    ).rejects.toMatchObject({ code: "UNKNOWN_CALL" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInUi(page, B);
    await expect(page.getByTestId(`donna-record-${UI_CALL}`)).toHaveCount(0);
    await expect(page.getByTestId(`donna-question-${UI_CALL}`)).toHaveCount(0);
    await ctx.close();
  });

  test("a signed-out client cannot read or write", async () => {
    const anonymous = createSupabaseRemoteFromConfig(CONFIG);
    await expect(anonymous.store.load()).rejects.toBeInstanceOf(DonnaStoreError);
    await expect(
      anonymous.store.upsertCall({ id: `live-${RUN}-anon`, clientId: "cl-alpha", dueAt: new Date().toISOString() }),
    ).rejects.toBeInstanceOf(DonnaStoreError);
  });

  test("the server refuses sign-up for an address that is not on the allowlist", async () => {
    const client = createClient(CONFIG.url, CONFIG.anonKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signUp({ email: `stranger-${RUN}@example.test`, password: `Xy-${RUN}-pw-9!` });
    expect(error, "sign-up must be rejected by the server").not.toBeNull();
    expect(data.session).toBeNull();
  });
});
