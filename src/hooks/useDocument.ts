import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export interface UseDocument {
  filePath: string | null;
  content: string;
  dirty: boolean;
  error: string | null;
  diskChanged: boolean;
  setError: (e: string | null) => void;
  setDiskChanged: (v: boolean) => void;
  onChange: (next: string) => void;
  newDoc: () => void;
  openFromDialog: () => Promise<void>;
  save: () => Promise<void>;
  loadFile: (path: string) => Promise<void>;
  checkDisk: () => Promise<void>;
}

export function useDocument(): UseDocument {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [dirty, setDirty] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [diskChanged, setDiskChanged] = useState<boolean>(false);

  // Live mirrors for the once-subscribed OS listeners (see useOsIntegration).
  const filePathRef = useRef(filePath);
  const contentRef = useRef(content);
  const dirtyRef = useRef(dirty);
  const lastMtimeRef = useRef<number | null>(null);
  filePathRef.current = filePath;
  contentRef.current = content;
  dirtyRef.current = dirty;

  function onChange(next: string) {
    setContent(next);
    setDirty(true);
  }

  async function rememberMtime(path: string) {
    try {
      lastMtimeRef.current = (await invoke("file_mtime", { path })) as number;
    } catch {
      lastMtimeRef.current = null;
    }
  }

  async function loadFile(path: string) {
    if (dirtyRef.current && !window.confirm("Discard unsaved changes?")) return;
    try {
      const text = (await invoke("read_md", { path })) as string;
      setContent(text);
      setFilePath(path);
      setDirty(false);
      setDiskChanged(false);
      setError(null);
      void rememberMtime(path);
      try {
        await invoke("add_recent_file", { path });
      } catch {
        // Not inside Tauri — recent-files tracking unavailable.
      }
    } catch (e) {
      setError(`Failed to open file: ${String(e)}`);
    }
  }

  function newDoc() {
    if (dirtyRef.current && !window.confirm("Discard unsaved changes?")) return;
    setContent("");
    setFilePath(null);
    setDirty(false);
    setDiskChanged(false);
    setError(null);
    lastMtimeRef.current = null;
  }

  async function openFromDialog() {
    try {
      const picked = await openDialog({
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx"] }],
      });
      if (typeof picked === "string") await loadFile(picked);
    } catch (e) {
      setError(`Open failed: ${String(e)}`);
    }
  }

  async function save() {
    let path = filePathRef.current;
    if (!path) {
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

  return {
    filePath, content, dirty, error, diskChanged,
    setError, setDiskChanged,
    onChange, newDoc, openFromDialog, save, loadFile, checkDisk,
  };
}
