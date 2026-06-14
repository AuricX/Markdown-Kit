import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
// `?inline` returns the CSS as a string instead of auto-injecting it, so we can
// swap the active highlight.js theme by hand when the app theme changes.
import githubDark from "highlight.js/styles/github-dark.css?inline";
import githubLight from "highlight.js/styles/github.css?inline";

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
 * Owns the dark/light theme. Drives three things off a single state:
 *   1. `data-theme` on <html> for the CSS-variable palette,
 *   2. the injected highlight.js stylesheet for code blocks,
 *   3. persistence to localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    let style = document.getElementById("hljs-theme") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "hljs-theme";
      document.head.appendChild(style);
    }
    style.textContent = theme === "dark" ? githubDark : githubLight;

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
