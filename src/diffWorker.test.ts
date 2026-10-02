import { describe, it, expect } from "vitest";
import { computeLCS, compute3Way, computeDiffStats } from "./diffWorker";
import type { DiffRow } from "./diffWorker";

const L = (s: string) => s.split("\n");
const numsA = (d: ReturnType<typeof computeLCS>) =>
  d.filter((r) => r.lineNumA !== null).map((r) => r.lineNumA);
const numsB = (d: ReturnType<typeof computeLCS>) =>
  d.filter((r) => r.lineNumB !== null).map((r) => r.lineNumB);

describe("computeLCS", () => {
  it("reports identical input as entirely unchanged", () => {
    const d = computeLCS(L("x\ny\nz"), L("x\ny\nz"), false, false);
    expect(d).toHaveLength(3);
    expect(d.every((r) => r.type === "unchanged")).toBe(true);
  });

  it("handles empty input on either side", () => {
    expect(computeLCS([], [], false, false)).toHaveLength(0);
    const d = computeLCS([], L("a\nb"), false, false);
    expect(d.map((r) => r.type)).toEqual(["add", "add"]);
  });

  // Regression guard for the prefix/suffix peeling optimisation: line numbers
  // are assigned relative to the trimmed middle section and must be shifted
  // back into the coordinates of the original input.
  it("keeps line numbers contiguous and 1-based after prefix/suffix peeling", () => {
    const d = computeLCS(L("a\nb\nOLD\nd\ne"), L("a\nb\nNEW\nd\ne"), false, false);
    expect(numsA(d)).toEqual([1, 2, 3, 4, 5]);
    expect(numsB(d)).toEqual([1, 2, 3, 4, 5]);
    expect(d.some((r) => r.type === "del" && r.lineA === "OLD")).toBe(true);
    expect(d.some((r) => r.type === "add" && r.lineB === "NEW")).toBe(true);
  });

  /**
   * Exercises the unchanged branch *inside* the trimmed middle section.
   *
   * The earlier line-number test peeled a prefix and suffix that left only
   * changed lines in the middle, so the `prefix + i` offset on unchanged rows
   * was never executed and deleting it did not fail any test. This case puts
   * an unchanged line between two changes, with a non-zero prefix, so the
   * offset is actually observable.
   */
  it("offsets unchanged lines inside the trimmed middle section", () => {
    const a = L("head\nAAA\nmid\nBBB\ntail");
    const b = L("head\nXXX\nmid\nYYY\ntail");
    const d = computeLCS(a, b, false, false);

    const mid = d.find((r) => r.type === "unchanged" && r.lineA === "mid");
    expect(mid).toBeDefined();
    // "mid" is the third line of both inputs.
    expect(mid!.lineNumA).toBe(3);
    expect(mid!.lineNumB).toBe(3);

    expect(numsA(d)).toEqual([1, 2, 3, 4, 5]);
    expect(numsB(d)).toEqual([1, 2, 3, 4, 5]);
  });

  it("offsets changed lines inside the trimmed middle section", () => {
    const d = computeLCS(L("head\nOLD\ntail"), L("head\nNEW\ntail"), false, false);
    expect(d.find((r) => r.type === "del")!.lineNumA).toBe(2);
    expect(d.find((r) => r.type === "add")!.lineNumB).toBe(2);
  });

  it("locates a pure append at the correct line", () => {
    const d = computeLCS(L("a\nb"), L("a\nb\nc"), false, false);
    const adds = d.filter((r) => r.type === "add");
    expect(adds).toHaveLength(1);
    expect(adds[0].lineNumB).toBe(3);
  });

  it("locates a pure prepend at the correct line", () => {
    const d = computeLCS(L("b\nc"), L("a\nb\nc"), false, false);
    const adds = d.filter((r) => r.type === "add");
    expect(adds).toHaveLength(1);
    expect(adds[0].lineNumB).toBe(1);
  });

  it("reconstructs both original inputs exactly", () => {
    const a = L("one\ntwo\nthree\nfour");
    const b = L("one\n2\nthree\n4\nfive");
    const d = computeLCS(a, b, false, false);
    expect(d.filter((r) => r.lineNumA !== null).map((r) => r.lineA)).toEqual(a);
    expect(d.filter((r) => r.lineNumB !== null).map((r) => r.lineB)).toEqual(b);
  });

  it("applies the ignore-whitespace and ignore-case flags", () => {
    const on = computeLCS(L("Hello   World"), L("hello world"), true, true);
    expect(on).toHaveLength(1);
    expect(on[0].type).toBe("unchanged");

    const off = computeLCS(L("Hello   World"), L("hello world"), false, false);
    expect(off.some((r) => r.type !== "unchanged")).toBe(true);
  });

  it("displays the original text rather than the normalized form", () => {
    const d = computeLCS(L("Hello   World"), L("hello world"), true, true);
    expect(d[0].lineA).toBe("Hello   World");
    expect(d[0].lineB).toBe("hello world");
  });

  // The DP table is (m+1)*(n+1) Int32Array cells. Without a ceiling, two large
  // files with no shared lines would try to allocate gigabytes.
  it("refuses oversized comparisons with an explanatory error", () => {
    const gen = (n: number, tag: string) =>
      Array.from({ length: n }, (_, i) => `${tag} line ${i}`);
    expect(() => computeLCS(gen(6000, "a"), gen(6000, "b"), false, false)).toThrow(
      /too large/i,
    );
  });

  it("still handles very large files when the edit is localized", () => {
    const base = Array.from({ length: 20000 }, (_, i) => `line ${i}`);
    const modified = [...base];
    modified[10000] = "MUTATED";
    const d = computeLCS(base, modified, false, false);
    expect(d.some((r) => r.type === "del" && r.lineA === "line 10000")).toBe(true);
    expect(d.some((r) => r.type === "add" && r.lineB === "MUTATED")).toBe(true);
  });
});

describe("compute3Way", () => {
  const base = L("one\ntwo\nthree");

  it("reports a clean merge as unchanged", () => {
    const d = compute3Way(base, base, base, false, false);
    expect(d.every((r) => r.type === "unchanged")).toBe(true);
  });

  // These flags were accepted but never applied in 3-way mode, so toggling
  // them had no effect on merge-conflict comparisons.
  it("honours the ignore flags (previously ignored in 3-way mode)", () => {
    const a = L("ONE\ntwo\nthree");
    const b = L("one   \ntwo\nthree");

    const off = compute3Way(a, base, b, false, false).filter(
      (r) => r.type !== "unchanged",
    ).length;
    const on = compute3Way(a, base, b, true, true).filter(
      (r) => r.type !== "unchanged",
    ).length;

    expect(off).toBeGreaterThan(0);
    expect(on).toBeLessThan(off);
  });
});

describe("computeDiffStats", () => {
  const rows = (spec: Array<DiffRow["type"]>): DiffRow[] =>
    spec.map((type, i) => ({
      type,
      lineA: "",
      lineB: "",
      lineNumA: type === "add" ? null : i + 1,
      lineNumB: type === "del" ? null : i + 1,
    }));

  it("counts additions, deletions and unchanged rows", () => {
    const s = computeDiffStats(rows(["unchanged", "add", "del", "unchanged"]));
    expect(s).toMatchObject({ adds: 1, dels: 1, unchanged: 2 });
  });

  /**
   * A modified line appears as both a deletion and an addition. Dividing by
   * the row count would therefore double-count it: three lines with one edit
   * would read 50% rather than 67%. The denominator is the longer of the two
   * reconstructed inputs instead.
   */
  it("does not double-count a modified line", () => {
    const s = computeDiffStats(rows(["unchanged", "unchanged", "del", "add"]));
    // linesA = 2 unchanged + 1 del = 3; linesB = 2 unchanged + 1 add = 3.
    expect(s.similarity).toBe(67);
  });

  it("reports identical content as 100%", () => {
    expect(computeDiffStats(rows(["unchanged", "unchanged"])).similarity).toBe(100);
  });

  it("reports entirely different content as 0%", () => {
    expect(computeDiffStats(rows(["del", "del", "add", "add"])).similarity).toBe(0);
  });

  it("treats two empty inputs as identical", () => {
    expect(computeDiffStats([]).similarity).toBe(100);
  });

  it("handles a pure append", () => {
    // A = 2 lines, B = 3 lines, 2 shared -> 2/3.
    expect(computeDiffStats(rows(["unchanged", "unchanged", "add"])).similarity).toBe(67);
  });

  // The guarantee that motivated extracting this function.
  it("matches what the engine reports for the same input", () => {
    const a = "one\ntwo\nthree".split("\n");
    const b = "one\nCHANGED\nthree".split("\n");
    const diff = computeLCS(a, b, false, false);
    const s = computeDiffStats(diff);
    expect(s).toMatchObject({ adds: 1, dels: 1, unchanged: 2, similarity: 67 });
  });
});

describe("detectMovedBlocks", () => {
  it("identifies a multi-line block moved from top to bottom", () => {
    const a = [
      "anchor1();",
      "anchor2();",
      "anchor3();",
      "function helper() {",
      "  console.log('helper');",
      "  return true;",
      "}",
      "footer1();",
      "footer2();",
      "footer3();",
      "footer4();",
      "footer5();",
    ];
    const b = [
      "anchor1();",
      "anchor2();",
      "anchor3();",
      "footer1();",
      "footer2();",
      "footer3();",
      "footer4();",
      "footer5();",
      "function helper() {",
      "  console.log('helper');",
      "  return true;",
      "}",
    ];

    const diff = computeLCS(a, b, false, false);
    const movedFrom = diff.filter((r) => r.moved === "from");
    const movedTo = diff.filter((r) => r.moved === "to");

    expect(movedFrom.length).toBe(4);
    expect(movedTo.length).toBe(4);
    expect(movedFrom[0].movedBlockId).toBe(1);
    expect(movedTo[0].movedBlockId).toBe(1);
    expect(movedFrom.map((r) => r.lineA)).toEqual([
      "function helper() {",
      "  console.log('helper');",
      "  return true;",
      "}",
    ]);
    expect(movedTo.map((r) => r.lineB)).toEqual([
      "function helper() {",
      "  console.log('helper');",
      "  return true;",
      "}",
    ]);
  });

  it("does not tag single short punctuation lines as moved", () => {
    const a = ["foo();", "}", "bar();"];
    const b = ["bar();", "baz();", "}"];

    const diff = computeLCS(a, b, false, false);
    // Single brace '}' should not be falsely tagged as a moved block
    const movedBraces = diff.filter(
      (r) => (r.lineA === "}" || r.lineB === "}") && r.moved !== undefined
    );
    expect(movedBraces).toHaveLength(0);
  });

  it("assigns distinct movedBlockId numbers to distinct moved blocks", () => {
    const a = [
      "anchorOne_A();",
      "anchorOne_B();",
      "anchorOne_C();",
      "const ALPHA = 'long_string_alpha';",
      "const ALPHA2 = 'long_string_alpha2';",
      "anchorTwo_A();",
      "anchorTwo_B();",
      "anchorTwo_C();",
      "const BETA = 'long_string_beta';",
      "const BETA2 = 'long_string_beta2';",
      "anchorThree_A();",
      "anchorThree_B();",
      "anchorThree_C();",
    ];
    const b = [
      "anchorOne_A();",
      "anchorOne_B();",
      "anchorOne_C();",
      "const BETA = 'long_string_beta';",
      "const BETA2 = 'long_string_beta2';",
      "anchorTwo_A();",
      "anchorTwo_B();",
      "anchorTwo_C();",
      "anchorThree_A();",
      "anchorThree_B();",
      "anchorThree_C();",
      "const ALPHA = 'long_string_alpha';",
      "const ALPHA2 = 'long_string_alpha2';",
    ];

    const diff = computeLCS(a, b, false, false);
    const blockIds = new Set(
      diff.filter((r) => r.movedBlockId !== undefined).map((r) => r.movedBlockId)
    );
    expect(blockIds.size).toBe(2);
  });
});
