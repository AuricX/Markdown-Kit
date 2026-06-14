import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Navbar, { type ViewMode } from "../components/Navbar";

function renderNavbar(overrides: Partial<React.ComponentProps<typeof Navbar>> = {}) {
  const handlers = {
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onPrint: vi.fn(),
    onViewChange: vi.fn(),
    onToggleTheme: vi.fn(),
  };
  render(
    <Navbar
      fileName="note.md"
      dirty={false}
      viewMode={"split" as ViewMode}
      theme="dark"
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("Navbar", () => {
  it("shows the file name and no dirty marker when clean", () => {
    renderNavbar();
    expect(screen.getByLabelText("Document name")).toHaveTextContent("note.md");
    expect(screen.queryByLabelText("unsaved changes")).toBeNull();
  });

  it("shows a dirty marker when dirty", () => {
    renderNavbar({ dirty: true });
    expect(screen.getByLabelText("unsaved changes")).toBeInTheDocument();
  });

  it("fires file-action handlers on click", () => {
    const h = renderNavbar();
    fireEvent.click(screen.getByText("New"));
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(screen.getByText("Save"));
    fireEvent.click(screen.getByText("PDF"));
    expect(h.onNew).toHaveBeenCalledOnce();
    expect(h.onOpen).toHaveBeenCalledOnce();
    expect(h.onSave).toHaveBeenCalledOnce();
    expect(h.onPrint).toHaveBeenCalledOnce();
  });

  it("marks the active view and requests a change on click", () => {
    const h = renderNavbar({ viewMode: "split" });
    const splitBtn = screen.getByRole("button", { name: "Split" });
    expect(splitBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(h.onViewChange).toHaveBeenCalledWith("preview");
  });

  it("toggles theme and reflects the target theme in its label", () => {
    const h = renderNavbar({ theme: "dark" });
    const btn = screen.getByRole("button", { name: /Switch to light theme/ });
    fireEvent.click(btn);
    expect(h.onToggleTheme).toHaveBeenCalledOnce();
  });
});
