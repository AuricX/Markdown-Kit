# FUTURE.md — Future Considerations & Backlog

Checklist of not-yet-built features, hardening, and known gaps for the Markdown Viewer / Editor.
Ordered roughly by value/effort. `[x]` = shipped (2026-06-14 batches).

---

## Features

- [x] **Print to PDF** — `Cmd+P` prints the rendered preview via the system print dialog ("Save as PDF").
- [x] **Recent-files menu** — File → Open Recent, last 10, persisted to `app_config_dir/recent.json`.
- [x] **Light/dark theme toggle** — `Cmd+Shift+L`; swaps editor theme + injected hljs stylesheet; persisted.
- [x] **New / empty document command** — File → New (`Cmd+N`), dirty-guarded.
- [x] **Native menu bar** — App / File / Edit / View / Window submenus.
- [x] **Settings dialog** — `Cmd+,` or the ⚙ toolbar button; theme, font size, default view mode.
- [x] **Quit-while-dirty guard** — `Cmd+Q` / menu quit now intercepts `ExitRequested`, mirrors the
      dirty flag into Rust (`QuitGuard`), and round-trips a `confirm-quit` prompt before exiting.
- [ ] **Multiple tabs / documents** — single-document app today; one file at a time.
- [ ] **Scroll-sync** — editor ‖ preview synced scrolling.
- [ ] **Find / replace** in editor (CodeMirror search extension not wired).
- [ ] **Word/char count** / status bar.
- [ ] **Export HTML** — standalone styled `.html` from preview.

## Editor / Preview polish

- [x] **Preview-only / editor-only toggle** — view-mode segmented control + `Cmd+1/2/3`, persisted.
- [x] **Persist split ratio** — `autoSaveId="md-split"` on the PanelGroup.
- [x] **External link handling** — http/https links open in the browser via `opener.openUrl`.
- [x] **Debounced preview** — `useDeferredValue` keeps typing smooth on large docs.
- [x] **Configurable font size** — Settings slider (10–24px) drives editor + preview via a CSS var.
- [ ] **Vertical (stacked) split option** — currently horizontal-only.
- [ ] **Configurable tab size / wrap** — still hardcoded (4-space, wrap on); font size is done.
- [ ] **Image rendering** — verify relative-path images in preview resolve (Tauri asset protocol).

## Robustness / correctness

- [x] **Non-UTF-8 files** — `read_md` now returns an explicit "not valid UTF-8" message (tested).
- [x] **External-modification detection** — on window focus, re-stat via `file_mtime`; banner offers Reload.
- [ ] **Multi-file drop / Open-with** — drag-drop opens only `paths[0]`; Open-with takes the LAST pending
      path. Still single-open by design; decide whether to open-all or warn.
- [ ] **Save error recovery** — partial-write / disk-full not specifically handled beyond the error banner.
- [ ] **Quit-while-dirty** — see "real quit guard" above; the hide-on-close path is guarded, quit is not.

## Security / hardening

- [x] **Set a real CSP** — `tauri.conf.json` now has a locked-down policy (was `null`).
- [x] **No-raw-HTML invariant** — preview escapes HTML; regression test in `PreviewPane.test.tsx`.
- [ ] **Audit highlight.js / remark / rehype** for advisories periodically.
- [ ] **Path validation** in `read_md`/`save_md` — accept arbitrary paths; fine for a local editor, note
      the trust boundary if scope grows (e.g. remote content driving file writes).
- [ ] **Tighten CSP further** — `style-src` still needs `'unsafe-inline'` for CodeMirror + injected hljs;
      revisit if those can move to nonce/hashed styles.

## CLI

- [ ] **Run the app from the CLI** — a `markdown [file.md]` invocation that launches the app and
      opens the given file (and `markdown -` / stdin for piped content). Implementation notes:
  - macOS app bundles aren't on `$PATH`; add a thin `markdown` shim (symlink/script in
    `/usr/local/bin`) that calls `open -a Markdown --args <abspath>`, or ship a CLI binary.
  - File path already flows through `dispatch_opened_file` → reuse it; resolve relative paths to
    absolute before handing off (cwd is lost across `open`).
  - Single-instance already forwards argv to a running app, so `markdown x.md` works whether or not
    the app is already open.
  - Consider an `install-cli` action (writes the shim) and a `--version` / `--help` flag.

## Platform / distribution

- [ ] **Windows / Linux support** — single-instance argv path exists, but Open-with (`RunEvent::Opened`),
      hide-on-close, and `Reopen` are macOS-centric; no Windows/Linux verification.
- [ ] **Code signing + notarization** (macOS) for a distributable `.dmg`.
- [ ] **Auto-update** — Tauri updater plugin not wired.

## Tooling / DX

- [ ] **CI** — no pipeline running `pnpm test` + `cargo test` + build.
- [ ] **Lint / format config** — no ESLint/Prettier/rustfmt config checked in.
- [ ] **E2E test** for the OS-level paths (drag-drop, Open-with, menu, hide-on-close) — manual only today.
- [ ] **Dependency-version pre-flight** referenced in README — confirm the enforcing script exists/runs.
- [ ] **Bundle size** — the JS chunk is ~1.2 MB (CodeMirror + react-markdown). Consider code-splitting.

---

## Known concerns / caveats

Things that work but carry caveats worth tracking:

- **Unsigned bundle** — the `.app`/`.dmg` are not code-signed or notarized. macOS Gatekeeper warns
  on first launch (right-click → **Open**, or System Settings → Privacy & Security → **Open Anyway**).
  Needed before any real distribution; see "Code signing + notarization" below.
- **Apple Silicon only** — the DMG is `aarch64`. No Intel/universal build produced. Intel Macs can't
  run it as-is (would need `--target universal-apple-darwin` or an x86_64 build).
- **`Cmd+Q` confirm uses `window.confirm`** — a JS dialog, not a native sheet. It blocks the webview
  while open (acceptable here, but note it for any future webview-dialog work).
- **Launch metric is approximate** — `report_ready` measures process-start → React mount, not final
  pixel paint (a hair later). Measured ~0.5–1.2s; the true time-to-interactive is marginally higher.
- **`report_ready` ships in the release binary** — env-gated (`MD_LAUNCH_TIMING`), silent and inert
  otherwise. Harmless, but it is diagnostic code in production; strip if undesired.
- **Live view mode is not remembered** — only the *default* view persists (by design). Switching
  view during a session resets on relaunch; revisit if users expect last-used to stick.
- **External-change detection is focus-based** — only re-stats on window focus, not via a file
  watcher. A change while the window stays focused isn't noticed until focus is lost and regained.
- **Settings store loads `localStorage` once at module import** — fine in the app; tests that need a
  different seed must call `setSettings(...)` rather than reseeding storage after import.

---

## Known manual-only verifications (no automated coverage)

Require a real macOS bundle (see README §"Manual verification checklist"):

1. Drag-drop loads file.
2. Open With cold-start / while-running (single-instance).
3. File → Open dialog; Open Recent (persists across relaunch).
4. Save / Save-As; dirty marker clears.
5. Resize / divider drag / no pane collapse; split ratio persists.
6. **Hide-on-close** then Dock-click re-show; `Cmd+Q` quits.
7. **Print to PDF** sheet shows only the preview.
8. **Theme** toggle persists; **view modes** switch; menu shortcuts fire.
9. External link opens in browser; external on-disk edit triggers the Reload banner.

→ Candidates to automate with a Tauri E2E / WebDriver harness.
