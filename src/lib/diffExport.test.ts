import { describe, it, expect } from "vitest";
import {
  generatePatchReport,
  generateCsvReport,
  generateMdReport,
  escapeCsv,
} from "./diffExport";
import type { DiffRow } from "./types";

describe("diffExport", () => {
  const sampleDiff: DiffRow[] = [
    { type: "unchanged", lineA: "const x = 1;", lineB: "const x = 1;", lineNumA: 1, lineNumB: 1 },
    { type: "del", lineA: "const y = 2;", lineB: "", lineNumA: 2, lineNumB: null },
    { type: "add", lineA: "", lineB: "const y = 3;", lineNumA: null, lineNumB: 2 },
  ];

  const sampleStats = {
    similarity: 33,
    addCount: 1,
    delCount: 1,
    unchangedCount: 1,
  };

  it("generates a unified diff patch correctly", () => {
    const patch = generatePatchReport(sampleDiff);
    expect(patch).toContain("--- Original\n+++ Modified\n");
    expect(patch).toContain(" const x = 1;\n");
    expect(patch).toContain("-const y = 2;\n");
    expect(patch).toContain("+const y = 3;\n");
  });

  it("escapes CSV values and formats rows", () => {
    expect(escapeCsv('hello "world"')).toBe('"hello ""world"""');
    expect(escapeCsv("")).toBe('""');

    const csv = generateCsvReport(sampleDiff);
    expect(csv).toContain("Type,Original Line,Modified Line,Original Content,Modified Content");
    expect(csv).toContain('unchanged,1,1,"const x = 1;","const x = 1;"');
    expect(csv).toContain('del,2,,"const y = 2;",""');
    expect(csv).toContain('add,,2,"","const y = 3;"');
  });

  it("generates markdown diff reports with summary stats", () => {
    const md = generateMdReport(sampleDiff, sampleStats, "2026-10-02 12:00:00");
    expect(md).toContain("# Diff Report");
    expect(md).toContain("**Date:** 2026-10-02 12:00:00");
    expect(md).toContain("- **Similarity:** 33%");
    expect(md).toContain("- **Additions:** +1 lines");
    expect(md).toContain("- **Deletions:** -1 lines");
    expect(md).toContain("- **Unchanged:** 1 lines");
    expect(md).toContain("```diff\n  const x = 1;\n- const y = 2;\n+ const y = 3;\n```");
  });
});
