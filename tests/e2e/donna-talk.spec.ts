import { expect, test } from "@playwright/test";

test.describe("Talk to Donna (synthetic)", () => {
  test("she calls, speaks first, stops a chase, files a debrief, and fits the phone", async ({ page }, testInfo) => {
    const arabic = testInfo.project.name === "mobile-arabic";
    await page.goto("/app-studio/donna");
    await page.getByTestId("donna-talk-open").click();
    await expect(page).toHaveURL(/\/app-studio\/donna\/talk$/);

    const incoming = page.getByTestId("donna-talk-incoming");
    await expect(incoming).toBeVisible();
    if (arabic) {
      await page.getByTestId("donna-talk-lang-ar").click();
      await expect(incoming).toHaveAttribute("dir", "rtl");
    }
    await page.screenshot({ path: testInfo.outputPath(`donna-talk-incoming-${testInfo.project.name}.png`) });
    await page.getByTestId("donna-talk-answer").click();

    const her = page.locator('[data-testid="donna-talk-entry"][data-who="donna"]');
    await expect(her.first()).toContainText(arabic ? "بطّل تبعت" : "Stop messaging Beta");
    await expect(page.getByTestId("donna-radar-dot")).toHaveCount(5);

    const input = page.getByTestId("donna-talk-input");
    await input.fill(arabic ? "هكلم بيتا" : "I'm about to call Beta");
    await input.press("Enter");
    await expect(her.last()).toHaveAttribute("data-mood", "STOP");

    await input.fill(
      arabic
        ? "لسه خالص مع جاما، ميزانيتها ٥ مليون كاش ووعدتها ابعتلها الماستر بلان بكره"
        : "Just finished with Gamma. Budget is 5 million, cash. I promised to send the floor plans tomorrow.",
    );
    await input.press("Enter");
    await expect(her.last().getByTestId("donna-talk-proposal")).toBeVisible();
    await her.last().getByTestId("donna-talk-file").click();
    await expect(her.last()).toContainText(arabic ? "اتسجّل" : "Filed");

    const talk = page.getByTestId("donna-talk");
    await expect(talk.getByRole("button", { name: /^(send|call|dial|schedule|book|whatsapp|message)\b/i })).toHaveCount(0);
    await expect(talk.locator('a[href^="tel:"], a[href*="wa.me"], a[href^="mailto:"]')).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`donna-talk-live-${testInfo.project.name}.png`) });
  });
});
