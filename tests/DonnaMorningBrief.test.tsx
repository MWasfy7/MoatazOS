import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { MorningBrief } from "@/components/donna/MorningBrief";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";

function SwitchToArabic() {
  const { setLocale } = useLocale();
  return <button type="button" onClick={() => setLocale("ar")}>switch-ar</button>;
}

function mount() {
  render(
    <LocaleProvider>
      <DonnaProvider>
        <SwitchToArabic />
        <MorningBrief />
      </DonnaProvider>
    </LocaleProvider>,
  );
  return screen.getByTestId("donna-morning-brief");
}

afterEach(cleanup);

describe("MorningBrief", () => {
  it("speaks first: greeting plus restraint lines at the top", () => {
    const brief = mount();
    expect(within(brief).getByTestId("donna-brief-greeting").textContent).toMatch(/Good morning\. \d+ things matter today\./);
    const lines = within(brief).getAllByTestId("donna-brief-line");
    expect(lines[0]?.dataset.kind).toBe("HOLD_OFF");
    expect(lines[0]?.textContent).toMatch(/Stop messaging Synthetic Client Beta/);
    expect(lines[1]?.textContent).toMatch(/Leave Synthetic Client Delta alone/);
  });

  it("offers no execution control", () => {
    const brief = mount();
    expect(within(brief).queryByRole("button", { name: /^(send|call|dial|schedule|book|whatsapp|message)\b/i })).toBeNull();
    expect(brief.querySelector('a[href^="tel:"], a[href*="wa.me"]')).toBeNull();
  });

  it("renders in Egyptian Arabic, right to left", async () => {
    const brief = mount();
    await userEvent.click(screen.getByText("switch-ar"));
    expect(within(brief).getByTestId("donna-brief-greeting").textContent).toMatch(/صباح الخير/);
    expect(within(brief).getAllByTestId("donna-brief-line")[0]?.textContent).toMatch(/بطّل تبعت/);
  });

  it("falls back to reading when the browser cannot speak", () => {
    const brief = mount();
    // jsdom has no speechSynthesis.
    expect(within(brief).queryByTestId("donna-brief-listen")).toBeNull();
    expect(brief.textContent).toMatch(/Read it instead/);
  });
});
