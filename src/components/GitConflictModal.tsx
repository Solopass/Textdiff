import React, { useRef } from "react";
import { GitMerge, X, Sparkles } from "lucide-react";
import { SERVER_FEATURES_ENABLED, COMING_SOON_TITLE } from "../lib/constants";
import { useFocusTrap } from "../hooks/useFocusTrap";

export interface GitConflictParseResult {
  orig: string;
  mod: string;
  base?: string;
  isThreeWay: boolean;
}

export function parseGitConflict(text: string): GitConflictParseResult {
  const lines = text.split("\n");
  const orig: string[] = [];
  const mod: string[] = [];
  const base: string[] = [];
  let hasBase = false;
  let state: "normal" | "ours" | "base" | "theirs" = "normal";

  for (const line of lines) {
    if (line.startsWith("<<<<<<< ")) {
      state = "ours";
    } else if (line.startsWith("||||||| ")) {
      state = "base";
      hasBase = true;
    } else if (line.startsWith("=======")) {
      state = "theirs";
    } else if (line.startsWith(">>>>>>> ")) {
      state = "normal";
    } else {
      if (state === "normal") {
        orig.push(line);
        mod.push(line);
        base.push(line);
      } else if (state === "ours") {
        orig.push(line);
      } else if (state === "base") {
        base.push(line);
      } else if (state === "theirs") {
        mod.push(line);
      }
    }
  }

  return {
    orig: orig.join("\n"),
    mod: mod.join("\n"),
    base: hasBase ? base.join("\n") : undefined,
    isThreeWay: hasBase,
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conflictText: string;
  setConflictText: (t: string) => void;
  onResolveManual: (result: GitConflictParseResult) => void;
  onResolveAI: () => void;
  isResolvingAI: boolean;
}

export const GitConflictModal: React.FC<Props> = ({
  isOpen,
  onClose,
  conflictText,
  setConflictText,
  onResolveManual,
  onResolveAI,
  isResolvingAI,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { active: isOpen, onClose });

  if (!isOpen) return null;

  const handleManualParse = () => {
    const result = parseGitConflict(conflictText);
    onResolveManual(result);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="git-conflict-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-[#020617] border border-[#334155] rounded-xl w-full max-w-3xl flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="p-4 border-b border-[#334155] flex justify-between items-center bg-[#0F172A] rounded-t-xl">
          <h3 id="git-conflict-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-[#34D399]" />
            Git Conflict Resolver
          </h3>
          <button
            onClick={onClose}
            aria-label="Close Git conflict resolver"
            className="text-[#94A3B8] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
          <p className="text-[#94A3B8] text-sm">
            Paste a file containing standard Git conflict markers (
            <code className="bg-[#1E293B] px-1 py-0.5 rounded text-[#F472B6]">
              {"<<<<<<<"}
            </code>
            ,{" "}
            <code className="bg-[#1E293B] px-1 py-0.5 rounded text-[#60A5FA]">
              {"======="}
            </code>
            ,{" "}
            <code className="bg-[#1E293B] px-1 py-0.5 rounded text-[#34D399]">
              {">>>>>>>"}
            </code>
            ). TextDiff Studio will automatically parse it and load it into the
            3-Way Merge editor.
          </p>
          <textarea
            value={conflictText}
            onChange={(e) => setConflictText(e.target.value)}
            placeholder={
              "<<<<<<< HEAD\nconsole.log('local changes');\n=======\nconsole.log('remote changes');\n>>>>>>> feature-branch"
            }
            className="w-full flex-1 min-h-[300px] bg-[#0A0A0C] border border-[#334155] rounded-md p-4 text-[#E2E8F0] font-mono text-xs focus:outline-none focus:border-[#34D399] resize-none"
          />
          <div className="flex gap-4">
            <button
              onClick={handleManualParse}
              disabled={!conflictText.trim()}
              className="w-full py-3 bg-[#34D399] text-[#064E3B] font-bold rounded hover:bg-[#10B981] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              MANUAL PARSE
            </button>
            <button
              onClick={onResolveAI}
              disabled={
                !SERVER_FEATURES_ENABLED ||
                !conflictText.trim() ||
                isResolvingAI
              }
              title={SERVER_FEATURES_ENABLED ? undefined : COMING_SOON_TITLE}
              className={`w-full flex items-center justify-center gap-2 py-3 bg-[#8B5CF6] text-white font-bold rounded transition-colors disabled:cursor-not-allowed shadow-[0_0_15px_rgba(139,92,246,0.4)] ${SERVER_FEATURES_ENABLED ? "hover:bg-[#7C3AED] disabled:opacity-50" : "opacity-40 grayscale"}`}
            >
              {isResolvingAI ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              AI RESOLVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
