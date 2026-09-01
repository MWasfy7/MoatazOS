import { expect, test } from "@playwright/test";

test.describe("S2 deterministic Decision Engine v0", () => {
  test("opens from Command Center with a bounded immutable decision", async ({ page }) => {
    await page.goto("/app-studio/salesos");
    await page.getByRole("link", { name: "Open Decision Engine v0" }).click();
    await expect(page).toHaveURL(/salesos\/decision-engine$/);
    await expect(page.getByTestId("deterministic-decision")).toHaveAttribute("data-decision-state", "NO_ACTION");
    await expect(page.getByRole("button", { name: /send|call|schedule|write|override/i })).toHaveCount(0);
  });

  test("creates new lineage after buyer reengagement and preserves chasing", async ({ page }) => {
    await page.goto("/app-studio/salesos/decision-engine");
    await page.getByRole("button", { name: "Reengagement after chasing" }).click();
    await expect(page.getByTestId("deterministic-decision")).toHaveAttribute("data-decision-state", "NEXT_STEP_READY");
    await expect(page.getByTestId("decision-lineage").locator("li")).toHaveCount(2);
    await expect(page.getByText("Chasing after explicit pause")).toBeVisible();
    await expect(page.getByText(/later decision does not erase it/i)).toBeVisible();
  });

  test("captures deterministic evidence review in desktop and Arabic mobile", async ({ page }, testInfo) => {
    await page.goto("/app-studio/salesos/decision-engine");
    if (testInfo.project.name === "desktop-chromium") {
      await page.getByRole("button", { name: "Reengagement after chasing" }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("s2-desktop-decision-engine-lineage.png"), fullPage: true });
      return;
    }

    await page.getByRole("button", { name: "العربية" }).click();
    await page.getByRole("button", { name: "طلب بالعربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("يدعم طلب منسوب إلى المشتري مراجعة فئة محدودة للخطوة التالية.")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("s2-mobile-arabic-decision-engine.png"), fullPage: true });
  });
});
