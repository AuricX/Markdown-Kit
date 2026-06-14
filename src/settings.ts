import { useSyncExternalStore } from "react";
import type { ViewMode } from "./components/Navbar";

export interface Settings {
  /** Editor + preview font size in px. */
  fontSize: number;
  /** View mode the app opens in. */
  defaultView: ViewMode;
}

const STORAGE_KEY = "md-settings";
export const FONT_MIN = 10;
export const FONT_MAX = 24;
const DEFAULTS: Settings = { fontSize: 14, defaultView: "preview" };

function clampFont(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n)
    ? Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n)))
    : DEFAULTS.fontSize;
}

function isViewMode(v: unknown): v is ViewMode {
  return v === "split" || v === "editor" || v === "preview";
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      return {
        fontSize: clampFont(p.fontSize),
        defaultView: isViewMode(p.defaultView) ? p.defaultView : DEFAULTS.defaultView,
      };
    }
  } catch {
    // Corrupt/unavailable storage — fall back to defaults.
  }
  return { ...DEFAULTS };
}

// Module-level reactive store: shared across App and the Settings modal without
// a context provider, so components that only read settings work even when
// rendered bare (e.g. in tests). getSnapshot returns a stable reference between
// mutations, as useSyncExternalStore requires.
let state: Settings = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort persistence.
  }
}

export function getSettings(): Settings {
  return state;
}

export function setSettings(patch: Partial<Settings>) {
  const next: Settings = {
    fontSize: patch.fontSize !== undefined ? clampFont(patch.fontSize) : state.fontSize,
    defaultView: isViewMode(patch.defaultView) ? patch.defaultView : state.defaultView,
  };
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
