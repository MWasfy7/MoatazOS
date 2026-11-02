import { expect, test } from "@playwright/test";

// DON-03: the review panel reads the operator's own note. Typed text stands in for dictation.
test.describe("Donna voice review panel (synthetic)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto("/app-studio/donna");
    if (testInfo.project.name === "mobile-arabic") {
      await page.getByRole("button", { name: "العربية" }).click();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    }
  });

  const labels = (project: string) =>
    project === "mobile-arabic"
      ? { spoke: "تحدثت", next: "التالي", useDate: "استخدم هذا التاريخ", stop: /عدم التواصل/ }
      : { spoke: "Spoke", next: "Next", useDate: "Use this date", stop: /not to be contacted/ };

  test("do-not-contact in the note shows a stop alert and offers no date", async ({ page }, testInfo) => {
    const t = labels(testInfo.project.name);
    const alpha = page.getByTestId("donna-question-call-alpha");
    await alpha.getByRole("button", { name: t.spoke }).click();
    await alpha.getByRole("textbox").first().fill("قالي مش عايز، بلاش تتصل بيا 2026-11-05");
    const panel = alpha.getByTestId("donna-voice-review");
    await expect(panel).toHaveAttribute("data-decision", "NO_ACTION");
    await expect(panel.getByRole("alert")).toContainText(t.stop);
    await expect(panel.getByRole("button", { name: t.useDate })).toHaveCount(0);
  });

  test("a follow-up date can be used as an internal reminder and still needs the operator to save", async ({ page }, testInfo) => {
    const t = labels(testInfo.project.name);
    const alpha = page.getByTestId("donna-question-call-alpha");
    await alpha.getByRole("button", { name: t.spoke }).click();
    await alpha.getByRole("textbox").first().fill("spoke, follow up 2026-11-05");
    const panel = alpha.getByTestId("donna-voice-review");
    await expect(panel).toHaveAttribute("data-decision", "PROPOSE_INTERNAL_FOLLOW_UP");
    await panel.getByRole("button", { name: t.useDate }).click();
    // Nothing was saved by pressing the button: the question is still open.
    await expect(page.getByTestId("donna-toast")).toHaveCount(0);
    await alpha.getByRole("button", { name: t.next, exact: true }).click();
    await alpha.getByRole("button", { name: t.next, exact: true }).click();
    await expect(alpha.locator('input[type="date"]')).toHaveValue("2026-11-05");
    await expect(alpha.locator('input[type="datetime-local"]')).toHaveCount(0);
  });
});
