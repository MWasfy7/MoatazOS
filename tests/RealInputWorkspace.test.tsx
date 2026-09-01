import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RealInputWorkspace } from "@/components/salesos/RealInputWorkspace";
import { renderWithLocale } from "./test-utils";

describe("S1 Real Input Workspace", () => {
  it("S1-024 previews a synthetic CRM timeline without execution authority", () => {
    renderWithLocale(<RealInputWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Load synthetic example" }));
    expect(screen.getByTestId("import-preview")).toHaveAttribute("data-import-status", "ACCEPTED");
    expect(screen.getByText("crm-export:synthetic:1")).toBeInTheDocument();
    expect(screen.getAllByText("2", { selector: "dd" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /send|call|write to crm|authorize/i })).not.toBeInTheDocument();
  });

  it("S1-025 renders a PII-masked WhatsApp preview with multiline Arabic preserved", () => {
    renderWithLocale(<RealInputWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp export" }));
    fireEvent.click(screen.getByRole("button", { name: "Load synthetic example" }));
    expect(screen.getByText(/صباح الخير/)).toHaveTextContent("[EMAIL REDACTED]");
    expect(screen.queryByText("buyer@example.test")).not.toBeInTheDocument();
  });
});
