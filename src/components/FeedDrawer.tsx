import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy, ExternalLink, Link2, RefreshCw, X } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { captionParts, hunkToPatch, relativeTime, type FeedItem } from "../lib/feed";

interface Props {
  onClose: () => void;
  onOpenInStudio: (item: FeedItem) => void;
  /** Items posted this session, shown on top immediately. */
  localPosts: FeedItem[];
  /** Post to show first and highlight (from a `?post=` permalink). */
  focusPostId?: string | null;
}

export const permalinkFor = (id: string) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("post", id);
  return url.toString();
};

/** THE FEED — a strictly chronological, 2007-flavoured public stream. */
export const FeedDrawer: React.FC<Props> = ({ onClose, onOpenInStudio, localPosts, focusPostId }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, { active: true, onClose });
  const [items, setItems] = useState<FeedItem[]>([]);
  const [focused, setFocused] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string>("");
  const [now, setNow] = useState(Date.now());
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const api = await import("../lib/feedApi");
      const [list, post] = await Promise.all([
        api.fetchFeed(),
        focusPostId ? api.fetchPost(focusPostId) : Promise.resolve(null),
      ]);
      setItems(list);
      setFocused(post);
      if (focusPostId && !post) setError("That post doesn't exist (any more).");
    } catch (e) {
      console.error("Failed to load feed", e);
      setError(
        (e as { code?: string })?.code === "permission-denied"
          ? "The feed isn't available right now."
          : "Couldn't reach the feed. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, [focusPostId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1500);
    } catch {
      /* clipboard denied */
    }
  };

  // Local posts first, then the server list without duplicates.
  const seen = new Set<string>();
  const merged = [...(focused ? [focused] : []), ...localPosts, ...items].filter((i) =>
    seen.has(i.id) ? false : (seen.add(i.id), true),
  );

  const filtered = selectedTag
    ? merged.filter(
        (i) =>
          i.tags?.some((t) => t.toLowerCase() === selectedTag.toLowerCase()) ||
          i.stats.language?.toLowerCase() === selectedTag.toLowerCase(),
      )
    : merged;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal="true" aria-labelledby="feed-title">
      <div
        ref={panelRef}
        tabIndex={-1}
        className="retro-feed w-full max-w-md h-full flex flex-col bg-[#C0DEED] text-[#14171A] shadow-2xl animate-in slide-in-from-right duration-200"
      >
        <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[#9AE4E8] to-[#33CCFF]">
          <h2 id="feed-title" className="text-xl font-bold text-white tracking-tight [text-shadow:0_1px_0_#0084B4]">
            the feed
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={load} aria-label="Refresh feed" className="text-white/80 hover:text-white">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} aria-label="Close feed" className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {selectedTag && (
          <div className="flex items-center justify-between px-4 py-2 bg-[#E8F5FD] border-b border-[#AAB8C2] text-xs">
            <div className="flex items-center gap-1.5 text-[#14171A]">
              <span className="text-[#657786]">Filter:</span>
              <span className="font-bold text-[#0084B4]">#{selectedTag}</span>
              <span className="text-[#657786]">({filtered.length} {filtered.length === 1 ? "post" : "posts"})</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              aria-label="Clear tag filter"
              className="flex items-center gap-1 text-[#0084B4] hover:text-[#00698C] font-semibold text-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          <div className="bg-white rounded-md border border-[#AAB8C2]">
            {error && (
              <p role="alert" className="p-3 text-sm text-[#D40D12] border-b border-[#E1E8ED]">
                {error}
              </p>
            )}
            {!loading && merged.length === 0 && !error && (
              <p className="p-6 text-center text-sm text-[#657786]">Nothing here yet. Be the first to post a diff.</p>
            )}
            {!loading && merged.length > 0 && filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-[#657786]">
                <p>No posts matching #{selectedTag}.</p>
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="mt-2 text-[#0084B4] hover:underline font-medium text-xs cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            )}
            {loading && merged.length === 0 && <p className="p-6 text-center text-sm text-[#657786]">Loading…</p>}

            <ol>
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className={`p-3 border-b border-[#E1E8ED] last:border-b-0 ${item.id === focusPostId ? "bg-[#FFFCE5]" : ""}`}
                >
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-bold text-[#0084B4]">{item.author}</span>
                    <span className="text-[#AAB8C2] text-xs">{relativeTime(item.timestamp, now)}</span>
                    {item.stats.language && (
                      <button
                        type="button"
                        onClick={() => setSelectedTag(item.stats.language.toLowerCase())}
                        aria-label={`Filter by language #${item.stats.language}`}
                        className="text-[#657786] hover:text-[#0084B4] text-xs hover:underline cursor-pointer"
                      >
                        #{item.stats.language}
                      </button>
                    )}
                  </div>

                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                    {captionParts(item.caption).map((p, i) =>
                      p.tag ? (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedTag(p.text.replace(/^#/, "").toLowerCase())}
                          aria-label={`Filter by tag ${p.text}`}
                          className="text-[#0084B4] hover:underline cursor-pointer font-medium"
                        >
                          {p.text}
                        </button>
                      ) : (
                        <React.Fragment key={i}>{p.text}</React.Fragment>
                      ),
                    )}
                  </p>

                  <div className="mt-2 flex gap-2 text-[11px] font-mono">
                    <span className="text-[#2E7D32]">+{item.stats.additions}</span>
                    <span className="text-[#C62828]">-{item.stats.deletions}</span>
                    <span className="text-[#657786]">{item.stats.similarity}% similar</span>
                    {item.fileName && <span className="text-[#657786] truncate">{item.fileName}</span>}
                  </div>

                  {item.hunk && (
                    <pre className="mt-2 max-h-40 overflow-auto bg-[#F5F8FA] border border-[#E1E8ED] rounded p-2 font-mono text-[11px] leading-snug">
                      {item.hunk
                        .split("\n")
                        .filter((l) => l && !l.startsWith("@@"))
                        .map((l, i) => (
                          <div
                            key={i}
                            className={l[0] === "+" ? "text-[#2E7D32] bg-[#E1F5D4]" : l[0] === "-" ? "text-[#C62828] bg-[#FDE0E0]" : "text-[#657786]"}
                          >
                            {l}
                          </div>
                        ))}
                    </pre>
                  )}

                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {(item.hunk || item.fullShareId) && (
                      <button onClick={() => onOpenInStudio(item)} className="flex items-center gap-1 text-[#0084B4] hover:underline">
                        <ExternalLink className="w-3 h-3" /> OPEN IN STUDIO
                      </button>
                    )}
                    {item.hunk && (
                      <button
                        onClick={() => copy(`patch-${item.id}`, hunkToPatch(item.hunk!, item.fileName))}
                        className="flex items-center gap-1 text-[#0084B4] hover:underline"
                      >
                        {copied === `patch-${item.id}` ? <Check className="w-3 h-3" /> : <ClipboardCopy className="w-3 h-3" />}
                        COPY PATCH
                      </button>
                    )}
                    <button
                      onClick={() => copy(`link-${item.id}`, permalinkFor(item.id))}
                      className="flex items-center gap-1 text-[#0084B4] hover:underline"
                    >
                      {copied === `link-${item.id}` ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                      SHARE LINK
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-3 text-center text-[11px] text-[#657786]">
            Newest first. No algorithm, no ads, no likes.
          </p>
        </div>
      </div>
    </div>
  );
};
