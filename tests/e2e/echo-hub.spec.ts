import { expect, test } from "@playwright/test";

test("ECHO opens within MoatazOS and shows Donna and SalesOS context", async ({ page }) => {
  await page.goto("/app-studio/echo");
  await expect(page.getByRole("heading", { name: "ECHO" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Donna Today/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /SalesOS opportunities/ })).toBeVisible();
  await expect(page.getByText(/External models are not connected/)).toBeVisible();
});
