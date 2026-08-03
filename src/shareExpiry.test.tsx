/**
 * Share-link expiry, exercised through the real load path.
 *
 * Firestore is mocked at the module boundary so these run offline. What's
 * under test is the app's handling of the returned document — specifically
 * that an expired one is refused rather than rendered.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));

/** Controls what the mocked getDoc returns for the next render. */
let mockDoc: { exists: boolean; data?: Record<string, unknown> } = { exists: false };

vi.mock("firebase/firestore", () => ({
  getDoc: async () => ({
    exists: () => mockDoc.exists,
    data: () => mockDoc.data,
  }),
  doc: () => ({}),
  collection: () => ({}),
  addDoc: async () => ({ id: "generated-id" }),
}));

vi.mock("./firebase", () => ({ getDb: async () => ({}) }));

import App from "./App";

const DAY = 24 * 60 * 60 * 1000;

const payload = (overrides: Record<string, unknown> = {}) => ({
  data: JSON.stringify({
    origText: "shared A",
    modText: "shared B",
    language: "javascript",
  }),
  timestamp: Date.now(),
  ...overrides,
});

const setUrl = (search: string) => {
  window.history.replaceState({}, "", `/${search}`);
};

beforeEach(() => {
  localStorage.clear();
  setUrl("?id=abc123");
});

afterEach(() => {
  setUrl("");
  vi.restoreAllMocks();
});

describe("share link expiry", () => {
  it("loads a link that has not expired", async () => {
    mockDoc = { exists: true, data: payload({ expiresAt: Date.now() + 10 * DAY }) };
    render(<App />);

    await waitFor(() => {
      const eds = screen.getAllByTestId("monaco-editor") as HTMLTextAreaElement[];
      expect(eds[0].value).toBe("shared A");
      expect(eds[1].value).toBe("shared B");
    });
  });

  it("refuses an expired link and explains why", async () => {
    mockDoc = { exists: true, data: payload({ expiresAt: Date.now() - DAY }) };
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/share link has expired/i)).toBeInTheDocument();
    });

    // The content must not be loaded despite the document still existing.
    const eds = screen.getAllByTestId("monaco-editor") as HTMLTextAreaElement[];
    expect(eds[0].value).toBe("");
  });

  /**
   * Links created before expiry shipped carry no `expiresAt`. They must keep
   * working rather than being treated as expired at timestamp 0.
   */
  it("treats a link with no expiry as non-expiring", async () => {
    mockDoc = { exists: true, data: payload() };
    render(<App />);

    await waitFor(() => {
      const eds = screen.getAllByTestId("monaco-editor") as HTMLTextAreaElement[];
      expect(eds[0].value).toBe("shared A");
    });
    expect(screen.queryByText(/has expired/i)).not.toBeInTheDocument();
  });

  it("reports a missing document instead of failing silently", async () => {
    mockDoc = { exists: false };
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
    });
  });
});
