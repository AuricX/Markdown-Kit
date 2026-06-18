import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import PreviewPane from "../components/PreviewPane";
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

test("renders heading + GFM table + inline code", () => {
  render(<PreviewPane value={"# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n`x`"} resolvedTheme="light" />);
  expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByText("x")).toBeInTheDocument();
});

test("escapes raw HTML (no rehype-raw)", () => {
  const { container } = render(<PreviewPane value={"<script>alert(1)</script>"} resolvedTheme="light" />);
  expect(container.querySelector("script")).toBeNull();
  // react-markdown without rehype-raw renders the raw markup as visible escaped
  // text (not dropped), so the literal characters must appear in the output.
  expect(container).toHaveTextContent("<script>alert(1)</script>");
});

test("dark resolvedTheme applies prose-invert + data-preview-theme", () => {
  const { container } = render(<PreviewPane value="x" resolvedTheme="dark" />);
  expect(container.querySelector('[data-preview-theme="dark"]')).not.toBeNull();
  expect(container.querySelector(".prose-invert")).not.toBeNull();
});
