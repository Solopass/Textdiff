import * as Diff3 from 'node-diff3';
// Shared with the UI. Kept in its own dependency-free module so importing the
// stats helper does not drag this engine into the main bundle.
import { computeDiffStats } from './lib/diffStats';
import type { DiffRow, WordPart } from './lib/diffStats';

export { computeDiffStats } from './lib/diffStats';
export type { DiffRow, WordPart, DiffStats } from './lib/diffStats';

// Same quadratic-table concern as the line-level LCS, but per line pair. A
// single minified line can hold tens of thousands of tokens, and this runs for
// every changed pair, so the ceiling here is much tighter. Above it we skip
// intra-line highlighting and let the row render as a plain add/del.
const MAX_TOKEN_DP_CELLS = 1_000_000;

const computeTokenDiff = (strA: string, strB: string) => {
  const tokensA = strA.split(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/).filter(Boolean);
  const tokensB = strB.split(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/).filter(Boolean);
  const m = tokensA.length;
  const n = tokensB.length;
  if ((m + 1) * (n + 1) > MAX_TOKEN_DP_CELLS) {
    return { partsA: undefined, partsB: undefined };
  }
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (tokensA[i] === tokensB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  const partsA: WordPart[] = [];
  const partsB: WordPart[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
      partsA.unshift({ text: tokensA[i - 1], type: 'unchanged' });
      partsB.unshift({ text: tokensB[j - 1], type: 'unchanged' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      partsB.unshift({ text: tokensB[j - 1], type: 'add' });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      partsA.unshift({ text: tokensA[i - 1], type: 'del' });
      i--;
    }
  }
  return { partsA, partsB };
};

const makeNormalizer = (ignoreWhitespace: boolean, ignoreCasing: boolean) => (line: string) => {
  let str = line;
  if (ignoreWhitespace) str = str.trim().replace(/\s+/g, ' ');
  if (ignoreCasing) str = str.toLowerCase();
  return str;
};

/**
 * Guard on the LCS dynamic-programming table.
 *
 * The table is (m+1) x (n+1) Int32Array cells = 4 bytes each, so two 10k-line
 * files already cost ~400MB and 20k lines costs ~1.6GB — enough to kill the
 * tab. Prefix/suffix trimming below removes the bulk of that in practice
 * (real edits touch a small middle region), but a pathological input where
 * every line differs still needs a hard ceiling.
 *
 * 12M cells ~= 48MB, which is a safe working-set for a worker.
 */
const MAX_DP_CELLS = 12_000_000;

export class DiffTooLargeError extends Error {
  constructor(m: number, n: number) {
    super(
      `Diff too large: ${m} x ${n} changed lines exceeds the ${MAX_DP_CELLS.toLocaleString()} cell limit. ` +
        `Try comparing smaller files, or enable "trim blank lines" to reduce the input.`,
    );
    this.name = 'DiffTooLargeError';
  }
}

/**
 * Detects blocks of lines that were deleted in one place and added in another
 * (e.g. moved functions, rearranged blocks), annotating rows with:
 * - `moved: 'from'` on deleted lines
 * - `moved: 'to'` on added lines
 * - `movedBlockId`: numeric ID linking the source and destination blocks
 */
export const detectMovedBlocks = (
  diff: DiffRow[],
  normalizer?: (s: string) => string
): void => {
  const norm = normalizer || ((s: string) => s.trim());

  type Run = {
    type: 'del' | 'add';
    indices: number[];
  };

  const runs: Run[] = [];
  let currentRun: Run | null = null;

  for (let i = 0; i < diff.length; i++) {
    const row = diff[i];
    if (row.type === 'del' || row.type === 'add') {
      if (currentRun && currentRun.type === row.type) {
        currentRun.indices.push(i);
      } else {
        currentRun = { type: row.type, indices: [i] };
        runs.push(currentRun);
      }
    } else {
      currentRun = null;
    }
  }

  const delRuns = runs.filter((r) => r.type === 'del');
  const addRuns = runs.filter((r) => r.type === 'add');

  if (delRuns.length === 0 || addRuns.length === 0) return;

  const claimedIndices = new Set<number>();
  let nextBlockId = 1;

  const maxDelLen = Math.max(...delRuns.map((r) => r.indices.length));
  const maxAddLen = Math.max(...addRuns.map((r) => r.indices.length));
  const maxL = Math.min(maxDelLen, maxAddLen);

  for (let len = maxL; len >= 1; len--) {
    const addMap = new Map<string, number[][]>();

    for (const addRun of addRuns) {
      for (let start = 0; start <= addRun.indices.length - len; start++) {
        const sliceIndices = addRun.indices.slice(start, start + len);
        if (sliceIndices.some((idx) => claimedIndices.has(idx))) continue;

        const lines = sliceIndices.map((idx) => norm(diff[idx].lineB));
        const totalCharCount = lines.reduce((acc, l) => acc + l.trim().length, 0);

        if ((len >= 2 && totalCharCount >= 6) || (len === 1 && totalCharCount >= 20)) {
          const key = lines.join('\n');
          const existing = addMap.get(key) || [];
          existing.push(sliceIndices);
          addMap.set(key, existing);
        }
      }
    }

    if (addMap.size === 0) continue;

    for (const delRun of delRuns) {
      for (let start = 0; start <= delRun.indices.length - len; start++) {
        const sliceIndices = delRun.indices.slice(start, start + len);
        if (sliceIndices.some((idx) => claimedIndices.has(idx))) continue;

        const lines = sliceIndices.map((idx) => norm(diff[idx].lineA));
        const totalCharCount = lines.reduce((acc, l) => acc + l.trim().length, 0);

        if ((len >= 2 && totalCharCount >= 6) || (len === 1 && totalCharCount >= 20)) {
          const key = lines.join('\n');
          const matchingSlices = addMap.get(key);
          if (matchingSlices && matchingSlices.length > 0) {
            let addSlice: number[] | null = null;
            while (matchingSlices.length > 0) {
              const cand = matchingSlices.shift()!;
              if (!cand.some((idx) => claimedIndices.has(idx))) {
                addSlice = cand;
                break;
              }
            }

            if (addSlice) {
              const blockId = nextBlockId++;

              for (const dIdx of sliceIndices) {
                diff[dIdx].moved = 'from';
                diff[dIdx].movedBlockId = blockId;
                claimedIndices.add(dIdx);
              }

              for (const aIdx of addSlice) {
                diff[aIdx].moved = 'to';
                diff[aIdx].movedBlockId = blockId;
                claimedIndices.add(aIdx);
              }
            }
          }
        }
      }
    }
  }
};

export const computeLCS = (aLines: string[], bLines: string[], ignoreWhitespace: boolean, ignoreCasing: boolean) => {
  const normalize = makeNormalizer(ignoreWhitespace, ignoreCasing);

  // Precompute normalized forms once. The original called normalize() inside
  // the O(m*n) inner loop, so a 5k x 5k diff ran 25M trim+regex+toLowerCase
  // calls — that alone dominated runtime.
  const aNorm = aLines.map(normalize);
  const bNorm = bLines.map(normalize);

  // Peel off the common prefix and suffix before building the table. These
  // regions are unchanged by definition, so they cost nothing to emit
  // directly and shrink the quadratic core to just the edited span.
  let prefix = 0;
  while (prefix < aNorm.length && prefix < bNorm.length && aNorm[prefix] === bNorm[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < aNorm.length - prefix &&
    suffix < bNorm.length - prefix &&
    aNorm[aNorm.length - 1 - suffix] === bNorm[bNorm.length - 1 - suffix]
  ) {
    suffix++;
  }

  const aMid = aLines.slice(prefix, aLines.length - suffix);
  const bMid = bLines.slice(prefix, bLines.length - suffix);
  const aMidNorm = aNorm.slice(prefix, aNorm.length - suffix);
  const bMidNorm = bNorm.slice(prefix, bNorm.length - suffix);

  const m = aMid.length;
  const n = bMid.length;

  if ((m + 1) * (n + 1) > MAX_DP_CELLS) {
    throw new DiffTooLargeError(m, n);
  }

  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (aMidNorm[i] === bMidNorm[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diff: DiffRow[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aMidNorm[i - 1] === bMidNorm[j - 1]) {
      // Line numbers are offset by the peeled prefix.
      diff.unshift({ type: 'unchanged', lineA: aMid[i - 1], lineB: bMid[j - 1], lineNumA: prefix + i, lineNumB: prefix + j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'add', lineA: '', lineB: bMid[j - 1], lineNumA: null, lineNumB: prefix + j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'del', lineA: aMid[i - 1], lineB: '', lineNumA: prefix + i, lineNumB: null });
      i--;
    }
  }

  // Re-attach the unchanged prefix and suffix that were peeled off above.
  for (let k = prefix - 1; k >= 0; k--) {
    diff.unshift({ type: 'unchanged', lineA: aLines[k], lineB: bLines[k], lineNumA: k + 1, lineNumB: k + 1 });
  }
  for (let k = 0; k < suffix; k++) {
    const aIdx = aLines.length - suffix + k;
    const bIdx = bLines.length - suffix + k;
    diff.push({ type: 'unchanged', lineA: aLines[aIdx], lineB: bLines[bIdx], lineNumA: aIdx + 1, lineNumB: bIdx + 1 });
  }

  detectMovedBlocks(diff, normalize);

  for (let k = 0; k < diff.length; k++) {
    if (diff[k].type === 'del' && k + 1 < diff.length && diff[k + 1].type === 'add') {
      if (!diff[k].moved && !diff[k + 1].moved) {
        const { partsA, partsB } = computeTokenDiff(diff[k].lineA, diff[k + 1].lineB);
        diff[k].partsA = partsA;
        diff[k + 1].partsB = partsB;
      }
      k++;
    } else if (diff[k].type === 'add' && k + 1 < diff.length && diff[k + 1].type === 'del') {
      if (!diff[k].moved && !diff[k + 1].moved) {
        const { partsA, partsB } = computeTokenDiff(diff[k + 1].lineA, diff[k].lineB);
        diff[k + 1].partsA = partsA;
        diff[k].partsB = partsB;
      }
      k++;
    }
  }
  return diff;
};

export const compute3Way = (aLines: string[], oLines: string[], bLines: string[], ignoreWhitespace: boolean, ignoreCasing: boolean) => {
  const normalize = makeNormalizer(ignoreWhitespace, ignoreCasing);

  // The ignore-whitespace / ignore-case toggles were silently dead in 3-way
  // mode: normalize() was defined here but never applied, so diff3Merge always
  // compared raw lines. Feed it normalized lines so the flags take effect, and
  // keep a lookup back to the original text so the rendered output still shows
  // what the user actually typed rather than the normalized form.
  const applyNormalization = ignoreWhitespace || ignoreCasing;
  const aCmp = applyNormalization ? aLines.map(normalize) : aLines;
  const oCmp = applyNormalization ? oLines.map(normalize) : oLines;
  const bCmp = applyNormalization ? bLines.map(normalize) : bLines;

  // Maps a normalized line back to the original, per side. Built in reverse so
  // the first occurrence wins on collisions.
  const buildLookup = (orig: string[], cmp: string[]) => {
    const map = new Map<string, string>();
    for (let i = cmp.length - 1; i >= 0; i--) map.set(cmp[i], orig[i]);
    return map;
  };
  const aLookup = applyNormalization ? buildLookup(aLines, aCmp) : null;
  const oLookup = applyNormalization ? buildLookup(oLines, oCmp) : null;
  const bLookup = applyNormalization ? buildLookup(bLines, bCmp) : null;
  const denorm = (line: string, ...maps: (Map<string, string> | null)[]) => {
    for (const map of maps) {
      const hit = map?.get(line);
      if (hit !== undefined) return hit;
    }
    return line;
  };

  // node-diff3 just takes arrays of strings.
  const mergeResult = Diff3.diff3Merge(aCmp, oCmp, bCmp, { excludeFalseConflicts: true });
  
  // We can format this mergeResult into a DiffRow array so we can render it.
  const diff: DiffRow[] = [];
  let aIdx = 1, bIdx = 1;

  mergeResult.forEach((block: any) => {
    if (block.ok) {
      block.ok.forEach((line: string) => {
        // An "ok" block can originate from any of the three inputs; check all
        // three lookups so the original casing/spacing is restored.
        const original = denorm(line, aLookup, oLookup, bLookup);
        diff.push({ type: 'unchanged', lineA: original, lineB: original, lineNumA: aIdx++, lineNumB: bIdx++ });
      });
    } else if (block.conflict) {
      const a = (block.conflict.a || []).map((l: string) => denorm(l, aLookup));
      const b = (block.conflict.b || []).map((l: string) => denorm(l, bLookup));
      // we can represent conflict as del from A, and add from B, or just raw blocks.
      // But we have 2 columns. A simple way:
      // show A's version on the left (del), B's version on the right (add).
      // If we pad them to match, it looks like a regular diff!
      const maxLen = Math.max(a.length, b.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < a.length && i < b.length) {
          const { partsA, partsB } = computeTokenDiff(a[i], b[i]);
          diff.push({ type: 'del', lineA: a[i], lineB: '', lineNumA: aIdx++, lineNumB: null, partsA });
          diff.push({ type: 'add', lineA: '', lineB: b[i], lineNumA: null, lineNumB: bIdx++, partsB });
        } else if (i < a.length) {
          diff.push({ type: 'del', lineA: a[i], lineB: '', lineNumA: aIdx++, lineNumB: null });
        } else if (i < b.length) {
          diff.push({ type: 'add', lineA: '', lineB: b[i], lineNumA: null, lineNumB: bIdx++ });
        }
      }
    }
  });
  return diff;
};

// Only register the worker entry point when actually running as a worker.
// The pure functions above are exported for unit tests, and importing this
// module from a test should not install a global message handler.
const isWorkerContext =
  typeof self !== 'undefined' &&
  typeof (globalThis as any).WorkerGlobalScope !== 'undefined' &&
  self instanceof (globalThis as any).WorkerGlobalScope;

const handleMessage = (e: MessageEvent) => {
  // requestId is echoed back so the main thread can drop results from runs
  // that were superseded while they were still computing.
  const { requestId, orig, mod, base, isThreeWay, ws, caseInsensitive, trimBlanks } = e.data;

  try {
    let aLines = orig.split('\n');
    let bLines = mod.split('\n');
    let oLines = base ? base.split('\n') : [];

    if (trimBlanks) {
      const isNotEmpty = (l: string) => l.trim().length > 0;
      aLines = aLines.filter(isNotEmpty);
      bLines = bLines.filter(isNotEmpty);
      oLines = oLines.filter(isNotEmpty);
    }

    let rawDiff;
    if (isThreeWay) {
      rawDiff = compute3Way(aLines, oLines, bLines, ws, caseInsensitive);
    } else {
      rawDiff = computeLCS(aLines, bLines, ws, caseInsensitive);
    }

    self.postMessage({ requestId, rawDiff, stats: computeDiffStats(rawDiff) });
  } catch (err: any) {
    // Report failures as a normal message rather than letting them escape as
    // an unhandled worker error, so the UI can show why and reset its state.
    self.postMessage({
      requestId,
      error: err?.message || 'The diff engine failed on this input.',
    });
  }
};

if (isWorkerContext) {
  self.onmessage = handleMessage;
}
