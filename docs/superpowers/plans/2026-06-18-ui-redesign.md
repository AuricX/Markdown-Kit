# UI Redesign Implementation Plan — Tailwind v4 + shadcn/ui + Lucide

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing 3-pane Markdown Kit editor to a VSCode-like aesthetic with Tailwind v4 + shadcn/ui + Lucide, split `App.tsx` into focused hooks/components, and add an independent preview theme — frontend (`src/`) only.

**Architecture:** Keep the IDE shape (CodeMirror ‖ react-markdown, resizable). `App.tsx` becomes thin composition; state/effects move into `useDocument` / `useOsIntegration` / `useKeyboardShortcuts`. Theme gains two independent axes: app theme (`light|dark`, `theme.tsx`) and preview theme (`match|light|dark`, settings store) resolved by `usePreviewTheme`. Styling moves from a 548-line `styles.css` to Tailwind utilities + a ~80–120 line `index.css` token bridge.

**Tech Stack:** Tauri v2 (untouched) · React 19 · TypeScript · Vite 8 · Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first) · `@tailwindcss/typography` · shadcn/ui (Radix + Tailwind, copy-paste) · `lucide-react` · CodeMirror 6 · react-markdown · react-resizable-panels · Vitest + Testing Library.

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from the spec + repo.

- **Scope:** `src/` only. Do NOT touch `src-tauri/`, the native menu, updater logic, CI, `tauri.conf.json`, or `capabilities/`.
- **Package manager:** `pnpm` only — never `npm`/`npx`. Run bins via `pnpm exec` / `pnpm dlx`.
- **Version pins (do not bump):** tauri 2.11 / dialog 2.7 / opener 2.5 / process 2.3 / updater 2.10 / single-instance 2.4; `@tauri-apps/*` JS same major/minor. rustc ≥1.88. React 19, Vite 8, TypeScript 6, Vitest 4.
- **Tree-shaking:** `lucide-react` via **named imports only** (`import { Save } from "lucide-react"`). Every added dep must tree-shake; net CSS must shrink.
- **No new deps beyond the spec §5 list.** Slider = native `<input type="range">`; Separator = bordered div (no primitive).
- **Security (unchanged):** no `rehype-raw` (raw HTML stays escaped in preview). CSP in `tauri.conf.json` is NOT edited — `style-src 'self' 'unsafe-inline'` already covers Radix inline styles + the static Tailwind file.
- **Tauri-guarded:** every Tauri `invoke`/`listen`/window call stays try/catch-guarded so the frontend runs in browser/jsdom.
- **Menu/toolbar parity:** every toolbar action mirrors a native-menu event handler — keep them wired to the same callbacks.
- **TypeScript strictness:** `noUnusedLocals` + `noUnusedParameters` are on — no dead imports/params will compile. `src/test/**` is excluded from `tsconfig` build.

### Plan-level decisions (not in spec — flagged for review)

1. **`ViewMode` type relocates from `components/Navbar.tsx` → `settings.ts`.** It is domain state (persisted as `defaultView`); this removes the current store→component import and survives the Navbar→Toolbar rename. All importers repoint to `./settings` / `../settings`.
2. **CSS transition keeps BOTH stylesheets imported** (`index.css` + `styles.css`) until the final CSS-reduction task, deleting `styles.css` rules incrementally. This overrides spec §11.1's literal "renders unstyled-but-working" in favor of a styled, runnable app at every step (the stated §11 goal). Old CSS uses semantic classes (`.navbar`, `.markdown-body`); Tailwind uses utilities — negligible clash risk.
3. **Verification model:** per locked decision §4 ("delete all 7 tests now, rewrite after"), refactor/restyle tasks (4–15) gate on `pnpm build` (tsc + vite) clean **+ manual smoke check**, not failing-test-first TDD. The test suite is rewritten in Task 16 and is where `previewTheme` logic + a11y get covered.

---

## File Structure

**Create:**
- `src/index.css` — Tailwind entry + `@theme` tokens + VSCode Dark+/Light+ palettes + preview palettes + migrated essentials (replaces `styles.css`).
- `src/lib/utils.ts` — `cn()` = `twMerge(clsx(...))`.
- `src/components/ui/{button,dialog,select,tooltip}.tsx` — shadcn copy-paste (CLI-generated).
- `src/hooks/useDocument.ts` — filePath/content/dirty/error/diskChanged + load/save/new + mtime + disk check.
- `src/hooks/useOsIntegration.ts` — drag-drop, file-opened+pending, menu events, focus disk-check, dirty-mirror, confirm-quit.
- `src/hooks/useKeyboardShortcuts.ts` — Cmd/Ctrl+S save (+ Escape until Radix Dialog owns it).
- `src/hooks/usePreviewTheme.ts` — resolve preview theme → hljs swap; returns resolved `light|dark`.
- `src/components/Toolbar.tsx` — was `Navbar.tsx`.
- `src/components/ToolbarButton.tsx` — icon button + Radix Tooltip.
- `src/components/ViewModeSwitch.tsx` — segmented control.
- `src/components/Banner.tsx` — was `ErrorBanner.tsx`.
- `src/components/SettingsDialog.tsx` — was `SettingsModal.tsx`, on shadcn Dialog.
- `components.json` — shadcn config (repo root).

**Modify:**
- `package.json` — deps (via pnpm add).
- `vite.config.ts:7` — add `@tailwindcss/vite` plugin + `@` alias.
- `vitest.config.ts` — add `@` alias + (Task 16) keep setup.
- `tsconfig.json` — add `baseUrl` + `paths` for `@/*`.
- `src/main.tsx` — import `index.css`; wrap `TooltipProvider`.
- `src/settings.ts` — `ViewMode` type home; `previewTheme` field + guard + validate.
- `src/theme.tsx` — remove hljs swap (app theme only).
- `src/App.tsx` — thin to composition; consume hooks.
- `src/components/{EditorPane,PreviewPane,SplitView}.tsx` — restyle (Tailwind); PreviewPane gains `prose` + `resolvedTheme`.
- `src/test/setup.ts` — (Task 16) add `matchMedia` + pointer-event stubs.

**Delete:**
- `src/test/{App,EditorPane,Navbar,PreviewPane,fileio,settings,theme}.test.tsx` (Task 3).
- `src/components/{Navbar,ErrorBanner,SettingsModal}.tsx` (renamed away in Tasks 9/13/14).
- `src/styles.css` (Task 15).

---

## Task 1: Tooling — Tailwind v4 + index.css token bridge

**Files:**
- Modify: `package.json`, `vite.config.ts:7`, `tsconfig.json`, `src/main.tsx:5`
- Create: `src/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind processing active in `vite`; `index.css` exports the `@theme` tokens (`--color-background`, `--color-foreground`, `--color-card`, `--color-popover`, `--color-primary`, `--color-secondary`, `--color-muted`, `--color-accent`, `--color-destructive`, `--color-border`, `--color-input`, `--color-ring`, each with a `-foreground` where shadcn expects it) consumed by all later Tailwind classes (`bg-background`, `text-foreground`, …); `@` → `src` path alias for Tasks 2+.

- [ ] **Step 1: Add Tailwind v4 dev deps**

```bash
pnpm add -D tailwindcss @tailwindcss/vite @tailwindcss/typography
```

- [ ] **Step 2: Wire the Vite plugin + `@` alias**

Edit `vite.config.ts` — add imports and the plugin/alias. Full head of file:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // ...rest unchanged (clearScreen, server block)
```

Leave the `clearScreen`/`server` block exactly as-is.

- [ ] **Step 3: Add the `@/*` path alias to tsconfig**

Edit `tsconfig.json` `compilerOptions` — add two keys (keep everything else):

```jsonc
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
```

- [ ] **Step 4: Create `src/index.css` (Tailwind entry + tokens + palettes)**

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

/* shadcn token bridge → Tailwind theme. Tokens are CSS vars set per data-theme. */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

/* VSCode Dark+ */
[data-theme="dark"] {
  --background: #1e1e1e;
  --foreground: #d4d4d4;
  --card: #252526;
  --card-foreground: #d4d4d4;
  --popover: #252526;
  --popover-foreground: #d4d4d4;
  --primary: #0e639c;
  --primary-foreground: #ffffff;
  --secondary: #2d2d30;
  --secondary-foreground: #d4d4d4;
  --muted: #2d2d30;
  --muted-foreground: #858585;
  --accent: #094771;
  --accent-foreground: #ffffff;
  --destructive: #5a1d1d;
  --destructive-foreground: #f48771;
  --border: #3c3c3c;
  --input: #3c3c3c;
  --ring: #007acc;
}

/* VSCode Light+ */
[data-theme="light"] {
  --background: #ffffff;
  --foreground: #1e1e1e;
  --card: #f3f3f3;
  --card-foreground: #1e1e1e;
  --popover: #ffffff;
  --popover-foreground: #1e1e1e;
  --primary: #005fb8;
  --primary-foreground: #ffffff;
  --secondary: #e7e7e7;
  --secondary-foreground: #1e1e1e;
  --muted: #ececec;
  --muted-foreground: #6c6c6c;
  --accent: #cfe5ff;
  --accent-foreground: #00305c;
  --destructive: #f2dede;
  --destructive-foreground: #a31515;
  --border: #e5e5e5;
  --input: #cecece;
  --ring: #005fb8;
}

/* Preview palette (independent axis; scoped by data-preview-theme on the prose container) */
[data-preview-theme="dark"] {
  --background: #0d1117;
  --foreground: #c9d1d9;
  --border: #30363d;
}
[data-preview-theme="light"] {
  --background: #ffffff;
  --foreground: #1f2328;
  --border: #d0d7de;
}

html,
body,
#root {
  height: 100%;
}
body {
  margin: 0;
  font-size: var(--app-font-size, 14px);
}
```

> Surviving `styles.css` essentials (CodeMirror height fixes, `@media print`, hljs `prose` overrides) are folded in during Task 15 — index.css is intentionally incomplete here.

- [ ] **Step 5: Import `index.css` in `main.tsx` (keep `styles.css`)**

Edit `src/main.tsx` — add the index.css import ABOVE the styles.css import (decision #2 keeps both during migration):

```tsx
import App from "./App";
import { ThemeProvider } from "./theme";
import "./index.css";
import "./styles.css";
```

- [ ] **Step 6: Verify build is clean and the app renders**

Run: `pnpm build`
Expected: PASS — `tsc` no errors, `vite build` emits `dist/` with a Tailwind CSS file.

Run (manual smoke): `pnpm tauri dev` → app opens, both panes visible, existing styling intact (styles.css still applied), no console errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts tsconfig.json src/index.css src/main.tsx
git commit -m "build: add Tailwind v4 + token bridge (index.css), @ alias"
```

---

## Task 2: shadcn/ui scaffolding (cn + ui primitives + TooltipProvider)

**Files:**
- Modify: `package.json`, `components.json` (create), `src/main.tsx`
- Create: `src/lib/utils.ts`, `src/components/ui/{button,dialog,select,tooltip}.tsx`

**Interfaces:**
- Consumes: `@` alias + `index.css` tokens (Task 1).
- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/utils`; React components `Button`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogClose`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, `Tooltip`/`TooltipTrigger`/`TooltipContent`/`TooltipProvider` from `@/components/ui/*`. Consumed by Tasks 9, 12, 14.

- [ ] **Step 1: Add runtime deps**

```bash
pnpm add lucide-react class-variance-authority clsx tailwind-merge @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tooltip
```

- [ ] **Step 2: Create `components.json` (repo root)**

shadcn needs this to know paths. Tailwind v4 → empty `config`, css points at `index.css`.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 3: Generate the four primitives + `cn`**

```bash
pnpm dlx shadcn@latest add button dialog select tooltip
```

This creates `src/lib/utils.ts` (the `cn` helper) and `src/components/ui/{button,dialog,select,tooltip}.tsx`. If the CLI prompts to overwrite `index.css`, **decline** (our token bridge is authoritative) — or accept and re-apply the Task 1 `index.css` afterward.

Expected `src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Verify the generated files exist**

Run: `ls src/lib/utils.ts src/components/ui/button.tsx src/components/ui/dialog.tsx src/components/ui/select.tsx src/components/ui/tooltip.tsx`
Expected: all five paths listed.

- [ ] **Step 5: Wrap `TooltipProvider` in `main.tsx`**

Radix tooltips need a provider ancestor. Edit `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./theme";
import { TooltipProvider } from "./components/ui/tooltip";
import "./index.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **Step 6: Verify build is clean**

Run: `pnpm build`
Expected: PASS. (Generated `ui/*` may need no edits; if `tsc` flags an unused import in a generated file, remove only that line.)

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml components.json src/lib/utils.ts src/components/ui/ src/main.tsx
git commit -m "build: scaffold shadcn/ui (button, dialog, select, tooltip) + cn"
```

---

## Task 3: Delete obsolete frontend tests

Per locked decision §4 — delete all 7 now, rewrite in Task 16. Unblocks refactor churn. `setup.ts` is KEPT.

**Files:**
- Delete: `src/test/{App,EditorPane,Navbar,PreviewPane,fileio,settings,theme}.test.tsx`
- Keep: `src/test/setup.ts`, `vitest.config.ts`

**Interfaces:** none.

- [ ] **Step 1: Delete the seven test files**

```bash
git rm src/test/App.test.tsx src/test/EditorPane.test.tsx src/test/Navbar.test.tsx \
       src/test/PreviewPane.test.tsx src/test/fileio.test.tsx src/test/settings.test.tsx \
       src/test/theme.test.tsx
```

- [ ] **Step 2: Verify the test runner is green with no tests**

Run: `pnpm test`
Expected: Vitest reports "no test files found" (exit 0) — no failures. (`setup.ts` is a setup file, not a test.)

- [ ] **Step 3: Verify build still clean**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "test: remove frontend tests ahead of UI refactor (rewritten in §10)"
```

---

## Task 4: settings.ts — relocate ViewMode + add previewTheme

**Files:**
- Modify: `src/settings.ts`, `src/components/Navbar.tsx`, `src/components/SplitView.tsx`, `src/components/SettingsModal.tsx`, `src/App.tsx:11`

**Interfaces:**
- Consumes: nothing new.
- Produces: `type ViewMode = "split" | "editor" | "preview"` and `type PreviewTheme = "match" | "light" | "dark"` exported from `@/settings` (relative `./settings` / `../settings`); `Settings` gains `previewTheme: PreviewTheme`; `isPreviewTheme(v): v is PreviewTheme` guard. Consumed by Tasks 8 (usePreviewTheme), 14 (SettingsDialog).

- [ ] **Step 1: Move `ViewMode` into settings.ts + add previewTheme**

Rewrite `src/settings.ts`. The `ViewMode` type is now DEFINED here (was imported from Navbar):

```ts
import { useSyncExternalStore } from "react";

export type ViewMode = "split" | "editor" | "preview";
export type PreviewTheme = "match" | "light" | "dark";

export interface Settings {
  /** Editor + preview font size in px. */
  fontSize: number;
  /** View mode the app opens in. */
  defaultView: ViewMode;
  /** Preview theme axis, independent of app theme. "match" follows app theme. */
  previewTheme: PreviewTheme;
}

const STORAGE_KEY = "md-settings";
export const FONT_MIN = 10;
export const FONT_MAX = 24;
const DEFAULTS: Settings = { fontSize: 14, defaultView: "preview", previewTheme: "match" };

function clampFont(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n)
    ? Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n)))
    : DEFAULTS.fontSize;
}

function isViewMode(v: unknown): v is ViewMode {
  return v === "split" || v === "editor" || v === "preview";
}

function isPreviewTheme(v: unknown): v is PreviewTheme {
  return v === "match" || v === "light" || v === "dark";
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      return {
        fontSize: clampFont(p.fontSize),
        defaultView: isViewMode(p.defaultView) ? p.defaultView : DEFAULTS.defaultView,
        previewTheme: isPreviewTheme(p.previewTheme) ? p.previewTheme : DEFAULTS.previewTheme,
      };
    }
  } catch {
    // Corrupt/unavailable storage — fall back to defaults.
  }
  return { ...DEFAULTS };
}

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
    previewTheme: isPreviewTheme(patch.previewTheme) ? patch.previewTheme : state.previewTheme,
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
```

- [ ] **Step 2: Repoint the four `ViewMode` importers**

`ViewMode` no longer comes from Navbar. Update each import:

- `src/components/Navbar.tsx:1` — delete `export type ViewMode = ...` line; add `import type { ViewMode } from "../settings";`
- `src/components/SplitView.tsx:3` — change to `import type { ViewMode } from "../settings";`
- `src/components/SettingsModal.tsx:3` — change to `import type { ViewMode } from "../settings";`
- `src/App.tsx:11` — split the import: `import Navbar from "./components/Navbar";` and `import type { ViewMode } from "./settings";`

- [ ] **Step 3: Verify build is clean (no circular import, no unused)**

Run: `pnpm build`
Expected: PASS. (settings.ts no longer imports from components → cycle removed.)

- [ ] **Step 4: Commit**

```bash
git add src/settings.ts src/components/Navbar.tsx src/components/SplitView.tsx src/components/SettingsModal.tsx src/App.tsx
git commit -m "feat(settings): add previewTheme; move ViewMode type into settings"
```

---

## Task 5: Extract `useDocument` hook

Carve document state + file ops out of `App.tsx`. Behavior identical.

**Files:**
- Create: `src/hooks/useDocument.ts`
- Modify: `src/App.tsx` (state lines 23-27, handlers 67-171, mtime ref 45, disk-check body 310-323)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
```ts
interface UseDocument {
  filePath: string | null;
  content: string;
  dirty: boolean;
  error: string | null;
  diskChanged: boolean;
  setError: (e: string | null) => void;
  setDiskChanged: (v: boolean) => void;
  onChange: (next: string) => void;     // was handleChange
  newDoc: () => void;
  openFromDialog: () => Promise<void>;
  save: () => Promise<void>;
  loadFile: (path: string) => Promise<void>;
  checkDisk: () => Promise<void>;        // re-stat current file → setDiskChanged
}
export function useDocument(): UseDocument
```
Consumed by App (Task 5), useOsIntegration (Task 6).

- [ ] **Step 1: Create `src/hooks/useDocument.ts`**

Move `basename`, the doc state, refs, and handlers verbatim from `App.tsx`. `loadFile`/`save`/`newDoc` keep their exact dirty-guard + recent-file + mtime logic.

```ts
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
```

- [ ] **Step 2: Consume it in `App.tsx`; delete the moved code**

In `App.tsx`: remove the doc `useState`s (23-27), `filePathRef/contentRef/dirtyRef/lastMtimeRef` (41-45,49-51), `handleChange`, `rememberMtime`, `loadFile`(+ref), `newDoc`(+ref), `openFromDialog`(+ref), `save`(+ref), and the focus-check effect body (310-323 — the listener wiring stays for now; have it call `checkDisk`). Replace with:

```tsx
const {
  filePath, content, dirty, error, diskChanged,
  setError, setDiskChanged,
  onChange, newDoc, openFromDialog, save, loadFile, checkDisk,
} = useDocument();
```

Update the focus effect to use `checkDisk`:

```tsx
useEffect(() => {
  window.addEventListener("focus", checkDisk);
  return () => window.removeEventListener("focus", checkDisk);
}, [checkDisk]);
```

Update JSX wiring: `<EditorPane value={content} onChange={onChange} />`, `onDismiss={() => setError(null)}`, `onDismiss={() => setDiskChanged(false)}`, reload `onAction={() => filePath && loadFile(filePath)}`. Remove the now-unused `useRef` imports if no longer used in App (keep what menu/keyboard effects still need — those still ref-mirror `newDoc`/`save`/etc. until Task 6). Import `basename` from the hook for the title effect.

> NOTE: `printToPdf` stays in App (uses `viewMode`). The menu/keyboard/OS effects still live in App and still ref-mirror `newDoc/openFromDialog/save/loadFile` — that's fine; Task 6 moves them.

- [ ] **Step 3: Verify build + smoke**

Run: `pnpm build` → PASS.
Smoke (`pnpm tauri dev`): open a file (drag-drop + dialog), edit (dirty dot), save, New (dirty-guard prompt), trigger read-fail banner (open a deleted path via recent). Behavior unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDocument.ts src/App.tsx
git commit -m "refactor: extract useDocument hook from App"
```

---

## Task 6: Extract `useOsIntegration` hook

Consolidate the 5 ref-mirrored OS effects (drag-drop, file-opened+pending, menu events, focus disk-check, dirty-mirror) + confirm-quit.

**Files:**
- Create: `src/hooks/useOsIntegration.ts`
- Modify: `src/App.tsx` (effects 220-306, 310-323, 327-331)

**Interfaces:**
- Consumes: `UseDocument` callbacks (`loadFile`, `newDoc`, `openFromDialog`, `save`, `checkDisk`) + `dirty`.
- Produces:
```ts
interface OsHandlers {
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
export function useOsIntegration(h: OsHandlers): void
```

- [ ] **Step 1: Create `src/hooks/useOsIntegration.ts`**

All callbacks are mirrored through one ref so the once-subscribed listeners stay current. Moves the drag-drop, file-opened+pending, menu, focus, and dirty-mirror effects verbatim.

```ts
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
```

- [ ] **Step 2: Consume in `App.tsx`; delete the 5 moved effects + their refs**

Remove from `App.tsx`: the drag-drop, file-opened, menu, focus, and dirty-mirror `useEffect`s; `viewModeRef`/`toggleThemeRef`/`newDocRef`/`openFromDialogRef`/`saveRef`/`loadFileRef`/`printToPdfRef` (no longer needed). Keep `printToPdf` (still uses viewMode) and `viewMode`/`setViewMode`. Add:

```tsx
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
```

Remove the now-unused imports in App (`listen`, `getCurrentWebview`, `invoke` if unused elsewhere — note `set_dirty`/`report_ready` effects: `report_ready` still uses `invoke`, so keep `invoke`). Keep the `report_ready` and `checkForUpdates` effects in App.

- [ ] **Step 3: Verify build + smoke**

Run: `pnpm build` → PASS.
Smoke: menu File→New/Open/Save/Print, View menu switches, theme menu toggles, Settings menu opens dialog, drag-drop, Finder Open-with (cold + running), external-edit reload notice on refocus, dirty quit guard (`Cmd+Q` with unsaved → confirm). All unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useOsIntegration.ts src/App.tsx
git commit -m "refactor: consolidate OS listeners into useOsIntegration"
```

---

## Task 7: Extract `useKeyboardShortcuts` hook

**Files:**
- Create: `src/hooks/useKeyboardShortcuts.ts`
- Modify: `src/App.tsx` (keydown effect 196-207)

**Interfaces:**
- Consumes: `save` (UseDocument), a close-dialog callback.
- Produces:
```ts
export function useKeyboardShortcuts(h: { onSave: () => void; onEscape: () => void }): void
```
> `onEscape` is removed in Task 14 once Radix Dialog owns Escape.

- [ ] **Step 1: Create `src/hooks/useKeyboardShortcuts.ts`**

```ts
import { useEffect, useRef } from "react";

export function useKeyboardShortcuts(h: { onSave: () => void; onEscape: () => void }): void {
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        ref.current.onSave();
      } else if (e.key === "Escape") {
        ref.current.onEscape();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
```

- [ ] **Step 2: Consume in `App.tsx`; delete the keydown effect**

```tsx
useKeyboardShortcuts({ onSave: save, onEscape: () => setSettingsOpen(false) });
```

- [ ] **Step 3: Verify build + smoke**

Run: `pnpm build` → PASS.
Smoke: `Cmd+S` saves; `Escape` closes the settings modal.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/App.tsx
git commit -m "refactor: extract useKeyboardShortcuts hook"
```

---

## Task 8: Theme split — slim `theme.tsx` + `usePreviewTheme`

App theme stops owning hljs. A new hook resolves the preview theme and swaps hljs keyed on the **resolved preview** theme.

**Files:**
- Modify: `src/theme.tsx` (remove hljs swap, imports 8-11, effect 47-63)
- Create: `src/hooks/usePreviewTheme.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useTheme()` (app theme), `useSettings().previewTheme` (Task 4).
- Produces: `usePreviewTheme(): "light" | "dark"` — resolves `match → appTheme`, swaps the global `#hljs-theme` `<style>`, returns the resolved theme. Consumed by App → passed to PreviewPane (Task 12).

- [ ] **Step 1: Remove the hljs swap from `theme.tsx`**

Delete the `?inline` imports (lines 8-11) and the hljs-`<style>` logic inside the effect. The effect keeps only `data-theme` + persistence:

```tsx
useEffect(() => {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Best-effort persistence only.
  }
}, [theme]);
```

Update the file's doc comment (drop the "injected highlight.js stylesheet" bullet). `Theme`, `useTheme`, `ThemeProvider` exports unchanged.

- [ ] **Step 2: Create `src/hooks/usePreviewTheme.ts`**

```ts
import { useEffect } from "react";
// `?inline` returns the CSS as a string so we can hot-swap the active hljs theme.
import githubDark from "highlight.js/styles/github-dark.css?inline";
import githubLight from "highlight.js/styles/github.css?inline";
import { useTheme } from "../theme";
import { useSettings } from "../settings";

/**
 * Resolves the independent preview-theme axis ("match" follows the app theme),
 * swaps the global highlight.js stylesheet to match the RESOLVED preview theme,
 * and returns "light" | "dark" for the preview container to apply.
 */
export function usePreviewTheme(): "light" | "dark" {
  const { theme: appTheme } = useTheme();
  const { previewTheme } = useSettings();
  const resolved = previewTheme === "match" ? appTheme : previewTheme;

  useEffect(() => {
    let style = document.getElementById("hljs-theme") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "hljs-theme";
      document.head.appendChild(style);
    }
    style.textContent = resolved === "dark" ? githubDark : githubLight;
  }, [resolved]);

  return resolved;
}
```

- [ ] **Step 3: Call it in `App.tsx`**

```tsx
const previewTheme = usePreviewTheme();
```

Pass to PreviewPane (prop is consumed fully in Task 12; harmless now):

```tsx
right={<PreviewPane value={deferredContent} resolvedTheme={previewTheme} />}
```

Add the optional prop to PreviewPane now so the build passes (Task 12 wires it into the DOM):

`src/components/PreviewPane.tsx` — `interface PreviewPaneProps { value: string; resolvedTheme?: "light" | "dark"; }` and accept (unused yet — prefix `_` or reference in a comment to satisfy `noUnusedParameters`; cleanest: destructure and use in Task 12. For now: `export default function PreviewPane({ value }: PreviewPaneProps)` and leave `resolvedTheme` optional/unread — TS allows unused optional props since they aren't parameters of concern only if destructured. To avoid the lint, do NOT destructure it yet; just widen the interface.)

- [ ] **Step 4: Verify build + smoke**

Run: `pnpm build` → PASS.
Smoke: toggle app theme → code-block colors follow. Set `md-settings.previewTheme` to `"light"` in devtools localStorage, reload with app in dark → hljs in preview is light (full preview palette lands in Task 12). App theme toggle still themes chrome + editor.

- [ ] **Step 5: Commit**

```bash
git add src/theme.tsx src/hooks/usePreviewTheme.ts src/App.tsx src/components/PreviewPane.tsx
git commit -m "feat(theme): independent preview theme; move hljs swap to usePreviewTheme"
```

---

## Task 9: Toolbar + ToolbarButton + ViewModeSwitch (Lucide + Tooltips)

Rename `Navbar` → `Toolbar`; build an icon button (with Radix Tooltip) and a segmented view switch. Lucide replaces all toolbar glyphs.

**Files:**
- Create: `src/components/ToolbarButton.tsx`, `src/components/ViewModeSwitch.tsx`, `src/components/Toolbar.tsx`
- Delete: `src/components/Navbar.tsx`
- Modify: `src/App.tsx` (import + `<Navbar>` → `<Toolbar>`)

**Interfaces:**
- Consumes: `cn`, `Tooltip*` (Task 2); `ViewMode` (settings).
- Produces: `<Toolbar fileName dirty viewMode onNew onOpen onSave onPrint onViewChange onOpenSettings />` (same prop shape as Navbar); `<ToolbarButton icon label onClick shortcut? />`; `<ViewModeSwitch value onChange />`.

- [ ] **Step 1: Create `ToolbarButton.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  shortcut?: string;
  active?: boolean;
}

export default function ToolbarButton({ icon: Icon, label, onClick, shortcut, active }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground",
            "hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            active && "bg-secondary text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 text-muted-foreground">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Create `ViewModeSwitch.tsx`**

```tsx
import { PanelLeft, Columns2, Eye } from "lucide-react";
import type { ViewMode } from "@/settings";
import { cn } from "@/lib/utils";

const OPTIONS: { mode: ViewMode; label: string; title: string; Icon: typeof PanelLeft }[] = [
  { mode: "editor", label: "Editor only", title: "⌘2", Icon: PanelLeft },
  { mode: "split", label: "Split view", title: "⌘1", Icon: Columns2 },
  { mode: "preview", label: "Preview only", title: "⌘3", Icon: Eye },
];

export default function ViewModeSwitch({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div role="group" aria-label="View mode" className="inline-flex rounded-md border border-border p-0.5">
      {OPTIONS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          aria-label={label}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            "inline-flex h-7 w-8 items-center justify-center rounded text-muted-foreground",
            "hover:text-foreground",
            value === mode && "bg-secondary text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `Toolbar.tsx` (replaces Navbar)**

```tsx
import { FilePlus2, FolderOpen, Save, FileDown, Settings, Circle } from "lucide-react";
import type { ViewMode } from "@/settings";
import ToolbarButton from "./ToolbarButton";
import ViewModeSwitch from "./ViewModeSwitch";

interface ToolbarProps {
  fileName: string;
  dirty: boolean;
  viewMode: ViewMode;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onPrint: () => void;
  onViewChange: (mode: ViewMode) => void;
  onOpenSettings: () => void;
}

export default function Toolbar({
  fileName, dirty, viewMode, onNew, onOpen, onSave, onPrint, onViewChange, onOpenSettings,
}: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Main toolbar"
      className="flex h-10 items-center gap-1 border-b border-border bg-card px-2 text-card-foreground"
    >
      <div className="flex items-center gap-0.5">
        <ToolbarButton icon={FilePlus2} label="New" shortcut="⌘N" onClick={onNew} />
        <ToolbarButton icon={FolderOpen} label="Open" shortcut="⌘O" onClick={onOpen} />
        <ToolbarButton icon={Save} label="Save" shortcut="⌘S" onClick={onSave} />
        <ToolbarButton icon={FileDown} label="Print to PDF" shortcut="⌘P" onClick={onPrint} />
      </div>

      <div className="flex flex-1 items-center justify-center gap-1.5 truncate text-sm" aria-label="Document name">
        <span className="truncate">{fileName}</span>
        {dirty && <Circle className="h-2 w-2 shrink-0 fill-current" aria-label="unsaved changes" />}
      </div>

      <div className="flex items-center gap-1">
        <ViewModeSwitch value={viewMode} onChange={onViewChange} />
        <ToolbarButton icon={Settings} label="Settings" shortcut="⌘," onClick={onOpenSettings} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Swap in App; delete Navbar**

`src/App.tsx`: `import Toolbar from "./components/Toolbar";` (remove the Navbar import + its `type { ViewMode }` was already from settings). Change `<Navbar … />` → `<Toolbar … />` (identical props).

```bash
git rm src/components/Navbar.tsx
```

- [ ] **Step 5: Verify build + smoke**

Run: `pnpm build` → PASS (named lucide imports tree-shake).
Smoke: all four file buttons fire; dirty dot shows; view switch changes mode + shows active state; tooltips appear with ⌘ hints; settings opens.

- [ ] **Step 6: Commit**

```bash
git add src/components/Toolbar.tsx src/components/ToolbarButton.tsx src/components/ViewModeSwitch.tsx src/App.tsx
git commit -m "feat(ui): Toolbar with Lucide icons + Radix tooltips; retire Navbar"
```

---

## Task 10: Restyle SplitView + EditorPane (Tailwind)

Small, paired restyle. Pure styling; CodeMirror logic untouched.

**Files:**
- Modify: `src/components/SplitView.tsx`, `src/components/EditorPane.tsx`

**Interfaces:** unchanged props.

- [ ] **Step 1: Restyle `SplitView.tsx`**

Replace the four `className` strings (`single-pane`, `split-group`, `split-panel`, `split-handle`) with Tailwind. Keep `autoSaveId`, `defaultSize`, `minSize`.

```tsx
export default function SplitView({ left, right, viewMode }: SplitViewProps) {
  if (viewMode === "editor") return <div className="h-full min-h-0">{left}</div>;
  if (viewMode === "preview") return <div className="h-full min-h-0">{right}</div>;
  return (
    <PanelGroup direction="horizontal" className="h-full min-h-0" autoSaveId="md-split">
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
```

- [ ] **Step 2: Restyle `EditorPane.tsx` wrapper**

Only the wrapping `<div className="pane editor-pane">` changes; CodeMirror config/theme logic stays:

```tsx
return (
  <div className="h-full min-h-0 overflow-hidden bg-background" aria-label="Markdown editor">
    <CodeMirror /* …unchanged props… */ />
  </div>
);
```

- [ ] **Step 3: Verify build + smoke**

Run: `pnpm build` → PASS.
Smoke: split drag works + ratio persists across relaunch; handle hover highlights; editor fills height; all three view modes lay out correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/SplitView.tsx src/components/EditorPane.tsx
git commit -m "style: Tailwind for SplitView + EditorPane wrapper"
```

---

## Task 11: Restyle PreviewPane → `prose` + independent preview theme

`prose` typography replaces `markdown-body`; `resolvedTheme` (Task 8) drives `prose-invert` + `data-preview-theme` so the preview palette is independent of the app.

**Files:**
- Modify: `src/components/PreviewPane.tsx`

**Interfaces:**
- Consumes: `resolvedTheme: "light" | "dark"` (App, Task 8).
- Produces: same render contract; security (no rehype-raw) + link handler unchanged.

- [ ] **Step 1: Restyle `PreviewPane.tsx`**

Keep imports, `handleLinkClick`, the security comment, plugins, and the `a` component override exactly. Replace the wrapper:

```tsx
interface PreviewPaneProps {
  value: string;
  resolvedTheme?: "light" | "dark";
}

export default function PreviewPane({ value, resolvedTheme = "dark" }: PreviewPaneProps) {
  return (
    <div
      className="h-full min-h-0 overflow-auto bg-background"
      data-preview-theme={resolvedTheme}
      aria-label="Markdown preview"
    >
      <div
        className={cn(
          "markdown-body prose mx-auto max-w-3xl px-6 py-4",
          resolvedTheme === "dark" && "prose-invert"
        )}
      >
        <Markdown /* …unchanged remark/rehype/components… */>{value}</Markdown>
      </div>
    </div>
  );
}
```

Add `import { cn } from "@/lib/utils";`. Keep `.markdown-body` on the inner div — Task 15's hljs/print CSS still keys on it.

- [ ] **Step 2: Verify build + smoke**

Run: `pnpm build` → PASS.
Smoke — the headline feature: app **dark** + Settings preview **light** → preview shows light bg + light hljs while chrome/editor stay dark; switch preview to **Match** → follows app theme. Headings/lists/tables/inline code render via `prose`. XSS guard intact (`<script>` in `.md` stays escaped text).

- [ ] **Step 3: Commit**

```bash
git add src/components/PreviewPane.tsx
git commit -m "feat(ui): prose preview with independent theme palette"
```

---

## Task 12: Restyle Banner (was ErrorBanner) with Lucide

**Files:**
- Create: `src/components/Banner.tsx`
- Delete: `src/components/ErrorBanner.tsx`
- Modify: `src/App.tsx` (imports + both `<ErrorBanner>` usages)

**Interfaces:**
- Produces: `<Banner message onDismiss actionLabel? onAction? variant? />` where `variant?: "error" | "info"` (default `"error"`). Same call sites as ErrorBanner plus an optional variant.

- [ ] **Step 1: Create `Banner.tsx`**

```tsx
import { CircleAlert, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BannerProps {
  message: string;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "error" | "info";
}

export default function Banner({ message, onDismiss, actionLabel, onAction, variant = "error" }: BannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm",
        variant === "error"
          ? "bg-destructive text-destructive-foreground"
          : "bg-secondary text-secondary-foreground"
      )}
    >
      <CircleAlert className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-black/10"
        >
          <RotateCw className="h-3.5 w-3.5" />
          {actionLabel}
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="rounded p-0.5 hover:bg-black/10">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Swap in App; delete ErrorBanner**

`src/App.tsx`: `import Banner from "./components/Banner";`. The disk-changed banner uses `variant="info"`:

```tsx
{diskChanged && (
  <Banner
    message="This file changed on disk."
    actionLabel="Reload"
    onAction={() => filePath && loadFile(filePath)}
    onDismiss={() => setDiskChanged(false)}
    variant="info"
  />
)}
{error && <Banner message={error} onDismiss={() => setError(null)} />}
```

```bash
git rm src/components/ErrorBanner.tsx
```

- [ ] **Step 3: Verify build + smoke**

Run: `pnpm build` → PASS.
Smoke: trigger an error (open a missing file) → red banner with alert icon, dismiss works; external-edit → info banner with Reload (RotateCw) reloads the file.

- [ ] **Step 4: Commit**

```bash
git add src/components/Banner.tsx src/App.tsx
git commit -m "feat(ui): Banner with Lucide icons; retire ErrorBanner"
```

---

## Task 13: SettingsDialog on shadcn Dialog (+ preview-theme row)

Rebuild the modal on Radix Dialog (focus trap, Escape, aria — fixes the current a11y gap). Add App-theme (Sun/Moon) + Preview-theme (Select) rows. Controlled by App.

**Files:**
- Create: `src/components/SettingsDialog.tsx`
- Delete: `src/components/SettingsModal.tsx`
- Modify: `src/App.tsx`, `src/hooks/useKeyboardShortcuts.ts`

**Interfaces:**
- Consumes: `Dialog*`, `Select*` (Task 2); `useTheme`; `useSettings`/`setSettings`/`FONT_MIN`/`FONT_MAX`/`PreviewTheme`/`ViewMode`.
- Produces: `<SettingsDialog open onOpenChange />` (controlled).

- [ ] **Step 1: Create `SettingsDialog.tsx`**

```tsx
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../theme";
import {
  useSettings, setSettings, FONT_MIN, FONT_MAX,
  type ViewMode, type PreviewTheme,
} from "../settings";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
];
const PREVIEW_OPTIONS: { value: PreviewTheme; label: string }[] = [
  { value: "match", label: "Match app" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { theme, toggle } = useTheme();
  const { fontSize, defaultView, previewTheme } = useSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">App theme</span>
            <button
              type="button"
              onClick={toggle}
              aria-label={`Theme: ${theme}. Switch to ${theme === "dark" ? "light" : "dark"}.`}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          </div>

          <label className="flex items-center justify-between">
            <span className="text-sm">Font size</span>
            <span className="flex items-center gap-2">
              <input
                type="range"
                min={FONT_MIN}
                max={FONT_MAX}
                value={fontSize}
                aria-label="Font size"
                onChange={(e) => setSettings({ fontSize: Number(e.target.value) })}
              />
              <span className="w-10 text-right text-sm text-muted-foreground">{fontSize}px</span>
            </span>
          </label>

          <div className="flex items-center justify-between">
            <span className="text-sm">Default view</span>
            <Select value={defaultView} onValueChange={(v) => setSettings({ defaultView: v as ViewMode })}>
              <SelectTrigger className="w-40" aria-label="Default view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Preview theme</span>
            <Select value={previewTheme} onValueChange={(v) => setSettings({ previewTheme: v as PreviewTheme })}>
              <SelectTrigger className="w-40" aria-label="Preview theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREVIEW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Control it from App; drop Escape from keyboard hook**

`src/App.tsx`: `import SettingsDialog from "./components/SettingsDialog";`. Replace `{settingsOpen && <SettingsModal … />}` with:

```tsx
<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
```

Radix Dialog now owns Escape + focus trap → remove `onEscape` from the keyboard hook call and from the hook signature:

`src/hooks/useKeyboardShortcuts.ts` → `h: { onSave: () => void }`, drop the `else if (e.key === "Escape")` branch.
`src/App.tsx` → `useKeyboardShortcuts({ onSave: save });`

```bash
git rm src/components/SettingsModal.tsx
```

- [ ] **Step 3: Verify build + smoke**

Run: `pnpm build` → PASS.
Smoke: open Settings (button + `Cmd+,` + menu) → focus traps inside dialog, Escape closes, clicking outside closes; App-theme toggle (Sun/Moon) reskins live; font slider clamps 10–24; Default view persists; **Preview theme** select switches the preview palette independently and persists across relaunch.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsDialog.tsx src/App.tsx src/hooks/useKeyboardShortcuts.ts
git commit -m "feat(ui): SettingsDialog on Radix Dialog + preview-theme control"
```

---

## Task 14: CSS reduction — retire styles.css

Fold the surviving essentials into `index.css`, delete `styles.css`, drop its import. Target `index.css` ≈ 80–120 lines.

**Files:**
- Modify: `src/index.css`, `src/main.tsx`
- Delete: `src/styles.css`

**Interfaces:** none.

- [ ] **Step 1: Identify survivors in `styles.css`**

Read `src/styles.css`. Only these classes/rules are still referenced after the restyle: CodeMirror height fixes (`.cm-editor`/`.cm-scroller` height), the `@media print` preview-only rule (used by `printToPdf`), and any hljs/`prose` overrides the highlighted code needs (`.markdown-body pre`, `code` spacing). Everything keyed on retired classes (`.navbar*`, `.modal*`, `.error-banner*`, `.split-*`, `.single-pane`, `.pane`, `.setting-*`) is dead.

- [ ] **Step 2: Append survivors to `index.css`**

Add to the end of `src/index.css` (adjust selectors to what Step 1 found):

```css
/* CodeMirror must fill its pane. */
.cm-editor,
.cm-scroller {
  height: 100%;
}

/* hljs/prose interplay: let highlight.js own code-block colors inside prose. */
.markdown-body pre code.hljs {
  padding: 0;
  background: transparent;
}

/* Print to PDF: show only the rendered preview. */
@media print {
  body * {
    visibility: hidden;
  }
  [data-preview-theme],
  [data-preview-theme] * {
    visibility: visible;
  }
  [data-preview-theme] {
    position: absolute;
    inset: 0;
    overflow: visible;
  }
}
```

> Adapt the `@media print` selectors to match the actual preview wrapper (it now carries `data-preview-theme`). Verify against the old print rule in `styles.css`.

- [ ] **Step 3: Delete styles.css + its import**

`src/main.tsx`: remove `import "./styles.css";`.

```bash
git rm src/styles.css
```

- [ ] **Step 4: Verify size + build + smoke**

Run: `wc -l src/index.css` → expect ~80–120.
Run: `pnpm build` → PASS (no missing-class visual regressions).
Smoke (full visual pass): toolbar, both panes, split handle, banners, dialog all styled; **Print to PDF** outputs only the rendered preview; light + dark app themes both clean; independent preview theme intact.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/main.tsx
git commit -m "style: retire styles.css; fold essentials into index.css"
```

---

## Task 15: Rewrite the test suite

Augment `setup.ts` for Radix-under-jsdom, then write tests covering §10. Vitest config unchanged except it already points at `setup.ts`.

**Files:**
- Modify: `src/test/setup.ts`
- Create: `src/test/{App,fileio,view,settings,theme,SettingsDialog,PreviewPane}.test.tsx`

**Interfaces:** consumes all prior tasks' public component/hook/store APIs.

- [ ] **Step 1: Augment `setup.ts` (matchMedia + pointer stubs for Radix)**

Append to `src/test/setup.ts` (keep existing ResizeObserver + MemoryStorage):

```ts
// Radix Dialog/Select probe these under jsdom; provide no-op stubs.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }) as unknown as MediaQueryList;
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
}
```

- [ ] **Step 2: Write `App.test.tsx` (render + view defaults)**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { ThemeProvider } from "../theme";
import { TooltipProvider } from "../components/ui/tooltip";

function renderApp() {
  return render(
    <ThemeProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  );
}

beforeEach(() => localStorage.clear());

test("renders toolbar + preview pane, Untitled + non-dirty at start", () => {
  renderApp();
  expect(screen.getByRole("toolbar", { name: /main toolbar/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/markdown preview/i)).toBeInTheDocument();
  expect(screen.getByText("Untitled")).toBeInTheDocument();
  expect(screen.queryByLabelText(/unsaved changes/i)).not.toBeInTheDocument();
});

test("defaults to preview view; can switch to split (editor appears)", async () => {
  renderApp();
  expect(screen.queryByLabelText(/markdown editor/i)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /split view/i }));
  expect(screen.getByLabelText(/markdown editor/i)).toBeInTheDocument();
});

test("opens the settings dialog", async () => {
  renderApp();
  await userEvent.click(screen.getByRole("button", { name: /settings/i }));
  expect(await screen.findByRole("dialog", { name: /settings/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Write `fileio.test.tsx` (file-opened, save, save-as, read-fail)**

Mirror the old fileio test, asserting loaded text **in the preview pane**. Mock `@tauri-apps/api/core` + plugins.

```tsx
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "../App";
import { ThemeProvider } from "../theme";
import { TooltipProvider } from "../components/ui/tooltip";

const listeners: Record<string, (e: { payload: unknown }) => void> = {};
vi.mock("@tauri-apps/api/event", () => ({
  listen: (name: string, cb: (e: { payload: unknown }) => void) => {
    listeners[name] = cb;
    return Promise.resolve(() => {});
  },
}));
const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ onDragDropEvent: () => Promise.resolve(() => {}) }) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ setTitle: () => {} }) }));
const saveDialog = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: (...a: unknown[]) => saveDialog(...a) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../updater", () => ({ checkForUpdates: vi.fn() }));

function renderApp() {
  return render(
    <ThemeProvider><TooltipProvider><App /></TooltipProvider></ThemeProvider>
  );
}
beforeEach(() => {
  localStorage.clear();
  invoke.mockReset();
  for (const k of Object.keys(listeners)) delete listeners[k];
});

test("file-opened loads content into the preview", async () => {
  invoke.mockImplementation((cmd: string) => {
    if (cmd === "read_md") return Promise.resolve("# Hello\n\nworld");
    if (cmd === "take_pending_file") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
  renderApp();
  await waitFor(() => expect(listeners["file-opened"]).toBeTypeOf("function"));
  listeners["file-opened"]({ payload: "/tmp/x.md" });
  const preview = await screen.findByLabelText(/markdown preview/i);
  expect(await within(preview).findByText("Hello")).toBeInTheDocument();
});

test("Cmd+S on Untitled triggers Save-As; cancel writes nothing", async () => {
  saveDialog.mockResolvedValue(null);
  invoke.mockResolvedValue(undefined);
  renderApp();
  await userEvent.keyboard("{Meta>}s{/Meta}");
  await waitFor(() => expect(saveDialog).toHaveBeenCalled());
  expect(invoke).not.toHaveBeenCalledWith("save_md", expect.anything());
});

test("read failure shows the error banner", async () => {
  invoke.mockImplementation((cmd: string) => {
    if (cmd === "read_md") return Promise.reject("ENOENT");
    if (cmd === "take_pending_file") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
  renderApp();
  await waitFor(() => expect(listeners["file-opened"]).toBeTypeOf("function"));
  listeners["file-opened"]({ payload: "/tmp/missing.md" });
  expect(await screen.findByRole("alert")).toHaveTextContent(/failed to open/i);
});
```

- [ ] **Step 4: Write `settings.test.tsx` (store: clamp, validate, persist, previewTheme)**

```tsx
import { getSettings, setSettings } from "../settings";

beforeEach(() => localStorage.clear());

test("font clamps to 10–24", () => {
  setSettings({ fontSize: 99 });
  expect(getSettings().fontSize).toBe(24);
  setSettings({ fontSize: 1 });
  expect(getSettings().fontSize).toBe(10);
});

test("defaultView rejects invalid values", () => {
  setSettings({ defaultView: "preview" });
  setSettings({ defaultView: "bogus" as never });
  expect(getSettings().defaultView).toBe("preview");
});

test("previewTheme validates + persists", () => {
  setSettings({ previewTheme: "light" });
  expect(getSettings().previewTheme).toBe("light");
  expect(JSON.parse(localStorage.getItem("md-settings")!).previewTheme).toBe("light");
  setSettings({ previewTheme: "nope" as never });
  expect(getSettings().previewTheme).toBe("light");
});
```

- [ ] **Step 5: Write `theme.test.tsx` (app theme + hljs keyed on preview)**

```tsx
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../theme";
import { usePreviewTheme } from "../hooks/usePreviewTheme";
import { setSettings } from "../settings";

function Probe() {
  const { theme, toggle } = useTheme();
  usePreviewTheme();
  return <button onClick={toggle}>theme:{theme}</button>;
}
beforeEach(() => localStorage.clear());

test("default dark; toggle flips data-theme + persists", async () => {
  render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(document.documentElement.dataset.theme).toBe("dark");
  await act(async () => { screen.getByRole("button").click(); });
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem("md-theme")).toBe("light");
});

test("hljs style injected and follows resolved preview theme", () => {
  setSettings({ previewTheme: "dark" });
  render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(document.getElementById("hljs-theme")).toBeInstanceOf(HTMLStyleElement);
});
```

> `?inline` resolves to empty under the Vitest transform (see CLAUDE.md) — assert the injection mechanism + the resolved value path, not CSS contents.

- [ ] **Step 6: Write `PreviewPane.test.tsx` (render, GFM, XSS guard, theme class)**

```tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import PreviewPane from "../components/PreviewPane";
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

test("renders heading + GFM table + inline code", () => {
  render(<PreviewPane value={"# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n`x`"} resolvedTheme="light" />);
  expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByText("x")).toBeInTheDocument();
});

test("escapes raw HTML (no rehype-raw)", () => {
  const { container } = render(<PreviewPane value={"<script>alert(1)</script>"} resolvedTheme="light" />);
  expect(container.querySelector("script")).toBeNull();
});

test("dark resolvedTheme applies prose-invert + data-preview-theme", () => {
  const { container } = render(<PreviewPane value="x" resolvedTheme="dark" />);
  expect(container.querySelector('[data-preview-theme="dark"]')).not.toBeNull();
  expect(container.querySelector(".prose-invert")).not.toBeNull();
});
```

- [ ] **Step 7: Write `SettingsDialog.test.tsx` (a11y: role, Escape, focus)**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import SettingsDialog from "../components/SettingsDialog";
import { ThemeProvider } from "../theme";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <ThemeProvider>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </ThemeProvider>
  );
}
beforeEach(() => localStorage.clear());

test("renders as a dialog and Escape closes it", async () => {
  render(<Harness />);
  expect(await screen.findByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("exposes the preview-theme control", async () => {
  render(<Harness />);
  expect(await screen.findByLabelText(/preview theme/i)).toBeInTheDocument();
});
```

- [ ] **Step 8: Write `view.test.tsx` (view switching)**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { ThemeProvider } from "../theme";
import { TooltipProvider } from "../components/ui/tooltip";

const renderApp = () =>
  render(<ThemeProvider><TooltipProvider><App /></TooltipProvider></ThemeProvider>);
beforeEach(() => localStorage.clear());

test("editor-only hides preview; preview-only hides editor", async () => {
  renderApp();
  await userEvent.click(screen.getByRole("button", { name: /editor only/i }));
  expect(screen.getByLabelText(/markdown editor/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/markdown preview/i)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /preview only/i }));
  expect(screen.getByLabelText(/markdown preview/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/markdown editor/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 9: Run the suite green**

Run: `pnpm test`
Expected: PASS — all files green. Fix any jsdom/Radix gaps by extending `setup.ts` (not the components). If a Radix Select interaction is flaky under jsdom, assert presence of the trigger (`getByLabelText`) rather than driving the listbox open.

- [ ] **Step 10: Commit**

```bash
git add src/test/
git commit -m "test: rewrite frontend suite for redesigned UI + previewTheme"
```

---

## Task 16: Full manual verification (gate, no commit)

Run the existing checklist (`FUTURE.md`) against the real app. This is the final gate before merge — not a code change.

- [ ] **Step 1: Build + launch**

Run: `pnpm build` → PASS. Run: `pnpm tauri dev`.

- [ ] **Step 2: Walk the checklist**

Verify each: drag-drop open · Finder Open-With (cold + running) · Open Recent · Save / Save-As · split-drag + ratio persist · hide-on-close + Dock reopen · `Cmd+Q` dirty guard · Print-to-PDF (preview only) · app theme toggle (chrome + editor) · **independent preview theme** (dark app + light preview, and Match) · font-size slider · external-edit reload banner · external links open in browser.

- [ ] **Step 3: Rust untouched (sanity)**

Run: `cargo test --manifest-path src-tauri/Cargo.toml` → 9 tests PASS (should be unaffected; confirms scope held).

- [ ] **Step 4: Record outcome**

If all green, the branch is ready for `superpowers:finishing-a-development-branch`. If anything fails, file it as a follow-up task and fix before merge.

---

## Self-Review

**1. Spec coverage**

| Spec section | Covered by |
|---|---|
| §2.1 VSCode aesthetic restyle | Tasks 1, 9–14 |
| §2.2 Tailwind v4, styles.css minimal | Tasks 1, 14 |
| §2.3 Lucide icons everywhere | Tasks 9, 12, 13 (icon map §9) |
| §2.4 shadcn/ui for select components | Tasks 2, 13 |
| §2.5 App.tsx → hooks + components | Tasks 5–7, 9–13 |
| §2.6 independent preview theme | Tasks 4, 8, 11, 13 |
| §2.7 lightweight / tree-shake | Global Constraints + Tasks 1–2 (named imports) |
| §4 locked decisions | shadcn (T2), restyle-not-rearchitect (all), app theme retheme (T1), previewTheme (T4/8/11/13), prose typography (T11), delete-then-rewrite tests (T3/15), native slider + bordered div (T13 + Constraints) |
| §5 stack additions | Tasks 1 (Tailwind+typography) + 2 (lucide, radix×4, slot, cva/clsx/tailwind-merge) |
| §6 component/hook split | File Structure + Tasks 5–13 |
| §7 theme model | Tasks 4, 8, 11 |
| §8 token bridge | Task 1 (index.css) |
| §9 icon map | Tasks 9/12/13 |
| §10 testing strategy | Tasks 3 + 15 (all 8 areas) |
| §11 migration sequence | Task order 1→16 (decision #2 notes the §11.1 deviation) |
| §12 risks | jsdom/Radix → T15 setup stubs; prose tuning → T11; big-bang → styled-each-step (decision #2); CodeMirror theming → T10 keeps oneDark |
| §13 open items | none blocking |

**2. Placeholder scan:** No "TBD"/"implement later". Two explicit "adapt to actual file" notes (Task 14 print selectors, Task 14 survivor list) require reading `styles.css` at execution — they reference real content, not placeholders. shadcn `ui/*` are CLI-generated (Task 2), not transcribed — the canonical mechanism.

**3. Type consistency:** `ViewMode`/`PreviewTheme` defined once (settings.ts, Task 4), imported everywhere after. `usePreviewTheme(): "light"|"dark"` (Task 8) ↔ `PreviewPane resolvedTheme?: "light"|"dark"` (Task 11) ↔ App passes `previewTheme` (Task 8). `UseDocument` shape (Task 5) ↔ `useOsIntegration` handler names (Task 6) match (`loadFile/newDoc/openFromDialog/save/checkDisk`). `useKeyboardShortcuts` signature narrows in Task 13 (drops `onEscape`) — flagged at both sites.

**Known residual risk:** Task 8 widens `PreviewPaneProps` with an unread optional prop to keep the build green before Task 11 wires it; `noUnusedParameters` is satisfied because it's an interface field, not a destructured param. Confirmed safe.
