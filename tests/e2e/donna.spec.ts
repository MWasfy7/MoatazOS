import { expect, test } from "@playwright/test";

test.describe("Donna client-outcome recovery (synthetic slice)", () => {
  test("shows unresolved questions as soon as the app opens", async ({ page }) => {
    await page.goto("/app-studio/salesos");
    await expect(page.getByTestId("donna-banner")).toContainText(/Unresolved client questions: 2|أسئلة عملاء بلا إجابة: 2/);
    await page.getByRole("link", { name: /Review questions|مراجعة الأسئلة/ }).click();
    await expect(page).toHaveURL(/app-studio\/donna$/);
    await expect(page.getByTestId("donna-question-call-alpha")).toBeVisible();
    await expect(page.getByTestId("donna-question-call-beta")).toBeVisible();
  });

  test("ignoring the question never completes it; recording an outcome does, with the right next-action type", async ({ page }, testInfo) => {
    await page.goto("/app-studio/donna");
    if (testInfo.project.name === "mobile-arabic") {
      await page.getByRole("button", { name: "العربية" }).click();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByText("هل تحدثت مع هذا العميل؟").first()).toBeVisible();
      await expect(page.getByTestId("donna-demo-status")).toContainText("غير منفّذة");
      await page.getByRole("button", { name: "إخفاء التنبيه" }).click();
      await expect(page.getByTestId("donna-unresolved-count")).toHaveText("(2)");
      const alpha = page.getByTestId("donna-question-call-alpha");
      await alpha.getByRole("button", { name: "تحدثت" }).click();
      await alpha.getByLabel(/تاريخ متابعة داخلي/).check();
      await alpha.getByLabel("تاريخ المتابعة").fill("2026-10-29");
      await alpha.getByRole("button", { name: "حفظ النتيجة" }).click();
      await expect(page.getByTestId("donna-next-call-alpha")).toContainText("متابعة داخلية (لم يوافق عليها العميل)");
      await page.screenshot({ path: testInfo.outputPath("donna-mobile-arabic.png"), fullPage: true });
      return;
    }

    await page.getByRole("button", { name: "Dismiss banner" }).click();
    await expect(page.getByTestId("donna-unresolved-count")).toHaveText("(2)");
    await page.getByRole("button", { name: "+1 day" }).click();
    await expect(page.getByTestId("donna-unresolved-count")).toHaveText("(4)");

    const alpha = page.getByTestId("donna-question-call-alpha");
    await alpha.getByRole("button", { name: "Spoke" }).click();
    await alpha.getByLabel(/What happened/).fill("Synthetic note: wants a revised offer");
    await alpha.getByLabel(/Client-confirmed appointment \(/).check();
    await alpha.getByLabel("Appointment date and time").fill("2026-10-30T11:00");
    await alpha.getByRole("button", { name: "Save outcome" }).click();
    await expect(alpha.getByRole("alert")).toContainText("Tick the box only if the client explicitly agreed");
    await alpha.getByLabel("The client explicitly confirmed this time").check();
    await alpha.getByRole("button", { name: "Save outcome" }).click();
    await expect(page.getByTestId("donna-next-call-alpha")).toContainText("Client-confirmed appointment: 2026-10-30 11:00");
    await expect(page.getByTestId("donna-unresolved-count")).toHaveText("(3)");

    const beta = page.getByTestId("donna-question-call-beta");
    await beta.getByRole("button", { name: "Snooze" }).click();
    await beta.getByRole("button", { name: "1 hour" }).click();
    await expect(page.getByTestId("donna-reminder-call-beta")).toContainText("Snoozed until");
    await expect(page.getByTestId("donna-unresolved-count")).toHaveText("(3)");
    await page.screenshot({ path: testInfo.outputPath("donna-desktop.png"), fullPage: true });
  });

  test("offers no execution control and labels later work as not implemented", async ({ page }) => {
    await page.goto("/app-studio/donna");
    await expect(page.getByRole("button", { name: /^(send|call|dial|schedule|book|text|whatsapp|email|message)\b/i })).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')).toHaveCount(0);
    await expect(page.getByTestId("donna-demo-status")).toContainText(/not implemented|غير منفّذة/);
  });
});
