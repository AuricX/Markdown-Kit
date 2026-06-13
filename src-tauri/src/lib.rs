use std::sync::Mutex;

#[cfg(desktop)]
use tauri::Emitter;
use tauri::Manager;

/// Shared state holding file paths delivered by the OS
/// (via `RunEvent::Opened` on macOS, or single-instance argv on relaunch)
/// before the frontend was ready to consume them. Drained once taken.
#[derive(Default)]
struct PendingFile(Mutex<Vec<String>>);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Read a UTF-8 file's contents. IO/encoding errors are mapped to a String
/// so they cross the IPC boundary cleanly.
#[tauri::command]
fn read_md(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
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
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        .invoke_handler(tauri::generate_handler![
            greet,
            read_md,
            save_md,
            take_pending_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            // macOS delivers Open-with file paths here, NOT via argv.
            #[cfg(desktop)]
            if let tauri::RunEvent::Opened { urls } = _event {
                for url in urls {
                    if let Some(path) = url_to_path(&url) {
                        dispatch_opened_file(_app_handle, path);
                    }
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::{read_md, save_md, PendingFile};
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
}
