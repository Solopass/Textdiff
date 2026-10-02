/**
 * Diff row shapes and the statistics derived from them.
 *
 * This lives apart from `diffWorker.ts` on purpose. The UI needs
 * `computeDiffStats`, and importing it from the worker module pulled the LCS
 * engine (and its `node-diff3` dependency) into the main bundle — roughly 3KB
 * gzipped of code that only ever runs inside a Web Worker. Keeping the shared
 * pieces in a module with no dependencies of its own means both sides can
 * import it for free.
 *
 * Nothing here may import the engine, or that regression comes straight back.
 */

export type WordPart = { text: string; type: 'unchanged' | 'add' | 'del' };

export type DiffRow = {
  type: 'unchanged' | 'add' | 'del' | 'folded';
  lineA: string;
  lineB: string;
  lineNumA: number | null;
  lineNumB: number | null;
  partsA?: WordPart[];
  partsB?: WordPart[];
  moved?: 'from' | 'to';
  movedBlockId?: number;
};

export type DiffStats = {
  adds: number;
  dels: number;
  unchanged: number;
  /** Percentage, 0-100, rounded. */
  similarity: number;
};

/**
 * The single source of truth for diff statistics.
 *
 * This used to be computed in two places with two different formulas. The
 * worker reported `unchanged / max(lenA, lenB)` while App.tsx ignored that
 * field entirely and recomputed `unchanged / (adds + dels + unchanged)`. The
 * second denominator double-counts a modified line — once as a deletion, once
 * as an addition — so three lines with one edit read as 50% similar instead of
 * 67%. The displayed number was the less intuitive of the two.
 *
 * Everything here derives from the diff rows alone, so both call sites agree
 * by construction rather than by convention.
 *
 * Line counts are recovered from the rows: every row that exists on the A side
 * is either unchanged or a deletion, and likewise for B with additions.
 */
export const computeDiffStats = (rawDiff: DiffRow[]): DiffStats => {
  let adds = 0;
  let dels = 0;
  let unchanged = 0;

  for (const row of rawDiff) {
    if (row.type === 'add') adds++;
    else if (row.type === 'del') dels++;
    else if (row.type === 'unchanged') unchanged++;
  }

  // Two empty inputs are trivially identical; without this the ratio below
  // would report 0%.
  if (adds === 0 && dels === 0 && unchanged === 0) {
    return { adds, dels, unchanged, similarity: 100 };
  }

  const lineCountA = unchanged + dels;
  const lineCountB = unchanged + adds;
  const similarity = Math.round(
    (unchanged / Math.max(lineCountA, lineCountB, 1)) * 100,
  );

  return { adds, dels, unchanged, similarity };
};
