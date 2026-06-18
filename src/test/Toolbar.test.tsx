import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { TooltipProvider } from "../components/ui/tooltip";
import Toolbar from "../components/Toolbar";

function renderToolbar(props: Record<string, unknown> = {}) {
  const handlers = {
    onNew: vi.fn(), onOpen: vi.fn(), onSave: vi.fn(), onPrint: vi.fn(),
    onViewChange: vi.fn(), onOpenSettings: vi.fn(),
  };
  render(
    <TooltipProvider>
      <Toolbar fileName="doc.md" dirty={false} viewMode="preview" {...handlers} {...props} />
    </TooltipProvider>
  );
  return handlers;
}

test("shows the dirty marker when dirty", () => {
  renderToolbar({ dirty: true });
  expect(screen.getByLabelText(/unsaved changes/i)).toBeInTheDocument();
});

test("hides the dirty marker when clean", () => {
  renderToolbar({ dirty: false });
  expect(screen.queryByLabelText(/unsaved changes/i)).not.toBeInTheDocument();
});

test("file action buttons fire their handlers", async () => {
  const h = renderToolbar();
  await userEvent.click(screen.getByRole("button", { name: /^new$/i }));
  await userEvent.click(screen.getByRole("button", { name: /^open$/i }));
  await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
  await userEvent.click(screen.getByRole("button", { name: /print/i }));
  await userEvent.click(screen.getByRole("button", { name: /settings/i }));
  expect(h.onNew).toHaveBeenCalled();
  expect(h.onOpen).toHaveBeenCalled();
  expect(h.onSave).toHaveBeenCalled();
  expect(h.onPrint).toHaveBeenCalled();
  expect(h.onOpenSettings).toHaveBeenCalled();
});

test("view switch fires onViewChange", async () => {
  const h = renderToolbar();
  await userEvent.click(screen.getByRole("button", { name: /editor only/i }));
  expect(h.onViewChange).toHaveBeenCalledWith("editor");
});
