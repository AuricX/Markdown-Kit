import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import App from "../App";
import { setSettings } from "../settings";

describe("App shell", () => {
  beforeEach(() => {
    document.title = "";
    // Reset settings to their defaults (preview is the default view).
    setSettings({ fontSize: 14, defaultView: "preview" });
  });

  it("opens in the preview pane by default", () => {
    render(<App />);
    expect(screen.getByLabelText("Markdown preview")).toBeInTheDocument();
    expect(screen.queryByLabelText("Markdown editor")).toBeNull();
  });

  it("shows the editor after switching to split via the toolbar", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(screen.getByLabelText("Markdown editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown preview")).toBeInTheDocument();
  });

  it("starts with an Untitled, non-dirty title", () => {
    render(<App />);
    expect(document.title).toBe("Untitled");
  });

  it("opens the settings modal from the toolbar", () => {
    render(<App />);
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  });
});
