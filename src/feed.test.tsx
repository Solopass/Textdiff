/**
 * The public Diff Feed through the real UI, with Firestore mocked.
 */
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));

const SERVER_TS = { __serverTimestamp: true };
const addDoc = vi.fn(async (_c: any, _d: Record<string, unknown>) => ({ id: "post-new" }));
let feedDocs: { id: string; data: Record<string, unknown> }[] = [];
let singleDoc: { id: string; data: Record<string, unknown> } | null = null;

vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  doc: (_db: unknown, name: string, id: string) => ({ name, id }),
  query: (c: unknown) => c,
  orderBy: () => ({}),
  limit: () => ({}),
  serverTimestamp: () => SERVER_TS,
  addDoc: (c: any, d: Record<string, unknown>) => addDoc(c, d),
  getDocs: async () => ({ docs: feedDocs.map((d) => ({ id: d.id, data: () => d.data })) }),
  getDoc: async () => ({
    exists: () => !!singleDoc,
    id: singleDoc?.id,
    data: () => singleDoc?.data,
  }),
}));

vi.mock("./firebase", () => ({ getDb: async () => ({}) }));

import App from "./App";

const editors = () => screen.getAllByTestId("monaco-editor") as HTMLTextAreaElement[];
const setUrl = (path: string) => window.history.replaceState({}, "", `/${path}`);

/** Renders the app and gets past the landing page. */
const renderStudio = () => {
  render(<App />);
  const open = screen.queryByRole("button", { name: "Open Studio" });
  if (open) fireEvent.click(open);
};

const post = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  data: {
    author: "@ada",
    caption: "Tightened the #rust lifetimes",
    tags: ["rust"],
    timestamp: { toMillis: () => Date.now() - 5 * 60_000 },
    stats: { additions: 1, deletions: 1, similarity: 67, language: "rust" },
    hunk: "@@ -1,3 +1,3 @@\n fn a() {}\n-fn b<'a>() {}\n+fn b() {}\n fn c() {}\n",
    ...over,
  },
});

/** Lands in the studio with a diff already computed. */
const studioWithDiff = async () => {
  renderStudio();
  const [a, b] = editors();
  fireEvent.change(a, { target: { value: "one\ntwo\nthree" } });
  fireEvent.change(b, { target: { value: "one\nTWO\nthree" } });
  fireEvent.click(screen.getByTitle("Run Diff (Ctrl+Enter)"));
  await waitFor(() => expect(screen.getByRole("button", { name: /post to feed/i })).toBeEnabled());
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  addDoc.mockClear();
  feedDocs = [];
  singleDoc = null;
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
});

afterEach(() => setUrl(""));

describe("posting to the feed", () => {
  it("is unavailable until there is a diff", async () => {
    renderStudio();
    expect(await screen.findByRole("button", { name: /post to feed/i })).toBeDisabled();
  });

  it("enforces 280 characters with a live counter", async () => {
    await studioWithDiff();
    fireEvent.click(screen.getByRole("button", { name: /post to feed/i }));
    const box = await screen.findByLabelText("Caption");
    expect(screen.getByText("280")).toBeInTheDocument();

    fireEvent.change(box, { target: { value: "x".repeat(281) } });
    const counter = document.getElementById("feed-counter")!;
    expect(counter.className).toMatch(/D40D12/);
    expect(screen.getByRole("button", { name: "POST DIFF" })).toBeDisabled();

    fireEvent.change(box, { target: { value: "x".repeat(280) } });
    expect(screen.getByRole("button", { name: "POST DIFF" })).toBeEnabled();
  });

  it("writes a well-formed post, shows it on top, and starts the cooldown", async () => {
    await studioWithDiff();
    fireEvent.click(screen.getByRole("button", { name: /post to feed/i }));
    await userEvent.type(await screen.findByLabelText("Caption"), "Uppercased it #shouting");
    await userEvent.type(screen.getByLabelText("Author handle"), "jake");
    fireEvent.click(screen.getByRole("button", { name: "POST DIFF" }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    const [coll, data] = addDoc.mock.calls[0];
    expect(coll.name).toBe("diff_feed");
    expect(data).toMatchObject({
      author: "@jake",
      caption: "Uppercased it #shouting",
      tags: ["shouting"],
      timestamp: SERVER_TS,
      stats: { additions: 1, deletions: 1, similarity: 67 },
    });
    expect(String(data.hunk)).toMatch(/^@@ -1,3 \+1,3 @@\n one\n-two\n\+TWO\n three\n$/);
    // Rules pin the key set; undefined optionals must be omitted, not sent.
    expect(Object.values(data)).not.toContain(undefined);
    expect(localStorage.getItem("tds_author_handle")).toBe("@jake");

    const feed = await screen.findByRole("dialog", { name: /the feed/i });
    expect(within(feed).getByText("@jake")).toBeInTheDocument();
    expect(within(feed).getByText("#shouting")).toBeInTheDocument();

    fireEvent.click(within(feed).getByRole("button", { name: "Close feed" }));
    fireEvent.click(screen.getByRole("button", { name: /post to feed/i }));
    await screen.findByLabelText("Caption");
    expect(screen.getByText(/^Wait \d+s$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "POST DIFF" })).toBeDisabled();
  });
});

describe("reading the feed", () => {
  it("lists posts and opens one in the studio", async () => {
    feedDocs = [post("p1")];
    renderStudio();
    fireEvent.click(await screen.findByRole("button", { name: /^feed$/i }));

    const feed = await screen.findByRole("dialog", { name: /the feed/i });
    expect(await within(feed).findByText("@ada")).toBeInTheDocument();
    expect(within(feed).getByText("5m ago")).toBeInTheDocument();
    fireEvent.click(within(feed).getByRole("button", { name: /open in studio/i }));

    await waitFor(() => {
      expect(editors()[0].value).toBe("fn a() {}\nfn b<'a>() {}\nfn c() {}");
      expect(editors()[1].value).toBe("fn a() {}\nfn b() {}\nfn c() {}");
    });
    expect(screen.queryByRole("dialog", { name: /the feed/i })).not.toBeInTheDocument();
  });

  it("copies a patch with file headers", async () => {
    feedDocs = [post("p1", { fileName: "src/lib.rs" })];
    renderStudio();
    fireEvent.click(await screen.findByRole("button", { name: /^feed$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /copy patch/i }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringMatching(/^--- a\/src\/lib\.rs\n\+\+\+ b\/src\/lib\.rs\n@@ -1,3 \+1,3 @@\n/),
      ),
    );
  });

  it("opens a ?post= permalink with that post first", async () => {
    feedDocs = [post("other", { author: "@bob" })];
    singleDoc = post("p9", { author: "@linked" });
    setUrl("?post=p9");
    render(<App />);

    const feed = await screen.findByRole("dialog", { name: /the feed/i });
    const items = await within(feed).findAllByRole("listitem");
    await waitFor(() => expect(within(items[0]).getByText("@linked")).toBeInTheDocument());
  });
});
