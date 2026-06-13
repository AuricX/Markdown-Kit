# Markdown Viewer / Editor — Design Spec

**Date:** 2026-06-13
**Status:** Approved
**Stack:** Tauri v2 (CLI 2.5.0) + Vite + React + TypeScript

## Goal

A simple desktop Markdown viewer/editor: drag-and-drop `.md` files in, edit on the left, see rendered preview on the right, save edits. Must be selectable via Finder "Open with". VSCode-like look and feel.

## Non-Goals (YAGNI)

- Multi-tab / multiple documents at once (single document at a time).
- Cross-platform parity (macOS is the primary target; Open-with wiring is macOS-specific).
- Print-to-PDF (documented as a future consideration, not built now).
- Persisted recent-files list, settings UI, plugin system.

## Architecture

```
┌─────────────────────────────────────────────┐
│ Tauri v2 shell (Rust)                         │
│  - window mgmt (resizable, min size)          │
│  - commands: read_md, save_md                 │
│  - RunEvent::Opened  → emit "file-opened"     │
│  - single-instance plugin                     │
└───────────────▲───────────────────────────────┘
                │ invoke / events (IPC)
┌───────────────┴───────────────────────────────┐
│ React frontend (Vite + TS)                     │
│  App ── Editor (CodeMirror) │ Preview (md)     │
│      └─ SplitPane (resizable divider)          │
└────────────────────────────────────────────────┘
```

## Components

### Frontend

| Unit | Responsibility | Key deps |
|------|----------------|----------|
| `App.tsx` | Owns state: `filePath`, `content`, `dirty`. Wires panes, Cmd+S handler, drag-drop + `file-opened` listeners. | tauri api |
| `Editor.tsx` | CodeMirror 6 editor, markdown language mode, dark theme. Emits content changes (debounced not required). | `@codemirror/lang-markdown`, `@uiw/react-codemirror`, `@codemirror/theme-one-dark` |
| `Preview.tsx` | Renders markdown to HTML. GFM (tables, task lists, strikethrough) + code-block syntax highlighting. | `react-markdown`, `remark-gfm`, `rehype-highlight` (highlight.js) |
| `SplitPane` | Horizontal resizable split, draggable divider, sensible min widths. | `react-resizable-panels` |
| `styles` | VSCode-like theme: dark background (#1e1e1e), mono font stack, scrollbars. | — |

### Backend (Rust — `src-tauri/src/lib.rs`)

| Command / handler | Signature | Notes |
|-------------------|-----------|-------|
| `read_md` | `(path: String) -> Result<String, String>` | Read file UTF-8. |
| `save_md` | `(path: String, content: String) -> Result<(), String>` | Write file UTF-8. |
| `RunEvent::Opened` | handler in `run()` | macOS delivers Open-with file paths here (not argv). Cache path; emit `file-opened` to frontend once webview is ready. |
| single-instance | `tauri-plugin-single-instance` | Reopening with a new file reuses the existing window instead of spawning a second app. |

Plugins: `tauri-plugin-dialog` (Save As / open dialog), `tauri-plugin-fs` (or custom commands — custom commands chosen for tighter control), `tauri-plugin-single-instance`.

## Data Flow

1. **Open**
   - *Drag-drop*: webview `onDragDropEvent` yields absolute path → `invoke('read_md')` → set `content`, `filePath`, clear `dirty`.
   - *Finder "Open with"*: `RunEvent::Opened { urls }` in Rust → emit `file-opened` with path → frontend listener → `read_md` → load.
2. **Edit**: CodeMirror change → update `content`, set `dirty = true`.
3. **Save** (`Cmd+S`):
   - If `filePath` known → `save_md` → clear `dirty`.
   - Else → dialog "Save As" → set `filePath` → `save_md` → clear `dirty`.

## "Open With" Wiring (the load-bearing detail)

`src-tauri/tauri.conf.json`:

```jsonc
"bundle": {
  "fileAssociations": [
    {
      "ext": ["md", "markdown", "mdx"],
      "name": "Markdown Document",
      "role": "Editor"
    }
  ]
}
```

- This embeds document-type UTIs in the generated `Info.plist`, so Finder lists the app under "Open With".
- On macOS the opened file path arrives via `RunEvent::Opened`, **not** command-line args. Must handle there.
- Webview may not be ready when `Opened` fires at cold start → cache the path in Rust state, and have the frontend request "any pending file" on mount (a `take_pending_file` command) in addition to listening for the live event. This covers both cold-start and already-running cases.

## VSCode-like Look & Feel

- **Font:** `'SF Mono', Menlo, Monaco, Consolas, 'Courier New', monospace` for the editor; system UI font for chrome.
- **Tab size:** 4 spaces; insert spaces (CodeMirror `indentUnit` = 4, tab key inserts spaces).
- **Theme:** dark — editor background `#1e1e1e`, One Dark syntax theme for CodeMirror, preview styled to match (dark bg, light text, GitHub-dark-ish markdown styling).
- **Window:** resizable (Tauri default), `minWidth`/`minHeight` set (~600×400), title shows filename + `●` when dirty.
- **Split:** draggable divider, 50/50 default, min pane widths so neither collapses.

## Error Handling

- `read_md` / `save_md` return `Result<_, String>`; frontend surfaces failures as an inline banner/toast (no crashes).
- Opening a new file while `dirty` → basic `confirm()` prompt ("Discard unsaved changes?"). Lightweight; richer dialog is future work.

## Testing

- **Rust:** unit tests for `read_md`/`save_md` against temp files (happy path + missing file + bad path).
- **Frontend:** Vitest — markdown rendering (GFM features render), dirty-state transitions, save routing (known path vs Save-As).
- **Manual checklist** (OS-level, not automatable here): drag-drop loads file; Finder "Open with" cold-start loads file; Finder "Open with" while running reuses window; window resize; Cmd+S saves.

## Future Considerations

- **Print-to-PDF**: via webview print API or a headless render of the preview pane to PDF. Likely a `Cmd+P` → render preview HTML → PDF. Out of scope now.
- Dirty-close confirmation dialog (native), recent-files menu, light/dark toggle, multiple tabs.

## Implementation Phases (for subagent-driven development)

1. **Scaffold** — `pnpm create tauri-app` (React-TS-Vite), verify dev build runs.
2. **Backend** — Rust commands `read_md`/`save_md`, plugins, `RunEvent::Opened` + `take_pending_file`, `fileAssociations` in conf.
3. **Frontend shell** — App state, SplitPane, VSCode dark styling.
4. **Editor** — CodeMirror integration, markdown mode, tab/indent config.
5. **Preview** — react-markdown + GFM + highlight.
6. **Wire I/O** — drag-drop, file-opened event, Cmd+S save / Save-As.
7. **Tests + manual verification** — Rust + Vitest + manual Open-with checklist.
