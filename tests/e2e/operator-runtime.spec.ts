import { expect, test } from "@playwright/test";

test.describe("SalesOS Build 4 Operator Runtime", () => {
  test("opens the Command Queue and explains ACT, commitment, restraint, and contradiction priorities", async ({ page }) => {
    await page.goto("/app-studio/salesos");
    await page.getByRole("link", { name: "Open Operator Runtime" }).click();
    await expect(page).toHaveURL(/salesos\/operator-runtime$/);
    await expect(page.locator('[data-queue-section="COMMITMENTS_DUE"]')).toContainText("Payment-plan commitment");
    await expect(page.locator('[data-queue-section="ACT_NOW"]')).toContainText("New Cairo request");
    await expect(page.locator('[data-queue-section="WAIT_PROTECTED"]')).toContainText("Dubai pause");
    await expect(page.locator('[data-queue-section="AT_RISK_NEGLECT"]')).toContainText("Silence only");
  });

  test("preserves provenance through queue to decision and records capture without external execution", async ({ page }) => {
    await page.goto("/app-studio/salesos/operator-runtime");
    await page.getByRole("button", { name: /New Cairo request/i }).click();
    await expect(page.getByTestId("evidence-contract")).toContainText("synthetic-build4:whatsapp:egypt-strong-request");
    await page.getByLabel("Optional note").fill("Manual mixed note: اتصل العميل about Palm Hills");
    await page.getByRole("button", { name: "Record capture" }).click();
    await expect(page.getByTestId("quick-capture")).toContainText("operator-entered evidence");
    await expect(page.getByRole("button", { name: /send|email|schedule|write to crm|contact customer/i })).toHaveCount(0);
  });

  test("records immutable disagreement and a separate non-causal later observation", async ({ page }) => {
    await page.goto("/app-studio/salesos/operator-runtime");
    await page.getByRole("button", { name: /Dubai pause/i }).click();
    await page.getByLabel("Override reason").fill("New unverified context outside imported evidence");
    await page.getByLabel("Intended action").fill("Call once to clarify timing");
    await page.getByRole("button", { name: "Record material override" }).click();
    await expect(page.getByTestId("override-ledger")).toContainText("1 append-only records");
    await page.getByRole("button", { name: "Record synthetic later observation" }).click();
    await expect(page.getByText(/does not establish that the operator or SalesOS was right/i)).toBeVisible();
  });

  test("keeps patterns as experiment candidates and doctrine unchanged", async ({ page }) => {
    await page.goto("/app-studio/salesos/operator-runtime");
    await page.getByRole("button", { name: "Detect synthetic pattern" }).click();
    await expect(page.getByTestId("learning-ledger")).toContainText("Candidate only");
    await expect(page.getByTestId("learning-ledger")).toContainText("Evidence before action · v1.0.0");
  });

  test("exports only an allowlisted snapshot and clears the complete session", async ({ page }) => {
    await page.goto("/app-studio/salesos/operator-runtime");
    await page.getByRole("button", { name: "Preview JSON" }).click();
    const exported = page.getByTestId("sanitized-export");
    await expect(exported).toContainText("salesos-operator-export-v1");
    await expect(exported).not.toContainText("synthetic-build4");
    await expect(exported).not.toContainText("Palm Hills");
    await page.getByRole("button", { name: "Clear operator session" }).click();
    await expect(page.getByTestId("session-cleared")).toBeVisible();
    await expect(page.getByTestId("operator-runtime")).toHaveCount(0);
  });

  test("captures required desktop and Arabic RTL operator evidence", async ({ page }, testInfo) => {
    await page.goto("/app-studio/salesos/operator-runtime");
    if (testInfo.project.name === "desktop-chromium") {
      await page.screenshot({ path: testInfo.outputPath("build4-desktop-command-queue.png"), fullPage: true });
      await page.getByRole("button", { name: /Dubai pause/i }).click();
      await page.getByLabel("Override reason").fill("Synthetic disagreement evidence");
      await page.getByLabel("Intended action").fill("Review before a bounded call");
      await page.getByRole("button", { name: "Record material override" }).click();
      await page.screenshot({ path: testInfo.outputPath("build4-desktop-override-ledger.png"), fullPage: true });
      return;
    }
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByRole("button", { name: /Palm Hills \/ EGP/i }).click();
    await expect(page.getByText("عقد الأدلة")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("build4-mobile-arabic-runtime.png"), fullPage: true });
  });
});
