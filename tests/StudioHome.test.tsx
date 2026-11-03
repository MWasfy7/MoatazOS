import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioHome } from "@/components/app-studio/StudioHome";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

function mount() {
  render(
    <LocaleProvider>
      <DonnaProvider>
        <StudioHome />
      </DonnaProvider>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  // jsdom has no canvas; the orb simply does not draw.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App Studio home", () => {
  it("introduces Donna, SalesOS and ECHO with real links", () => {
    mount();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Donna keeps your book. You close.");
    expect(screen.getByTestId("studio-answer").getAttribute("href")).toBe("/app-studio/donna/talk");
    expect(screen.getByRole("link", { name: "Open the Command Center" }).getAttribute("href")).toBe("/app-studio/salesos");
    expect(screen.getByRole("link", { name: "Talk to ECHO" }).getAttribute("href")).toBe("/app-studio/echo");
  });

  it("restraint wins: calling a client who asked for space gets Don't, and nothing is sent", async () => {
    mount();
    expect(screen.queryByTestId("studio-says")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "I'm calling Beta" }));
    expect(screen.getByTestId("studio-heard").textContent).toMatch(/^English, /);
    expect(screen.getByTestId("studio-says").textContent).toMatch(/^Don't\./);
    expect(screen.getByTestId("studio-sent").textContent).toBe("Nothing. Donna drafts; you decide and send.");
  });

  it("answers an Arabic sentence in Arabic", async () => {
    mount();
    await userEvent.type(screen.getByLabelText("Your sentence"), "هكلم بيتا{Enter}");
    expect(screen.getByTestId("studio-heard").textContent).toMatch(/^Arabic, /);
    expect(screen.getByTestId("studio-says").textContent).toMatch(/^لأ\./);
  });
});
