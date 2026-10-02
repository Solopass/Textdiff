/**
 * End-to-end interaction tests driven through the real UI.
 *
 * Monaco is replaced with a plain textarea (see src/test/monacoMock.tsx) and
 * Worker is replaced with a synchronous stand-in that runs the real diff
 * engine (see src/setupTests.ts). Everything else — state, handlers, rendering
 * — is the actual application.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));

import App from "./App";

/**
 * The app renders two editor layouts — one for wide screens, one stacked for
 * narrow — and hides one with CSS. jsdom has no layout, so both are present.
 * They share the same state, so driving the first pair is sufficient.
 */
const editors = () => screen.getAllByTestId("monaco-editor");
const editorA = () => editors()[0];
const editorB = () => editors()[1];

/** Enters the studio from the landing page. */
const openStudio = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<App />);
  await user.click(screen.getByText(/Open Studio/i));
};

const typeInto = async (
  user: ReturnType<typeof userEvent.setup>,
  el: HTMLElement,
  text: string,
) => {
  await user.clear(el);
  await user.type(el, text);
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("landing page", () => {
  it("shows the studio only after entering", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByText("RUN_DIFF")).not.toBeInTheDocument();
    await user.click(screen.getByText(/Open Studio/i));
    expect(screen.getByText("RUN_DIFF")).toBeInTheDocument();
  });
});

describe("running a comparison", () => {
  it("produces stats reflecting the actual change", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await typeInto(user, editorA(), "one\ntwo\nthree");
    await typeInto(user, editorB(), "one\nCHANGED\nthree");
    await user.click(screen.getByText("RUN_DIFF"));

    // Similarity is unchanged / max(linesA, linesB) = 2 / 3 = 67%, computed by
    // the shared computeDiffStats so the UI and the worker cannot disagree.
    await waitFor(() => {
      expect(screen.getByText("67%")).toBeInTheDocument();
    });
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("reports identical input as fully similar", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await typeInto(user, editorA(), "same\ncontent");
    await typeInto(user, editorB(), "same\ncontent");
    await user.click(screen.getByText("RUN_DIFF"));

    await waitFor(() => {
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  it("shows the results panel with a change breakdown", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await typeInto(user, editorA(), "keep\nREMOVED");
    await typeInto(user, editorB(), "keep\nINSERTED");
    await user.click(screen.getByText("RUN_DIFF"));

    // The row contents themselves can't be asserted here: the diff output is
    // rendered through react-virtuoso, which measures element heights to decide
    // what to mount. jsdom reports every height as 0, so no rows are produced.
    // The summary panel is real DOM and is what gets checked instead.
    await waitFor(() => {
      const report = document.getElementById("diff-report-container");
      expect(report).not.toBeNull();
      expect(report!.textContent).toContain("Similarity");
      expect(report!.textContent).toContain("Total Changes");
    });
  });

  // The ignore-whitespace flag reaches the engine through the worker message,
  // so this covers the wiring rather than the algorithm (unit-tested already).
  it("passes the ignore-whitespace flag through to the engine", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await typeInto(user, editorA(), "hello    world");
    await typeInto(user, editorB(), "hello world");

    await user.click(screen.getByText("IGNORE_WS"));
    await user.click(screen.getByText("RUN_DIFF"));

    await waitFor(() => {
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });
});

describe("editor actions", () => {
  it("swaps the two sides", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await typeInto(user, editorA(), "AAA");
    await typeInto(user, editorB(), "BBB");

    await user.click(screen.getByText("SWAP"));

    await waitFor(() => {
      expect(editorA()).toHaveValue("BBB");
      expect(editorB()).toHaveValue("AAA");
    });
  });

  it("clears both sides once confirmed", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openStudio(user);

    await typeInto(user, editorA(), "some text");
    await user.click(screen.getByText("CLEAR"));

    await waitFor(() => expect(editorA()).toHaveValue(""));
  });

  it("keeps the text when the clear prompt is dismissed", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await openStudio(user);

    await typeInto(user, editorA(), "precious");
    await user.click(screen.getByText("CLEAR"));

    expect(editorA()).toHaveValue("precious");
  });

  it("fills both editors from the sample loader", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.click(screen.getByText("LOAD_SAMPLE"));

    await waitFor(() => {
      expect((editorA() as HTMLTextAreaElement).value.length).toBeGreaterThan(0);
      expect((editorB() as HTMLTextAreaElement).value.length).toBeGreaterThan(0);
    });
  });
});

describe("view modes", () => {
  it("switches between split and unified", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await typeInto(user, editorA(), "a");
    await typeInto(user, editorB(), "b");
    await user.click(screen.getByText("RUN_DIFF"));

    await waitFor(() => expect(screen.getByText(/SPLIT_VIEW/)).toBeInTheDocument());

    await user.click(screen.getByText("UNIFIED"));
    await waitFor(() => expect(screen.getByText(/UNIFIED_VIEW/)).toBeInTheDocument());
  });
});

describe("cloud sync", () => {
  it("opens and closes the Gist cloud sync modal", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    expect(screen.queryByRole("dialog", { name: /cloud sync/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /gist/i }));

    const dialog = screen.getByRole("dialog", { name: /cloud sync/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/GITHUB GISTS/i)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /cloud sync/i })).not.toBeInTheDocument();
  });
});
