/**
 * The public Diff Feed — pure logic, no Firebase, no React.
 *
 * A post carries one hunk of the diff as unified-diff text (`hunk`), not
 * separate before/after snippets. Keeping the +/- structure means COPY PATCH
 * needs no re-diffing and produces something `git apply` accepts, and both
 * sides for OPEN IN STUDIO fall out of it with `splitHunk`.
 *
 * Limits here are mirrored in firestore.rules; change both together.
 */
import type { DiffRow } from "./diffStats";

export const FEED_COLLECTION = "diff_feed";
export const FEED_CAPTION_MAX = 280;
export const FEED_AUTHOR_MAX = 30;
export const FEED_HUNK_MAX = 2000;
export const FEED_FILENAME_MAX = 100;
export const FEED_TAGS_MAX = 5;
export const FEED_PAGE_SIZE = 30;
export const FEED_COOLDOWN_MS = 30_000;
export const FEED_HANDLE_KEY = "tds_author_handle";
export const FEED_LAST_POST_KEY = "tds_feed_last_post";

export interface FeedStats {
  additions: number;
  deletions: number;
  similarity: number;
  language: string;
}

export interface FeedItem {
  id: string;
  author: string;
  caption: string;
  tags: string[];
  /** ms since epoch, from the server timestamp */
  timestamp: number;
  hunk?: string;
  fileName?: string;
  fullShareId?: string;
  stats: FeedStats;
}

/** Lower-cased, de-duplicated #hashtags, capped at FEED_TAGS_MAX. */
export const extractTags = (caption: string): string[] => {
  const tags = new Set<string>();
  for (const m of caption.matchAll(/(^|[^\w&])#([A-Za-z][\w-]{0,29})/g)) {
    tags.add(m[2].toLowerCase());
    if (tags.size >= FEED_TAGS_MAX) break;
  }
  return [...tags];
};

/** `jake` → `@jake`; anything unusable → `@anonymous`. */
export const normalizeHandle = (raw: string): string => {
  const cleaned = raw.trim().replace(/^@+/, "").replace(/[^\w.-]/g, "");
  if (!cleaned) return "@anonymous";
  return "@" + cleaned.slice(0, FEED_AUTHOR_MAX - 1);
};

/**
 * The first hunk of a diff as unified-diff text, starting at its `@@` header.
 * Lines are dropped from the end to fit `maxChars`; the header is recomputed
 * so the result stays a valid patch. Returns null when nothing changed.
 */
export const firstHunk = (rows: DiffRow[], context = 3, maxChars = FEED_HUNK_MAX): string | null => {
  const isChange = (r: DiffRow) => r.type === "add" || r.type === "del";
  const first = rows.findIndex(isChange);
  if (first === -1) return null;

  let start = first;
  while (start > 0 && first - start < context && rows[start - 1].type === "unchanged") start--;

  // Extend through changes; a run of unchanged lines longer than 2×context
  // would start a new hunk, so stop there (keeping `context` trailing lines).
  let end = first;
  let gap = 0;
  for (let i = first; i < rows.length; i++) {
    const r = rows[i];
    if (r.type === "folded") break;
    if (isChange(r)) {
      end = i;
      gap = 0;
    } else if (++gap > context * 2) break;
  }
  let stop = end;
  while (stop + 1 < rows.length && stop - end < context && rows[stop + 1].type === "unchanged") stop++;

  const body: string[] = [];
  let used = 0;
  for (let i = start; i <= stop; i++) {
    const r = rows[i];
    const line = r.type === "add" ? `+${r.lineB}` : r.type === "del" ? `-${r.lineA}` : ` ${r.lineA}`;
    if (used + line.length + 1 > maxChars - 40) break; // leave room for the header
    body.push(line);
    used += line.length + 1;
  }
  // A single enormous line can push every change past the limit.
  if (!body.some((l) => l[0] !== " ")) return null;

  const lenA = body.filter((l) => l[0] !== "+").length;
  const lenB = body.filter((l) => l[0] !== "-").length;
  // An empty side means the hunk sits at the very top of that file (any
  // preceding line would have been included as context), which unified diff
  // writes as `0,0`.
  const startA = lenA ? firstLineNum(rows, start, "A") ?? 1 : 0;
  const startB = lenB ? firstLineNum(rows, start, "B") ?? 1 : 0;
  return `@@ -${startA},${lenA} +${startB},${lenB} @@\n${body.join("\n")}\n`;
};

const firstLineNum = (rows: DiffRow[], from: number, side: "A" | "B"): number | null => {
  for (let i = from; i < rows.length; i++) {
    const n = side === "A" ? rows[i].lineNumA : rows[i].lineNumB;
    if (n != null) return n;
  }
  return null;
};

/** Both sides of a hunk, for loading into the editors. */
export const splitHunk = (hunk: string): { orig: string; mod: string } => {
  const orig: string[] = [];
  const mod: string[] = [];
  for (const line of hunk.split("\n")) {
    if (line.startsWith("@@") || line === "" || line.startsWith("\\")) continue;
    const body = line.slice(1);
    if (line[0] !== "+") orig.push(body);
    if (line[0] !== "-") mod.push(body);
  }
  return { orig: orig.join("\n"), mod: mod.join("\n") };
};

/** A complete patch for one file, ready for `git apply`. */
export const hunkToPatch = (hunk: string, fileName = "file.txt"): string => {
  const name = fileName.replace(/^[ab]\//, "").replace(/\s+/g, "_") || "file.txt";
  return `--- a/${name}\n+++ b/${name}\n${hunk.endsWith("\n") ? hunk : hunk + "\n"}`;
};

/** 2006-era timestamps: "3m ago", "5h ago", then "Oct 7, 2026". */
export const relativeTime = (ms: number, now = Date.now()): string => {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/** Splits a caption into text and #tag pieces for highlighting. */
export const captionParts = (caption: string): { text: string; tag: boolean }[] => {
  const parts: { text: string; tag: boolean }[] = [];
  let last = 0;
  for (const m of caption.matchAll(/(^|[^\w&])(#[A-Za-z][\w-]{0,29})/g)) {
    const at = (m.index ?? 0) + m[1].length;
    if (at > last) parts.push({ text: caption.slice(last, at), tag: false });
    parts.push({ text: m[2], tag: true });
    last = at + m[2].length;
  }
  if (last < caption.length) parts.push({ text: caption.slice(last), tag: false });
  return parts;
};

/** Milliseconds left before this browser may post again (0 = ready). */
export const cooldownRemaining = (now = Date.now()): number => {
  try {
    const last = Number(sessionStorage.getItem(FEED_LAST_POST_KEY));
    if (!last) return 0;
    return Math.max(0, last + FEED_COOLDOWN_MS - now);
  } catch {
    return 0;
  }
};

export const markPosted = (now = Date.now()) => {
  try {
    sessionStorage.setItem(FEED_LAST_POST_KEY, String(now));
  } catch {
    /* storage unavailable — cooldown simply doesn't apply */
  }
};
