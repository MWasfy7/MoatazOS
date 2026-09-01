import { expect, test } from "@playwright/test";

test.describe("S3 Lead Loss Report v0", () => {
  test("opens from Command Center with exact semantic metrics", async ({ page }) => {
    await page.goto("/app-studio/salesos");
    await page.getByRole("link", { name: "Open Lead Loss Report" }).click();
    await expect(page).toHaveURL(/salesos\/lead-loss-report$/);
    await expect(page.getByTestId("metric-leads-received")).toContainText("8 / 9");
    await expect(page.getByTestId("metric-first-response")).toContainText("240 / 6");
    await expect(page.getByTestId("metric-restraint-respected")).toContainText("1 / 2");
    await expect(page.getByRole("button", { name: /send|call|schedule|write|override|assign|contact/i })).toHaveCount(0);
  });

  test("drills into the existing contradictory Decision Card evidence", async ({ page }) => {
    await page.goto("/app-studio/salesos/lead-loss-report");
    const contradictory = page.getByTestId("lead-report-row").filter({ hasText: "L. Fahmy" });
    await contradictory.getByRole("link", { name: "Open Decision Card evidence" }).click();
    await expect(page).toHaveURL(/salesos\/opportunity\/opp-layla$/);
    await expect(page.getByTestId("decision-card")).toBeVisible();
    await expect(page.getByText("Validated evidence conflicts; no single conclusion is currently supported.").first()).toBeVisible();
  });

  test("captures the commercial report on desktop and Arabic mobile", async ({ page }, testInfo) => {
    await page.goto("/app-studio/salesos/lead-loss-report");
    if (testInfo.project.name === "desktop-chromium") {
      await page.screenshot({ path: testInfo.outputPath("s3-desktop-lead-loss-report.png"), fullPage: true });
      return;
    }

    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "تقرير فقدان العملاء المحتملين v0" })).toBeVisible();
    await expect(page.getByText("غياب دليل الإسناد فجوة في الأدلة ولا يثبت خطأ المندوب.")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("s3-mobile-arabic-lead-loss-report.png"), fullPage: true });
  });
});
