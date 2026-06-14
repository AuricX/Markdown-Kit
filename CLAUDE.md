# CLAUDE.md — Markdown Viewer / Editor

Desktop Markdown viewer + editor. CodeMirror editor (left) ‖ live rendered preview
(right), resizable VSCode-styled window with an in-window toolbar and a native macOS
menu bar. **Tauri v2 + React 19 + TypeScript. macOS-targeted.**

---

## Stack

| Layer    | Tech                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| Shell    | Tauri v2 (Rust), single-instance, dialog + opener plugins, native menu        |
| Frontend | React 19, TypeScript, Vite 8                                                   |
| Editor   | CodeMirror 6 (`@uiw/react-codemirror`), `lang-markdown`, One Dark / light     |
| Preview  | `react-markdown` + `remark-gfm` + `rehype-highlight` (highlight.js)           |
| Layout   | `react-resizable-panels`                                                       |
| Tests    | Vitest + Testing Library (frontend), `cargo test` (Rust)                       |

Identifier: `com.auricx.md-viewer-editor`. Product name: **Markdown**. Window 1100×700, min 600×400.

---

## Architecture

```
Finder / drag-drop / argv / menu
        │
        ▼
  src-tauri/src/lib.rs  ── Rust backend (commands, menu, window/recent plumbing)
        │  IPC (invoke) + events (file-opened, menu-*)
        ▼
  src/main.tsx  ── ThemeProvider
        ▼
  src/App.tsx           ── state owner (filePath, content, dirty, error, view, disk-changed)
        │
        ├── Navbar (toolbar)
        ├── ErrorBanner (errors + disk-changed notice)
        └── SplitView ── EditorPane (CodeMirror) / PreviewPane (react-markdown)
```

### Backend — `src-tauri/src/lib.rs`

IPC commands (registered in `invoke_handler`):

- **`read_md(path) -> Result<String, String>`** — reads bytes, validates UTF-8;
  non-UTF-8 returns an explicit "not valid UTF-8" message.
- **`save_md(path, content) -> Result<(), String>`** — write/truncate UTF-8.
- **`take_pending_file() -> Vec<String>`** — drain paths cached before frontend ready.
- **`file_mtime(path) -> Result<u64, String>`** — seconds-since-epoch mtime; powers
  external-modification detection.
- **`add_recent_file(path) -> Vec<String>`** — prepend to the persisted recent list,
  rebuild the menu, return the new list.
- **`get_recent_files() -> Vec<String>`** / **`clear_recent_files()`**.
- **`set_dirty(bool)`** — mirrors the frontend dirty flag into `QuitGuard` for the quit guard.
- **`quit_app()`** — sets the force flag and `app.exit(0)` after the user confirms a dirty quit.
- **`report_ready()`** — opt-in (`MD_LAUNCH_TIMING`) cold-launch timing; no-op otherwise.

Recent files: JSON at `app_config_dir/recent.json`. `merge_recent()` is the pure
list transform (move-to-front, dedupe, cap `MAX_RECENT = 10`) — unit-tested.

Native menu (desktop-only): `build_app_menu()` constructs App / File / Edit / View /
Window submenus. File has New, Open…, **Open Recent** (rebuilt from the persisted
list), Save, Print to PDF, Close. View has the three view-modes + theme toggle.
`handle_menu_event()` forwards most clicks to the frontend as events
(`menu-new/open/save/print/view/theme`); recent-file and clear are handled in Rust.
`rebuild_menu()` swaps the live menu via `app.set_menu` when the recent list changes.

Window / lifecycle (desktop-only):

- **CloseRequested → `api.prevent_close()` + `window.hide()`** — red-button close hides
  the window instead of quitting. The app stays alive in the Dock.
- **`RunEvent::Reopen`** (macOS Dock-icon click) → `window.show()` + focus.
- **`RunEvent::ExitRequested`** — guards `Cmd+Q` / menu quit: if `code` is None, not force-confirmed,
  and `QuitGuard.dirty`, calls `api.prevent_exit()`, shows the window, emits `confirm-quit`. The
  frontend confirms then calls `quit_app` (sets force → `exit`).
- **`RunEvent::Opened`** — macOS Open-with paths; `file://` URL → path → dispatch.
- **single-instance** (registered FIRST) — second launch forwards markdown argv.
- **`dispatch_opened_file`** — caches in `PendingFile`, emits `file-opened`, shows+focuses.

Real quit goes through `Cmd+Q` / the menu (`ExitRequested`) and **is** dirty-guarded via the
`confirm-quit` round-trip above.

### Frontend — `src/App.tsx`

Single state owner: `filePath`, `content`, `dirty`, `error`, `diskChanged`, `viewMode`.
Theme lives in `ThemeProvider` (context), consumed via `useTheme()`.

- **Ref-mirroring**: mount-time listeners (drag-drop, file-opened, menu, keydown,
  focus) read live state through refs to avoid stale closures.
- **`useDeferredValue(content)`** feeds the preview — debounces the expensive markdown
  re-render so fast typing stays smooth. (This introduces a 1-frame lag between the
  editor source and the rendered preview — relevant to tests; see Tests below.)
- **Handlers**: `newDoc`, `openFromDialog` (plugin-dialog `open`), `save`, `loadFile`,
  `printToPdf`. `loadFile`/`save` call `add_recent_file` and record `file_mtime`.
- **`printToPdf`**: if in editor-only mode, briefly switch to split so the preview is
  mounted, then `window.print()` (the `@media print` stylesheet shows only the preview).
- **Menu events** wired to the same handlers the navbar buttons use.
- **External-mod detection**: on window `focus`, re-stat the file and flag a reload notice.
- Persistence in `localStorage`: theme (`md-theme`), settings (`md-settings` = font size +
  default view). The live view mode is session-only; it resets to the default view each launch.
- All Tauri calls try/catch-guarded so the app still runs in browser/jsdom.

### Settings

`settings.ts` is a tiny `useSyncExternalStore` store (no provider) holding `fontSize` and
`defaultView`, persisted to `localStorage["md-settings"]`. `defaultView` defaults to **preview**
and seeds the initial `viewMode` (and applies live when changed). `fontSize` drives editor +
preview through the `--app-font-size` CSS variable. Theme stays in `ThemeProvider`; the Settings
modal just relocates its control. `SettingsModal` is opened from the ⚙ toolbar button or
**Settings…** (`Cmd+,`).

### Components

- **`Navbar`** — toolbar: New/Open/Save/PDF, document name + dirty dot, view-mode
  segmented control, **⚙ settings button**. Every action mirrors a native-menu item.
- **`SettingsModal`** — theme / font-size / default-view dialog; backdrop + × + Escape close.
- **`SplitView`** — `viewMode` switch: split (draggable, ratio persisted via
  `autoSaveId="md-split"`), editor-only, or preview-only.
- **`EditorPane`** — CodeMirror 6; theme-aware (`oneDark` vs light); 4-space tabs,
  line numbers, wrapping. `aria-label="Markdown editor"` on wrapper (contenteditable).
- **`PreviewPane`** — react-markdown w/ GFM + highlight. External links open via
  `opener.openUrl`. **No `rehype-raw`** — raw HTML escaped (XSS guard).
- **`ErrorBanner`** — dismissible top banner; optional action button (used for the
  disk-changed "Reload").
- **`theme.tsx`** — `ThemeProvider`/`useTheme`. Drives `data-theme` on `<html>`, swaps
  the injected highlight.js stylesheet (`?inline` strings), persists to localStorage.

---

## Features (current)

- Open via drag-drop, **File → Open** (`Cmd+O`), or Finder **Open With** (cold + running).
- **Open Recent** (last 10, persisted).
- Edit (CodeMirror 6) with live GFM preview (tables, task lists, strikethrough, code highlight).
- **View modes**: split / editor / preview (`Cmd+1/2/3`); default view configurable (preview).
- **Settings** (`Cmd+,` / ⚙): theme, font size (10–24px), default view mode.
- **Light/dark theme** (`Cmd+Shift+L` or Settings), persisted.
- **Print to PDF** (`Cmd+P`) via the system print dialog on the rendered preview.
- Save / Save-As (`Cmd+S`); dirty `●` marker; discard-confirm on load-over-dirty.
- **Hide-on-close**, re-show on Dock click; **`Cmd+Q` quit is dirty-guarded**.
- **Cold launch < 2s** (preview-default + lean bundle; measured ~0.5–1.2s).
- External links → browser; external-modification reload notice; error banner.

---

## Security posture

- **No raw HTML in preview** (no `rehype-raw`).
- **CSP set** in `tauri.conf.json`: `default-src 'self'`; images from self/data/blob/
  asset/http(s); `style-src 'self' 'unsafe-inline'` (CodeMirror + injected hljs);
  `connect-src 'self' ipc:`.
- **Capabilities** (`capabilities/default.json`): core/event defaults, window
  set-title/set-focus/hide/show, opener default + `open-url`, dialog default.

---

## Tests

**Frontend** (`src/test/`, Vitest + Testing Library, jsdom):

- `App.test.tsx` — renders both panes; Untitled/non-dirty start.
- `EditorPane.test.tsx` — accessible container; renders value; onChange.
- `PreviewPane.test.tsx` — heading, GFM list/table, inline code, **HTML-escape XSS guard**.
- `fileio.test.tsx` — `file-opened` load (asserts within the **preview** pane, since the
  editor source also contains the text), Cmd+S save, Save-As fallback, read-fail banner.
- `Navbar.test.tsx` — file-name/dirty, action handlers, active view + change, settings button.
- `theme.test.tsx` — default dark, toggle→light + `data-theme` + localStorage, restore, style injection.
- `settings.test.tsx` — store defaults/clamp/validate/persist; `SettingsModal` controls + close.
- `App.test.tsx` also covers preview-default, switch-to-split, and opening the settings modal.

Frontend totals **34 tests / 7 files**.

`src/test/setup.ts` stubs `ResizeObserver` and replaces the broken Node test-runner
`localStorage` with an in-memory `Storage`.

**Rust** (`src-tauri/src/lib.rs` `#[cfg(test)]`): read happy/missing/**non-UTF-8**,
save→read roundtrip, bad-path, `PendingFile` drain order, **`merge_recent` move-to-front /
dedupe / cap**. 9 tests.

> Note: `?inline` CSS resolves to empty under the Vitest transform but is correctly
> inlined in the production build (verified: hljs tokens present in `dist`). The theme
> test asserts the injection mechanism, not the CSS contents.

---

## Commands

```sh
pnpm install
pnpm tauri dev      # app, hot reload
pnpm test           # frontend (Vitest)
pnpm build          # tsc + vite production build
cargo test --manifest-path src-tauri/Cargo.toml   # Rust
pnpm tauri build    # → src-tauri/target/release/bundle/macos/Markdown.app + .dmg
```

---

## Version-pinning constraint

Rust crates and `@tauri-apps/*` JS packages must stay same major/minor (build pre-flight
enforces). Pinned: tauri **2.6** / dialog **2.3** / opener **2.4**. Cargo deps use exact `=`.

---

## Conventions

- **pnpm only** (never npm/npx). Run bins via `pnpm exec` / `pnpm dlx`.
- Tauri calls always try/catch-guarded so the frontend degrades gracefully outside the shell.
- Native-menu actions and toolbar buttons share the same handlers — keep them in sync.
- `panic = "abort"`, LTO, `opt-level = "s"`, stripped — release profile tuned for size.
