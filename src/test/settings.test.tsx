import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSettings, setSettings, FONT_MIN, FONT_MAX } from "../settings";
import SettingsModal from "../components/SettingsModal";
import { ThemeProvider } from "../theme";

beforeEach(() => {
  localStorage.removeItem("md-settings");
  localStorage.removeItem("md-theme");
  delete document.documentElement.dataset.theme;
  setSettings({ fontSize: 14, defaultView: "preview" });
});

describe("settings store", () => {
  it("defaults to 14px / preview", () => {
    expect(getSettings()).toEqual({ fontSize: 14, defaultView: "preview" });
  });

  it("clamps font size into range", () => {
    setSettings({ fontSize: 999 });
    expect(getSettings().fontSize).toBe(FONT_MAX);
    setSettings({ fontSize: 1 });
    expect(getSettings().fontSize).toBe(FONT_MIN);
  });

  it("ignores invalid view modes", () => {
    setSettings({ defaultView: "split" });
    // @ts-expect-error — testing runtime guard against bad input
    setSettings({ defaultView: "bogus" });
    expect(getSettings().defaultView).toBe("split");
  });

  it("persists to localStorage", () => {
    setSettings({ fontSize: 18, defaultView: "editor" });
    expect(JSON.parse(localStorage.getItem("md-settings")!)).toEqual({
      fontSize: 18,
      defaultView: "editor",
    });
  });
});

function renderModal() {
  const onClose = vi.fn();
  render(
    <ThemeProvider>
      <SettingsModal onClose={onClose} />
    </ThemeProvider>,
  );
  return onClose;
}

describe("SettingsModal", () => {
  it("renders the three settings controls", () => {
    renderModal();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("Font size")).toBeInTheDocument();
    expect(screen.getByLabelText("Default view")).toBeInTheDocument();
  });

  it("updates font size from the slider", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Font size"), { target: { value: "20" } });
    expect(getSettings().fontSize).toBe(20);
    expect(screen.getByText("20px")).toBeInTheDocument();
  });

  it("updates the default view from the select", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Default view"), { target: { value: "editor" } });
    expect(getSettings().defaultView).toBe("editor");
  });

  it("toggles theme via the theme control", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /Switch to light/ });
    fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("closes on the × button", () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
