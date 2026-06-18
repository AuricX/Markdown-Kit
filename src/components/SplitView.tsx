import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ReactNode } from "react";
import type { ViewMode } from "../settings";

interface SplitViewProps {
  left: ReactNode;
  right: ReactNode;
  viewMode: ViewMode;
}

/**
 * Layout switch driven by `viewMode`:
 *   - "split"   → draggable 50/50 split (ratio persisted via autoSaveId),
 *   - "editor"  → editor only,
 *   - "preview" → preview only.
 * Min sizes keep either pane from collapsing in split mode.
 */
export default function SplitView({ left, right, viewMode }: SplitViewProps) {
  if (viewMode === "editor") {
    return <div className="min-h-0 flex-1">{left}</div>;
  }
  if (viewMode === "preview") {
    return <div className="min-h-0 flex-1">{right}</div>;
  }
  return (
    <PanelGroup direction="horizontal" className="min-h-0 flex-1" autoSaveId="md-split">
      <Panel defaultSize={50} minSize={20} className="min-h-0">
        {left}
      </Panel>
      <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-ring data-[resize-handle-active]:bg-ring" />
      <Panel defaultSize={50} minSize={20} className="min-h-0">
        {right}
      </Panel>
    </PanelGroup>
  );
}
