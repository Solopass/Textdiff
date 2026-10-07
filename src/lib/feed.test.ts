import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeLCS } from "../diffWorker";
import {
  captionParts,
  extractTags,
  firstHunk,
  hunkToPatch,
  normalizeHandle,
  relativeTime,
  splitHunk,
} from "./feed";

const rowsFor = (a: string, b: string) => computeLCS(a.split("\n"), b.split("\n"), false, false);

/**
 * The roadmap's acceptance test for COPY PATCH: the output must satisfy
 * `git apply --check` against the original file — and actually apply.
 */
const gitApplies = (orig: string, patch: string, fileName: string) => {
  const dir = mkdtempSync(join(tmpdir(), "tds-feed-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    writeFileSync(join(dir, fileName), orig);
    writeFileSync(join(dir, "p.patch"), patch);
    execFileSync("git", ["apply", "--check", "p.patch"], { cwd: dir, stdio: "pipe" });
    execFileSync("git", ["apply", "p.patch"], { cwd: dir, stdio: "pipe" });
    return readFileSync(join(dir, fileName), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const lines = (n: number, prefix = "line") => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);

describe("firstHunk", () => {
  it("returns null when nothing changed", () => {
    expect(firstHunk(rowsFor("a\nb", "a\nb"))).toBeNull();
  });

  it("includes three lines of context and a correct header", () => {
    const a = lines(20);
    const b = [...a];
    b[9] = "changed 10";
    const hunk = firstHunk(rowsFor(a.join("\n"), b.join("\n")))!;
    expect(hunk.split("\n")[0]).toBe("@@ -7,7 +7,7 @@");
    expect(hunk).toContain("-line 10\n+changed 10");
  });

  it("produces a patch git applies, mid-file", () => {
    const a = lines(30).join("\n") + "\n";
    const bArr = lines(30);
    bArr.splice(14, 1, "replaced 15", "inserted");
    const b = bArr.join("\n") + "\n";
    const patch = hunkToPatch(firstHunk(rowsFor(a.trimEnd(), b.trimEnd()))!, "app.ts");
    expect(gitApplies(a, patch, "app.ts")).toBe(b);
  });

  it("produces a patch git applies at the top and bottom of a file", () => {
    const a = lines(10).join("\n") + "\n";
    const top = ["new first", ...lines(10)].join("\n") + "\n";
    expect(gitApplies(a, hunkToPatch(firstHunk(rowsFor(a.trimEnd(), top.trimEnd()))!, "f.txt"), "f.txt")).toBe(top);

    const bottom = [...lines(9), "new last"].join("\n") + "\n";
    expect(gitApplies(a, hunkToPatch(firstHunk(rowsFor(a.trimEnd(), bottom.trimEnd()))!, "f.txt"), "f.txt")).toBe(bottom);
  });

  it("produces a patch git applies to an empty file", () => {
    const b = "hello\nworld\n";
    const hunk = firstHunk(rowsFor("", b.trimEnd()).filter((r) => !(r.type === "del" && r.lineA === "")))!;
    expect(hunk.startsWith("@@ -0,0 +1,2 @@")).toBe(true);
    expect(gitApplies("", hunkToPatch(hunk, "new.txt"), "new.txt")).toBe(b);
  });

  it("only takes the first hunk when changes are far apart", () => {
    const a = lines(40);
    const b = [...a];
    b[2] = "first change";
    b[35] = "far change";
    const hunk = firstHunk(rowsFor(a.join("\n"), b.join("\n")))!;
    expect(hunk).toContain("first change");
    expect(hunk).not.toContain("far change");
  });

  it("stays under the size cap and remains a valid patch when truncated", () => {
    const a = lines(200).join("\n") + "\n";
    const b = lines(200, "rewritten line that is quite a bit longer than before").join("\n") + "\n";
    const hunk = firstHunk(rowsFor(a.trimEnd(), b.trimEnd()))!;
    expect(hunk.length).toBeLessThanOrEqual(2000);
    expect(() => gitApplies(a, hunkToPatch(hunk, "big.txt"), "big.txt")).not.toThrow();
  });
});

describe("splitHunk", () => {
  it("recovers both sides", () => {
    const hunk = "@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n";
    expect(splitHunk(hunk)).toEqual({ orig: "a\nb\nc", mod: "a\nB\nc" });
  });
});

describe("captions and handles", () => {
  it("extracts lower-cased unique hashtags, capped at five", () => {
    expect(extractTags("Fixed #Rust lifetimes in #rust and #wasm")).toEqual(["rust", "wasm"]);
    expect(extractTags("#a1 #b2 #c3 #d4 #e5 #f6")).toHaveLength(5);
    expect(extractTags("issue #123 and a&#39;s entity")).toEqual([]);
  });

  it("splits captions for tag highlighting without losing text", () => {
    const parts = captionParts("ship it #typescript now");
    expect(parts.map((p) => p.text).join("")).toBe("ship it #typescript now");
    expect(parts.filter((p) => p.tag).map((p) => p.text)).toEqual(["#typescript"]);
  });

  it("normalizes handles", () => {
    expect(normalizeHandle("jake")).toBe("@jake");
    expect(normalizeHandle("@@jake")).toBe("@jake");
    expect(normalizeHandle("  ")).toBe("@anonymous");
    expect(normalizeHandle("<script>")).toBe("@script");
    expect(normalizeHandle("x".repeat(50)).length).toBe(30);
  });
});

describe("relativeTime", () => {
  const now = Date.UTC(2026, 9, 7, 12);
  it("reads like 2006", () => {
    expect(relativeTime(now - 10_000, now)).toBe("just now");
    expect(relativeTime(now - 3 * 60_000, now)).toBe("3m ago");
    expect(relativeTime(now - 5 * 3_600_000, now)).toBe("5h ago");
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe("2d ago");
    expect(relativeTime(Date.UTC(2026, 0, 2, 12), now)).toBe("Jan 2, 2026");
  });
});
