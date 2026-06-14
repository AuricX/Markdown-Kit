import { useTheme } from "../theme";
import { useSettings, setSettings, FONT_MIN, FONT_MAX } from "../settings";
import type { ViewMode } from "./Navbar";

interface SettingsModalProps {
  onClose: () => void;
}

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
];

/**
 * Settings dialog: theme, font size, and the default view mode. Theme lives in
 * ThemeProvider; font size and default view live in the settings store. Clicking
 * the backdrop or × closes it; Escape is handled by the parent.
 */
export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { theme, toggle } = useTheme();
  const { fontSize, defaultView } = useSettings();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close settings"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="setting-row">
            <span className="setting-label">Theme</span>
            <button
              type="button"
              className="setting-control setting-toggle"
              onClick={toggle}
              aria-label={`Theme: ${theme}. Switch to ${theme === "dark" ? "light" : "dark"}.`}
            >
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          </div>

          <label className="setting-row">
            <span className="setting-label">Font size</span>
            <span className="setting-control">
              <input
                type="range"
                min={FONT_MIN}
                max={FONT_MAX}
                value={fontSize}
                aria-label="Font size"
                onChange={(e) => setSettings({ fontSize: Number(e.target.value) })}
              />
              <span className="setting-value">{fontSize}px</span>
            </span>
          </label>

          <label className="setting-row">
            <span className="setting-label">Default view</span>
            <select
              className="setting-control"
              aria-label="Default view"
              value={defaultView}
              onChange={(e) => setSettings({ defaultView: e.target.value as ViewMode })}
            >
              {VIEW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
