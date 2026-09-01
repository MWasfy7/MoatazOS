import { expect, test } from "@playwright/test";

const crmCsv = `event_id,lead_id,occurred_at,actor_id,actor_role,channel,event_type,direction,source_ref,text_or_summary,crm_stage
e2e-crm-001,lead-e2e-001,2026-08-24 09:15,rep-e2e-01,REP,CRM,LEAD_ASSIGNED,INTERNAL,e2e:crm:row:1,Lead assigned,New
e2e-crm-002,lead-e2e-001,2026-08-24 09:20,buyer-e2e-01,BUYER,CRM,BUYER_MESSAGE,INBOUND,e2e:crm:row:2,أرسل التفاصيل إلى buyer@example.test,Contacted`;

const whatsappExport = `[24/08/2026, 10:20] - Buyer Synth: أرسل التفاصيل إلى buyer@example.test
وهذا سطر ثانٍ في الرسالة
[24/08/2026, 10:23] - Rep Synth: Acknowledged for review.`;

test.describe("S1 Real Input Layer", () => {
  test("opens from Command Center and imports a CRM CSV into a masked preview", async ({ page }) => {
    await page.goto("/app-studio/salesos");
    await page.getByRole("link", { name: "Open Real Input Layer" }).click();
    await expect(page).toHaveURL(/salesos\/import$/);
    await page.getByLabel("Choose an exported file").setInputFiles({
      name: "synthetic-e2e.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(crmCsv),
    });
    await expect(page.getByTestId("import-preview")).toHaveAttribute("data-import-status", "ACCEPTED");
    await expect(page.getByText("e2e:crm:row:1")).toBeVisible();
    await expect(page.getByText("[EMAIL REDACTED]", { exact: false })).toBeVisible();
    await expect(page.getByText("buyer@example.test", { exact: false })).toHaveCount(0);
  });

  test("imports multiline WhatsApp and renders actual Arabic product copy", async ({ page }) => {
    await page.goto("/app-studio/salesos/import");
    await page.getByRole("button", { name: "WhatsApp export" }).click();
    await page.getByLabel("Choose an exported file").setInputFiles({
      name: "synthetic-e2e.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(whatsappExport),
    });
    await expect(page.getByText(/وهذا سطر ثانٍ/)).toBeVisible();
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "طبقة إدخال البيانات الفعلية" })).toBeVisible();
    await expect(page.getByText(/لا ينشئ قراراً ولا يسمح بالتواصل/)).toBeVisible();
  });

  test("captures the S1 import workspace and masked timeline", async ({ page }, testInfo) => {
    await page.goto("/app-studio/salesos/import");
    if (testInfo.project.name === "desktop-chromium") {
      await page.getByRole("button", { name: "Load synthetic example" }).click();
      await expect(page.getByTestId("import-preview")).toHaveAttribute("data-import-status", "ACCEPTED");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("s1-desktop-crm-import-preview.png"), fullPage: true });
      return;
    }

    await page.getByRole("button", { name: "WhatsApp export" }).click();
    await page.getByRole("button", { name: "Load synthetic example" }).click();
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("s1-mobile-arabic-whatsapp-preview.png"), fullPage: true });
  });
});
