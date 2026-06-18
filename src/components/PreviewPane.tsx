import type { MouseEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { openUrl } from "@tauri-apps/plugin-opener";

interface PreviewPaneProps {
  value: string;
  resolvedTheme: "light" | "dark";
}

// External (http/https) links must open in the user's browser, not navigate the
// app's webview away from the document. In-page anchors (#…) keep default behavior.
function handleLinkClick(e: MouseEvent<HTMLAnchorElement>, href?: string) {
  if (href && /^https?:\/\//i.test(href)) {
    e.preventDefault();
    void openUrl(href).catch(() => {
      // Not inside Tauri (browser/jsdom) — let the default action stand.
    });
  }
}

/**
 * Rendered markdown preview (right pane). GFM (tables, task lists,
 * strikethrough) via remark-gfm; code-block highlighting via rehype-highlight.
 * The active highlight.js stylesheet is injected by ThemeProvider.
 *
 * SECURITY: raw HTML is intentionally NOT enabled (no rehype-raw). react-markdown
 * escapes HTML by default, protecting against <script> in adversarial .md files.
 */
export default function PreviewPane({ value, resolvedTheme }: PreviewPaneProps) {
  return (
    <div className="pane preview-pane" data-preview-theme={resolvedTheme} aria-label="Markdown preview">
      <div className={`markdown-body${resolvedTheme === "dark" ? " prose-invert" : ""}`}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            a: ({ href, children, ...props }) => (
              <a href={href} onClick={(e) => handleLinkClick(e, href)} {...props}>
                {children}
              </a>
            ),
          }}
        >
          {value}
        </Markdown>
      </div>
    </div>
  );
}
