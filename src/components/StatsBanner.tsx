import React from "react";
import {
  Download,
  FileText,
  FileCode,
  Lock,
  Maximize,
  Minimize,
} from "lucide-react";

export interface DiffStatsProps {
  similarity: number;
  addCount: number;
  delCount: number;
  unchangedCount: number;
}

interface Props {
  stats: DiffStatsProps;
  onCopyReport: () => void;
  onCopyPatch?: () => void;
  onExportPatch: () => void;
  onExportCsv: () => void;
  onExportMd: () => void;
  onExportJson: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onExportPng: () => void;
  onExportArchive?: () => void;
  isExporting: "png" | "pdf" | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const StatsBanner: React.FC<Props> = ({
  stats,
  onCopyReport,
  onCopyPatch,
  onExportPatch,
  onExportCsv,
  onExportMd,
  onExportJson,
  onExportHtml,
  onExportPdf,
  onExportPng,
  onExportArchive,
  isExporting,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const totalChanges = stats.addCount + stats.delCount;

  return (
    <section className="bg-[#111827] border border-[#334155] p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-around gap-6">
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1 font-serif italic">
            Similarity
          </span>
          <span className="text-xl font-mono text-[#34D399]">
            {stats.similarity}%
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1 font-serif italic">
            Additions
          </span>
          <span className="text-xl font-mono text-[#10B981]">
            +{stats.addCount}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1 font-serif italic">
            Deletions
          </span>
          <span className="text-xl font-mono text-[#EF4444]">
            -{stats.delCount}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1 font-serif italic">
            Unchanged
          </span>
          <span className="text-xl font-mono text-[#94A3B8]">
            {stats.unchangedCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopyReport}
            className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono"
          >
            COPY_REPORT
          </button>
          {onCopyPatch && (
            <button
              onClick={onCopyPatch}
              className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono"
              title="Copy Unified Diff Patch to clipboard"
            >
              COPY_PATCH
            </button>
          )}
          <button
            onClick={onExportPatch}
            className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT_PATCH
          </button>
          <button
            onClick={onExportCsv}
            className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT_CSV
          </button>
          <button
            onClick={onExportMd}
            className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
          >
            <FileText className="w-3.5 h-3.5" />
            EXPORT_MD
          </button>
          <button
            onClick={onExportJson}
            className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT_JSON
          </button>
          {onExportArchive && (
            <button
              onClick={onExportArchive}
              className="px-3 py-1.5 border border-[#B45309] bg-[#78350F] text-[#FDE68A] hover:bg-[#B45309] transition-colors text-xs font-mono flex items-center gap-2"
              title="Export Encrypted Archive (.tds.enc)"
            >
              <Lock className="w-3.5 h-3.5" />
              EXPORT_ENC
            </button>
          )}
          <button
            onClick={onExportHtml}
            className="px-3 py-1.5 border border-[#1D4ED8] bg-[#1E3A8A] text-[#93C5FD] hover:bg-[#1D4ED8] transition-colors text-xs font-mono flex items-center gap-2"
          >
            <FileCode className="w-3.5 h-3.5" />
            EXPORT_HTML
          </button>
          <button
            onClick={onExportPdf}
            disabled={isExporting !== null}
            aria-busy={isExporting === "pdf"}
            className="px-3 py-1.5 border border-[#065F46] bg-[#064E3B] text-[#34D399] hover:bg-[#065F46] transition-colors text-xs font-mono flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting === "pdf" ? (
              <span className="w-3.5 h-3.5 border-2 border-[#065F46] border-t-[#34D399] rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {isExporting === "pdf" ? "BUILDING..." : "EXPORT_PDF"}
          </button>
          <button
            onClick={onExportPng}
            disabled={isExporting !== null}
            aria-busy={isExporting === "png"}
            className="px-3 py-1.5 border border-[#6D28D9] bg-[#4C1D95] text-[#C4B5FD] hover:bg-[#6D28D9] transition-colors text-xs font-mono flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting === "png" ? (
              <span className="w-3.5 h-3.5 border-2 border-[#6D28D9] border-t-[#C4B5FD] rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {isExporting === "png" ? "BUILDING..." : "EXPORT_PNG"}
          </button>
          <button
            onClick={onToggleFullscreen}
            className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors text-xs font-mono flex items-center gap-2"
          >
            {isFullscreen ? (
              <Minimize className="w-3.5 h-3.5" />
            ) : (
              <Maximize className="w-3.5 h-3.5" />
            )}
            {isFullscreen ? "EXIT_FULLSCREEN" : "FULLSCREEN"}
          </button>
        </div>
      </div>

      <div className="w-full flex flex-col gap-1">
        <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
          <span>Change Breakdown</span>
          <span>{totalChanges} Total Changes</span>
        </div>
        <div className="w-full h-1.5 flex rounded-full overflow-hidden bg-[#1E293B]">
          {totalChanges > 0 ? (
            <>
              <div
                style={{
                  width: `${(stats.addCount / totalChanges) * 100}%`,
                }}
                className="bg-[#10B981]"
                title={`Additions: ${stats.addCount}`}
              />
              <div
                style={{
                  width: `${(stats.delCount / totalChanges) * 100}%`,
                }}
                className="bg-[#EF4444]"
                title={`Deletions: ${stats.delCount}`}
              />
            </>
          ) : (
            <div className="w-full bg-[#475569]" title="No changes" />
          )}
        </div>
      </div>
    </section>
  );
};
