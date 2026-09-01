import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecisionEngineReview } from "@/components/salesos/DecisionEngineReview";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { renderWithLocale } from "./test-utils";

describe("S2 Decision Engine Review", () => {
  it("renders the current immutable decision without execution controls", () => {
    renderWithLocale(<DecisionEngineReview />);
    expect(screen.getByTestId("deterministic-decision")).toHaveAttribute("data-decision-state", "NO_ACTION");
    expect(screen.getByText("An attributable buyer pause remains active.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send|call|schedule|crm write|override/i })).not.toBeInTheDocument();
  });

  it("exposes all four deterministic states through isolated synthetic cases", () => {
    renderWithLocale(<DecisionEngineReview />);
    const cases: Array<[string, string]> = [
      ["Direct request", "NEXT_STEP_READY"],
      ["Silence only", "INSUFFICIENT_EVIDENCE"],
      ["Contradiction", "CONTRADICTORY_EVIDENCE"],
      ["Explicit pause", "NO_ACTION"],
    ];
    for (const [label, state] of cases) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(screen.getByTestId("deterministic-decision")).toHaveAttribute("data-decision-state", state);
    }
  });

  it("shows linked reengagement lineage while preserving the chasing finding", () => {
    renderWithLocale(<DecisionEngineReview />);
    fireEvent.click(screen.getByRole("button", { name: "Reengagement after chasing" }));
    expect(screen.getByTestId("decision-lineage").querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("Chasing after explicit pause")).toBeInTheDocument();
    expect(screen.getByText(/later decision does not erase it/i)).toBeInTheDocument();
  });

  it("renders actual S2 review chrome in Arabic with no English policy leakage", () => {
    renderWithLocale(<ArabicHarness />);
    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    fireEvent.click(screen.getByRole("button", { name: "طلب بالعربية" }));
    expect(screen.getByRole("heading", { name: "مراجعة محرك القرار v0" })).toBeInTheDocument();
    expect(screen.getByText("القرار الحالي الثابت")).toBeInTheDocument();
    expect(screen.getByText("يدعم طلب منسوب إلى المشتري مراجعة فئة محدودة للخطوة التالية.")).toBeInTheDocument();
    expect(screen.queryByText("Current immutable decision")).not.toBeInTheDocument();
    expect(screen.queryByText("Buyer request")).not.toBeInTheDocument();
  });
});

function ArabicHarness() {
  const { setLocale } = useLocale();
  return <><button type="button" onClick={() => setLocale("ar")}>العربية</button><DecisionEngineReview /></>;
}
