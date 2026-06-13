import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EditorPane from "../components/EditorPane";

describe("EditorPane", () => {
  it("exposes an accessible 'Markdown editor' container", () => {
    render(<EditorPane value="hello" onChange={() => {}} />);
    expect(screen.getByLabelText("Markdown editor")).toBeInTheDocument();
  });

  it("renders the initial value into the document", () => {
    const { container } = render(
      <EditorPane value="hello" onChange={() => {}} />
    );
    // CodeMirror renders editor content into the DOM.
    expect(container.textContent).toContain("hello");
  });

  it("accepts an onChange handler prop without throwing", () => {
    // We don't simulate typing (unreliable in jsdom); just assert the wired
    // prop interface renders cleanly.
    const onChange = vi.fn();
    expect(() =>
      render(<EditorPane value="x" onChange={onChange} />)
    ).not.toThrow();
  });
});
