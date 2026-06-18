import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "../App";
import { ThemeProvider } from "../theme";
import { TooltipProvider } from "../components/ui/tooltip";

vi.mock("@tauri-apps/api/event", () => ({
  listen: (_name: string, _cb: unknown) => Promise.resolve(() => {}),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ onDragDropEvent: () => Promise.resolve(() => {}) }) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ setTitle: () => {} }) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn().mockResolvedValue(null) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../updater", () => ({ checkForUpdates: vi.fn() }));

function renderApp() {
  return render(<ThemeProvider><TooltipProvider><App /></TooltipProvider></ThemeProvider>);
}
beforeEach(() => localStorage.clear());

test("renders toolbar + preview pane, Untitled + non-dirty at start", () => {
  renderApp();
  expect(screen.getByRole("toolbar", { name: /main toolbar/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/markdown preview/i)).toBeInTheDocument();
  expect(screen.getByText("Untitled")).toBeInTheDocument();
  expect(screen.queryByLabelText(/unsaved changes/i)).not.toBeInTheDocument();
});

test("defaults to preview view; can switch to split (editor appears)", async () => {
  renderApp();
  expect(screen.queryByLabelText(/markdown editor/i)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /split view/i }));
  expect(screen.getByLabelText(/markdown editor/i)).toBeInTheDocument();
});

test("opens the settings dialog", async () => {
  renderApp();
  await userEvent.click(screen.getByRole("button", { name: /settings/i }));
  expect(await screen.findByRole("dialog", { name: /settings/i })).toBeInTheDocument();
});
