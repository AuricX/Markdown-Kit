import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PreviewPane from "../components/PreviewPane";

const SAMPLE = [
  "# Title",
  "",
  "- [x] done",
  "",
  "| a | b |",
  "|---|---|",
  "| 1 | 2 |",
  "",
  "Some ~~struck~~ text with `code`.",
  "",
  "```js",
  "const x = 1;",
  "```",
].join("\n");

describe("PreviewPane", () => {
  it("renders a heading from markdown", () => {
    render(<PreviewPane value={SAMPLE} />);
    expect(
      screen.getByRole("heading", { name: "Title" })
    ).toBeInTheDocument();
  });

  it("renders GFM task list items as checkboxes", () => {
    render(<PreviewPane value={SAMPLE} />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);
  });

  it("renders a GFM table with cells", () => {
    render(<PreviewPane value={SAMPLE} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("1")).toBeInTheDocument();
    expect(within(table).getByText("2")).toBeInTheDocument();
    // Header cells prove the table structure parsed.
    expect(within(table).getByRole("columnheader", { name: "a" })).toBeInTheDocument();
  });

  it("renders inline code", () => {
    const { container } = render(<PreviewPane value={SAMPLE} />);
    const codeEls = container.querySelectorAll("code");
    expect(codeEls.length).toBeGreaterThan(0);
  });

  it("escapes raw HTML (no rehype-raw) to block script injection", () => {
    const { container } = render(
      <PreviewPane value={'<script>alert(1)</script>'} />
    );
    // The <script> should be rendered as escaped text, not a live element.
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
