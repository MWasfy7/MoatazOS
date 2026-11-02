import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceReviewPanel } from "@/components/donna/VoiceReviewPanel";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";

const AT = "2026-11-02T09:00:00Z";

function SwitchToArabic() {
  const { setLocale } = useLocale();
  return <button type="button" onClick={() => setLocale("ar")}>switch-ar</button>;
}

function mount(note: string, onUseDate = vi.fn()) {
  render(
    <LocaleProvider>
      <SwitchToArabic />
      <VoiceReviewPanel note={note} callId="SYN-1" at={AT} onUseDate={onUseDate} />
    </LocaleProvider>,
  );
  return onUseDate;
}

afterEach(cleanup);

describe("VoiceReviewPanel", () => {
  it("shows nothing for an empty note", () => {
    mount("   ");
    expect(screen.queryByTestId("donna-voice-review")).toBeNull();
  });

  it("restraint is primary: alert, no date offered, even with a date in the note", () => {
    mount("spoke, he said do not contact me, follow up 2026-11-05");
    const panel = screen.getByTestId("donna-voice-review");
    expect(panel.dataset.decision).toBe("NO_ACTION");
    expect(screen.getByRole("alert").textContent).toMatch(/not to be contacted/);
    expect(screen.queryByRole("button", { name: /use this date/i })).toBeNull();
  });

  it("restraint in Egyptian Arabic is detected and shown in Arabic", async () => {
    mount("قالي مش عايز، بلاش تتصل بيا");
    await userEvent.click(screen.getByText("switch-ar"));
    expect(screen.getByTestId("donna-voice-review").dataset.decision).toBe("NO_ACTION");
    expect(screen.getByRole("alert").textContent).toMatch(/عدم التواصل/);
  });

  it("offers an internal reminder date only, and applying it calls back with that date", async () => {
    const onUseDate = mount("spoke, follow up 2026-11-05");
    expect(screen.getByTestId("donna-voice-review").dataset.decision).toBe("PROPOSE_INTERNAL_FOLLOW_UP");
    expect(screen.getByText(/never confirms a client appointment/i)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /use this date/i }));
    expect(onUseDate).toHaveBeenCalledWith("2026-11-05");
  });

  it("a date alone still proposes a reminder; no outcome words asks the operator", () => {
    mount("talked about the unit 2026-11-05 maybe");
    expect(screen.getByTestId("donna-voice-review").dataset.decision).toBe("PROPOSE_INTERNAL_FOLLOW_UP");
    cleanup();
    mount("some words only");
    expect(screen.getByTestId("donna-voice-review").dataset.decision).toBe("ASK_OPERATOR_OUTCOME");
    expect(screen.queryByRole("button", { name: /use this date/i })).toBeNull();
  });
});
