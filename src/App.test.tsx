import { render, screen } from "@testing-library/react";
import App from "./App";
import { describe, it, expect } from "vitest";

describe("App", () => {
  it("renders TextDiff title", () => {
    render(<App />);
    expect(screen.getByText(/TextDiff/i)).toBeInTheDocument();
  });
});

it("renders Open Studio button and enters main app", () => {
  render(<App />);
  const openBtn = screen.getByText(/Open Studio/i);
  expect(openBtn).toBeInTheDocument();
});
