import { expect, test } from "@playwright/test";

test.describe("Mobile Arabic client follow-up", () => {
  test("opens from the Command Center and renders RTL Arabic on a phone viewport", async ({ page }) => {
    await page.goto("/app-studio/salesos");
    // The Command Center defaults to English; the mobile screen switches itself to Arabic on entry.
    await page.getByRole("link", { name: "Open mobile follow-up" }).click();
    await expect(page).toHaveURL(/salesos\/mobile$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "متابعة العملاء" })).toBeVisible();
    await expect(page.getByTestId("session-only-banner")).toContainText("يضيع لما تعمل تحديث");
    // no horizontal overflow on a phone
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("shows last contact and next step for every client", async ({ page }) => {
    await page.goto("/app-studio/salesos/mobile");
    const cards = page.locator("[data-client-card]");
    await expect(cards).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) {
      await expect(cards.nth(index).getByTestId("last-contact")).not.toBeEmpty();
      await expect(cards.nth(index).getByTestId("next-step")).not.toBeEmpty();
    }
  });

  test("records a call outcome into the in-memory session", async ({ page }) => {
    await page.goto("/app-studio/salesos/mobile");
    await page.locator("[data-client-card]").first().getByRole("button", { name: "تسجيل" }).click();
    await expect(page.getByTestId("record-sheet")).toBeVisible();
    await page.getByLabel("إيه اللي حصل؟").selectOption("CLIENT_CALLED");
    await page.getByLabel("ملاحظة (اختياري)").fill("اتصلت وطلب يشوف الخيارات");
    await page.getByRole("button", { name: "حفظ في الجلسة" }).click();
    await expect(page.getByTestId("save-confirm")).toContainText("تم التسجيل في هذه الجلسة");
  });

  test("parses a pasted WhatsApp conversation locally and never exposes send controls", async ({ page }) => {
    await page.goto("/app-studio/salesos/mobile");
    await page.locator("[data-client-card]").first().getByRole("button", { name: "تسجيل" }).click();
    await page.getByRole("button", { name: "لصق محادثة" }).click();
    await page.getByLabel("اسم العميل كما يظهر في المحادثة").fill("Buyer Synth");
    await page.getByLabel("اسمك كما يظهر في المحادثة").fill("Rep Synth");
    await page.getByLabel("الصق محادثة الواتساب").fill("[24/08/2026, 10:20:00] - Buyer Synth: ابعتلي الخيارات\n[24/08/2026, 10:23:00] - Rep Synth: حاضر");
    await page.getByRole("button", { name: "فحص المحادثة" }).click();
    await expect(page.getByTestId("paste-result")).toHaveAttribute("data-import-status", "ACCEPTED");
    await expect(page.getByRole("button", { name: /إرسال|ابعت|اتصل|whatsapp|send/i })).toHaveCount(0);
  });

  test("captures phone screenshots", async ({ page }, testInfo) => {
    await page.goto("/app-studio/salesos/mobile");
    await page.screenshot({ path: testInfo.outputPath("mobile-ar-list.png"), fullPage: true });
    await page.locator("[data-client-card]").first().getByRole("button", { name: "تسجيل" }).click();
    await page.screenshot({ path: testInfo.outputPath("mobile-ar-record.png"), fullPage: true });
  });
});

test("record sheet is pinned to the bottom of the real viewport", async ({ page }, testInfo) => {
  await page.goto("/app-studio/salesos/mobile");
  await page.locator("[data-client-card]").first().getByRole("button", { name: "تسجيل" }).click();
  const sheet = page.getByTestId("record-sheet");
  const box = (await sheet.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.round(box.height)).toBeLessThanOrEqual(vp.height + 1);
  await page.screenshot({ path: testInfo.outputPath("mobile-ar-sheet-viewport.png") });
});
