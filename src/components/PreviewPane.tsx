interface PreviewPaneProps {
  value: string;
}

/**
 * Placeholder preview. Task 4 replaces the <pre> with rendered markdown.
 * Keep the prop interface ({ value }) stable.
 */
export default function PreviewPane({ value }: PreviewPaneProps) {
  return (
    <div className="pane preview-pane">
      <pre className="preview-content" aria-label="Markdown preview">
        {value}
      </pre>
    </div>
  );
}
