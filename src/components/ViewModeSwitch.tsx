import { PanelLeft, Columns2, Eye } from "lucide-react";
import type { ViewMode } from "@/settings";
import { cn } from "@/lib/utils";

const OPTIONS: { mode: ViewMode; label: string; title: string; Icon: typeof PanelLeft }[] = [
  { mode: "editor", label: "Editor only", title: "⌘2", Icon: PanelLeft },
  { mode: "split", label: "Split view", title: "⌘1", Icon: Columns2 },
  { mode: "preview", label: "Preview only", title: "⌘3", Icon: Eye },
];

export default function ViewModeSwitch({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div role="group" aria-label="View mode" className="inline-flex rounded-md border border-border p-0.5">
      {OPTIONS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          aria-label={label}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            "inline-flex h-7 w-8 items-center justify-center rounded text-muted-foreground",
            "hover:text-foreground",
            value === mode && "bg-secondary text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
