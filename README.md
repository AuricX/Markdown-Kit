# Markdown Viewer / Editor

A simple desktop Markdown viewer and editor. CodeMirror editor on the left, live
rendered preview on the right, in a resizable VSCode-styled window. Built with
Tauri v2 + React + TypeScript. macOS.

## Features

- Open files three ways: drag-and-drop, the native **File → Open** dialog
  (`Cmd+O`), or Finder's **Open With** for `.md`, `.markdown`, `.mdx`.
- **Open Recent** menu — last 10 files, persisted across launches.
- In-window **toolbar** (New / Open / Save / PDF) plus a full native macOS menu bar.
- Edit with a CodeMirror 6 editor (markdown syntax highlighting, 4-space tabs,
  line numbers, line wrapping).
- Live GFM preview: tables, task lists, strikethrough, syntax-highlighted code blocks.
- **View modes** — split, editor-only, preview-only (`Cmd+1/2/3` or the toolbar).
- **Light / dark theme** toggle (`Cmd+Shift+L`), persisted; swaps editor + code themes.
- **Print to PDF** (`Cmd+P`) — prints the rendered preview via the system print dialog.
- Save with `Cmd+S` (`Save As…` dialog when the document has no path yet).
- **Closing the window hides it** (app stays in the Dock); re-opens on Dock click.
  `Cmd+Q` quits for real.
- External links open in the default browser; preview escapes raw HTML (no script injection).
- Detects when the open file changes on disk and offers to reload.

## Develop

```sh
pnpm install
pnpm tauri dev      # run the app with hot reload
pnpm test           # frontend unit tests (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust unit tests
```

## Build

```sh
pnpm tauri build
```

Produces `src-tauri/target/release/bundle/macos/Markdown.app` and a `.dmg`.

> **Note:** the Rust crates and the `@tauri-apps/*` JS packages must stay on the
> same major/minor (the build pre-flight enforces this). They are currently pinned
> to the 2.6 / 2.3 / 2.4 lines respectively.

## Manual verification checklist (OS-level, not covered by automated tests)

These exercise paths that require a real macOS bundle and user interaction:

1. **Drag-drop** — drag a `.md` file onto the window; it loads into the editor.
2. **Open With (cold start)** — quit the app, then in Finder right-click a `.md`
   → Open With → Markdown; the app launches with the file loaded.
3. **Open With (running)** — with the app already open, Open With another `.md`;
   the same window loads the new file (single-instance, no second app).
4. **Save** — edit, `Cmd+S`; title's dirty marker (●) clears, file on disk updates.
5. **Save As** — drag in nothing, type content, `Cmd+S`; a save dialog appears.
6. **Resize** — the window resizes; the split divider drags; neither pane collapses.
7. **Hide on close** — click the red ✕; the window hides but the app stays in the
   Dock. Click the Dock icon → the window reappears. `Cmd+Q` actually quits.
8. **Open Recent** — open a few files; **File → Open Recent** lists them and
   survives a relaunch.
9. **Print to PDF** — `Cmd+P`; the system print sheet appears on the rendered
   preview; "Save as PDF" produces a clean PDF (no editor/toolbar).
10. **Theme** — `Cmd+Shift+L` toggles light/dark; the choice persists across launches.

## Future considerations

See [`FUTURE.md`](./FUTURE.md) for the remaining backlog (multiple tabs,
find/replace, scroll-sync, CI, code-signing, Windows/Linux support, …).
