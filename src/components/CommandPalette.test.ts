import { describe, it, expect } from "vitest";
import { fuzzyScore } from "./CommandPalette";

const matches = (h: string, n: string) => fuzzyScore(h, n) !== null;

describe("fuzzyScore", () => {
  it("matches an exact substring", () => {
    expect(matches("Export as PDF", "PDF")).toBe(true);
  });

  it("matches characters spread across the string", () => {
    // "expdf" -> EX-port as P-D-F
    expect(matches("Export as PDF", "expdf")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(matches("Export as PDF", "EXPORT")).toBe(true);
    expect(matches("Export as PDF", "export")).toBe(true);
  });

  it("rejects characters that appear out of order", () => {
    expect(matches("Export as PDF", "fdp")).toBe(false);
  });

  it("rejects characters that are absent entirely", () => {
    expect(matches("Export as PDF", "zzz")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(fuzzyScore("anything", "")).toBe(0);
  });

  // Lower is better, so a tight prefix must outrank a scattered match.
  it("ranks a contiguous prefix above a scattered match", () => {
    const prefix = fuzzyScore("Export as PDF", "export")!;
    const scattered = fuzzyScore("Export as PDF", "epf")!;
    expect(prefix).toBeLessThan(scattered);
  });

  it("ranks the intended command first among realistic competitors", () => {
    const titles = [
      "Run comparison",
      "Export as PDF",
      "Export as PNG",
      "Open settings",
    ];
    const best = titles
      .map((t) => ({ t, s: fuzzyScore(t, "pdf") }))
      .filter((x): x is { t: string; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s)[0];
    expect(best.t).toBe("Export as PDF");
  });
});
