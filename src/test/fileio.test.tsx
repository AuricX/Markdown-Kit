import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "../App";
import { ThemeProvider } from "../theme";
import { TooltipProvider } from "../components/ui/tooltip";

const listeners: Record<string, (e: { payload: unknown }) => void> = {};
vi.mock("@tauri-apps/api/event", () => ({
  listen: (name: string, cb: (e: { payload: unknown }) => void) => {
    listeners[name] = cb;
    return Promise.resolve(() => {});
  },
}));
const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ onDragDropEvent: () => Promise.resolve(() => {}) }) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ setTitle: () => {} }) }));
const saveDialog = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: (...a: unknown[]) => saveDialog(...a) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../updater", () => ({ checkForUpdates: vi.fn() }));

function renderApp() {
  return render(<ThemeProvider><TooltipProvider><App /></TooltipProvider></ThemeProvider>);
}
beforeEach(() => {
  localStorage.clear();
  invoke.mockReset();
  for (const k of Object.keys(listeners)) delete listeners[k];
});

test("file-opened loads content into the preview", async () => {
  invoke.mockImplementation((cmd: string) => {
    if (cmd === "read_md") return Promise.resolve("# Hello\n\nworld");
    if (cmd === "take_pending_file") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
  renderApp();
  await waitFor(() => expect(listeners["file-opened"]).toBeTypeOf("function"));
  listeners["file-opened"]({ payload: "/tmp/x.md" });
  const preview = await screen.findByLabelText(/markdown preview/i);
  expect(await within(preview).findByText("Hello")).toBeInTheDocument();
});

test("Cmd+S on Untitled triggers Save-As; cancel writes nothing", async () => {
  saveDialog.mockResolvedValue(null);
  invoke.mockResolvedValue(undefined);
  renderApp();
  await userEvent.keyboard("{Meta>}s{/Meta}");
  await waitFor(() => expect(saveDialog).toHaveBeenCalled());
  expect(invoke).not.toHaveBeenCalledWith("save_md", expect.anything());
});

test("read failure shows the error banner", async () => {
  invoke.mockImplementation((cmd: string) => {
    if (cmd === "read_md") return Promise.reject("ENOENT");
    if (cmd === "take_pending_file") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
  renderApp();
  await waitFor(() => expect(listeners["file-opened"]).toBeTypeOf("function"));
  listeners["file-opened"]({ payload: "/tmp/missing.md" });
  expect(await screen.findByRole("alert")).toHaveTextContent(/failed to open/i);
});

test("menu-save on Untitled triggers Save-As (menu wiring)", async () => {
  saveDialog.mockResolvedValue(null);
  invoke.mockResolvedValue(undefined);
  renderApp();
  await waitFor(() => expect(listeners["menu-save"]).toBeTypeOf("function"));
  listeners["menu-save"]();
  await waitFor(() => expect(saveDialog).toHaveBeenCalled());
});

test("menu-view switches the view (menu wiring)", async () => {
  invoke.mockImplementation((c: string) =>
    c === "take_pending_file" ? Promise.resolve([]) : Promise.resolve(undefined));
  renderApp();
  await waitFor(() => expect(listeners["menu-view"]).toBeTypeOf("function"));
  listeners["menu-view"]({ payload: "editor" });
  expect(await screen.findByLabelText(/markdown editor/i)).toBeInTheDocument();
});
