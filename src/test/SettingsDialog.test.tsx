import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import SettingsDialog from "../components/SettingsDialog";
import { ThemeProvider } from "../theme";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <ThemeProvider>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </ThemeProvider>
  );
}
beforeEach(() => localStorage.clear());

test("renders as a dialog and Escape closes it", async () => {
  render(<Harness />);
  expect(await screen.findByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("exposes the preview-theme control", async () => {
  render(<Harness />);
  expect(await screen.findByLabelText(/preview theme/i)).toBeInTheDocument();
});
