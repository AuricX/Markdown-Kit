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
    return <div className="single-pane">{left}</div>;
  }
  if (viewMode === "preview") {
    return <div className="single-pane">{right}</div>;
  }
  return (
    <PanelGroup direction="horizontal" className="split-group" autoSaveId="md-split">
      <Panel defaultSize={50} minSize={20} className="split-panel">
        {left}
      </Panel>
      <PanelResizeHandle className="split-handle" />
      <Panel defaultSize={50} minSize={20} className="split-panel">
        {right}
      </Panel>
    </PanelGroup>
  );
}
