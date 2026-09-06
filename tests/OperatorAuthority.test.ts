import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productionFiles = [
  "src/lib/operatorRuntime/runtime.ts",
  "src/lib/operatorRuntime/types.ts",
  "src/components/salesos/OperatorRuntime.tsx",
  "src/components/salesos/RealInputWorkspace.tsx",
];

describe("Build 4 authority and persistence boundary", () => {
  it("B4-024 contains no network, external-send, browser persistence, server action, or API-route primitive", () => {
    const source = productionFiles.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|["']use server["']|\/api\//);
    expect(source).not.toMatch(/nodemailer|twilio|whatsapp-web|googleapis|salesforce|hubspot/i);
  });

  it("B4-025 keeps the core operator-generic", () => {
    const source = productionFiles.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/Moataz/i);
    expect(source).toContain("operatorId");
  });
});
