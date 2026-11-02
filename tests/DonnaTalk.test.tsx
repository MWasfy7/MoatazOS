import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DonnaProvider } from "@/components/donna/DonnaProvider";
import { TalkScreen } from "@/components/donna/talk/TalkScreen";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

function mount() {
  render(
    <LocaleProvider>
      <DonnaProvider>
        <TalkScreen />
      </DonnaProvider>
    </LocaleProvider>,
  );
}

const herLast = () => {
  const entries = screen.getAllByTestId("donna-talk-entry").filter((e) => e.dataset.who === "donna");
  return entries[entries.length - 1] as HTMLElement;
};

async function answerAndAsk(text: string) {
  await userEvent.click(screen.getByTestId("donna-talk-answer"));
  await userEvent.type(screen.getByTestId("donna-talk-input"), `${text}{Enter}`);
  return herLast();
}

beforeEach(() => {
  // jsdom has no canvas; the orb simply does not draw.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Talk to Donna", () => {
  it("rings first; answering makes her speak first, restraint before anything else", async () => {
    mount();
    expect(screen.getByTestId("donna-talk-incoming").textContent).toMatch(/Donna.*is calling/);
    expect(screen.getByTestId("donna-talk-incoming").textContent).toMatch(/9 things before you start/);
    await userEvent.click(screen.getByTestId("donna-talk-answer"));
    const opener = herLast();
    expect(opener.textContent).toMatch(/Afternoon\. 9 things still matter today\./);
    const text = opener.textContent ?? "";
    expect(text.indexOf("Stop messaging Beta")).toBeGreaterThan(-1);
    expect(text.indexOf("Stop messaging Beta")).toBeLessThan(text.indexOf("You promised Alpha"));
    expect(within(opener).getByTestId("donna-talk-brief")).toBeTruthy();
  });

  it("answers who to call from memory, leaving the held clients out", async () => {
    mount();
    const reply = await answerAndAsk("who should I call?");
    expect(reply.textContent).toMatch(/Not Beta or Delta\. Leave them alone\./);
    expect(reply.textContent).toMatch(/First, Alpha: you're 2 days late on a promise/);
    expect(reply.textContent).toMatch(/Then Gamma: you planned it for 15:00/);
  });

  it("stops the operator from chasing, and turns the conversation red", async () => {
    mount();
    const reply = await answerAndAsk("I'm about to call Beta");
    expect(reply.dataset.mood).toBe("STOP");
    expect(reply.textContent).toMatch(/Don't\. Beta has 3 messages with no reply/);
  });

  it("files a debrief only after the operator confirms, and remembers it", async () => {
    mount();
    const proposal = await answerAndAsk("Just finished with Gamma. Budget is 5 million, cash. I promised to send the floor plans tomorrow.");
    const card = within(proposal).getByTestId("donna-talk-proposal");
    expect(card.textContent).toMatch(/You promised: .*send the floor plans.*, tomorrow\./);
    expect(card.textContent).toMatch(/a budget of .*5M EGP/);
    expect(card.textContent).toMatch(/Nothing is sent to anyone/);
    await userEvent.click(within(card).getByTestId("donna-talk-file"));
    expect(herLast().textContent).toMatch(/Filed\. I'll hold you to it/);
    expect(card.dataset.state).toBe("filed");
    await userEvent.type(screen.getByTestId("donna-talk-input"), "tell me about gamma{Enter}");
    expect(within(herLast()).getByTestId("donna-talk-dossier").textContent).toMatch(/5M EGP/);
  });

  it("works in Egyptian Arabic, right to left, and answers in the language the operator uses", async () => {
    mount();
    await userEvent.click(screen.getByTestId("donna-talk-lang-ar"));
    expect(screen.getByTestId("donna-talk-incoming").getAttribute("dir")).toBe("rtl");
    expect(screen.getByTestId("donna-talk-incoming").textContent).toMatch(/دونا/);
    await userEvent.click(screen.getByTestId("donna-talk-answer"));
    expect(herLast().textContent).toMatch(/بطّل تبعت لـبيتا/);
    await userEvent.type(screen.getByTestId("donna-talk-input"), "هكلم بيتا{Enter}");
    expect(herLast().textContent).toMatch(/لأ\. بيتا عنده 3 رسايل من غير رد/);
    await userEvent.click(screen.getByTestId("donna-talk-lang-en"));
    await userEvent.type(screen.getByTestId("donna-talk-input"), "اكلم مين الأول؟{Enter}");
    expect(herLast().getAttribute("lang")).toBe("ar");
    expect(herLast().textContent).toMatch(/مش بيتا ولا دلتا/);
  });

  it("shows the book as a radar; tapping a client asks Donna about them", async () => {
    mount();
    await userEvent.click(screen.getByTestId("donna-talk-answer"));
    const dots = screen.getAllByTestId("donna-radar-dot");
    expect(dots.map((d) => d.dataset.heat)).toEqual(["COOLING", "HELD", "HOT", "HELD", "WARM"]);
    expect(dots[0]?.getAttribute("aria-label")).toMatch(/Alpha: going cold · 9d · promise late/);
    await userEvent.click(dots[3] as HTMLElement);
    expect(herLast().textContent).toMatch(/Leave Delta alone\. They asked for space/);
  });

  it("declining still leaves one line, and nothing on the screen can contact anyone", async () => {
    mount();
    await userEvent.click(screen.getByTestId("donna-talk-decline"));
    expect(herLast().textContent).toMatch(/Fine\. I'll be here\. But Alpha won't wait forever\./);
    const talk = screen.getByTestId("donna-talk");
    expect(within(talk).queryAllByRole("button", { name: /^(send|call|dial|schedule|book|whatsapp|message)\b/i })).toHaveLength(0);
    expect(talk.querySelector('a[href^="tel:"], a[href*="wa.me"], a[href^="mailto:"]')).toBeNull();
    expect(screen.getByTestId("donna-talk-note").textContent).toMatch(/can't listen\. Type instead/);
  });
});
