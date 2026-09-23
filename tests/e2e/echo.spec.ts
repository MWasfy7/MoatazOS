import { expect, test } from "@playwright/test";

test.describe("ECHO Build 0 local conversation", () => {
  test("withholds a negated request and preserves focus after a greeting", async ({ page }) => {
    await page.goto("/echo");
    await expect(page.locator("main[data-runtime-ready='true']")).toBeVisible();
    const input = page.getByLabel("Message ECHO");
    for (const text of ["the ECHO runtime", "morning", "don't change that file", "continue"]) {
      await input.fill(text);
      await page.getByRole("button", { name: "Send" }).click();
      await expect(input).toHaveValue("");
    }
    await expect(page.getByText("Understood. I won’t proceed with that request. Nothing external has run.")).toBeVisible();
    await expect(page.getByText(/Picking up the ECHO runtime/)).toBeVisible();
    await expect(page.getByText(/I resolved this as a request to change/)).toHaveCount(0);
  });
  test("keeps context across natural mixed-language turns", async ({ page }) => {
    await page.goto("/echo");
    await expect(page.getByRole("heading", { name: "ECHO" })).toBeVisible();
    await expect(page.locator("main[data-runtime-ready='true']")).toBeVisible();
    const input = page.getByLabel("Message ECHO");
    await input.fill("the cognitive runtime");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/current focus for this session/)).toBeVisible();
    await expect(input).toHaveValue("");
    await input.fill("yalla kammel");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/Picking up the cognitive runtime/)).toBeVisible();
    await expect(page.getByText(/triggered any external action/i)).toBeVisible();
  });
});
