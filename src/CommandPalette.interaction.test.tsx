/**
 * Command palette and overlay behaviour, driven through the real app.
 *
 * These cover the wiring that unit tests can't reach: the Ctrl+K binding, the
 * palette running a command that changes app state, and Escape closing the
 * right overlay when several could be open.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));

import App from "./App";

const openStudio = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<App />);
  await user.click(screen.getByText(/Open Studio/i));
};

const palette = () => screen.queryByRole("dialog", { name: /command palette/i });

beforeEach(() => {
  localStorage.clear();
});

describe("command palette", () => {
  it("opens with Ctrl+K and closes with Escape", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    expect(palette()).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(palette()).toBeInTheDocument());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(palette()).not.toBeInTheDocument());
  });

  /**
   * Regression: Escape must work even before focus has moved into the palette.
   *
   * Focus is set in a requestAnimationFrame, so there is a window where focus
   * is still on whatever opened the palette. Escape used to be handled only on
   * the palette's own subtree, and the app ignores Escape while the palette is
   * open — so a press in that gap dismissed nothing at all. Not awaiting the
   * focus here is the point of the test.
   */
  it("closes on Escape pressed before focus lands in the input", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.keyboard("{Control>}k{/Control}");
    expect(palette()).toBeInTheDocument();
    // Deliberately no waitFor on focus.
    await user.keyboard("{Escape}");

    await waitFor(() => expect(palette()).not.toBeInTheDocument());
  });

  it("also opens from the toolbar button", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.click(screen.getByTitle(/Command Palette/i));
    await waitFor(() => expect(palette()).toBeInTheDocument());
  });

  it("filters the list as you type", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByLabelText(/search commands/i);

    const before = screen.getAllByRole("option").length;
    await user.type(input, "export");
    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeLessThan(before);
    });
    expect(screen.getByText("Export as PDF")).toBeInTheDocument();
  });

  it("matches non-contiguous input", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.keyboard("{Control>}k{/Control}");
    // "expdf" -> EX-port as P-D-F
    await user.type(await screen.findByLabelText(/search commands/i), "expdf");

    await waitFor(() => {
      expect(screen.getByText("Export as PDF")).toBeInTheDocument();
    });
  });

  it("shows a message when nothing matches", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByLabelText(/search commands/i), "zzzzzz");

    await waitFor(() => {
      expect(screen.getByText(/No commands match/i)).toBeInTheDocument();
    });
  });

  it("runs the highlighted command on Enter and closes", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByLabelText(/search commands/i), "unified");
    await user.keyboard("{Enter}");

    // The palette closes and the view mode actually changes.
    await waitFor(() => expect(palette()).not.toBeInTheDocument());
    await waitFor(() => {
      const unifiedBtn = screen.getByText("UNIFIED").closest("button");
      expect(unifiedBtn?.className).toContain("bg-[#334155]");
    });
  });

  it("runs a command on click", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByLabelText(/search commands/i), "shortcuts");
    await user.click(screen.getByText("Show keyboard shortcuts"));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
      ).toBeInTheDocument();
    });
  });

  it("resets the query between openings", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByLabelText(/search commands/i);
    await user.type(input, "export");
    await user.keyboard("{Escape}");

    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => {
      expect(screen.getByLabelText(/search commands/i)).toHaveValue("");
    });
  });

  it("disables commands that need a diff before one exists", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByLabelText(/search commands/i), "next change");

    await waitFor(() => {
      const option = screen.getByText("Jump to next change").closest('[role="option"]');
      expect(option).toHaveAttribute("aria-disabled", "true");
    });
  });
});

describe("overlays", () => {
  it("closes the shortcuts dialog with Escape", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.click(screen.getByTitle(/Keyboard Shortcuts/i));
    const dialog = await screen.findByRole("dialog", { name: /keyboard shortcuts/i });
    expect(dialog).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /keyboard shortcuts/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("closes the history dialog with Escape", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.click(screen.getByTitle(/Diff History/i));
    await screen.findByRole("dialog", { name: /diff history/i });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /diff history/i }),
      ).not.toBeInTheDocument();
    });
  });

  // Escape is handled by the palette first and must not fall through to the
  // dialog behind it — otherwise one keypress closes two things.
  it("Escape closes only the palette when it is stacked over a dialog", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.click(screen.getByTitle(/Keyboard Shortcuts/i));
    await screen.findByRole("dialog", { name: /keyboard shortcuts/i });

    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(palette()).toBeInTheDocument());

    await user.keyboard("{Escape}");

    await waitFor(() => expect(palette()).not.toBeInTheDocument());
    expect(
      screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
  });
});
