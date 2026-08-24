import { test, expect } from "@playwright/test";

/**
 * End-to-end smoke test covering the sprint's own "Definition of
 * Done" click-through path: open the app, enter SalesOS, select an
 * opportunity, switch between decision states, inspect evidence, and
 * switch to Arabic mobile mode.
 */
test.describe("SalesOS Command Center click-through", () => {
  test("opens SalesOS and shows the opportunity list", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/app-studio\/salesos/);
    await expect(page.getByRole("heading", { name: /Command Center/i })).toBeVisible();
  });

  test("selects an opportunity and sees its Decision Card", async ({ page }) => {
    await page.goto("/app-studio/salesos");
    await page.getByRole("link", { name: /A\. Hassan/i }).click();
    await expect(page.getByTestId("decision-card")).toBeVisible();
  });

  test("switches between all four decision-state fixtures", async ({ page }) => {
    const cases: Array<[string, string]> = [
      ["F. Al-Sayed", "NO_ACTION"],
      ["A. Hassan", "NEXT_STEP_READY"],
      ["O. Zaki", "INSUFFICIENT_EVIDENCE"],
      ["L. Fahmy", "CONTRADICTORY_EVIDENCE"],
    ];
    for (const [name, state] of cases) {
      await page.goto("/app-studio/salesos");
      await page.getByRole("link", { name: new RegExp(name.replace(".", "\\.")) }).click();
      await expect(page.locator(`[data-decision-state="${state}"]`).first()).toBeVisible();
    }
  });

  test("inspects evidence via the inspection rail", async ({ page }) => {
    await page.goto("/app-studio/salesos/opportunity/opp-layla");
    await page.locator('[data-inspection-item="evidence"]').click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("sees a new-snapshot notice and can explicitly compare", async ({ page }) => {
    await page.goto("/app-studio/salesos/opportunity/opp-karim");
    await expect(page.getByText(/newer snapshot/i)).toBeVisible();
    await page.getByRole("button", { name: /compare/i }).click();
    await expect(page.getByTestId("snapshot-comparison")).toBeVisible();
  });

  test("switches to Arabic and sees RTL layout", async ({ page }) => {
    await page.goto("/app-studio/salesos");
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test.describe("Mobile Arabic", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Arabic mobile fixture renders correctly", async ({ page }) => {
    await page.goto("/app-studio/salesos");
    await page.getByRole("button", { name: "العربية" }).click();
    await page.goto("/app-studio/salesos/opportunity/opp-mahmoud");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("decision-card")).toBeVisible();
  });
});


test.describe("Required product screenshots", () => {
  test("captures the required review surfaces", async ({ page }, testInfo) => {
    const capture = async (name: string) => {
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
    };

    if (testInfo.project.name === "desktop-chromium") {
      await page.goto("/app-studio/salesos");
      await capture("desktop-command-center");

      const decisionStates: Array<[string, string]> = [
        ["opp-farah", "decision-no-action"],
        ["opp-ahmed", "decision-next-step-ready"],
        ["opp-omar", "decision-insufficient-evidence"],
        ["opp-layla", "decision-contradictory-evidence"],
      ];
      for (const [opportunityId, fileName] of decisionStates) {
        await page.goto(`/app-studio/salesos/opportunity/${opportunityId}`);
        await expect(page.getByTestId("decision-card")).toBeVisible();
        await capture(fileName);
      }
      return;
    }

    await page.goto("/app-studio/salesos");
    await capture("mobile-command-center");
    await page.getByRole("button", { name: "العربية" }).click();
    await page.goto("/app-studio/salesos/opportunity/opp-mahmoud");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("decision-card")).toBeVisible();
    await capture("arabic-rtl-mobile");
  });
});
