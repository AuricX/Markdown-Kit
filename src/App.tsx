import { useDeferredValue, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import SplitView from "./components/SplitView";
import EditorPane from "./components/EditorPane";
import PreviewPane from "./components/PreviewPane";
import ErrorBanner from "./components/ErrorBanner";
import Navbar from "./components/Navbar";
import type { ViewMode } from "./settings";
import SettingsModal from "./components/SettingsModal";
import { useTheme } from "./theme";
import { useSettings, getSettings } from "./settings";
import { checkForUpdates } from "./updater";

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [dirty, setDirty] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [diskChanged, setDiskChanged] = useState<boolean>(false);
  // Initial view comes from the saved "default view" setting (preview by default).
  const [viewMode, setViewMode] = useState<ViewMode>(() => getSettings().defaultView);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const { toggle: toggleTheme } = useTheme();
  const settings = useSettings();

  // Preview lags the editor by a frame so fast typing doesn't re-render the
  // (relatively expensive) markdown tree on every keystroke.
  const deferredContent = useDeferredValue(content);

  // The mount-time OS listeners (drag-drop / file-opened / menu / keydown) are
  // subscribed once, so their closures would capture stale state. Mirror live
  // values into refs that those handlers read instead.
  const filePathRef = useRef(filePath);
  const contentRef = useRef(content);
  const dirtyRef = useRef(dirty);
  const viewModeRef = useRef(viewMode);
  const lastMtimeRef = useRef<number | null>(null);
  // toggleTheme comes from context (stable per render); mirror via ref so the
  // once-subscribed menu-event listener always calls the current one.
  const toggleThemeRef = useRef(toggleTheme);
  filePathRef.current = filePath;
  contentRef.current = content;
  dirtyRef.current = dirty;
  viewModeRef.current = viewMode;
  toggleThemeRef.current = toggleTheme;

  // Apply the configured default view live (e.g. changed in Settings) and adopt
  // it on mount. Manual navbar/menu toggles don't change the setting, so they
  // aren't overridden.
  useEffect(() => {
    setViewMode(settings.defaultView);
  }, [settings.defaultView]);

  // Drive editor + preview font size from the setting via a CSS variable.
  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-size", `${settings.fontSize}px`);
  }, [settings.fontSize]);

  function handleChange(next: string) {
    setContent(next);
    setDirty(true);
  }

  // Record the on-disk mtime of the current file so we can later detect external
  // edits. Best-effort; silently no-ops outside Tauri.
  async function rememberMtime(path: string) {
    try {
      lastMtimeRef.current = (await invoke("file_mtime", { path })) as number;
    } catch {
      lastMtimeRef.current = null;
    }
  }

  // Load a file into the editor, prompting if there are unsaved changes.
  async function loadFile(path: string) {
    if (dirtyRef.current && !window.confirm("Discard unsaved changes?")) {
      return;
    }
    try {
      const text = (await invoke("read_md", { path })) as string;
      setContent(text);
      setFilePath(path);
      setDirty(false);
      setDiskChanged(false);
      setError(null);
      void rememberMtime(path);
      // Record in the persisted "Open Recent" list (rebuilds the native menu).
      try {
        await invoke("add_recent_file", { path });
      } catch {
        // Not inside Tauri — recent-files tracking unavailable.
      }
    } catch (e) {
      setError(`Failed to open file: ${String(e)}`);
    }
  }
  const loadFileRef = useRef(loadFile);
  loadFileRef.current = loadFile;

  // New empty document (dirty-guarded).
  function newDoc() {
    if (dirtyRef.current && !window.confirm("Discard unsaved changes?")) {
      return;
    }
    setContent("");
    setFilePath(null);
    setDirty(false);
    setDiskChanged(false);
    setError(null);
    lastMtimeRef.current = null;
  }
  const newDocRef = useRef(newDoc);
  newDocRef.current = newDoc;

  // Open via the native file dialog.
  async function openFromDialog() {
    try {
      const picked = await openDialog({
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx"] }],
      });
      if (typeof picked === "string") {
        await loadFileRef.current(picked);
      }
    } catch (e) {
      setError(`Open failed: ${String(e)}`);
    }
  }
  const openFromDialogRef = useRef(openFromDialog);
  openFromDialogRef.current = openFromDialog;

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
      setDiskChanged(false);
      setError(null);
      void rememberMtime(path);
      try {
        await invoke("add_recent_file", { path });
      } catch {
        // ignore outside Tauri
      }
    } catch (e) {
      setError(`Save failed: ${String(e)}`);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;

  // Print-to-PDF: print the rendered preview via the webview's print dialog
  // (the user picks "Save as PDF"). A print stylesheet hides everything but the
  // preview. Editor-only mode is briefly switched to split so the preview is
  // actually mounted to print.
  function printToPdf() {
    const restore = viewModeRef.current;
    if (restore === "editor") setViewMode("split");
    // Two rAFs: let React mount the preview and the browser paint before printing.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        try {
          window.print();
        } finally {
          if (restore === "editor") setViewMode("editor");
        }
      })
    );
  }
  const printToPdfRef = useRef(printToPdf);
  printToPdfRef.current = printToPdf;

  // Cmd/Ctrl+S → save; Escape closes the settings modal. (Other shortcuts are
  // owned by the native menu.)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current();
      } else if (e.key === "Escape") {
        setSettingsOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Signal the backend that the UI has mounted (for opt-in launch timing).
  useEffect(() => {
    void invoke("report_ready").catch(() => {});
  }, []);

  // Check GitHub Releases for an update once on launch (best-effort, prompts).
  useEffect(() => {
    void checkForUpdates();
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

  // Native-menu events → the same handlers the navbar buttons use.
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let active = true;
    (async () => {
      try {
        unlisteners.push(await listen("menu-new", () => newDocRef.current()));
        unlisteners.push(await listen("menu-open", () => openFromDialogRef.current()));
        unlisteners.push(await listen("menu-save", () => saveRef.current()));
        unlisteners.push(await listen("menu-print", () => printToPdfRef.current()));
        unlisteners.push(await listen("menu-theme", () => toggleThemeRef.current()));
        unlisteners.push(await listen("menu-settings", () => setSettingsOpen(true)));
        unlisteners.push(
          await listen<string>("menu-view", (e) => {
            const m = e.payload;
            if (m === "split" || m === "editor" || m === "preview") setViewMode(m);
          })
        );
        // Backend asks us to confirm a quit that would lose unsaved changes.
        unlisteners.push(
          await listen("confirm-quit", () => {
            if (window.confirm("You have unsaved changes. Quit without saving?")) {
              void invoke("quit_app").catch(() => {});
            }
          })
        );
      } catch {
        // Not running inside Tauri — menu events unavailable.
      }
      if (!active) unlisteners.forEach((u) => u());
    })();
    return () => {
      active = false;
      unlisteners.forEach((u) => u());
    };
  }, []);

  // Detect external modification: when the window regains focus, re-stat the
  // open file and flag a mismatch so the user can reload.
  useEffect(() => {
    async function checkDisk() {
      const path = filePathRef.current;
      if (!path || lastMtimeRef.current == null) return;
      try {
        const mtime = (await invoke("file_mtime", { path })) as number;
        if (mtime !== lastMtimeRef.current) setDiskChanged(true);
      } catch {
        // File gone or not in Tauri — ignore.
      }
    }
    window.addEventListener("focus", checkDisk);
    return () => window.removeEventListener("focus", checkDisk);
  }, []);

  // Mirror the dirty flag into the backend so the native quit (Cmd+Q / menu)
  // can guard against discarding unsaved changes.
  useEffect(() => {
    void invoke("set_dirty", { dirty }).catch(() => {
      // Not inside Tauri — quit guarding unavailable.
    });
  }, [dirty]);

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

  const fileName = filePath ? basename(filePath) : "Untitled";

  return (
    <div className="app">
      <Navbar
        fileName={fileName}
        dirty={dirty}
        viewMode={viewMode}
        onNew={newDoc}
        onOpen={openFromDialog}
        onSave={save}
        onPrint={printToPdf}
        onViewChange={setViewMode}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {diskChanged && (
        <ErrorBanner
          message="This file changed on disk."
          actionLabel="Reload"
          onAction={() => filePath && loadFile(filePath)}
          onDismiss={() => setDiskChanged(false)}
        />
      )}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <SplitView
        viewMode={viewMode}
        left={<EditorPane value={content} onChange={handleChange} />}
        right={<PreviewPane value={deferredContent} />}
      />
    </div>
  );
}

export default App;
