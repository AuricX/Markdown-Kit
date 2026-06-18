import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider, useTheme } from "../theme";
import { usePreviewTheme } from "../hooks/usePreviewTheme";
import { setSettings } from "../settings";

const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
beforeEach(() => localStorage.clear());

test("preview 'match' resolves to the app theme (default dark)", () => {
  setSettings({ previewTheme: "match" });
  const { result } = renderHook(() => usePreviewTheme(), { wrapper });
  expect(result.current).toBe("dark");
});

test("explicit previewTheme overrides app theme (dark app, light preview)", () => {
  setSettings({ previewTheme: "light" });
  const { result } = renderHook(() => usePreviewTheme(), { wrapper });
  expect(result.current).toBe("light");
});

test("app theme toggle flips data-theme + persists (theme.tsx no longer owns hljs)", () => {
  const { result } = renderHook(() => useTheme(), { wrapper });
  expect(document.documentElement.dataset.theme).toBe("dark");
  act(() => result.current.toggle());
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem("md-theme")).toBe("light");
});

test("usePreviewTheme injects the hljs <style> element (mechanism, keyed on resolved)", () => {
  setSettings({ previewTheme: "dark" });
  renderHook(() => usePreviewTheme(), { wrapper });
  expect(document.getElementById("hljs-theme")).toBeInstanceOf(HTMLStyleElement);
});
