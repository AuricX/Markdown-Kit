# Markdown Viewer / Editor

A simple desktop Markdown viewer and editor. CodeMirror editor on the left, live
rendered preview on the right, in a resizable VSCode-styled window. Built with
Tauri v2 + React + TypeScript. macOS.

## Features

- Drag-and-drop a `.md` file onto the window to open it.
- Edit with a CodeMirror 6 editor (markdown syntax highlighting, One Dark theme,
  4-space tabs, line numbers).
- Live GFM preview: tables, task lists, strikethrough, syntax-highlighted code blocks.
- Save with `Cmd+S` (`Save As…` dialog when the document has no path yet).
- Selectable from Finder's **Open With** menu for `.md`, `.markdown`, and `.mdx`.

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

## Future considerations

- **Print to PDF** — e.g. `Cmd+P` renders the preview pane to a PDF (via the webview
  print API or a headless render). Not yet implemented.
- Native dirty-close confirmation dialog, recent-files menu, light/dark toggle,
  multiple tabs.
