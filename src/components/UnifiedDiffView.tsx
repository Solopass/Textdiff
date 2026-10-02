import React from "react";
import { Virtuoso } from "react-virtuoso";
import type { DiffRow } from "../lib/types";
import { highlightCode } from "../lib/highlight";
import { escapeHtml } from "../lib/sanitize";

interface EditingCell {
  side: "orig" | "mod";
  lineNum: number;
  text: string;
}

interface UnifiedDiffViewProps {
  diffResult: DiffRow[];
  showLineNums: boolean;
  wordWrap: boolean;
  syntaxTheme: any;
  language: string;
  searchQuery?: string;
  editingCell: EditingCell | null;
  onStartEdit: (side: "orig" | "mod", lineNum: number, text: string) => void;
  onUpdateEditText: (text: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
}

function renderUnifiedText(
  text: string,
  searchQuery?: string,
) {
  if (!searchQuery || !searchQuery.trim()) {
    return text;
  }
  const q = searchQuery.toLowerCase();
  const lower = text.toLowerCase();
  let pos = 0;
  let html = "";
  let lastIdx = 0;
  let hasMatch = false;

  while ((pos = lower.indexOf(q, pos)) !== -1) {
    hasMatch = true;
    html += escapeHtml(text.slice(lastIdx, pos));
    html += `<mark class="bg-amber-400/50 text-white font-bold rounded-sm px-0.5">${escapeHtml(text.slice(pos, pos + q.length))}</mark>`;
    lastIdx = pos + q.length;
    pos += q.length;
  }

  if (!hasMatch) {
    return text;
  }
  html += escapeHtml(text.slice(lastIdx));
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export const UnifiedDiffView: React.FC<UnifiedDiffViewProps> = ({
  diffResult,
  showLineNums,
  wordWrap,
  syntaxTheme,
  language,
  searchQuery,
  editingCell,
  onStartEdit,
  onUpdateEditText,
  onCommitEdit,
  onCancelEdit,
}) => {
  return (
    <Virtuoso
      data={diffResult}
      initialItemCount={diffResult.length}
      useWindowScroll
      className="w-full flex flex-col min-w-[600px] border border-[#1E293B]"
      itemContent={(idx, item) =>
        item.type === "folded" ? (
          <div
            key={idx}
            className="flex w-full py-2 text-center text-[#475569] bg-[#0F172A] border-y border-[#334155]"
          >
            <div className="flex items-center justify-center gap-2 w-full px-4">
              <div className="h-px bg-[#334155] flex-1"></div>
              <span className="text-[10px] uppercase font-bold tracking-widest">
                Unchanged Lines Folded
              </span>
              <div className="h-px bg-[#334155] flex-1"></div>
            </div>
          </div>
        ) : (
          <div
            key={idx}
            className={`flex border-b border-[#1E293B]/50 last:border-0 hover:bg-[#111827] transition-colors ${item.type === "add" || item.type === "del" ? "diff-row-changed" : ""} ${
              item.type === "del"
                ? "bg-[#450a0a]/20 text-[#FCA5A5]"
                : item.type === "add"
                  ? "bg-[#064E3B]/20 text-[#6EE7B7]"
                  : "text-[#94A3B8]"
            }`}
          >
            {showLineNums && (
              <div className="flex w-16 flex-shrink-0 bg-[#111827] text-[#64748B] border-r border-[#334155] select-none text-[10px]">
                <div className="w-1/2 text-right pr-1.5 py-0.5 border-r border-[#334155]/50">
                  {item.lineNumA}
                </div>
                <div className="w-1/2 text-right pr-1.5 py-0.5">
                  {item.lineNumB}
                </div>
              </div>
            )}
            <div
              className={`w-8 flex-shrink-0 text-center font-bold select-none border-r ${
                item.type === "del"
                  ? "border-[#EF4444]/30 bg-[#450a0a]/30 text-[#EF4444]"
                  : item.type === "add"
                    ? "border-[#10B981]/30 bg-[#064E3B]/30 text-[#10B981]"
                    : "border-[#334155] bg-[#111827] text-[#64748B]"
              } py-0.5`}
            >
              {item.type === "del"
                ? "-"
                : item.type === "add"
                  ? "+"
                  : " "}
            </div>
            <div
              className={`flex-1 px-3 py-0.5 ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} cursor-text`}
              onDoubleClick={() => {
                if (item.type === "del" && item.lineNumA !== null) {
                  onStartEdit("orig", item.lineNumA, item.lineA);
                } else if (item.type === "add" && item.lineNumB !== null) {
                  onStartEdit("mod", item.lineNumB, item.lineB);
                } else if (item.type === "unchanged" && item.lineNumB !== null) {
                  onStartEdit("mod", item.lineNumB, item.lineB);
                }
              }}
              title="Double-click to edit line"
            >
              {editingCell &&
              ((editingCell.side === "orig" && editingCell.lineNum === item.lineNumA) ||
                (editingCell.side === "mod" && editingCell.lineNum === item.lineNumB)) ? (
                <div className="flex items-center gap-1.5 w-full py-0.5">
                  <input
                    type="text"
                    autoFocus
                    ref={(el) => el?.select()}
                    value={editingCell.text}
                    onChange={(e) => onUpdateEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onCommitEdit();
                      } else if (e.key === "Escape") {
                        onCancelEdit();
                      }
                    }}
                    className="flex-1 bg-[#020617] text-white border border-[#34D399] rounded px-2 py-0.5 text-xs font-mono outline-none shadow"
                  />
                  <button
                    type="button"
                    onClick={onCommitEdit}
                    title="Save (Enter)"
                    className="px-1.5 py-0.5 text-[10px] font-bold bg-[#064E3B] text-[#34D399] rounded hover:bg-[#064E3B]/80"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    title="Cancel (Esc)"
                    className="px-1.5 py-0.5 text-[10px] bg-[#334155] text-[#94A3B8] rounded hover:bg-[#475569]"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  {item.moved === "from" && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 font-medium mr-1.5 select-none"
                      title={`Moved elsewhere (Block #${item.movedBlockId})`}
                    >
                      MOVED #{item.movedBlockId} ↷
                    </span>
                  )}
                  {item.moved === "to" && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 font-medium mr-1.5 select-none"
                      title={`Moved from elsewhere (Block #${item.movedBlockId})`}
                    >
                      MOVED #{item.movedBlockId} ↶
                    </span>
                  )}
                  {item.type === "add" ? (
                    item.partsB && !searchQuery ? (
                      item.partsB.map((part, i) => (
                        <span
                          key={i}
                          className={
                            part.type === "add"
                              ? "bg-[#10B981]/40 text-white rounded-[2px]"
                              : ""
                          }
                        >
                          {part.text}
                        </span>
                      ))
                    ) : (
                      renderUnifiedText(item.lineB, searchQuery)
                    )
                  ) : item.type === "del" ? (
                    item.partsA && !searchQuery ? (
                      item.partsA.map((part, i) => (
                        <span
                          key={i}
                          className={
                            part.type === "del"
                              ? "bg-[#EF4444]/40 text-white rounded-[2px]"
                              : ""
                          }
                        >
                          {part.text}
                        </span>
                      ))
                    ) : (
                      renderUnifiedText(item.lineA, searchQuery)
                    )
                  ) : (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: highlightCode(
                          item.lineA,
                          syntaxTheme,
                          language,
                        ),
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )
      }
    />
  );
};
