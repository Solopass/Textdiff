/**
 * Regression tests for localStorage persistence.
 *
 * The save and load key lists drifted apart once: six customization settings
 * were read at startup but never written, so they silently reset on every
 * reload. Nothing failed — the app just quietly forgot. These tests pin the
 * contract so that can't happen again unnoticed.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));

import App from "./App";

const openStudio = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<App />);
  await user.click(screen.getByText(/Open Studio/i));
};

const readConfig = () => JSON.parse(localStorage.getItem("tds_config") || "{}");

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("settings persistence", () => {
  /**
   * Every key the loader reads must also be written. This is the exact failure
   * that shipped: the six listed after `uiTint` were read and never saved.
   */
  it("persists every setting the loader reads back", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    // Change something so the debounced save effect fires.
    await user.click(screen.getByText("IGNORE_WS"));

    await waitFor(
      () => {
        expect(localStorage.getItem("tds_config")).not.toBeNull();
      },
      { timeout: 3000 },
    );

    const saved = Object.keys(readConfig());
    const mustPersist = [
      "viewMode",
      "ignoreWs",
      "ignoreCase",
      "trimBlankLines",
      "showLineNums",
      "foldUnchanged",
      "foldContext",
      "wordWrap",
      "syntaxTheme",
      "language",
      "appLayout",
      "uiFont",
      "uiRadius",
      "uiTint",
      // These six were the ones that silently reset.
      "uiFontSize",
      "uiTexture",
      "uiMotion",
      "customCSS",
      "uiSound",
      "uiGlass",
    ];

    const missing = mustPersist.filter((k) => !saved.includes(k));
    expect(missing, `not written to tds_config: ${missing.join(", ")}`).toEqual([]);
  });

  it("writes a toggled filter to storage", async () => {
    const user = userEvent.setup();
    await openStudio(user);

    await user.click(screen.getByText("IGNORE_CASE"));

    await waitFor(
      () => expect(readConfig().ignoreCase).toBe(true),
      { timeout: 3000 },
    );
  });

  it("restores saved settings on the next mount", async () => {
    localStorage.setItem(
      "tds_config",
      JSON.stringify({ ignoreWs: true, viewMode: "unified", wordWrap: true }),
    );

    const user = userEvent.setup();
    await openStudio(user);

    // The unified toggle should come back active.
    await waitFor(() => {
      const unified = screen.getByText("UNIFIED").closest("button");
      expect(unified?.className).toContain("bg-[#334155]");
    });
  });

  it("restores editor contents on the next mount", async () => {
    localStorage.setItem("tds_origText", "restored A");
    localStorage.setItem("tds_modText", "restored B");

    const user = userEvent.setup();
    await openStudio(user);

    await waitFor(() => {
      const eds = screen.getAllByTestId("monaco-editor") as HTMLTextAreaElement[];
      expect(eds[0].value).toBe("restored A");
      expect(eds[1].value).toBe("restored B");
    });
  });

  /**
   * The quota is ~5MB and two large pasted files exceed it. An unguarded
   * setItem throws inside a render effect, which previously broke the app on
   * every subsequent keystroke. Writes go through safeSetItem, so a throwing
   * quota must be survivable.
   */
  it("keeps working when localStorage throws a quota error", async () => {
    const user = userEvent.setup();
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key.startsWith("tds_")) {
        const err: any = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }
      return setItem.call(this, key, value);
    });

    await openStudio(user);

    const eds = screen.getAllByTestId("monaco-editor") as HTMLTextAreaElement[];
    await user.type(eds[0], "still typing");

    // The app must remain interactive rather than blowing up mid-render.
    await waitFor(() => expect(eds[0].value).toBe("still typing"));
    expect(screen.getByText("RUN_DIFF")).toBeInTheDocument();
  });

  it("tolerates corrupt stored config without crashing", async () => {
    localStorage.setItem("tds_config", "{not valid json");
    localStorage.setItem("tds_history", "also broken");

    const user = userEvent.setup();
    await openStudio(user);

    expect(screen.getByText("RUN_DIFF")).toBeInTheDocument();
  });
});
