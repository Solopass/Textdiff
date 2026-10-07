import React, { useEffect, useMemo, useRef, useState } from "react";
import { Globe, Megaphone, X } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { DiffRow } from "../lib/diffStats";
import {
  FEED_CAPTION_MAX,
  FEED_HANDLE_KEY,
  cooldownRemaining,
  extractTags,
  firstHunk,
  normalizeHandle,
} from "../lib/feed";

export interface ComposerSubmit {
  caption: string;
  handle: string;
  includeHunk: boolean;
  attachFull: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stats: { additions: number; deletions: number; similarity: number; language: string };
  fileName?: string;
  /** Rows of the current diff; the first hunk is taken from these. */
  rows: DiffRow[] | null;
  onPost: (input: ComposerSubmit & { hunk: string | null }) => Promise<void>;
}

const readHandle = () => {
  try {
    return localStorage.getItem(FEED_HANDLE_KEY) ?? "";
  } catch {
    return "";
  }
};

/** The "POST TO FEED" micro-composer. */
export const FeedComposerModal: React.FC<Props> = ({ isOpen, onClose, stats, fileName, rows, onPost }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { active: isOpen, onClose });
  const hunk = useMemo(() => (rows ? firstHunk(rows) : null), [rows]);

  const [caption, setCaption] = useState("");
  const [handle, setHandle] = useState(readHandle);
  const [includeHunk, setIncludeHunk] = useState(true);
  const [attachFull, setAttachFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(cooldownRemaining());

  // Tick the cooldown down so the button re-enables on its own.
  useEffect(() => {
    if (!isOpen || wait <= 0) return;
    const t = setInterval(() => setWait(cooldownRemaining()), 1000);
    return () => clearInterval(t);
  }, [isOpen, wait]);

  if (!isOpen) return null;

  const remaining = FEED_CAPTION_MAX - caption.length;
  const over = remaining < 0;
  const canPost = !busy && !over && caption.trim().length > 0 && wait <= 0;
  const tags = extractTags(caption);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost) return;
    setBusy(true);
    setError("");
    try {
      await onPost({
        caption: caption.trim(),
        handle: normalizeHandle(handle),
        includeHunk: includeHunk && !!hunk,
        attachFull,
        hunk,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setWait(cooldownRemaining());
    } finally {
      setBusy(false);
    }
  };

  const previewLines = hunk ? hunk.split("\n").filter((l) => l[0] === "+" || l[0] === "-").slice(0, 5) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feed-composer-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="retro-feed bg-[#F5F8FA] text-[#14171A] border-2 border-[#33CCFF] max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200 rounded-md"
      >
        <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-b from-[#9AE4E8] to-[#33CCFF] rounded-t-md">
          <h3 id="feed-composer-title" className="text-base font-bold text-white flex items-center gap-2 [text-shadow:0_1px_0_#0084B4]">
            <Megaphone className="w-4 h-4" />
            What are you diffing?
          </h3>
          <button onClick={onClose} aria-label="Close composer" className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 flex flex-col gap-3 text-sm">
          <div className="relative">
            <label htmlFor="feed-caption" className="sr-only">
              Caption
            </label>
            <textarea
              id="feed-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="Refactored the auth middleware. #typescript"
              aria-describedby="feed-counter"
              className="w-full border border-[#AAB8C2] rounded p-2 bg-white text-[#14171A] resize-none focus:outline-none focus:border-[#33CCFF]"
            />
            <span
              id="feed-counter"
              aria-live="polite"
              className={`absolute right-2 bottom-2 text-lg font-bold ${over ? "text-[#D40D12]" : remaining <= 20 ? "text-[#5C0002]" : "text-[#CCCCCC]"}`}
            >
              {remaining}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-[#E1F5D4] text-[#2E7D32]">+{stats.additions}</span>
            <span className="px-2 py-0.5 rounded bg-[#FDE0E0] text-[#C62828]">-{stats.deletions}</span>
            <span className="px-2 py-0.5 rounded bg-[#E8F5FD] text-[#0084B4]">{stats.similarity}% similar</span>
            {stats.language && <span className="px-2 py-0.5 rounded bg-[#EEE] text-[#555]">#{stats.language}</span>}
            {fileName && <span className="px-2 py-0.5 rounded bg-[#EEE] text-[#555] truncate max-w-[12rem]">{fileName}</span>}
            {tags.map((t) => (
              <span key={t} className="text-[#0084B4]">
                #{t}
              </span>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-[#657786]">
            Post as
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@anonymous"
              maxLength={30}
              aria-label="Author handle"
              className="flex-1 border border-[#AAB8C2] rounded px-2 py-1 bg-white text-[#14171A]"
            />
          </label>

          <label className={`flex items-start gap-2 text-xs ${hunk ? "text-[#14171A]" : "text-[#AAB8C2]"}`}>
            <input
              type="checkbox"
              checked={includeHunk && !!hunk}
              disabled={!hunk}
              onChange={(e) => setIncludeHunk(e.target.checked)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-1 min-w-0 flex-1">
              Include the first changed hunk
              {includeHunk && previewLines.length > 0 && (
                <pre className="bg-white border border-[#E1E8ED] rounded p-2 font-mono text-[11px] overflow-x-auto">
                  {previewLines.map((l, i) => (
                    <div key={i} className={l[0] === "+" ? "text-[#2E7D32]" : "text-[#C62828]"}>
                      {l}
                    </div>
                  ))}
                </pre>
              )}
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={attachFull} onChange={(e) => setAttachFull(e.target.checked)} className="mt-0.5" />
            <span>Attach the full comparison (as an open, unencrypted share link that expires in 30 days)</span>
          </label>

          <p className="flex items-start gap-2 text-xs text-[#657786] bg-[#FFFCE5] border border-[#F0E68C] rounded p-2">
            <Globe className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            The feed is public. Anyone can read what you post, and posts can't be edited or deleted.
          </p>

          {error && (
            <p role="alert" className="text-xs text-[#D40D12]">
              {error}
            </p>
          )}

          <div className="flex justify-end items-center gap-3">
            {wait > 0 && <span className="text-xs text-[#657786]">Wait {Math.ceil(wait / 1000)}s</span>}
            <button
              type="submit"
              disabled={!canPost}
              className="px-4 py-1.5 rounded font-bold text-white bg-gradient-to-b from-[#7FD3F7] to-[#33CCFF] border border-[#0084B4] shadow-[inset_0_1px_0_rgba(255,255,255,.5)] active:translate-y-px active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "posting..." : "POST DIFF"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
