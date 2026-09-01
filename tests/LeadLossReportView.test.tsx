import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeadLossReportView } from "@/components/salesos/LeadLossReportView";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { renderWithLocale } from "./test-utils";

describe("S3 Lead Loss Report view", () => {
  it("renders exact top-line metric fractions", () => {
    renderWithLocale(<LeadLossReportView />);
    expect(screen.getByTestId("metric-leads-received")).toHaveTextContent("8 / 9");
    expect(screen.getByTestId("metric-untouched-leads")).toHaveTextContent("2 / 8");
    expect(screen.getByTestId("metric-first-response")).toHaveTextContent("240 / 6");
    expect(screen.getByTestId("metric-first-response")).toHaveTextContent("40 min average");
  });

  it("renders an exhaustive four-state distribution", () => {
    renderWithLocale(<LeadLossReportView />);
    expect(screen.getByTestId("metric-state-no_action")).toHaveTextContent("3 / 8");
    expect(screen.getByTestId("metric-state-next_step_ready")).toHaveTextContent("3 / 8");
    expect(screen.getByTestId("metric-state-insufficient_evidence")).toHaveTextContent("1 / 8");
    expect(screen.getByTestId("metric-state-contradictory_evidence")).toHaveTextContent("1 / 8");
  });

  it("uses the observable restraint denominator and displays exclusions", () => {
    renderWithLocale(<LeadLossReportView />);
    expect(screen.getByTestId("metric-restraint-respected")).toHaveTextContent("1 / 2");
    expect(screen.getByTestId("metric-chasing-violations")).toHaveTextContent("1 / 2");
    expect(screen.getByTestId("metric-methodology")).toHaveTextContent("report-sara: Restraint window is not observable");
  });

  it("renders every eligible lead with a Decision Card drill-down", () => {
    renderWithLocale(<LeadLossReportView />);
    expect(screen.getAllByTestId("lead-report-row")).toHaveLength(8);
    const links = screen.getAllByRole("link", { name: "Open Decision Card evidence" });
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveAttribute("href", "/app-studio/salesos/opportunity/opp-farah");
  });

  it("shows source freshness, ownership boundaries, and manager history", () => {
    renderWithLocale(<LeadLossReportView />);
    expect(screen.getByText(/· Stale$/)).toBeInTheDocument();
    expect(screen.getAllByText("No assignment evidence")).toHaveLength(2);
    expect(screen.getByText("A missing assignment is an evidence gap; it does not establish rep fault.")).toBeInTheDocument();
    expect(screen.getByText("Review confirmed only the observable contact sequence.")).toBeInTheDocument();
    expect(screen.getByText("A source correction remains outside the current decision pending validation.")).toBeInTheDocument();
  });

  it("keeps provenance visible and PII-safe", () => {
    renderWithLocale(<LeadLossReportView />);
    expect(screen.getAllByText("synthetic:report-ahmed:crm_csv")).not.toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/buyer@example|\+2010\d{8}/);
  });

  it("contains no execution, CRM-write, or blame controls", () => {
    renderWithLocale(<LeadLossReportView />);
    expect(screen.queryByRole("button", { name: /send|call|schedule|write|override|assign|contact/i })).not.toBeInTheDocument();
    expect(screen.getByText(/does not claim causality/i)).toBeInTheDocument();
  });

  it("renders actual S3 report chrome and review summaries in Arabic", () => {
    renderWithLocale(<ArabicHarness />);
    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    expect(screen.getByRole("heading", { name: "تقرير فقدان العملاء المحتملين v0" })).toBeInTheDocument();
    expect(screen.getByText("مخالفات ملاحقة ملحوظة")).toBeInTheDocument();
    expect(screen.getByText("أكدت المراجعة تسلسل التواصل الملحوظ فقط.")).toBeInTheDocument();
    expect(screen.getByText("غياب دليل الإسناد فجوة في الأدلة ولا يثبت خطأ المندوب.")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Lead Loss Report");
    expect(document.body.textContent).not.toContain("Review confirmed only");
  });
});

function ArabicHarness() {
  const { setLocale } = useLocale();
  return <><button type="button" onClick={() => setLocale("ar")}>العربية</button><LeadLossReportView /></>;
}
