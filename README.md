# Markdown Kit

A fast, native **Markdown viewer and editor** for macOS. A CodeMirror 6 editor on
the left, a live GitHub-Flavored-Markdown preview on the right, in a resizable,
VSCode-styled window. Open a `.md` from Finder, drag one in, or start typing — edits
render live and save back to disk.

Built with **Tauri v2 (Rust) + React 19 + TypeScript**. The app bundle is ~3.5 MB and
cold-launches in about a second.

---

## Features

- **Open any way you like** — drag-and-drop, **File → Open** (`⌘O`), or Finder's
  **Open With** for `.md`, `.markdown`, and `.mdx` (works whether or not the app is
  already running — single-instance, no duplicate windows).
- **Open Recent** — the last 10 files, persisted across launches.
- **Editor** — CodeMirror 6 with Markdown syntax highlighting, line numbers, line
  wrapping, and 4-space tabs.
- **Live GFM preview** — tables, task lists, strikethrough, and syntax-highlighted
  code blocks. Raw HTML is escaped (no script injection from untrusted files).
- **View modes** — split, editor-only, or preview-only (`⌘1` / `⌘2` / `⌘3`, the
  toolbar, or the View menu).
- **Settings** (`⌘,` or the ⚙ button) — theme, font size (10–24px), and the default
  view mode the app opens in.
- **Light / dark theme** — toggle with `⌘⇧L` or in Settings; persisted. Swaps both the
  editor and code-block themes.
- **Print to PDF** (`⌘P`) — renders the preview through the system print dialog; choose
  "Save as PDF".
- **Save / Save As** (`⌘S`) — a dirty marker (●) in the title and toolbar shows unsaved
  changes; loading over unsaved work prompts first.
- **Stays out of your way** — closing the window hides it (the app remains in the Dock
  and reopens on Dock-click); `⌘Q` quits, with a confirm if you have unsaved changes.
- **Aware of the outside world** — external links open in your browser; if the open file
  changes on disk, a banner offers to reload.

### Keyboard shortcuts

| Action            | Shortcut |
| ----------------- | -------- |
| New               | `⌘N`     |
| Open…             | `⌘O`     |
| Save / Save As    | `⌘S`     |
| Print to PDF      | `⌘P`     |
| Settings          | `⌘,`     |
| Split / Editor / Preview | `⌘1` / `⌘2` / `⌘3` |
| Toggle theme      | `⌘⇧L`    |
| Quit (guarded)    | `⌘Q`     |

---

## Install (macOS)

**Requirements:** macOS on **Apple Silicon** (the prebuilt DMG is `aarch64`). Intel Macs
need a build from source targeting `x86_64` — see [Build](#build).

1. Open `Markdown_0.1.0_aarch64.dmg`.
2. Drag **Markdown.app** into **Applications**.
3. The app is **not code-signed**, so on first launch macOS Gatekeeper will block it.
   Open it once the manual way:
   **right-click Markdown.app → Open → Open**, or System Settings → **Privacy &
   Security** → scroll to the blocked-app notice → **Open Anyway**.
   After that first launch it opens normally.

To set it as the default for Markdown files: right-click any `.md` in Finder → **Get
Info** → **Open with: Markdown** → **Change All…**

---

## Develop

**Toolchain:**

- **Node.js** 18+ and **pnpm** (`npm i -g pnpm`)
- **Rust** stable (`rustup`), with the macOS target
- **Xcode Command Line Tools** (`xcode-select --install`)

```sh
pnpm install
pnpm tauri dev      # run the app with hot reload
pnpm test           # frontend unit tests (Vitest)
pnpm exec tsc --noEmit                              # type-check
cargo test --manifest-path src-tauri/Cargo.toml     # Rust unit tests
```

## Build

```sh
pnpm tauri build
```

Produces:

- `src-tauri/target/release/bundle/macos/Markdown.app`
- `src-tauri/target/release/bundle/dmg/Markdown_0.1.0_aarch64.dmg`

For an Intel or universal binary:

```sh
rustup target add x86_64-apple-darwin        # or aarch64 + x86_64 for universal
pnpm tauri build --target universal-apple-darwin
```

> **Version pinning:** the Rust crates and the `@tauri-apps/*` JS packages must stay on
> the same major/minor (the build pre-flight enforces this). Currently pinned to the
> 2.6 / 2.3 / 2.4 lines.

---

## Manual verification checklist (OS-level, not covered by automated tests)

These exercise paths that require a real macOS bundle and user interaction:

1. **Drag-drop** — drag a `.md` onto the window; it loads into the editor.
2. **Open With (cold start)** — quit, then Finder right-click a `.md` → Open With →
   Markdown; the app launches with the file loaded.
3. **Open With (running)** — with the app open, Open With another `.md`; the same window
   loads it (single-instance, no second app).
4. **Save / Save As** — `⌘S` clears the ● marker and writes to disk; with no path, a save
   dialog appears.
5. **Resize** — the window resizes; the split divider drags; neither pane collapses; the
   ratio persists across launches.
6. **Hide on close** — click the red ✕; the window hides but the app stays in the Dock;
   Dock-click reopens it. `⌘Q` quits (and confirms if there are unsaved changes).
7. **Open Recent** — open a few files; **File → Open Recent** lists them and survives a
   relaunch.
8. **Print to PDF** — `⌘P`; the print sheet shows only the rendered preview.
9. **Settings** — `⌘,` changes theme, font size, and default view; choices persist.
10. **External link / on-disk change** — a preview link opens in the browser; editing the
    file in another app surfaces a reload banner on focus.

---

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — architecture, IPC commands, components, and test map.
- [`FUTURE.md`](./FUTURE.md) — backlog, known concerns/caveats, and the
  run-from-CLI plan.
