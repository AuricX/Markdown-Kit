# Markdown Kit — UI Redesign (Tailwind + shadcn/ui + Lucide)

- **Date:** 2026-06-18
- **Status:** Design — approved direction, pending spec review
- **Scope:** Frontend (`src/`) only. `src-tauri/` Rust backend untouched.

---

## 1. Context / current state

Desktop Markdown viewer/editor. Tauri v2 + React 19 + TypeScript + Vite 8. 3-pane
layout (CodeMirror editor ‖ react-markdown preview, resizable). Current UI is:

- **No UI framework** — hand-rolled components + a single 548-line `styles.css`.
- **Icons** = emojis/unicode (`⚙` settings, `●` dirty, `×` close, text labels for view modes).
- **One god component** — `App.tsx` (381 lines) owns all state, handlers, and 7 effects
  (drag-drop, file-opened, menu events, keydown, focus disk-check, dirty-mirror, title).
- **Theme** — single `light|dark` state in `theme.tsx` drives both app chrome (`data-theme`)
  and the preview's hljs stylesheet. Persisted to `localStorage`.

## 2. Goals

1. Modern, VSCode-like aesthetic on the existing 3-pane editor (restyle, not re-architect the IDE).
2. Tailwind CSS v4 as the styling system; `styles.css` reduced to bare minimum.
3. Lucide icons (tree-shaken) replacing every emoji/unicode glyph.
4. shadcn/ui (Radix + Tailwind, copy-paste) for the few components that benefit.
5. Clean component split — break `App.tsx` into focused hooks + components.
6. **New feature:** preview theme independent of app theme (e.g. dark app, white preview).
7. Stay lightweight — every added dep tree-shaken; CSS shrinks net.

## 3. Non-goals (explicitly out of scope)

- No activity bar, status bar, command palette, or file-explorer sidebar (restyle only).
- No replacement of CodeMirror 6 (editor) or react-markdown (preview/parser).
- No changes to `src-tauri/` Rust, the native menu, updater logic, CI, or `tauri.conf.json`.
- The earlier ponytail-audit cuts (serde dep, `report_ready`, etc.) are **separate work**.

## 4. Locked decisions

| Decision | Choice |
|---|---|
| Component approach | **shadcn/ui** — Radix primitives + Tailwind, copy-pasted into repo (`components/ui/`) |
| Rewrite scope | **Restyle + clean component split** (no IDE chrome) |
| App theme | **Keep light/dark** toggle, retheme to VSCode Dark+ / Light+ |
| Preview theme | **New independent setting** — `match | light | dark` (default `match`) |
| Markdown typography | **`@tailwindcss/typography` `prose`** replaces hand-rolled `markdown-body` CSS |
| Tests | **Delete all 7 now, rewrite after** the refactor. Rust tests untouched. |
| Slider / Separator | **Native `<input type=range>` / bordered div** — no primitive (not worth a dep) |

## 5. Stack additions

| Dep | Type | Why |
|---|---|---|
| `tailwindcss` v4 + `@tailwindcss/vite` | dev | CSS-first config (no `tailwind.config.js`), Vite plugin, purged output |
| `@tailwindcss/typography` | dev | `prose` classes replace most `markdown-body` CSS |
| `lucide-react` | runtime | tree-shaken icons via named imports |
| `@radix-ui/react-dialog` | runtime | Settings dialog (focus trap, escape, aria — fixes current a11y gap) |
| `@radix-ui/react-select` | runtime | preview-theme + default-view dropdowns (native `<select>` can't match VSCode look) |
| `@radix-ui/react-tooltip` | runtime | styled toolbar tooltips with ⌘ hints |
| `@radix-ui/react-slot` | runtime | shadcn `asChild` composition |
| `class-variance-authority`, `clsx`, `tailwind-merge` | runtime | shadcn `cn()` + variant helpers |

**Bundle impact (honest):** Tailwind is compile-time (static CSS, purged) → CSS shrinks
vs 548 hand-rolled lines. `lucide-react` named imports tree-shake to only-used glyphs.
Radix (4 primitives) adds modest runtime JS (~tens of KB gz). The bundle is already
dominated by CodeMirror + react-markdown (~1.2 MB); net runtime increase is small, CSS
goes down. No CSP change needed (`style-src 'unsafe-inline'` already covers Radix inline
styles; Tailwind ships a static file).

## 6. Architecture — component / hook split

`App.tsx` becomes a thin composition. Its state and effects move into focused hooks.

```
src/
  main.tsx                 // providers + StrictMode (import { StrictMode })
  App.tsx                  // thin: composes layout + wires hooks
  index.css                // Tailwind entry + tokens + minimal globals (was styles.css)
  lib/
    utils.ts               // cn() = twMerge(clsx(...))
  hooks/
    useDocument.ts         // filePath, content, dirty; load/save/new; mtime; recent-file calls
    useOsIntegration.ts    // drag-drop, file-opened, menu events, focus disk-check,
                           //   dirty-mirror, pending-file drain  (absorbs 5 ref-mirrored effects)
    useKeyboardShortcuts.ts// Cmd/Ctrl+S save, Escape closes dialog
    usePreviewTheme.ts     // resolve preview theme -> data-preview-theme + hljs swap
  theme.tsx                // appTheme context (light/dark) + persist + data-theme  (hljs swap removed)
  settings.ts              // fontSize, defaultView, + previewTheme
  components/
    Toolbar.tsx            // was Navbar: file actions, title+dirty, ViewModeSwitch, settings btn
    ToolbarButton.tsx      // icon button + Radix Tooltip wrapper
    ViewModeSwitch.tsx     // segmented control (editor/split/preview), aria-pressed
    EditorPane.tsx         // CodeMirror (theme logic kept; wrapper reskinned)
    PreviewPane.tsx        // react-markdown in <div className="prose ...">
    SplitView.tsx          // react-resizable-panels switch (restyled handle)
    Banner.tsx             // was ErrorBanner: error + disk-changed; lucide icons
    SettingsDialog.tsx     // was SettingsModal, rebuilt on shadcn Dialog
    ui/
      button.tsx  dialog.tsx  select.tsx  tooltip.tsx   // shadcn copy-paste, only these
  updater.ts               // unchanged
```

Highest-value extraction: `useOsIntegration` consolidates the gnarly ref-mirrored OS
listeners, leaving `App.tsx` readable.

## 7. Theme model (new behavior)

Two independent axes:

- **appTheme** `light | dark` — lives in `theme.tsx` context. Drives `data-theme` on `<html>`
  (chrome tokens) and CodeMirror's `oneDark` vs light (editor follows the app). Persisted to
  `localStorage["md-theme"]`.
- **previewTheme** `match | light | dark` (default `match`) — lives in the settings store
  (`localStorage["md-settings"]`). Resolved (`match` → appTheme) drives:
  - `data-preview-theme` on the preview root,
  - the global hljs `<style>` swap (github vs github-dark),
  - `prose` vs `prose-invert` on the preview container.

So **dark app + white preview** = `appTheme:dark, previewTheme:light`. The hljs swap moves
out of `theme.tsx` into `usePreviewTheme` (keyed on the *resolved preview* theme, not app).

Settings dialog gains two rows: **App theme** (Sun/Moon toggle) and **Preview theme**
(Select: Match app / Light / Dark).

### settings.ts changes
- `Settings` interface gains `previewTheme: "match" | "light" | "dark"`.
- `DEFAULTS.previewTheme = "match"`.
- Add `isPreviewTheme()` guard; validate on `load()` and in `setSettings()`.

## 8. Styling / token bridge

`index.css`:
- `@import "tailwindcss";`
- `@plugin "@tailwindcss/typography";`
- `@theme` maps shadcn tokens (`background, foreground, card, popover, primary, secondary,
  muted, accent, destructive, border, input, ring`) → CSS vars.
- `[data-theme=dark]` / `[data-theme=light]` set those vars to **VSCode Dark+ / Light+** values.
- `[data-preview-theme=dark]` / `[data-preview-theme=light]` set the preview palette vars
  (scoped to `.markdown-body` / the prose container).

`styles.css` → `index.css` keeps only: Tailwind import, `@theme` tokens, the two palette
var-blocks, `html/body { height:100% }`, the `--app-font-size` var, CodeMirror height fixes,
the `@media print` preview-only rule, and the few `prose` overrides hljs needs.
**Target: ~80–120 lines (from 548).**

## 9. Icon map (lucide-react)

| Current | Lucide |
|---|---|
| New | `FilePlus2` |
| Open | `FolderOpen` |
| Save | `Save` |
| Print to PDF | `FileDown` |
| `⚙` settings | `Settings` |
| `×` close | `X` |
| `●` dirty | small filled `Circle` |
| view: editor / split / preview | `PanelLeft` / `Columns2` / `Eye` |
| banner error / reload | `CircleAlert` / `RotateCw` |
| theme toggle | `Sun` / `Moon` |

Tooltips (Radix) carry the `⌘`-accelerator hints currently in `title=` attributes.

## 10. Testing strategy

- **Delete now:** all 7 `src/test/*.tsx` (34 tests).
- **Keep:** `src/test/setup.ts` (ResizeObserver + in-memory localStorage stubs). Add
  `window.matchMedia` and pointer-event stubs Radix Dialog needs under jsdom.
- **Rewrite after refactor**, covering:
  - both panes render; Untitled/non-dirty start; title + dirty marker
  - file-open via `file-opened` event (assert text in the **preview** pane)
  - save / save-as fallback; read-fail banner
  - view switching (editor/split/preview)
  - settings store: font clamp, defaultView, **previewTheme** validate/persist
  - app-theme toggle → `data-theme` + persistence; hljs keyed to **preview** theme
  - SettingsDialog a11y: role=dialog, Escape closes, focus trap
- **Rust tests** (`src-tauri/`) untouched.

## 11. Migration sequence (app stays runnable each milestone)

1. **Tooling:** add Tailwind v4 + `@tailwindcss/vite` to `vite.config.ts`; create `index.css`
   with tokens; swap `main.tsx` import. App renders unstyled-but-working.
2. **shadcn scaffolding:** `lib/utils.ts` (`cn`), `components/ui/{button,dialog,select,tooltip}`.
3. **Delete tests** (unblocks refactor churn).
4. **Hooks extraction:** `useDocument`, `useOsIntegration`, `useKeyboardShortcuts` — `App.tsx`
   thinned, behavior identical. Manual smoke check.
5. **Theme split:** `theme.tsx` (app only) + `usePreviewTheme` + `settings.previewTheme`.
6. **Component restyle, one at a time:** Toolbar (+ToolbarButton, ViewModeSwitch) → SplitView →
   EditorPane wrapper → PreviewPane (`prose`) → Banner → SettingsDialog (on Radix Dialog).
7. **CSS reduction:** delete migrated rules from `styles.css`; confirm `index.css` ~80–120 lines.
8. **Rewrite tests** (§10). `pnpm test` green.
9. **Manual verification** (existing FUTURE.md checklist): drag-drop, Open-with, recent,
   save, split drag, hide/reopen, print-to-PDF, theme toggles incl. independent preview theme.

## 12. Risks / mitigations

- **jsdom + Radix Dialog** → needs `matchMedia`/pointer stubs in `setup.ts`. Mitigate in step 8.
- **`prose` vs current look** → defaults differ; tune with `prose-` modifiers. Expected (redesign).
- **Big-bang (tests deleted)** → sequence above keeps the app compiling/runnable each step;
  lean on manual smoke checks until tests are rewritten.
- **CodeMirror theming** → unaffected by Tailwind; editor keeps `oneDark`/light driven by appTheme.

## 13. Open items

None blocking. Independent-preview-theme resolution rule (`match` → appTheme) is fixed above.
