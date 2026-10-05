import React from "react";
import {
  SplitSquareHorizontal,
  Rows,
  CheckSquare,
  Square,
  GitMerge,
  Palette,
  History,
  Github,
  Cloud,
  Users,
  Keyboard,
  Search,
  Trash2,
  ArrowLeftRight,
  Share2,
} from "lucide-react";
import { SERVER_FEATURES_ENABLED, COMING_SOON_TITLE } from "../lib/constants";

interface Props {
  // View mode
  viewMode: "split" | "unified";
  setViewMode: (mode: "split" | "unified") => void;
  isNarrow: boolean;

  // Comparison filters
  isThreeWay: boolean;
  setIsThreeWay: (v: boolean) => void;
  ignoreWs: boolean;
  onToggleIgnoreWs: (checked: boolean) => void;
  ignoreCase: boolean;
  onToggleIgnoreCase: (checked: boolean) => void;
  trimBlankLines: boolean;
  onToggleTrimBlankLines: (checked: boolean) => void;
  foldUnchanged: boolean;
  setFoldUnchanged: (v: boolean) => void;
  foldContext: number;
  setFoldContext: (v: number) => void;
  showLineNums: boolean;
  setShowLineNums: (v: boolean) => void;
  wordWrap: boolean;
  setWordWrap: (v: boolean) => void;

  // Modal / Panel toggles
  onOpenGitModal: () => void;
  onOpenCustomizeModal: () => void;
  onOpenHistoryModal: () => void;
  showGithubPanel: boolean;
  onToggleGithubPanel: () => void;
  onOpenCloudSyncModal: () => void;
  showMultiplayer: boolean;
  onToggleMultiplayer: () => void;
  onOpenHelpModal: () => void;
  onOpenPalette: () => void;

  // Actions
  onClear: () => void;
  onSwap: () => void;
  language: string;
  setLanguage: (lang: string) => void;
  onLoadSample: () => void;
  onShare: () => void;
  isSharing: boolean;
  onRunDiff: () => void;
}

export const StudioToolbar: React.FC<Props> = ({
  viewMode,
  setViewMode,
  isNarrow,
  isThreeWay,
  setIsThreeWay,
  ignoreWs,
  onToggleIgnoreWs,
  ignoreCase,
  onToggleIgnoreCase,
  trimBlankLines,
  onToggleTrimBlankLines,
  foldUnchanged,
  setFoldUnchanged,
  foldContext,
  setFoldContext,
  showLineNums,
  setShowLineNums,
  wordWrap,
  setWordWrap,
  onOpenGitModal,
  onOpenCustomizeModal,
  onOpenHistoryModal,
  showGithubPanel,
  onToggleGithubPanel,
  onOpenCloudSyncModal,
  showMultiplayer,
  onToggleMultiplayer,
  onOpenHelpModal,
  onOpenPalette,
  onClear,
  onSwap,
  language,
  setLanguage,
  onLoadSample,
  onShare,
  isSharing,
  onRunDiff,
}) => {
  return (
    <section className="bg-[#111827] border border-[#334155] p-3 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2 bg-[#020617] p-1 border border-[#334155]">
        <button
          onClick={() => setViewMode("split")}
          title={
            isNarrow
              ? "Split view is unavailable on small screens"
              : "Side-by-side view"
          }
          className={`flex items-center gap-2 px-3 py-1 text-xs font-mono font-medium transition-colors ${viewMode === "split" ? "bg-[#334155] text-white" : "text-[#64748B] hover:text-[#94A3B8]"} ${isNarrow ? "opacity-50" : ""}`}
        >
          <SplitSquareHorizontal className="w-3.5 h-3.5" />
          SIDE-BY-SIDE
        </button>
        <button
          onClick={() => setViewMode("unified")}
          className={`flex items-center gap-2 px-3 py-1 text-xs font-mono font-medium transition-colors ${viewMode === "unified" ? "bg-[#334155] text-white" : "text-[#64748B] hover:text-[#94A3B8]"}`}
        >
          <Rows className="w-3.5 h-3.5" />
          UNIFIED
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            className="hidden"
            checked={isThreeWay}
            onChange={(e) => setIsThreeWay(e.target.checked)}
          />
          {isThreeWay ? (
            <CheckSquare className="w-4 h-4 text-[#34D399]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          3-WAY_MERGE
        </label>
        <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            className="hidden"
            checked={ignoreWs}
            onChange={(e) => onToggleIgnoreWs(e.target.checked)}
          />
          {ignoreWs ? (
            <CheckSquare className="w-4 h-4 text-[#34D399]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          IGNORE_WS
        </label>
        <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            className="hidden"
            checked={ignoreCase}
            onChange={(e) => onToggleIgnoreCase(e.target.checked)}
          />
          {ignoreCase ? (
            <CheckSquare className="w-4 h-4 text-[#34D399]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          IGNORE_CASE
        </label>
        <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            className="hidden"
            checked={trimBlankLines}
            onChange={(e) => onToggleTrimBlankLines(e.target.checked)}
          />
          {trimBlankLines ? (
            <CheckSquare className="w-4 h-4 text-[#34D399]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          TRIM_BLANKS
        </label>
        <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            className="hidden"
            checked={foldUnchanged}
            onChange={(e) => setFoldUnchanged(e.target.checked)}
          />
          {foldUnchanged ? (
            <CheckSquare className="w-4 h-4 text-[#34D399]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          FOLD_UNCHANGED
        </label>
        {foldUnchanged && (
          <select
            value={foldContext}
            onChange={(e) => setFoldContext(Number(e.target.value))}
            aria-label="Fold context lines"
            className="bg-[#020617] border border-[#334155] text-xs font-mono text-[#34D399] rounded px-1.5 py-0.5 focus:border-[#34D399] outline-none"
          >
            <option value={1}>1 line</option>
            <option value={3}>3 lines</option>
            <option value={5}>5 lines</option>
            <option value={10}>10 lines</option>
          </select>
        )}
        <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors ml-2 border-l border-[#334155] pl-4">
          <input
            type="checkbox"
            className="hidden"
            checked={showLineNums}
            onChange={(e) => setShowLineNums(e.target.checked)}
          />
          {showLineNums ? (
            <CheckSquare className="w-4 h-4 text-[#34D399]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          LINE_NUMS
        </label>
        <label className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            className="hidden"
            checked={wordWrap}
            onChange={(e) => setWordWrap(e.target.checked)}
          />
          {wordWrap ? (
            <CheckSquare className="w-4 h-4 text-[#34D399]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          WORD_WRAP
        </label>
        <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] ml-2 border-l border-[#334155] pl-4">
          <button
            onClick={onOpenGitModal}
            className="px-2 py-1 bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white border border-[#334155] rounded text-[10px] mr-2 flex items-center gap-1"
            title="Resolve Git Conflict"
          >
            <GitMerge className="w-3 h-3" /> GIT
          </button>

          <button
            onClick={onOpenCustomizeModal}
            className="px-3 py-1.5 border border-[#6D28D9] bg-[#4C1D95] text-[#C4B5FD] hover:bg-[#6D28D9] transition-colors flex items-center gap-2 mr-2"
          >
            <Palette className="w-3.5 h-3.5" />
            CUSTOMIZE
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <button
          onClick={onOpenHistoryModal}
          className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2"
          title="Diff History"
        >
          <History className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onToggleGithubPanel}
          className={`px-3 py-1.5 border border-[#334155] ${showGithubPanel ? "bg-[#334155] text-white" : "bg-[#1E293B] text-[#E2E8F0]"} hover:bg-[#334155] transition-colors flex items-center gap-2`}
        >
          <Github className="w-3.5 h-3.5" /> GITHUB
        </button>
        <button
          onClick={onOpenCloudSyncModal}
          className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2"
          title="Cloud Sync / GitHub Gist"
        >
          <Cloud className="w-3.5 h-3.5" /> GIST
        </button>
        <button
          onClick={() => SERVER_FEATURES_ENABLED && onToggleMultiplayer()}
          disabled={!SERVER_FEATURES_ENABLED}
          title={SERVER_FEATURES_ENABLED ? undefined : COMING_SOON_TITLE}
          className={`px-3 py-1.5 border border-[#334155] ${showMultiplayer ? "bg-[#334155] text-[#34D399]" : "bg-[#1E293B] text-[#E2E8F0]"} transition-colors flex items-center gap-2 ${SERVER_FEATURES_ENABLED ? "hover:bg-[#334155]" : "opacity-40 grayscale cursor-not-allowed"}`}
        >
          <Users className="w-3.5 h-3.5" /> MULTIPLAYER
        </button>
        <button
          onClick={onOpenHelpModal}
          className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2"
          title="Keyboard Shortcuts"
        >
          <Keyboard className="w-3.5 h-3.5" />
          HELP
        </button>
        <button
          onClick={onOpenPalette}
          className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2"
          title="Command Palette (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          COMMANDS
          <kbd className="text-[9px] text-[#64748B] border border-[#334155] px-1 py-0.5 font-mono ml-1">
            ^K
          </kbd>
        </button>
        <button
          onClick={onClear}
          className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2 text-[#FCA5A5] hover:bg-[#450a0a]/30"
          title="Clear All Texts"
        >
          <Trash2 className="w-3.5 h-3.5" />
          CLEAR
        </button>
        <button
          onClick={onSwap}
          className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors flex items-center gap-2"
          title="Swap Texts (Ctrl+Shift+S)"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          SWAP
        </button>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Code language for syntax highlighting"
          className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors outline-none cursor-pointer"
        >
          <option value="javascript">JAVASCRIPT</option>
          <option value="typescript">TYPESCRIPT</option>
          <option value="python">PYTHON</option>
          <option value="json">JSON</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="markdown">MARKDOWN</option>
          <option value="sql">SQL</option>
          <option value="shell">SHELL / BASH</option>
          <option value="yaml">YAML</option>
          <option value="plain">PLAIN TEXT</option>
        </select>
        <button
          onClick={onLoadSample}
          className="px-3 py-1.5 border border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155] transition-colors"
        >
          LOAD_SAMPLE
        </button>
        <button
          onClick={onShare}
          className="px-3 py-1.5 border border-[#3B82F6] bg-[#2563EB] text-white hover:bg-[#3B82F6] transition-colors flex items-center gap-2"
        >
          {isSharing ? (
            <span className="animate-spin text-white">...</span>
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
          {isSharing ? "SHARING..." : "SHARE"}
        </button>
        <button
          onClick={onRunDiff}
          className="px-4 py-1.5 border border-[#065F46] bg-[#064E3B] text-[#34D399] hover:bg-[#065F46] active:scale-95 transition-all"
          title="Run Diff (Ctrl+Enter)"
        >
          RUN_DIFF
        </button>
      </div>
    </section>
  );
};
