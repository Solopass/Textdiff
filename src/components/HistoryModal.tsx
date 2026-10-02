import React, { useRef } from "react";
import { History, X } from "lucide-react";
import type { HistoryItem } from "../lib/types";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
}

export const HistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  history,
  onRestore,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { active: isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-[#020617] border border-[#334155] max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center p-4 border-b border-[#334155] bg-[#1E293B]">
          <h3 id="history-modal-title" className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-[#34D399]" />
            Diff History
          </h3>
          <button
            onClick={onClose}
            aria-label="Close diff history"
            className="text-[#94A3B8] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs">
          {history.length === 0 ? (
            <div className="text-center text-[#64748B] py-8">
              No history available yet.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="border border-[#334155] bg-[#0F172A] p-3 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-center text-[#94A3B8] text-[10px]">
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                    <button
                      onClick={() => onRestore(item)}
                      className="px-2 py-1 bg-[#1E293B] hover:bg-[#334155] text-white transition-colors border border-[#334155]"
                    >
                      RESTORE
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[#E2E8F0] opacity-80">
                    <div className="bg-black p-2 overflow-hidden whitespace-nowrap text-ellipsis border border-[#1E293B]">
                      {item.origText.split("\n")[0] || "(empty)"}
                    </div>
                    <div className="bg-black p-2 overflow-hidden whitespace-nowrap text-ellipsis border border-[#1E293B]">
                      {item.modText.split("\n")[0] || "(empty)"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
