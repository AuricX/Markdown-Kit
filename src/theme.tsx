import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "md-theme";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return "dark";
}

/**
 * Owns the dark/light theme. Drives two things off a single state:
 *   1. `data-theme` on <html> for the CSS-variable palette,
 *   2. persistence to localStorage.
 *
 * The highlight.js stylesheet is now managed by usePreviewTheme, keyed on
 * the independent preview-theme axis.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Best-effort persistence only.
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
