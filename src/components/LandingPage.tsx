import React from 'react';
import { ArrowRight, FileText, SplitSquareHorizontal } from 'lucide-react';

interface Props {
  onEnter: () => void;
}

export const LandingPage: React.FC<Props> = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-[#020617] text-[#E2E8F0] flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-[#0F172A] border border-[#334155] rounded-xl flex items-center justify-center shadow-2xl">
            <SplitSquareHorizontal className="w-10 h-10 text-[#34D399]" />
          </div>
        </div>
        
        <h1 className="text-5xl font-bold tracking-tight text-white">
          TextDiff <span className="text-[#34D399]">Studio</span>
        </h1>
        
        <p className="text-xl text-[#94A3B8] leading-relaxed max-w-xl mx-auto">
          The ultimate, high-performance text and code comparison tool. Compare massive files, resolve 3-way merges, and share results instantly.
        </p>

        <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-8 text-left grid gap-6 shadow-2xl">
          <h2 className="text-sm font-bold tracking-widest text-white uppercase border-b border-[#334155] pb-4">
            Brief Instructions
          </h2>
          <ul className="space-y-4 text-[#94A3B8]">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#1E293B] flex items-center justify-center text-[#34D399] font-bold text-xs shrink-0 mt-0.5">1</span>
              <span><strong>Input your text:</strong> Type, paste, or drag-and-drop your original and modified files into the respective editor panels.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#1E293B] flex items-center justify-center text-[#34D399] font-bold text-xs shrink-0 mt-0.5">2</span>
              <span><strong>Run the diff:</strong> Click the <em>Run Diff</em> button or use <kbd className="bg-[#334155] px-1.5 py-0.5 rounded text-xs">Ctrl+Enter</kbd> to generate the comparison.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#1E293B] flex items-center justify-center text-[#34D399] font-bold text-xs shrink-0 mt-0.5">3</span>
              <span><strong>Review results:</strong> Use the diff viewer below to analyze changes. You can toggle between side-by-side and inline views.</span>
            </li>
          </ul>
        </div>

        <button 
          onClick={onEnter}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#34D399] text-[#064E3B] font-bold text-lg rounded hover:bg-[#10B981] transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(52,211,153,0.3)] mt-8"
        >
          Open Studio
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
