import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

test("Cmd/Ctrl+S calls onSave", async () => {
  const onSave = vi.fn();
  renderHook(() => useKeyboardShortcuts({ onSave }));
  await userEvent.keyboard("{Meta>}s{/Meta}");
  expect(onSave).toHaveBeenCalledTimes(1);
});
