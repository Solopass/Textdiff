import { describe, it, expect } from "vitest";
import { compare, stripRoot } from "./FolderDiff";

const map = (obj: Record<string, string>) => new Map(Object.entries(obj));
const byPath = (entries: ReturnType<typeof compare>) =>
  Object.fromEntries(entries.map((e) => [e.path, e.status]));

describe("stripRoot", () => {
  // Selecting a directory yields "my-app/src/index.ts". Two exports of the
  // same project under different folder names must still line up, so the
  // shared root segment is dropped.
  it("removes a single shared root directory", () => {
    expect(stripRoot(["app/src/a.ts", "app/src/b.ts", "app/README.md"])).toEqual([
      "src/a.ts",
      "src/b.ts",
      "README.md",
    ]);
  });

  it("leaves paths alone when roots differ", () => {
    const paths = ["a/one.ts", "b/two.ts"];
    expect(stripRoot(paths)).toEqual(paths);
  });

  it("handles a single flat file without emptying it", () => {
    expect(stripRoot(["only.txt"])).toEqual(["only.txt"]);
  });
});

describe("compare", () => {
  it("classifies added, removed, modified and identical files", () => {
    const a = map({ "keep.ts": "same", "edit.ts": "before", "gone.ts": "x" });
    const b = map({ "keep.ts": "same", "edit.ts": "after", "new.ts": "y" });

    expect(byPath(compare(a, b))).toEqual({
      "keep.ts": "identical",
      "edit.ts": "modified",
      "gone.ts": "removed",
      "new.ts": "added",
    });
  });

  it("carries both sides' contents so a pair can be opened directly", () => {
    const entries = compare(map({ "f.ts": "one" }), map({ "f.ts": "two" }));
    expect(entries[0]).toMatchObject({ textA: "one", textB: "two" });
  });

  it("returns an empty result for two empty trees", () => {
    expect(compare(map({}), map({}))).toEqual([]);
  });

  it("sorts output by path so the listing is stable", () => {
    const a = map({ "z.ts": "1", "a.ts": "1", "m.ts": "1" });
    const b = map({ "z.ts": "2", "a.ts": "2", "m.ts": "2" });
    expect(compare(a, b).map((e) => e.path)).toEqual(["a.ts", "m.ts", "z.ts"]);
  });

  it("treats a file missing from A as added, not modified", () => {
    const entries = compare(map({}), map({ "new.ts": "content" }));
    expect(entries[0].status).toBe("added");
    expect(entries[0].textA).toBe("");
    expect(entries[0].textB).toBe("content");
  });
});
