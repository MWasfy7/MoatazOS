import { expect, test } from "@playwright/test";

test("SalesOS handoff keeps restraint and council remains usable", async ({ page }) => {
  await page.goto("/app-studio/salesos/opportunity/opp-farah");
  await page.getByRole("link", { name: /Donna Council/ }).click();
  await page.waitForURL("**/app-studio/donna/council/opp-farah");
  await expect(page.getByTestId("council-sales-gate")).toContainText("NO_ACTION");
  await expect(page.getByRole("button", { name: "Copy approved draft" })).toHaveCount(0);
});

test("standalone council opens for a synthetic case", async ({ page }) => {
  await page.goto("/app-studio/donna/council");
  await expect(page.getByTestId("donna-council")).toBeVisible();
  await expect(page.getByText("Independent responses")).toBeVisible();
});
