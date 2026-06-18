import { Sun, Moon } from "lucide-react";
import { useTheme } from "../theme";
import {
  useSettings, setSettings, FONT_MIN, FONT_MAX,
  type ViewMode, type PreviewTheme,
} from "../settings";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
];
const PREVIEW_OPTIONS: { value: PreviewTheme; label: string }[] = [
  { value: "match", label: "Match app" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { theme, toggle } = useTheme();
  const { fontSize, defaultView, previewTheme } = useSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">App theme</span>
            <button
              type="button"
              onClick={toggle}
              aria-label={`Theme: ${theme}. Switch to ${theme === "dark" ? "light" : "dark"}.`}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          </div>

          <label className="flex items-center justify-between">
            <span className="text-sm">Font size</span>
            <span className="flex items-center gap-2">
              <input
                type="range"
                min={FONT_MIN}
                max={FONT_MAX}
                value={fontSize}
                aria-label="Font size"
                onChange={(e) => setSettings({ fontSize: Number(e.target.value) })}
              />
              <span className="w-10 text-right text-sm text-muted-foreground">{fontSize}px</span>
            </span>
          </label>

          <div className="flex items-center justify-between">
            <span className="text-sm">Default view</span>
            <Select value={defaultView} onValueChange={(v) => setSettings({ defaultView: v as ViewMode })}>
              <SelectTrigger className="w-40" aria-label="Default view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Preview theme</span>
            <Select value={previewTheme} onValueChange={(v) => setSettings({ previewTheme: v as PreviewTheme })}>
              <SelectTrigger className="w-40" aria-label="Preview theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREVIEW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
