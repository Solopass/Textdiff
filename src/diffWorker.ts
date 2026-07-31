import * as Diff3 from 'node-diff3';
export type WordPart = { text: string; type: 'unchanged' | 'add' | 'del' };
export type DiffRow = {
  type: 'unchanged' | 'add' | 'del' | 'folded';
  lineA: string;
  lineB: string;
  lineNumA: number | null;
  lineNumB: number | null;
  partsA?: WordPart[];
  partsB?: WordPart[];
};

const computeTokenDiff = (strA: string, strB: string) => {
  const tokensA = strA.split(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/).filter(Boolean);
  const tokensB = strB.split(/([a-zA-Z0-9_]+|\s+|[^a-zA-Z0-9_\s])/).filter(Boolean);
  const m = tokensA.length;
  const n = tokensB.length;
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

const computeLCS = (aLines: string[], bLines: string[], ignoreWhitespace: boolean, ignoreCasing: boolean) => {
  const normalize = (line: string) => {
    let str = line;
    if (ignoreWhitespace) str = str.trim().replace(/\s+/g, ' ');
    if (ignoreCasing) str = str.toLowerCase();
    return str;
  };
  const m = aLines.length;
  const n = bLines.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (normalize(aLines[i]) === normalize(bLines[j])) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  const diff: DiffRow[] = [];
  let i = m, j = n;
        
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalize(aLines[i - 1]) === normalize(bLines[j - 1])) {
      diff.unshift({ type: 'unchanged', lineA: aLines[i - 1], lineB: bLines[j - 1], lineNumA: i, lineNumB: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'add', lineA: '', lineB: bLines[j - 1], lineNumA: null, lineNumB: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'del', lineA: aLines[i - 1], lineB: '', lineNumA: i, lineNumB: null });
      i--;
    }
  }
  for (let k = 0; k < diff.length; k++) {
    if (diff[k].type === 'del' && k + 1 < diff.length && diff[k + 1].type === 'add') {
      const { partsA, partsB } = computeTokenDiff(diff[k].lineA, diff[k+1].lineB);
      diff[k].partsA = partsA;
      diff[k+1].partsB = partsB;
      k++;
    } else if (diff[k].type === 'add' && k + 1 < diff.length && diff[k + 1].type === 'del') {
      const { partsA, partsB } = computeTokenDiff(diff[k+1].lineA, diff[k].lineB);
      diff[k+1].partsA = partsA;
      diff[k].partsB = partsB;
      k++;
    }
  }
  return diff;
};

const compute3Way = (aLines: string[], oLines: string[], bLines: string[], ignoreWhitespace: boolean, ignoreCasing: boolean) => {
  const normalize = (line: string) => {
    let str = line;
    if (ignoreWhitespace) str = str.trim().replace(/\s+/g, ' ');
    if (ignoreCasing) str = str.toLowerCase();
    return str;
  };
  
  // node-diff3 just takes arrays of strings.
  const mergeResult = Diff3.diff3Merge(aLines, oLines, bLines, { excludeFalseConflicts: true });
  
  // We can format this mergeResult into a DiffRow array so we can render it.
  const diff: DiffRow[] = [];
  let aIdx = 1, oIdx = 1, bIdx = 1;
  
  mergeResult.forEach((block: any) => {
    if (block.ok) {
      block.ok.forEach((line: string) => {
        diff.push({ type: 'unchanged', lineA: line, lineB: line, lineNumA: aIdx++, lineNumB: bIdx++ });
      });
    } else if (block.conflict) {
      const a = block.conflict.a || [];
      const b = block.conflict.b || [];
      const o = block.conflict.o || [];
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

self.onmessage = (e: MessageEvent) => {
  const { orig, mod, base, isThreeWay, ws, caseInsensitive, trimBlanks } = e.data;
  
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
  
  let adds = 0, dels = 0, unchanged = 0;
  rawDiff.forEach(r => {
    if (r.type === 'add') adds++;
    else if (r.type === 'del') dels++;
    else if (r.type === 'unchanged') unchanged++;
  });
  
  const sim = (unchanged / Math.max(aLines.length, bLines.length, 1)) * 100;
  self.postMessage({ rawDiff, stats: { adds, dels, unchanged, similarity: Math.round(sim) } });
};
