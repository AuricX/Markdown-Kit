import { FilePlus2, FolderOpen, Save, FileDown, Settings, Circle } from "lucide-react";
import type { ViewMode } from "@/settings";
import ToolbarButton from "./ToolbarButton";
import ViewModeSwitch from "./ViewModeSwitch";

interface ToolbarProps {
  fileName: string;
  dirty: boolean;
  viewMode: ViewMode;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onPrint: () => void;
  onViewChange: (mode: ViewMode) => void;
  onOpenSettings: () => void;
}

export default function Toolbar({
  fileName, dirty, viewMode, onNew, onOpen, onSave, onPrint, onViewChange, onOpenSettings,
}: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Main toolbar"
      className="flex h-10 items-center gap-1 border-b border-border bg-card px-2 text-card-foreground"
    >
      <div className="flex items-center gap-0.5">
        <ToolbarButton icon={FilePlus2} label="New" shortcut="⌘N" onClick={onNew} />
        <ToolbarButton icon={FolderOpen} label="Open" shortcut="⌘O" onClick={onOpen} />
        <ToolbarButton icon={Save} label="Save" shortcut="⌘S" onClick={onSave} />
        <ToolbarButton icon={FileDown} label="Print to PDF" shortcut="⌘P" onClick={onPrint} />
      </div>

      <div className="flex flex-1 items-center justify-center gap-1.5 truncate text-sm" aria-label="Document name">
        <span className="truncate">{fileName}</span>
        {dirty && <Circle className="h-2 w-2 shrink-0 fill-current" aria-label="unsaved changes" />}
      </div>

      <div className="flex items-center gap-1">
        <ViewModeSwitch value={viewMode} onChange={onViewChange} />
        <ToolbarButton icon={Settings} label="Settings" shortcut="⌘," onClick={onOpenSettings} />
      </div>
    </div>
  );
}
