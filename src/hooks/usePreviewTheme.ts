import { useEffect } from "react";
// `?inline` returns the CSS as a string so we can hot-swap the active hljs theme.
import githubDark from "highlight.js/styles/github-dark.css?inline";
import githubLight from "highlight.js/styles/github.css?inline";
import { useTheme } from "../theme";
import { useSettings } from "../settings";

/**
 * Resolves the independent preview-theme axis ("match" follows the app theme),
 * swaps the global highlight.js stylesheet to match the RESOLVED preview theme,
 * and returns "light" | "dark" for the preview container to apply.
 */
export function usePreviewTheme(): "light" | "dark" {
  const { theme: appTheme } = useTheme();
  const { previewTheme } = useSettings();
  const resolved = previewTheme === "match" ? appTheme : previewTheme;

  useEffect(() => {
    let style = document.getElementById("hljs-theme") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "hljs-theme";
      document.head.appendChild(style);
    }
    style.textContent = resolved === "dark" ? githubDark : githubLight;
  }, [resolved]);

  return resolved;
}
