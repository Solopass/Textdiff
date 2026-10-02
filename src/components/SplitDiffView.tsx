import React from "react";
import { TableVirtuoso } from "react-virtuoso";
import type { DiffRow } from "../lib/types";
import { highlightCode } from "../lib/highlight";
import { escapeHtml } from "../lib/sanitize";

interface EditingCell {
  side: "orig" | "mod";
  lineNum: number;
  text: string;
}

interface SplitDiffViewProps {
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

function renderCellContent(
  text: string,
  syntaxTheme: any,
  language: string,
  searchQuery?: string,
) {
  if (!searchQuery || !searchQuery.trim()) {
    return highlightCode(text, syntaxTheme, language);
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
    return highlightCode(text, syntaxTheme, language);
  }
  html += escapeHtml(text.slice(lastIdx));
  return html;
}

export const SplitDiffView: React.FC<SplitDiffViewProps> = ({
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
    <TableVirtuoso
      data={diffResult}
      initialItemCount={diffResult.length}
      useWindowScroll
      className="w-full border-collapse table-fixed min-w-[600px]"
      components={{
        Table: ({ style, ...props }) => (
          <table
            {...props}
            style={{
              ...style,
              width: "100%",
              tableLayout: "fixed",
            }}
            className="border-collapse min-w-[600px]"
          />
        ),
        TableBody: React.forwardRef((props, ref) => (
          <tbody {...props} ref={ref} />
        )),
        TableRow: ({ item, ...props }) => (
          <tr
            {...props}
            className={`border-b border-[#1E293B]/50 last:border-0 ${item.type === "add" || item.type === "del" ? "diff-row-changed" : ""}`}
          />
        ),
      }}
      itemContent={(_idx, item) => (
        <React.Fragment>
          {item.type === "folded" && (
            <td
              colSpan={showLineNums ? 4 : 2}
              className="py-2 text-center text-[#475569] bg-[#0F172A] border-y border-[#334155]"
            >
              <div className="flex items-center justify-center gap-2">
                <div className="h-px bg-[#334155] flex-1"></div>
                <span className="text-[10px] uppercase font-bold tracking-widest">
                  Unchanged Lines Folded
                </span>
                <div className="h-px bg-[#334155] flex-1"></div>
              </div>
            </td>
          )}

          {item.type === "unchanged" && (
            <>
              {showLineNums && (
                <td className="w-10 text-right text-[#64748B] bg-[#111827] border-r border-[#334155] select-none pr-2 py-0.5">
                  {item.lineNumA}
                </td>
              )}
              <td
                className={`p-0.5 px-3 align-top ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} text-[#94A3B8] cursor-text`}
                onDoubleClick={() =>
                  item.lineNumA !== null &&
                  onStartEdit("orig", item.lineNumA, item.lineA)
                }
                title="Double-click to edit line"
              >
                {editingCell &&
                editingCell.side === "orig" &&
                editingCell.lineNum === item.lineNumA ? (
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
                  <span
                    dangerouslySetInnerHTML={{
                      __html: renderCellContent(
                        item.lineA,
                        syntaxTheme,
                        language,
                        searchQuery,
                      ),
                    }}
                  />
                )}
              </td>

              {showLineNums && (
                <td className="w-10 text-right text-[#64748B] bg-[#111827] border-r border-l border-[#334155] select-none pr-2 py-0.5">
                  {item.lineNumB}
                </td>
              )}
              <td
                className={`p-0.5 px-3 align-top ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} text-[#94A3B8] cursor-text`}
                onDoubleClick={() =>
                  item.lineNumB !== null &&
                  onStartEdit("mod", item.lineNumB, item.lineB)
                }
                title="Double-click to edit line"
              >
                {editingCell &&
                editingCell.side === "mod" &&
                editingCell.lineNum === item.lineNumB ? (
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
                  <span
                    dangerouslySetInnerHTML={{
                      __html: renderCellContent(
                        item.lineB,
                        syntaxTheme,
                        language,
                        searchQuery,
                      ),
                    }}
                  />
                )}
              </td>
            </>
          )}

          {item.type === "del" && (
            <>
              {showLineNums && (
                <td className="w-10 text-right text-[#EF4444] bg-[#450a0a]/30 border-r border-[#EF4444]/30 select-none pr-2 py-0.5">
                  {item.lineNumA}
                </td>
              )}
              <td
                className={`p-0.5 px-3 align-top ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} bg-[#450a0a]/20 text-[#FCA5A5] border-r border-[#334155]/30 cursor-text`}
                onDoubleClick={() =>
                  item.lineNumA !== null &&
                  onStartEdit("orig", item.lineNumA, item.lineA)
                }
                title="Double-click to edit line"
              >
                {editingCell &&
                editingCell.side === "orig" &&
                editingCell.lineNum === item.lineNumA ? (
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
                    {item.partsA && !searchQuery ? (
                      item.partsA.map((part, i) => (
                        <span
                          key={i}
                          className={
                            part.type === "del"
                              ? "bg-[#EF4444]/40 text-white rounded-[2px]"
                              : ""
                          }
                          dangerouslySetInnerHTML={{
                            __html: highlightCode(
                              part.text,
                              syntaxTheme,
                              language,
                            ),
                          }}
                        />
                      ))
                    ) : (
                      <span
                        dangerouslySetInnerHTML={{
                          __html: renderCellContent(
                            item.lineA,
                            syntaxTheme,
                            language,
                            searchQuery,
                          ),
                        }}
                      />
                    )}
                  </>
                )}
              </td>

              {showLineNums && (
                <td className="w-10 bg-[#111827] border-r border-l border-[#334155] select-none"></td>
              )}
              <td className="p-0.5 px-3"></td>
            </>
          )}

          {item.type === "add" && (
            <>
              {showLineNums && (
                <td className="w-10 bg-[#111827] border-r border-[#334155] select-none"></td>
              )}
              <td className="p-0.5 px-3 border-r border-[#334155]/30"></td>

              {showLineNums && (
                <td className="w-10 text-right text-[#10B981] bg-[#064E3B]/30 border-r border-[#10B981]/30 border-l border-[#334155] select-none pr-2 py-0.5">
                  {item.lineNumB}
                </td>
              )}
              <td
                className={`p-0.5 px-3 align-top ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} bg-[#064E3B]/20 text-[#6EE7B7] cursor-text`}
                onDoubleClick={() =>
                  item.lineNumB !== null &&
                  onStartEdit("mod", item.lineNumB, item.lineB)
                }
                title="Double-click to edit line"
              >
                {editingCell &&
                editingCell.side === "mod" &&
                editingCell.lineNum === item.lineNumB ? (
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
                    {item.moved === "to" && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 font-medium mr-1.5 select-none"
                        title={`Moved from elsewhere (Block #${item.movedBlockId})`}
                      >
                        MOVED #{item.movedBlockId} ↶
                      </span>
                    )}
                    {item.partsB && !searchQuery ? (
                      item.partsB.map((part, i) => (
                        <span
                          key={i}
                          className={
                            part.type === "add"
                              ? "bg-[#10B981]/40 text-white rounded-[2px]"
                              : ""
                          }
                          dangerouslySetInnerHTML={{
                            __html: highlightCode(
                              part.text,
                              syntaxTheme,
                              language,
                            ),
                          }}
                        />
                      ))
                    ) : (
                      <span
                        dangerouslySetInnerHTML={{
                          __html: renderCellContent(
                            item.lineB,
                            syntaxTheme,
                            language,
                            searchQuery,
                          ),
                        }}
                      />
                    )}
                  </>
                )}
              </td>
            </>
          )}
        </React.Fragment>
      )}
    />
  );
};
