import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider, useTheme } from "../theme";

function ThemeProbe() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      theme:{theme}
    </button>
  );
}

beforeEach(() => {
  localStorage.removeItem("md-theme");
  delete document.documentElement.dataset.theme;
});

describe("ThemeProvider", () => {
  it("defaults to dark and sets data-theme on <html>", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("theme:dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggles to light, updates <html> and persists to localStorage", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.getByRole("button")).toHaveTextContent("theme:light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("md-theme")).toBe("light");
  });

  it("restores the persisted theme on mount", () => {
    localStorage.setItem("md-theme", "light");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("theme:light");
  });

  it("injects a single highlight.js theme <style> element", () => {
    // The `?inline` CSS string is empty under the test transform, so we assert
    // the injection mechanism (one dedicated <style> element) rather than its
    // contents — real CSS is verified by the production build.
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    const styles = document.querySelectorAll("#hljs-theme");
    expect(styles).toHaveLength(1);
    expect(styles[0].tagName).toBe("STYLE");
  });
});
