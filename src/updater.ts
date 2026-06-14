import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";

// Check GitHub Releases for a newer signed build. If one exists, prompt the user;
// on confirm, download + install the new bundle and relaunch into it.
//
// Entirely best-effort: any failure (offline, no update endpoint reachable, or
// running outside the Tauri shell in the browser/jsdom) is swallowed so it never
// disrupts normal app usage.
export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (!update) return; // already on the latest version

    const notes = update.body ? `\n\n${update.body}` : "";
    const accepted = await ask(
      `Markdown Kit ${update.version} is available.${notes}\n\nDownload and install now?`,
      {
        title: "Update available",
        kind: "info",
        okLabel: "Install",
        cancelLabel: "Later",
      }
    );
    if (!accepted) return;

    // Downloads the bundle, verifies its signature against the configured pubkey,
    // and installs it. relaunch() then restarts into the updated app.
    await update.downloadAndInstall();
    await relaunch();
  } catch {
    // Not inside Tauri, offline, or no update available — ignore.
  }
}
