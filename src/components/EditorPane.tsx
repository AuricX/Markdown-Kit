interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Placeholder editor. Task 4 replaces the <textarea> with a real CodeMirror
 * instance. Keep the prop interface ({ value, onChange }) stable.
 */
export default function EditorPane({ value, onChange }: EditorPaneProps) {
  return (
    <div className="pane editor-pane">
      <textarea
        className="editor-textarea"
        aria-label="Markdown editor"
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    </div>
  );
}
