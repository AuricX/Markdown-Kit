import type { Theme } from "../theme";

export type ViewMode = "split" | "editor" | "preview";

interface NavbarProps {
  fileName: string;
  dirty: boolean;
  viewMode: ViewMode;
  theme: Theme;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onPrint: () => void;
  onViewChange: (mode: ViewMode) => void;
  onToggleTheme: () => void;
}

const VIEW_OPTIONS: { mode: ViewMode; label: string; title: string }[] = [
  { mode: "editor", label: "Editor", title: "Editor only (⌘2)" },
  { mode: "split", label: "Split", title: "Split view (⌘1)" },
  { mode: "preview", label: "Preview", title: "Preview only (⌘3)" },
];

/**
 * Top toolbar: file actions on the left, the document name + dirty marker in the
 * middle, and the view-mode segmented control + theme toggle on the right.
 * Every action here mirrors a native-menu item so both stay in sync.
 */
export default function Navbar({
  fileName,
  dirty,
  viewMode,
  theme,
  onNew,
  onOpen,
  onSave,
  onPrint,
  onViewChange,
  onToggleTheme,
}: NavbarProps) {
  return (
    <div className="navbar" role="toolbar" aria-label="Main toolbar">
      <div className="navbar-group">
        <button type="button" className="navbar-btn" onClick={onNew} title="New (⌘N)">
          New
        </button>
        <button type="button" className="navbar-btn" onClick={onOpen} title="Open (⌘O)">
          Open
        </button>
        <button type="button" className="navbar-btn" onClick={onSave} title="Save (⌘S)">
          Save
        </button>
        <button type="button" className="navbar-btn" onClick={onPrint} title="Print to PDF (⌘P)">
          PDF
        </button>
      </div>

      <div className="navbar-title" aria-label="Document name">
        {fileName}
        {dirty && <span className="navbar-dirty" aria-label="unsaved changes"> ●</span>}
      </div>

      <div className="navbar-group">
        <div className="navbar-segment" role="group" aria-label="View mode">
          {VIEW_OPTIONS.map(({ mode, label, title }) => (
            <button
              key={mode}
              type="button"
              className={`navbar-seg-btn${viewMode === mode ? " is-active" : ""}`}
              aria-pressed={viewMode === mode}
              title={title}
              onClick={() => onViewChange(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="navbar-btn navbar-theme"
          onClick={onToggleTheme}
          title="Toggle light/dark (⌘⇧L)"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? "☀︎" : "☾"}
        </button>
      </div>
    </div>
  );
}
