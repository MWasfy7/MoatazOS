import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCrmCsv } from "@/lib/realInput";

const docsRoot = resolve(process.cwd(), "docs", "salesos-diagnostic");
const template = readFileSync(resolve(docsRoot, "sanitized-demo-dataset-template.csv"), "utf8");

describe("SalesOS customer diagnostic handoff", () => {
  it("parses the shipped sanitized CSV template through the production importer", () => {
    const result = parseCrmCsv(template, {
      organizationId: "org-synthetic",
      salesFloorId: "floor-synthetic",
      sourceId: "diagnostic-template",
      defaultTimezoneOffset: "+02:00",
    });
    expect(result.status).toBe("ACCEPTED");
    expect(result.events).toHaveLength(3);
    expect(result.issues.filter((issue) => issue.severity === "ERROR")).toHaveLength(0);
  });

  it("contains only explicit synthetic identities and provenance", () => {
    expect(template).not.toMatch(/@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(template).not.toMatch(/\+?\d{10,}/);
    expect(template.match(/SYNTHETIC-LEAD-001/g)).toHaveLength(3);
    expect(template.match(/synthetic:/g)).toHaveLength(3);
  });

  it("documents schema fail-closed rules and industry adapter separation", () => {
    const schema = readFileSync(resolve(docsRoot, "supported-crm-schema.md"), "utf8");
    expect(schema).toContain("Fail-closed rules");
    expect(schema).toContain("Optional real-estate adapter columns");
    expect(schema).toContain("reject the import");
  });

  it("keeps real customer data behind an explicit privacy gate", () => {
    const privacy = readFileSync(resolve(docsRoot, "data-privacy-requirements.md"), "utf8");
    expect(privacy).toContain("Do not load real customer data");
    expect(privacy).toMatch(/written authorization/i);
    expect(privacy).toContain("no OAuth, CRM API, database");
  });
});
