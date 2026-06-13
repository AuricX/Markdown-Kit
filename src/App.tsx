import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import SplitView from "./components/SplitView";
import EditorPane from "./components/EditorPane";
import PreviewPane from "./components/PreviewPane";
import ErrorBanner from "./components/ErrorBanner";

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [dirty, setDirty] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // The drag-drop / file-opened / keydown listeners are subscribed once on
  // mount, so their closures would capture stale state. Mirror the live values
  // into refs that those handlers read instead.
  const filePathRef = useRef(filePath);
  const contentRef = useRef(content);
  const dirtyRef = useRef(dirty);
  filePathRef.current = filePath;
  contentRef.current = content;
  dirtyRef.current = dirty;

  function handleChange(next: string) {
    setContent(next);
    setDirty(true);
  }

  // Load a file into the editor, prompting if there are unsaved changes.
  // Defined as a ref-stable callback so the mount-time listeners can call it.
  async function loadFile(path: string) {
    if (dirtyRef.current && !window.confirm("Discard unsaved changes?")) {
      return;
    }
    try {
      const text = (await invoke("read_md", { path })) as string;
      setContent(text);
      setFilePath(path);
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(`Failed to open file: ${String(e)}`);
    }
  }
  const loadFileRef = useRef(loadFile);
  loadFileRef.current = loadFile;

  async function save() {
    let path = filePathRef.current;
    if (!path) {
      // Save-As: ask the user where to write.
      try {
        path = await saveDialog({
          filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx"] }],
        });
      } catch (e) {
        setError(`Save failed: ${String(e)}`);
        return;
      }
      if (!path) return; // user cancelled
    }
    try {
      await invoke("save_md", { path, content: contentRef.current });
      setFilePath(path);
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(`Save failed: ${String(e)}`);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;

  // Cmd/Ctrl+S → save.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Webview drag-and-drop: open the first dropped file.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    (async () => {
      try {
        const un = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === "drop" && event.payload.paths.length > 0) {
            loadFileRef.current(event.payload.paths[0]);
          }
        });
        if (active) unlisten = un;
        else un();
      } catch {
        // Not running inside Tauri — drag-drop is unavailable.
      }
    })();
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  // Finder "Open with": live event + cold-start pending file.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    (async () => {
      try {
        const un = await listen<string>("file-opened", (e) => {
          loadFileRef.current(e.payload);
        });
        if (active) unlisten = un;
        else un();
      } catch {
        // Not running inside Tauri — file-opened events are unavailable.
      }
      try {
        const paths = (await invoke("take_pending_file")) as string[];
        if (paths.length > 0) {
          loadFileRef.current(paths[paths.length - 1]);
        }
      } catch {
        // Not running inside Tauri — no pending file to take.
      }
    })();
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const name = filePath ? basename(filePath) : "Untitled";
    const title = `${name}${dirty ? " ●" : ""}`;
    document.title = title;

    // Best-effort native window title. Wrapped so it never throws outside Tauri
    // (e.g. in the browser dev server or jsdom tests).
    try {
      void getCurrentWindow().setTitle(title);
    } catch {
      // Not running inside Tauri — document.title is sufficient.
    }
  }, [filePath, dirty]);

  return (
    <div className="app">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <SplitView
        left={<EditorPane value={content} onChange={handleChange} />}
        right={<PreviewPane value={content} />}
      />
    </div>
  );
}

export default App;
