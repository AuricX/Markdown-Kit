import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { ReactNode } from "react";

interface SplitViewProps {
  left: ReactNode;
  right: ReactNode;
}

/**
 * Horizontal 50/50 split with a draggable, VSCode-styled divider.
 * Min sizes keep either pane from collapsing.
 */
export default function SplitView({ left, right }: SplitViewProps) {
  return (
    <PanelGroup direction="horizontal" className="split-group">
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
