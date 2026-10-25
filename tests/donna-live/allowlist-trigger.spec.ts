/**
 * DON-02: prove the DATABASE allowlist trigger through the Auth API, independently of the
 * dashboard sign-up switch. Run only in the dedicated SYNTHETIC test project, and only while
 * "Allow new users to sign up" is TEMPORARILY ON (docs/engineering/DON-02-SETUP.md §9).
 *
 *   DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED=yes npm run test:donna-live-trigger
 *
 * With the switch ON, an unlisted address can only be refused by the trigger. If the switch is
 * still OFF the refusal is the platform's own `signup_disabled`, which proves nothing about the
 * trigger, so this test FAILS (it never skips and never passes on that evidence).
 * The SQL probe (supabase/tests/hosted_probe.sql) exercises the trigger directly and is required either way.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test("with dashboard sign-up ON, the database trigger alone refuses an unlisted address", async () => {
  expect(
    process.env.DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED,
    "BLOCKED: set DONNA_LIVE_SIGNUP_TEMPORARILY_ENABLED=yes only after turning dashboard sign-up ON in the synthetic test project (DON-02-SETUP.md section 9), and turn it OFF again afterwards",
  ).toBe("yes");

  const client = createClient(process.env.NEXT_PUBLIC_DONNA_SUPABASE_URL as string, process.env.NEXT_PUBLIC_DONNA_SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false },
  });
  const credentials = { email: `stranger-${RUN}@example.test`, password: `Xy-${RUN}-pw-9!` };
  const { data, error } = await client.auth.signUp(credentials);

  expect(error, "sign-up must be refused").not.toBeNull();
  expect(data.session).toBeNull();
  // The platform's own refusal when the switch is OFF. Seeing it means this run proved nothing about the trigger.
  expect(error?.code, "dashboard sign-up is still OFF: this run does not exercise the trigger").not.toBe("signup_disabled");
  expect(error?.message ?? "", "dashboard sign-up is still OFF: this run does not exercise the trigger").not.toMatch(/signups? not allowed/i);

  // And no account was created behind the error.
  const attempt = await client.auth.signInWithPassword(credentials);
  expect(attempt.error, "no account may exist for the refused address").not.toBeNull();
  test.info().annotations.push({ type: "observed refusal", description: `${error?.status ?? "?"} ${error?.code ?? "?"}: ${error?.message ?? ""}` });
});
