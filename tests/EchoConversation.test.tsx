import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EchoConversation } from "@/components/echo/EchoConversation";
import { renderWithLocale } from "./test-utils";

describe("ECHO Build 0 conversation surface", () => {
  it("renders a truthful local-only conversation surface", () => {
    renderWithLocale(<EchoConversation />);
    expect(screen.getByRole("heading", { name: "ECHO" })).toBeInTheDocument();
    expect(screen.getByText(/proposal only · no external effects/i)).toBeInTheDocument();
    expect(screen.getByText(/No microphone or external service is connected/i)).toBeInTheDocument();
  });

  it("continues a contextual thread through the visible surface", () => {
    renderWithLocale(<EchoConversation />);
    const input = screen.getByLabelText("Message ECHO");
    fireEvent.change(input, { target: { value: "the cognitive runtime" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.change(input, { target: { value: "yalla kammel" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText(/Picking up the cognitive runtime/)).toBeInTheDocument();
    expect(screen.getByText("CONTINUE")).toBeInTheDocument();
  });

  it("routes pasted voice transcripts through the same interface", () => {
    renderWithLocale(<EchoConversation />);
    fireEvent.change(screen.getByLabelText("Input mode"), {
      target: { value: "VOICE_TRANSCRIPT" },
    });
    expect(screen.getByLabelText("Paste or type a voice transcript")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Paste or type a voice transcript"), {
      target: { value: "uh uh review the ECHO runtime" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText(/prepared it for review here/i)).toBeInTheDocument();
    expect(screen.getByText("ACTION_REQUEST")).toBeInTheDocument();
  });
});
