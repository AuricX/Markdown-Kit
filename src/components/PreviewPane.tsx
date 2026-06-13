import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

interface PreviewPaneProps {
  value: string;
}

/**
 * Rendered markdown preview (right pane). GFM (tables, task lists,
 * strikethrough) via remark-gfm; code-block highlighting via rehype-highlight.
 *
 * SECURITY: raw HTML is intentionally NOT enabled (no rehype-raw). react-markdown
 * escapes HTML by default, protecting against <script> in adversarial .md files.
 */
export default function PreviewPane({ value }: PreviewPaneProps) {
  return (
    <div className="pane preview-pane" aria-label="Markdown preview">
      <div className="markdown-body">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {value}
        </Markdown>
      </div>
    </div>
  );
}
