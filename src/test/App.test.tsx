import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import App from "../App";

describe("App shell", () => {
  beforeEach(() => {
    document.title = "";
  });

  it("renders both the editor and preview panes", () => {
    render(<App />);
    expect(screen.getByLabelText("Markdown editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown preview")).toBeInTheDocument();
  });

  it("starts with an Untitled, non-dirty title", () => {
    render(<App />);
    expect(document.title).toBe("Untitled");
  });

  it("updates content and marks the title dirty when typing", () => {
    render(<App />);

    const editor = screen.getByLabelText("Markdown editor");
    fireEvent.change(editor, { target: { value: "# Hello" } });

    // Placeholder editor and preview share the lifted content state.
    expect(editor).toHaveValue("# Hello");
    expect(screen.getByLabelText("Markdown preview")).toHaveTextContent(
      "# Hello"
    );
    expect(document.title).toBe("Untitled ●");
  });
});
