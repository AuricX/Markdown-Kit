import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { indentWithTab } from "@codemirror/commands";
import { useTheme } from "../theme";

interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
}

const MONO_STACK =
  "'SF Mono', Menlo, Monaco, Consolas, 'Courier New', monospace";

// VSCode-like: 4-space indentation inserted on Tab, mono font, full height.
const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontFamily: MONO_STACK,
    fontSize: "13px",
  },
  ".cm-content": {
    fontFamily: MONO_STACK,
  },
  ".cm-gutters": {
    fontFamily: MONO_STACK,
  },
});

const extensions = [
  markdown(),
  EditorState.tabSize.of(4),
  indentUnit.of("    "),
  keymap.of([indentWithTab]),
  editorTheme,
  EditorView.lineWrapping,
];

/**
 * CodeMirror 6 markdown editor (left pane). The accessible label lives on the
 * wrapping <div> because CodeMirror renders a contenteditable, not a textarea.
 */
export default function EditorPane({ value, onChange }: EditorPaneProps) {
  const { theme } = useTheme();
  return (
    <div className="pane editor-pane" aria-label="Markdown editor">
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={theme === "dark" ? oneDark : "light"}
        extensions={extensions}
        height="100%"
        style={{ height: "100%" }}
        basicSetup={{ lineNumbers: true, highlightActiveLine: true }}
      />
    </div>
  );
}
