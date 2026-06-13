import { useEffect, useState } from "react";
import SplitView from "./components/SplitView";
import EditorPane from "./components/EditorPane";
import PreviewPane from "./components/PreviewPane";

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [dirty, setDirty] = useState<boolean>(false);

  // setFilePath is unused until Task 5 wires file I/O; reference it so the
  // strict "noUnusedLocals" check passes without disabling the setter.
  void setFilePath;

  function handleChange(next: string) {
    setContent(next);
    setDirty(true);
  }

  useEffect(() => {
    const name = filePath ? basename(filePath) : "Untitled";
    const title = `${name}${dirty ? " ●" : ""}`;
    document.title = title;

    // Best-effort native window title. Wrapped so it never throws outside Tauri
    // (e.g. in the browser dev server or jsdom tests).
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setTitle(title);
      } catch {
        // Not running inside Tauri — document.title is sufficient.
      }
    })();
  }, [filePath, dirty]);

  return (
    <div className="app">
      <SplitView
        left={<EditorPane value={content} onChange={handleChange} />}
        right={<PreviewPane value={content} />}
      />
    </div>
  );
}

export default App;
