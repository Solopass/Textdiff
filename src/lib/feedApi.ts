/**
 * Firestore access for the Diff Feed. Imported lazily — only the feed drawer
 * and composer use it, so Firebase stays off first paint.
 */
import { getDb } from "../firebase";
import { FEED_COLLECTION, FEED_PAGE_SIZE, type FeedItem, type FeedStats } from "./feed";

// One shared import. fetchFeed and fetchPost run concurrently on a permalink,
// and two simultaneous first imports of a mocked module race in Vitest (one
// gets the real SDK). Browsers dedupe anyway; this just makes tests honest.
let firestoreModule: Promise<typeof import("firebase/firestore")> | null = null;
const loadFirestore = () => (firestoreModule ??= import("firebase/firestore"));

export interface NewPost {
  author: string;
  caption: string;
  tags: string[];
  stats: FeedStats;
  hunk?: string;
  fileName?: string;
  fullShareId?: string;
}

const toItem = (id: string, d: any): FeedItem | null => {
  // Server timestamps are null in the local echo of a just-written document.
  const ts = d?.timestamp;
  const timestamp = typeof ts?.toMillis === "function" ? ts.toMillis() : typeof ts === "number" ? ts : Date.now();
  if (typeof d?.caption !== "string" || typeof d?.author !== "string" || !d.stats) return null;
  return {
    id,
    author: d.author,
    caption: d.caption,
    tags: Array.isArray(d.tags) ? d.tags.filter((t: unknown) => typeof t === "string") : [],
    timestamp,
    hunk: typeof d.hunk === "string" ? d.hunk : undefined,
    fileName: typeof d.fileName === "string" ? d.fileName : undefined,
    fullShareId: typeof d.fullShareId === "string" ? d.fullShareId : undefined,
    stats: {
      additions: Number(d.stats.additions) || 0,
      deletions: Number(d.stats.deletions) || 0,
      similarity: Number(d.stats.similarity) || 0,
      language: String(d.stats.language ?? ""),
    },
  };
};

/** Newest first. Strictly chronological — no ranking of any kind. */
export const fetchFeed = async (): Promise<FeedItem[]> => {
  const [{ collection, getDocs, limit, orderBy, query }, db] = await Promise.all([
    loadFirestore(),
    getDb(),
  ]);
  const snap = await getDocs(
    query(collection(db, FEED_COLLECTION), orderBy("timestamp", "desc"), limit(FEED_PAGE_SIZE)),
  );
  return snap.docs.map((d: any) => toItem(d.id, d.data())).filter(Boolean) as FeedItem[];
};

export const fetchPost = async (id: string): Promise<FeedItem | null> => {
  const [{ doc, getDoc }, db] = await Promise.all([loadFirestore(), getDb()]);
  const snap = await getDoc(doc(db, FEED_COLLECTION, id));
  return snap.exists() ? toItem(snap.id, snap.data()) : null;
};

export const createPost = async (post: NewPost): Promise<FeedItem> => {
  const [{ addDoc, collection, serverTimestamp }, db] = await Promise.all([
    loadFirestore(),
    getDb(),
  ]);
  // Optional fields are omitted rather than sent as undefined — the rules pin
  // the allowed key set and Firestore rejects undefined values outright.
  const data: Record<string, unknown> = {
    author: post.author,
    caption: post.caption,
    tags: post.tags,
    stats: post.stats,
    // The server's clock, not ours: rules require timestamp == request.time,
    // so nobody can backdate a post or pin one to the top with a future date.
    timestamp: serverTimestamp(),
  };
  if (post.hunk) data.hunk = post.hunk;
  if (post.fileName) data.fileName = post.fileName;
  if (post.fullShareId) data.fullShareId = post.fullShareId;
  const ref = await addDoc(collection(db, FEED_COLLECTION), data);
  return { id: ref.id, ...post, timestamp: Date.now() };
};
