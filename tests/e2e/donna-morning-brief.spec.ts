import { expect, test } from "@playwright/test";

test.describe("Donna morning brief (synthetic)", () => {
  test("Donna talks first: restraint leads, and the screen fits the phone", async ({ page }, testInfo) => {
    const arabic = testInfo.project.name === "mobile-arabic";
    await page.goto("/app-studio/donna");
    if (arabic) {
      await page.getByRole("button", { name: "العربية" }).click();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    }
    const brief = page.getByTestId("donna-morning-brief");
    await expect(brief.getByTestId("donna-brief-greeting")).toContainText(arabic ? "صباح الخير" : "Good morning");
    const lines = brief.getByTestId("donna-brief-line");
    await expect(lines.first()).toHaveAttribute("data-kind", "HOLD_OFF");
    await expect(lines.nth(1)).toHaveAttribute("data-kind", "HOLD_OFF");
    await expect(brief.getByRole("button", { name: /^(send|call|dial|schedule|book|whatsapp|message)\b/i })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await brief.screenshot({ path: testInfo.outputPath(`donna-brief-${testInfo.project.name}.png`) });
  });

  test("installs to the home screen: manifest opens Donna full-screen", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest).toMatchObject({ short_name: "Donna", start_url: "/app-studio/donna", display: "standalone" });
    for (const icon of manifest.icons as Array<{ src: string }>) expect((await request.get(icon.src)).ok()).toBe(true);
  });
});
