import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";

export type Command = {
  id: string;
  /** Shown as the primary label. */
  title: string;
  /** Grouping label, e.g. "View" or "Export". */
  group: string;
  /** Displayed shortcut hint, e.g. "Ctrl+Enter". Purely informational. */
  shortcut?: string;
  /** Extra terms that should match this command but aren't in the title. */
  keywords?: string;
  /** Marks a command as unavailable; it renders greyed out and won't run. */
  disabled?: boolean;
  run: () => void;
};

/**
 * Subsequence fuzzy match, the same idea most editors use: every character of
 * the query must appear in order, but not necessarily adjacently, so "expdf"
 * finds "Export PDF".
 *
 * Returns null for no match, otherwise a score where lower is better.
 * Consecutive hits and hits at word boundaries are rewarded so that a typed
 * prefix ranks above a scattered match.
 */
export const fuzzyScore = (haystack: string, needle: string): number | null => {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();

  let score = 0;
  let hIdx = 0;
  let lastHit = -1;

  for (const char of n) {
    const found = h.indexOf(char, hIdx);
    if (found === -1) return null;
    // Penalise gaps between matched characters.
    score += found - hIdx;
    // Reward matches that start a word.
    if (found === 0 || h[found - 1] === " " || h[found - 1] === "_") score -= 2;
    // Reward runs of adjacent characters.
    if (found === lastHit + 1) score -= 1;
    lastHit = found;
    hIdx = found + 1;
  }
  return score;
};

type Props = {
  open: boolean;
  onClose: () => void;
  commands: Command[];
};

export function CommandPalette({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset each time it opens so it never reappears mid-search.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus after paint, otherwise the element isn't mounted yet.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const scored = commands
      .map((cmd) => {
        const haystack = `${cmd.title} ${cmd.group} ${cmd.keywords ?? ""}`;
        const score = fuzzyScore(haystack, query.trim());
        return score === null ? null : { cmd, score };
      })
      .filter((x): x is { cmd: Command; score: number } => x !== null);

    // Stable ordering: better score first, then original declaration order so
    // an empty query shows the list exactly as authored.
    scored.sort((a, b) => a.score - b.score);
    return scored.map((x) => x.cmd);
  }, [commands, query]);

  // Clamp the cursor when the result set shrinks under it.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  /**
   * Escape is handled at the window level, in the capture phase, rather than
   * only via the onKeyDown below.
   *
   * The inner handler needs focus to already be inside the palette, but focus
   * is moved to the input in a requestAnimationFrame. An Escape pressed in
   * that gap hit neither handler: the palette's, because focus was still on
   * whatever opened it, and the app's, because the app deliberately ignores
   * Escape while the palette is open. The result was a palette that couldn't
   * be dismissed by keyboard until you clicked into it first.
   *
   * Capture phase + stopPropagation also guarantees the app's window listener
   * never sees this Escape, so one keypress can't close a dialog underneath.
   */
  useEffect(() => {
    if (!open) return;
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const runCommand = (cmd: Command | undefined) => {
    if (!cmd || cmd.disabled) return;
    onClose();
    // Defer so the palette unmounts before the action runs — some commands
    // open other modals and would otherwise fight over focus.
    setTimeout(() => cmd.run(), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      runCommand(results[activeIndex]);
    }
    // Escape is deliberately not handled here — the window-level capture
    // listener above owns it, so it works regardless of where focus is.
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(e) => {
        // Only dismiss on backdrop clicks, not drags that end on the backdrop.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#0F172A] border border-[#334155] w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#334155]">
          <Search className="w-4 h-4 text-[#94A3B8] shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command..."
            aria-label="Search commands"
            aria-controls="command-palette-list"
            aria-activedescendant={
              results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined
            }
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#64748B]"
          />
          <kbd className="text-[10px] text-[#64748B] border border-[#334155] px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="Commands"
          className="max-h-[50vh] overflow-y-auto py-1"
        >
          {results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[#64748B]">
              No commands match "{query}"
            </p>
          )}

          {results.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {showGroup && (
                  <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[#64748B] font-bold">
                    {cmd.group}
                  </div>
                )}
                <div
                  id={`cmd-${cmd.id}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === activeIndex}
                  aria-disabled={cmd.disabled || undefined}
                  onMouseMove={() => setActiveIndex(i)}
                  onClick={() => runCommand(cmd)}
                  className={`px-4 py-2 flex items-center justify-between gap-3 text-sm ${
                    cmd.disabled
                      ? "text-[#475569] cursor-not-allowed"
                      : "cursor-pointer text-[#E2E8F0]"
                  } ${i === activeIndex && !cmd.disabled ? "bg-[#1E293B]" : ""}`}
                >
                  <span className="truncate">{cmd.title}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {cmd.shortcut && (
                      <kbd className="text-[10px] text-[#94A3B8] border border-[#334155] px-1.5 py-0.5 font-mono">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {i === activeIndex && !cmd.disabled && (
                      <CornerDownLeft
                        className="w-3.5 h-3.5 text-[#34D399]"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
