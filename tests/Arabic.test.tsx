import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";
import { DecisionCard } from "@/components/salesos/DecisionCard/DecisionCard";
import { FIXTURE_11_ARABIC_MOBILE, FIXTURE_M1A_RESTRAINT_RESPECTED } from "@/lib/fixtures";
import type { DecisionSnapshot } from "@/lib/types";
import { useEffect } from "react";

function ArabicHarness({ snapshot = FIXTURE_11_ARABIC_MOBILE }: { snapshot?: DecisionSnapshot }) {
  const { setLocale } = useLocale();
  useEffect(() => {
    setLocale("ar");
  }, [setLocale]);
  return <DecisionCard snapshot={snapshot} />;
}

describe("Arabic RTL semantics render", () => {
  it("renders the Arabic buyer alias and decision-state translation", () => {
    render(
      <LocaleProvider>
        <ArabicHarness />
      </LocaleProvider>,
    );
    expect(screen.getByText(FIXTURE_11_ARABIC_MOBILE.buyerAlias)).toBeInTheDocument();
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
    expect(text).not.toMatch(/إرسال/);
    expect(text).not.toMatch(/اتصال الآن/);
  });

  it("renders localized M1A restraint-panel labels and the reevaluation boundary", () => {
    render(
      <LocaleProvider>
        <ArabicHarness snapshot={FIXTURE_M1A_RESTRAINT_RESPECTED} />
      </LocaleProvider>,
    );
    expect(screen.getByText("سبب التريث")).toBeInTheDocument();
    expect(screen.getByText("مراجعة سلوك مندوب المبيعات")).toBeInTheDocument();
    expect(screen.getByText("إمكانية تقييم الالتزام بالتريث")).toBeInTheDocument();
    expect(screen.getByText("هذا يسمح بإعادة التقييم فقط، ولا يعني السماح بالتواصل مع العميل.")).toBeInTheDocument();
  });
});
