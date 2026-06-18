import { useDeferredValue, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import SplitView from "./components/SplitView";
import EditorPane from "./components/EditorPane";
import PreviewPane from "./components/PreviewPane";
import ErrorBanner from "./components/ErrorBanner";
import Toolbar from "./components/Toolbar";
import type { ViewMode } from "./settings";
import SettingsModal from "./components/SettingsModal";
import { useTheme } from "./theme";
import { useSettings, getSettings } from "./settings";
import { checkForUpdates } from "./updater";
import { useDocument, basename } from "./hooks/useDocument";
import { useOsIntegration } from "./hooks/useOsIntegration";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePreviewTheme } from "./hooks/usePreviewTheme";

function App() {
  const {
    filePath, content, dirty, error, diskChanged,
    setError, setDiskChanged,
    onChange, newDoc, openFromDialog, save, loadFile, checkDisk,
  } = useDocument();

  // Initial view comes from the saved "default view" setting (preview by default).
  const [viewMode, setViewMode] = useState<ViewMode>(() => getSettings().defaultView);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const { toggle: toggleTheme } = useTheme();
  const settings = useSettings();
  const previewTheme = usePreviewTheme();

  // Preview lags the editor by a frame so fast typing doesn't re-render the
  // (relatively expensive) markdown tree on every keystroke.
  const deferredContent = useDeferredValue(content);

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

  // Print-to-PDF: print the rendered preview via the webview's print dialog
  // (the user picks "Save as PDF"). A print stylesheet hides everything but the
  // preview. Editor-only mode is briefly switched to split so the preview is
  // actually mounted to print.
  //
  // Reads `viewMode` directly from render scope — safe because useOsIntegration
  // ref-mirrors `printToPdf`, so menu-print always invokes the current closure.
  function printToPdf() {
    const restore = viewMode;
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

  // Consolidate all OS-level listeners (drag-drop, file-opened, menu events,
  // focus disk-check, dirty-mirror, confirm-quit) into a single hook.
  useOsIntegration({
    dirty,
    loadFile,
    newDoc,
    openFromDialog,
    save,
    printToPdf,
    toggleTheme,
    openSettings: () => setSettingsOpen(true),
    setViewMode,
    checkDisk,
  });

  // Cmd/Ctrl+S → save; Escape closes the settings modal. (Other shortcuts are
  // owned by the native menu.) Uses the keyboard hook with ref-mirroring to avoid
  // re-attaching the listener on every `save` change.
  useKeyboardShortcuts({ onSave: save, onEscape: () => setSettingsOpen(false) });

  // Signal the backend that the UI has mounted (for opt-in launch timing).
  useEffect(() => {
    void invoke("report_ready").catch(() => {});
  }, []);

  // Check GitHub Releases for an update once on launch (best-effort, prompts).
  useEffect(() => {
    void checkForUpdates();
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

  const fileName = filePath ? basename(filePath) : "Untitled";

  return (
    <div className="app">
      <Toolbar
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
        left={<EditorPane value={content} onChange={onChange} />}
        right={<PreviewPane value={deferredContent} resolvedTheme={previewTheme} />}
      />
    </div>
  );
}

export default App;
