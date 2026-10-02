/**
 * Keyboard shortcut reference.
 *
 * Purely presentational — it depends on nothing but its own open/close state,
 * which is why it was the safest ~110 lines to lift out of App.tsx.
 */
import React, { useRef } from "react";
import { Keyboard, X } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";

type Props = {
  onClose: () => void;
};

export function ShortcutsModal({ onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { active: true, onClose });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-[#020617] border border-[#334155] max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center p-4 border-b border-[#334155] bg-[#1E293B]">
          <h3 id="shortcuts-modal-title" className="text-sm font-bold text-white flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#34D399]" />
            Keyboard Shortcuts
          </h3>
          <button
            onClick={() => onClose()}
            aria-label="Close keyboard shortcuts"
            className="text-[#94A3B8] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 font-mono text-xs">
          <ul className="space-y-4 text-[#94A3B8]">
            <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
              <span>Command Palette</span>
              <span className="flex gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">Ctrl</kbd>{" "}
                +{" "}
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">K</kbd>
              </span>
            </li>
            <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
              <span>Close dialog</span>
              <span className="flex gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">Esc</kbd>
              </span>
            </li>
            <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
              <span>Run Comparison</span>
              <span className="flex gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  Ctrl
                </kbd>{" "}
                +{" "}
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  Enter
                </kbd>
              </span>
            </li>
            <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
              <span>Swap Texts</span>
              <span className="flex gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  Ctrl
                </kbd>{" "}
                +{" "}
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  Shift
                </kbd>{" "}
                +{" "}
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  S
                </kbd>
              </span>
            </li>
            <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
              <span>Find in Text</span>
              <span className="flex gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  Ctrl
                </kbd>{" "}
                +{" "}
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  F
                </kbd>
              </span>
            </li>
            <li className="flex justify-between items-center border-b border-[#1E293B] pb-2">
              <span>Next Search Match</span>
              <span className="flex gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  Enter
                </kbd>
              </span>
            </li>
            <li className="flex justify-between items-center">
              <span>Prev Search Match</span>
              <span className="flex gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  Shift
                </kbd>{" "}
                +{" "}
                <kbd className="px-1.5 py-0.5 bg-[#1E293B] border border-[#334155] rounded text-white">
                  Enter
                </kbd>
              </span>
            </li>
          </ul>

          <div className="mt-8 text-center">
            <button
              onClick={() => onClose()}
              className="px-4 py-2 border border-[#334155] bg-[#1E293B] text-white hover:bg-[#334155] transition-colors w-full"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
