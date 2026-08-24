import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";
import { DecisionCard } from "@/components/salesos/DecisionCard/DecisionCard";
import { FIXTURE_11_ARABIC_MOBILE } from "@/lib/fixtures";
import { useEffect } from "react";

function ArabicHarness() {
  const { setLocale } = useLocale();
  useEffect(() => {
    setLocale("ar");
  }, [setLocale]);
  return <DecisionCard snapshot={FIXTURE_11_ARABIC_MOBILE} />;
}

describe("Arabic RTL semantics render", () => {
  it("renders the Arabic buyer alias and decision-state translation", () => {
    render(
      <LocaleProvider>
        <ArabicHarness />
      </LocaleProvider>,
    );
    expect(screen.getByText(FIXTURE_11_ARABIC_MOBILE.buyerAlias)).toBeInTheDocument();
    // The Arabic translation for NEXT_STEP_READY.
    expect(screen.getAllByText("الخطوة التالية جاهزة").length).toBeGreaterThan(0);
  });

  it("renders the Arabic next-step class and why-now evidence", () => {
    render(
      <LocaleProvider>
        <ArabicHarness />
      </LocaleProvider>,
    );
    expect(screen.getByText("تحضير مراجعة العرض التي طلبها المشتري")).toBeInTheDocument();
  });

  it("has no forbidden execution-control text even in Arabic", () => {
    const { container } = render(
      <LocaleProvider>
        <ArabicHarness />
      </LocaleProvider>,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/إرسال/); // "send"
    expect(text).not.toMatch(/اتصال الآن/); // "call now"
  });
});
