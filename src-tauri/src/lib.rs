use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Instant;

/// Captured at the top of `run()` to measure cold-launch time. Opt-in via the
/// `MD_LAUNCH_TIMING` env var so it is a no-op for normal users.
static LAUNCH_START: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

#[cfg(desktop)]
use tauri::Emitter;
use tauri::Manager;

#[cfg(desktop)]
use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};

/// Max number of paths kept in the "Open Recent" list.
const MAX_RECENT: usize = 10;

/// Shared state holding file paths delivered by the OS
/// (via `RunEvent::Opened` on macOS, or single-instance argv on relaunch)
/// before the frontend was ready to consume them. Drained once taken.
#[derive(Default)]
struct PendingFile(Mutex<Vec<String>>);

/// Mirrors the frontend's unsaved-changes flag into Rust so the `ExitRequested`
/// handler can guard `Cmd+Q` / menu quit. `force` lets the frontend bypass the
/// guard once the user has confirmed they want to quit.
#[derive(Default)]
struct QuitGuard {
    dirty: AtomicBool,
    force: AtomicBool,
}

/// Read a UTF-8 file's contents. IO/encoding errors are mapped to a String
/// so they cross the IPC boundary cleanly. Non-UTF-8 files get an explicit
/// message instead of a raw `InvalidData` os-error.
#[tauri::command]
fn read_md(path: String) -> Result<String, String> {
    match std::fs::read(&path) {
        Ok(bytes) => String::from_utf8(bytes)
            .map_err(|_| format!("{} is not valid UTF-8 text", path)),
        Err(e) => Err(format!("Failed to read {}: {}", path, e)),
    }
}

/// Write UTF-8 content to a file, creating or truncating it.
#[tauri::command]
fn save_md(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

/// Return and clear any file paths cached before the frontend was ready
/// (covers the cold-start case where `Opened` fired before the webview mounted).
#[tauri::command]
fn take_pending_file(state: tauri::State<'_, PendingFile>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap_or_else(|e| e.into_inner()))
}

/// Mirror the frontend dirty flag so quit can be guarded.
#[tauri::command]
fn set_dirty(state: tauri::State<'_, QuitGuard>, dirty: bool) {
    state.dirty.store(dirty, Ordering::Relaxed);
}

/// Called once when the frontend has mounted. Prints cold-launch time when
/// `MD_LAUNCH_TIMING` is set; otherwise a no-op.
#[tauri::command]
fn report_ready() {
    if std::env::var_os("MD_LAUNCH_TIMING").is_some() {
        if let Some(start) = LAUNCH_START.get() {
            eprintln!("[launch] frontend ready in {:.2?}", start.elapsed());
        }
    }
}

/// Force-quit, bypassing the unsaved-changes guard. Called by the frontend after
/// the user confirms they want to discard changes.
#[tauri::command]
fn quit_app(app: tauri::AppHandle, state: tauri::State<'_, QuitGuard>) {
    state.force.store(true, Ordering::Relaxed);
    app.exit(0);
}

/// Seconds-since-epoch of a file's last-modified time. Used by the frontend to
/// detect that the open file changed on disk underneath it.
#[tauri::command]
fn file_mtime(path: String) -> Result<u64, String> {
    let meta = std::fs::metadata(&path).map_err(|e| format!("Failed to stat {}: {}", path, e))?;
    let modified = meta.modified().map_err(|e| format!("No mtime for {}: {}", path, e))?;
    modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .map_err(|e| format!("Bad mtime for {}: {}", path, e))
}

// ---------------------------------------------------------------------------
// Recent files (persisted JSON in the app config dir)
// ---------------------------------------------------------------------------

/// Pure list transform: move `path` to the front, de-duplicate, cap at
/// `MAX_RECENT`. Kept side-effect-free so it is directly unit-testable.
fn merge_recent(mut list: Vec<String>, path: &str) -> Vec<String> {
    list.retain(|p| p != path);
    list.insert(0, path.to_string());
    list.truncate(MAX_RECENT);
    list
}

#[cfg(desktop)]
fn recent_file_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Option<std::path::PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join("recent.json"))
}

#[cfg(desktop)]
fn load_recent<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Vec<String> {
    let Some(path) = recent_file_path(app) else {
        return Vec::new();
    };
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[cfg(desktop)]
fn store_recent<R: tauri::Runtime>(app: &tauri::AppHandle<R>, list: &[String]) {
    if let Some(path) = recent_file_path(app) {
        if let Ok(json) = serde_json::to_string_pretty(list) {
            let _ = std::fs::write(path, json);
        }
    }
}

/// Add a path to the recent list and rebuild the menu so "Open Recent" reflects
/// it immediately. Returns the new list for the frontend.
#[tauri::command]
fn add_recent_file(app: tauri::AppHandle, path: String) -> Vec<String> {
    #[cfg(desktop)]
    {
        let list = merge_recent(load_recent(&app), &path);
        store_recent(&app, &list);
        rebuild_menu(&app, &list);
        return list;
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, path);
        Vec::new()
    }
}

#[tauri::command]
fn get_recent_files(app: tauri::AppHandle) -> Vec<String> {
    #[cfg(desktop)]
    {
        return load_recent(&app);
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Vec::new()
    }
}

#[tauri::command]
fn clear_recent_files(app: tauri::AppHandle) {
    #[cfg(desktop)]
    {
        store_recent(&app, &[]);
        rebuild_menu(&app, &[]);
    }
    #[cfg(not(desktop))]
    let _ = app;
}

// ---------------------------------------------------------------------------
// Native menu
// ---------------------------------------------------------------------------

/// Build the full application menu. `recents` populates the "Open Recent"
/// submenu. Menu-item ids are matched in `on_menu_event` and forwarded to the
/// frontend (or handled in Rust for recent-file clicks).
#[cfg(desktop)]
fn build_app_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    recents: &[String],
) -> tauri::Result<Menu<R>> {
    let prefs_item = MenuItemBuilder::with_id("settings", "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    // App menu (macOS shows the product name as the title).
    let app_menu = SubmenuBuilder::new(app, "Markdown Kit")
        .about(None)
        .separator()
        .item(&prefs_item)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    // Open Recent submenu, rebuilt from the persisted list each time.
    let mut recent_b = SubmenuBuilder::new(app, "Open Recent");
    if recents.is_empty() {
        let none = MenuItemBuilder::with_id("recent-none", "No Recent Files")
            .enabled(false)
            .build(app)?;
        recent_b = recent_b.item(&none);
    } else {
        for p in recents {
            let item = MenuItemBuilder::with_id(format!("recent::{p}"), p).build(app)?;
            recent_b = recent_b.item(&item);
        }
        let clear = MenuItemBuilder::with_id("clear-recent", "Clear Recent").build(app)?;
        recent_b = recent_b.separator().item(&clear);
    }
    let recent_menu = recent_b.build()?;

    let new_item = MenuItemBuilder::with_id("new", "New")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open_item = MenuItemBuilder::with_id("open", "Open…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save_item = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let print_item = MenuItemBuilder::with_id("print", "Print to PDF…")
        .accelerator("CmdOrCtrl+P")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_item)
        .item(&open_item)
        .item(&recent_menu)
        .separator()
        .item(&save_item)
        .item(&print_item)
        .separator()
        .close_window()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let split_item = MenuItemBuilder::with_id("view-split", "Split View")
        .accelerator("CmdOrCtrl+1")
        .build(app)?;
    let editor_item = MenuItemBuilder::with_id("view-editor", "Editor Only")
        .accelerator("CmdOrCtrl+2")
        .build(app)?;
    let preview_item = MenuItemBuilder::with_id("view-preview", "Preview Only")
        .accelerator("CmdOrCtrl+3")
        .build(app)?;
    let theme_item = MenuItemBuilder::with_id("toggle-theme", "Toggle Light/Dark")
        .accelerator("CmdOrCtrl+Shift+L")
        .build(app)?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&split_item)
        .item(&editor_item)
        .item(&preview_item)
        .separator()
        .item(&theme_item)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .fullscreen()
        .build()?;

    Menu::with_items(
        app,
        &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu],
    )
}

/// Replace the live menu (used after the recent list changes).
#[cfg(desktop)]
fn rebuild_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>, recents: &[String]) {
    if let Ok(menu) = build_app_menu(app, recents) {
        let _ = app.set_menu(menu);
    }
}

/// Handle a click on a native menu item. Most ids are forwarded to the
/// frontend as events; recent-file and clear are handled here in Rust.
#[cfg(desktop)]
fn handle_menu_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, id: &str) {
    match id {
        "new" | "open" | "save" | "print" | "settings" => {
            let _ = app.emit(&format!("menu-{id}"), ());
        }
        "view-split" => {
            let _ = app.emit("menu-view", "split");
        }
        "view-editor" => {
            let _ = app.emit("menu-view", "editor");
        }
        "view-preview" => {
            let _ = app.emit("menu-view", "preview");
        }
        "toggle-theme" => {
            let _ = app.emit("menu-theme", ());
        }
        "clear-recent" => {
            store_recent(app, &[]);
            rebuild_menu(app, &[]);
        }
        other if other.starts_with("recent::") => {
            let path = other.trim_start_matches("recent::").to_string();
            let _ = app.emit("file-opened", path);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}

// ---------------------------------------------------------------------------
// OS "Open with" plumbing
// ---------------------------------------------------------------------------

/// True if `arg` ends with a known markdown extension (case-insensitive).
#[cfg(desktop)]
fn has_markdown_extension(arg: &str) -> bool {
    let lower = arg.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".mdx")
}

/// Convert a `file://` URL (as delivered by macOS Open-with) to a filesystem path.
/// Falls back to treating the input as a plain path if URL parsing yields nothing.
#[cfg(desktop)]
fn url_to_path(url: &tauri::Url) -> Option<String> {
    url.to_file_path()
        .ok()
        .and_then(|p| p.into_os_string().into_string().ok())
}

/// Cache a path in the pending-file state and emit `file-opened` so an
/// already-running frontend can react immediately.
#[cfg(desktop)]
fn dispatch_opened_file<R: tauri::Runtime>(app: &tauri::AppHandle<R>, path: String) {
    let state = app.state::<PendingFile>();
    state
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .push(path.clone());
    let _ = app.emit("file-opened", path);
    // Bring the existing window forward so an "Open with" on a running app is visible.
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = LAUNCH_START.set(Instant::now());
    let mut builder = tauri::Builder::default();

    // single-instance must be the FIRST plugin registered. On a second launch
    // (e.g. Finder "Open with" while already running) this callback fires in the
    // original instance with the new process's argv; we forward any file path.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Match the first argv entry (skipping argv[0]) that looks like a
            // markdown file by extension; ignore flags and other arguments.
            if let Some(path) = argv.iter().skip(1).find(|a| has_markdown_extension(a)) {
                dispatch_opened_file(app, path.clone());
            }
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingFile::default())
        .manage(QuitGuard::default())
        .invoke_handler(tauri::generate_handler![
            read_md,
            save_md,
            take_pending_file,
            file_mtime,
            add_recent_file,
            get_recent_files,
            clear_recent_files,
            set_dirty,
            quit_app,
            report_ready
        ])
        .setup(|app| {
            // Install the menu once at startup, seeded with the saved recents.
            #[cfg(desktop)]
            {
                let handle = app.handle();
                let recents = load_recent(handle);
                let menu = build_app_menu(handle, &recents)?;
                app.set_menu(menu)?;
                app.on_menu_event(|app, event| {
                    handle_menu_event(app, event.id().as_ref());
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Red-button close hides the window instead of quitting; the app
            // stays alive in the Dock and is re-shown on Reopen. Real quit goes
            // through Cmd+Q / the menu (RunEvent::ExitRequested), not here.
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
            #[cfg(not(desktop))]
            let _ = (window, event);
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            #[cfg(desktop)]
            match _event {
                // macOS delivers Open-with file paths here, NOT via argv.
                tauri::RunEvent::Opened { urls } => {
                    for url in urls {
                        if let Some(path) = url_to_path(&url) {
                            dispatch_opened_file(_app_handle, path);
                        }
                    }
                }
                // Dock-icon click after the window was hidden: bring it back.
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Reopen { .. } => {
                    if let Some(window) = _app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                // Guard Cmd+Q / menu quit when there are unsaved changes. Only a
                // user-initiated quit (code None) that hasn't been force-confirmed
                // is blocked; we surface the window and ask the frontend to confirm.
                tauri::RunEvent::ExitRequested { api, code, .. } => {
                    let guard = _app_handle.state::<QuitGuard>();
                    if code.is_none()
                        && !guard.force.load(Ordering::Relaxed)
                        && guard.dirty.load(Ordering::Relaxed)
                    {
                        api.prevent_exit();
                        if let Some(window) = _app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        let _ = _app_handle.emit("confirm-quit", ());
                    }
                }
                _ => {}
            }
        });
}

#[cfg(test)]
mod tests {
    use super::{merge_recent, read_md, save_md, PendingFile, MAX_RECENT};
    use std::path::PathBuf;

    /// Unique temp path per test to avoid cross-test collisions.
    fn temp_path(name: &str) -> PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!("md_viewer_test_{}_{}.md", std::process::id(), name));
        p
    }

    #[test]
    fn read_md_happy_path() {
        let path = temp_path("read_happy");
        let expected = "# Hello\n\nSome *markdown*.\n";
        std::fs::write(&path, expected).unwrap();

        let got = read_md(path.to_string_lossy().into_owned()).unwrap();
        assert_eq!(got, expected);

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn read_md_missing_file_errors() {
        let path = temp_path("does_not_exist");
        std::fs::remove_file(&path).ok(); // ensure absent

        let result = read_md(path.to_string_lossy().into_owned());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read"));
    }

    #[test]
    fn read_md_non_utf8_errors_clearly() {
        let path = temp_path("non_utf8");
        std::fs::write(&path, [0xff, 0xfe, 0x00]).unwrap();

        let result = read_md(path.to_string_lossy().into_owned());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not valid UTF-8"));

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn save_then_read_roundtrip() {
        let path = temp_path("roundtrip");
        let content = "line 1\nline 2\nunicode: café 🚀\n";

        save_md(path.to_string_lossy().into_owned(), content.to_string()).unwrap();
        let got = read_md(path.to_string_lossy().into_owned()).unwrap();
        assert_eq!(got, content);

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn save_md_bad_path_errors() {
        // A path under a non-existent directory cannot be created by write().
        let bad = std::env::temp_dir().join("no_such_dir_xyz").join("file.md");
        let result = save_md(bad.to_string_lossy().into_owned(), "x".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to write"));
    }

    /// Pushing multiple paths then draining returns them all in order.
    /// Mirrors what `take_pending_file` does (std::mem::take on the inner Vec).
    #[test]
    fn pending_file_pushes_then_drains_in_order() {
        let pending = PendingFile::default();
        pending
            .0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .push("/a/first.md".to_string());
        pending
            .0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .push("/b/second.md".to_string());

        let taken =
            std::mem::take(&mut *pending.0.lock().unwrap_or_else(|e| e.into_inner()));
        assert_eq!(taken, vec!["/a/first.md", "/b/second.md"]);

        // After draining, the state is empty.
        let again =
            std::mem::take(&mut *pending.0.lock().unwrap_or_else(|e| e.into_inner()));
        assert!(again.is_empty());
    }

    #[test]
    fn merge_recent_moves_existing_to_front() {
        let list = vec!["/a.md".to_string(), "/b.md".to_string(), "/c.md".to_string()];
        let got = merge_recent(list, "/c.md");
        assert_eq!(got, vec!["/c.md", "/a.md", "/b.md"]);
    }

    #[test]
    fn merge_recent_dedupes_and_prepends_new() {
        let list = vec!["/a.md".to_string()];
        let got = merge_recent(list, "/new.md");
        assert_eq!(got, vec!["/new.md", "/a.md"]);
        // No duplicate when re-adding the same one.
        let got2 = merge_recent(got, "/new.md");
        assert_eq!(got2, vec!["/new.md", "/a.md"]);
    }

    #[test]
    fn merge_recent_caps_at_max() {
        let mut list = Vec::new();
        for i in 0..(MAX_RECENT + 5) {
            list = merge_recent(list, &format!("/file{i}.md"));
        }
        assert_eq!(list.len(), MAX_RECENT);
        // Most-recent first.
        assert_eq!(list[0], format!("/file{}.md", MAX_RECENT + 4));
    }
}
