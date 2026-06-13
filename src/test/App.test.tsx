import { render, screen } from "@testing-library/react";
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
});
