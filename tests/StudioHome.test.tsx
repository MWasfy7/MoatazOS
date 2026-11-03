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

const herLast = () => {
  const all = screen.getAllByTestId("studio-says");
  return all[all.length - 1] as HTMLElement;
};

beforeEach(() => {
  // jsdom has no canvas; the orb simply does not draw.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App Studio home", () => {
  it("introduces Donna, SalesOS and ECHO with real links, and says nothing is sent", () => {
    mount();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Donna keeps your book. You close.");
    expect(screen.getAllByRole("link", { name: "Talk to Donna" })[0]?.getAttribute("href")).toBe("/app-studio/donna/talk");
    expect(screen.getByRole("link", { name: "Open the Command Center" }).getAttribute("href")).toBe("/app-studio/salesos");
    expect(screen.getByRole("link", { name: "Talk to ECHO" }).getAttribute("href")).toBe("/app-studio/echo");
    expect(screen.getByTestId("studio-sent").textContent).toBe("Nothing leaves this page. She drafts; you send.");
  });

  it("answering the call makes her speak first, restraint before anything else", async () => {
    mount();
    expect(screen.queryByTestId("studio-transcript")).toBeNull();
    await userEvent.click(screen.getByTestId("studio-answer"));
    expect(herLast().textContent).toMatch(/Beta|Delta/);
    expect(screen.queryByTestId("studio-answer")).toBeNull();
  });

  it("restraint wins mid-conversation, and the room turns red", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "I'm calling Beta" }));
    expect(screen.getByTestId("studio-heard").textContent).toMatch(/^ECHO heard: English, /);
    expect(herLast().textContent).toMatch(/^Don't\./);
    expect(screen.getByTestId("studio-stage").dataset.mood).toBe("STOP");
  });

  it("keeps the thread: a follow-up about the same client is understood", async () => {
    mount();
    await userEvent.type(screen.getByLabelText("Talk or type to Donna"), "Prep me for Gamma{Enter}");
    await userEvent.type(screen.getByLabelText("Talk or type to Donna"), "What do I owe them?{Enter}");
    expect(screen.getAllByTestId("studio-says")).toHaveLength(2);
    expect(herLast().textContent).toMatch(/Gamma/);
  });

  it("answers an Arabic sentence in Arabic", async () => {
    mount();
    await userEvent.type(screen.getByLabelText("Talk or type to Donna"), "هكلم بيتا{Enter}");
    expect(screen.getByTestId("studio-heard").textContent).toMatch(/^ECHO heard: Arabic, /);
    expect(herLast().textContent).toMatch(/^لأ\./);
  });
});
