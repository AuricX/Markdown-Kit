import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Tauri mocks (no real backend) ---
const invoke = vi.fn();
const listen = vi.fn();
const onDragDropEvent = vi.fn();
const saveDialog = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listen(...args),
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent }),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: (...args: unknown[]) => saveDialog(...args),
}));

import App from "../App";

// Capture the callback App registers for the 'file-opened' event so tests can
// fire it directly.
function getFileOpenedCallback(): (e: { payload: string }) => void {
  const call = listen.mock.calls.find((c) => c[0] === "file-opened");
  if (!call) throw new Error("listen('file-opened', ...) was never called");
  return call[1] as (e: { payload: string }) => void;
}

beforeEach(() => {
  invoke.mockReset();
  listen.mockReset();
  onDragDropEvent.mockReset();
  saveDialog.mockReset();
  // Sensible defaults; individual tests override as needed.
  invoke.mockResolvedValue(undefined);
  listen.mockResolvedValue(() => {});
  onDragDropEvent.mockResolvedValue(() => {});
  // take_pending_file is called on mount; default to "nothing pending".
  invoke.mockImplementation((cmd: string) => {
    if (cmd === "take_pending_file") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
});

describe("file I/O wiring", () => {
  it("opens a file via the 'file-opened' event and shows its content in the preview", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "take_pending_file") return Promise.resolve([]);
      if (cmd === "read_md") return Promise.resolve("# Loaded Heading");
      return Promise.resolve(undefined);
    });

    render(<App />);
    await waitFor(() => expect(listen).toHaveBeenCalledWith("file-opened", expect.any(Function)));

    const cb = getFileOpenedCallback();
    cb({ payload: "/tmp/note.md" });

    // Preview renders the loaded markdown as a heading. Scope to the preview
    // pane: the editor source also contains this text.
    const preview = screen.getByLabelText("Markdown preview");
    const heading = await within(preview).findByText("Loaded Heading");
    expect(heading.tagName).toBe("H1");
    expect(invoke).toHaveBeenCalledWith("read_md", { path: "/tmp/note.md" });
  });

  it("saves to the known path on Cmd+S after a file is loaded", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "take_pending_file") return Promise.resolve([]);
      if (cmd === "read_md") return Promise.resolve("hello body");
      return Promise.resolve(undefined);
    });

    render(<App />);
    await waitFor(() => expect(listen).toHaveBeenCalledWith("file-opened", expect.any(Function)));
    getFileOpenedCallback()({ payload: "/tmp/known.md" });
    await screen.findByText("hello body");

    invoke.mockClear();
    fireEvent.keyDown(window, { key: "s", metaKey: true });

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("save_md", {
        path: "/tmp/known.md",
        content: "hello body",
      }),
    );
    // No Save-As dialog when a path is already known.
    expect(saveDialog).not.toHaveBeenCalled();
  });

  it("falls back to Save-As when no path is set", async () => {
    saveDialog.mockResolvedValue("/tmp/picked.md");

    render(<App />);
    // Let mount-time async effects settle.
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("take_pending_file"));
    invoke.mockClear();

    fireEvent.keyDown(window, { key: "s", metaKey: true });

    await waitFor(() => expect(saveDialog).toHaveBeenCalled());
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("save_md", {
        path: "/tmp/picked.md",
        content: "",
      }),
    );
  });

  it("shows an error banner when read_md fails", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "take_pending_file") return Promise.resolve([]);
      if (cmd === "read_md") return Promise.reject("ENOENT: no such file");
      return Promise.resolve(undefined);
    });

    render(<App />);
    await waitFor(() => expect(listen).toHaveBeenCalledWith("file-opened", expect.any(Function)));
    getFileOpenedCallback()({ payload: "/tmp/missing.md" });

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Failed to open file");
    expect(banner).toHaveTextContent("ENOENT");
  });
});
