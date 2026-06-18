import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

test("Cmd/Ctrl+S calls onSave; Escape calls onEscape", async () => {
  const onSave = vi.fn();
  const onEscape = vi.fn();
  renderHook(() => useKeyboardShortcuts({ onSave, onEscape }));
  await userEvent.keyboard("{Meta>}s{/Meta}");
  expect(onSave).toHaveBeenCalledTimes(1);
  await userEvent.keyboard("{Escape}");
  expect(onEscape).toHaveBeenCalledTimes(1);
});
