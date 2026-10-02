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

describe("in-diff search", () => {
  it("toggles search bar, matches occurrences, highlights marks, and clears", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    const [edA, edB] = editors();
    await user.clear(edA);
    await user.type(edA, "apple banana cherry");
    await user.clear(edB);
    await user.type(edB, "apple blueberry cherry");
    await user.click(screen.getByText("RUN_DIFF"));

    await waitFor(() => {
      expect(document.getElementById("diff-report-container")).not.toBeNull();
    });

    // Diff search button is present
    const searchBtn = screen.getByLabelText("Search in Diff");
    await user.click(searchBtn);

    // Search input should now be visible
    const searchInput = screen.getByPlaceholderText("Find in diff...") as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    // Type query "cherry"
    fireEvent.change(searchInput, { target: { value: "cherry" } });

    // Should indicate match count
    await waitFor(() => {
      expect(screen.getByText(/match/i)).toBeInTheDocument();
    });

    // Should render a <mark> element with the search match
    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent).toBe("cherry");

    // Clear search
    const clearBtn = screen.getByTitle("Clear search");
    await user.click(clearBtn);
    expect(searchInput.value).toBe("");

    // Close search with Esc button
    const closeBtn = screen.getByText("Esc");
    await user.click(closeBtn);
    expect(screen.queryByPlaceholderText("Find in diff...")).toBeNull();
  });
});
