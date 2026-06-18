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

const renderApp = () =>
  render(<ThemeProvider><TooltipProvider><App /></TooltipProvider></ThemeProvider>);
beforeEach(() => localStorage.clear());

test("editor-only hides preview; preview-only hides editor", async () => {
  renderApp();
  await userEvent.click(screen.getByRole("button", { name: /editor only/i }));
  expect(screen.getByLabelText(/markdown editor/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/markdown preview/i)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /preview only/i }));
  expect(screen.getByLabelText(/markdown preview/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/markdown editor/i)).not.toBeInTheDocument();
});
