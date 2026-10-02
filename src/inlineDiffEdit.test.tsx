import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));

import App from "./App";

const openStudio = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<App />);
  await user.click(screen.getByText(/Open Studio/i));
};

const editors = () => screen.getAllByTestId("monaco-editor");

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("inline diff editing", () => {
  it("opens an inline input on double-clicking a diff line and saves edits", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    const [edA, edB] = editors();
    await user.clear(edA);
    await user.type(edA, "line alpha\nline beta");
    await user.clear(edB);
    await user.type(edB, "line alpha\nline modified");
    await user.click(screen.getByText("RUN_DIFF"));

    // Wait for diff report
    await waitFor(() => {
      expect(document.getElementById("diff-report-container")).not.toBeNull();
    });

    // Find the diff cell containing "line modified"
    const cells = screen.getAllByTitle("Double-click to edit line");
    const modCell = cells.find((c) => c.textContent?.includes("line modified"));
    expect(modCell).toBeDefined();

    // Double-click to start inline editing
    await user.dblClick(modCell!);

    // An input field should appear with the text "line modified"
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("line modified");

    // Set new replacement content and save via the Save button
    fireEvent.change(input, { target: { value: "line edited" } });
    await user.click(screen.getByTitle("Save (Enter)"));

    // The diff should recompute and show the newly edited text
    await waitFor(() => {
      const updatedCells = screen.getAllByTitle("Double-click to edit line");
      const hasEdited = updatedCells.some((c) => c.textContent?.includes("line edited"));
      expect(hasEdited).toBe(true);
    });
  });

  it("cancels inline editing on Escape without changing text", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    const [edA, edB] = editors();
    await user.clear(edA);
    await user.type(edA, "item original");
    await user.clear(edB);
    await user.type(edB, "item modified");
    await user.click(screen.getByText("RUN_DIFF"));

    await waitFor(() => {
      expect(document.getElementById("diff-report-container")).not.toBeNull();
    });

    const cells = screen.getAllByTitle("Double-click to edit line");
    const targetCell = cells.find((c) => c.textContent?.includes("item modified"));
    expect(targetCell).toBeDefined();

    await user.dblClick(targetCell!);

    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("item modified");

    await user.type(input, " some junk{Escape}");

    // Input disappears and original text remains
    expect(document.querySelector("input[type='text']")).toBeNull();
    const finalCells = screen.getAllByTitle("Double-click to edit line");
    const hasOriginal = finalCells.some((c) => c.textContent?.includes("item modified"));
    expect(hasOriginal).toBe(true);
  });

  it("preserves CRLF line endings when editing inline", async () => {
    localStorage.setItem("tds_origText", "first\r\nsecond\r\nthird");
    localStorage.setItem("tds_modText", "first\r\nsecond_mod\r\nthird");

    const user = userEvent.setup();
    await openStudio(user);

    await user.click(screen.getByText("RUN_DIFF"));

    await waitFor(() => {
      expect(document.getElementById("diff-report-container")).not.toBeNull();
    });

    const cells = screen.getAllByTitle("Double-click to edit line");
    const targetCell = cells.find((c) => c.textContent?.includes("second_mod"));
    expect(targetCell).toBeDefined();

    await user.dblClick(targetCell!);
    const input = document.querySelector("input[type='text']") as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, { target: { value: "second_crlf_saved" } });
    await user.click(screen.getByTitle("Save (Enter)"));

    await waitFor(() => {
      const saved = localStorage.getItem("tds_modText");
      expect(saved).toContain("\r\n");
      expect(saved).toBe("first\r\nsecond_crlf_saved\r\nthird");
    });
  });
});

