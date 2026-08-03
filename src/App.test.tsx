import { render, screen } from "@testing-library/react";
import App from "./App";
import { describe, it, expect } from "vitest";

describe("App", () => {
  it("renders the TextDiff title", () => {
    render(<App />);
    expect(screen.getByText(/TextDiff/i)).toBeInTheDocument();
  });

  // Previously this lived outside the describe block, so it ran as a
  // top-level test detached from the suite it belongs to.
  it("renders the Open Studio button", () => {
    render(<App />);
    expect(screen.getByText(/Open Studio/i)).toBeInTheDocument();
  });
});
