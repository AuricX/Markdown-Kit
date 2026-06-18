import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export interface OsHandlers {
  dirty: boolean;
  loadFile: (path: string) => void | Promise<void>;
  newDoc: () => void;
  openFromDialog: () => void | Promise<void>;
  save: () => void | Promise<void>;
  printToPdf: () => void;
  toggleTheme: () => void;
  openSettings: () => void;
  setViewMode: (m: "split" | "editor" | "preview") => void;
  checkDisk: () => void | Promise<void>;
}

export function useOsIntegration(h: OsHandlers): void {
  const ref = useRef(h);
  ref.current = h;

  // Drag-and-drop: open the first dropped file.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    (async () => {
      try {
        const un = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === "drop" && event.payload.paths.length > 0) {
            ref.current.loadFile(event.payload.paths[0]);
          }
        });
        if (active) unlisten = un;
        else un();
      } catch {
        // Not inside Tauri — drag-drop unavailable.
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
        const un = await listen<string>("file-opened", (e) => ref.current.loadFile(e.payload));
        if (active) unlisten = un;
        else un();
      } catch {
        // Not inside Tauri — file-opened unavailable.
      }
      try {
        const paths = (await invoke("take_pending_file")) as string[];
        if (paths.length > 0) ref.current.loadFile(paths[paths.length - 1]);
      } catch {
        // Not inside Tauri — no pending file.
      }
    })();
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  // Native-menu events → the same handlers the toolbar uses.
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let active = true;
    (async () => {
      try {
        unlisteners.push(await listen("menu-new", () => ref.current.newDoc()));
        unlisteners.push(await listen("menu-open", () => ref.current.openFromDialog()));
        unlisteners.push(await listen("menu-save", () => ref.current.save()));
        unlisteners.push(await listen("menu-print", () => ref.current.printToPdf()));
        unlisteners.push(await listen("menu-theme", () => ref.current.toggleTheme()));
        unlisteners.push(await listen("menu-settings", () => ref.current.openSettings()));
        unlisteners.push(
          await listen<string>("menu-view", (e) => {
            const m = e.payload;
            if (m === "split" || m === "editor" || m === "preview") ref.current.setViewMode(m);
          })
        );
        unlisteners.push(
          await listen("confirm-quit", () => {
            if (window.confirm("You have unsaved changes. Quit without saving?")) {
              void invoke("quit_app").catch(() => {});
            }
          })
        );
      } catch {
        // Not inside Tauri — menu events unavailable.
      }
      if (!active) unlisteners.forEach((u) => u());
    })();
    return () => {
      active = false;
      unlisteners.forEach((u) => u());
    };
  }, []);

  // External-modification detection on window focus.
  useEffect(() => {
    const onFocus = () => ref.current.checkDisk();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Mirror dirty into the backend for the native quit guard.
  useEffect(() => {
    void invoke("set_dirty", { dirty: h.dirty }).catch(() => {
      // Not inside Tauri — quit guarding unavailable.
    });
  }, [h.dirty]);
}
