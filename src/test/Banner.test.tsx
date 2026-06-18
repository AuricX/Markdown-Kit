import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Banner from "../components/Banner";

test("renders message with alert role; dismiss fires onDismiss", async () => {
  const onDismiss = vi.fn();
  render(<Banner message="boom" onDismiss={onDismiss} />);
  expect(screen.getByRole("alert")).toHaveTextContent("boom");
  await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test("action button fires onAction (info variant)", async () => {
  const onAction = vi.fn();
  render(
    <Banner message="changed on disk" onDismiss={() => {}} actionLabel="Reload" onAction={onAction} variant="info" />
  );
  await userEvent.click(screen.getByRole("button", { name: /reload/i }));
  expect(onAction).toHaveBeenCalledTimes(1);
});

test("no action button when actionLabel omitted", () => {
  render(<Banner message="boom" onDismiss={() => {}} />);
  expect(screen.queryByRole("button", { name: /reload/i })).not.toBeInTheDocument();
});
