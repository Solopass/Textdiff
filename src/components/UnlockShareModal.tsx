import React, { useEffect, useRef, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves on success; rejects with a user-facing message on a wrong password. */
  onUnlock: (passphrase: string) => Promise<void>;
}

/** Asks for the password of a passphrase-protected share link. */
export const UnlockShareModal: React.FC<Props> = ({ isOpen, onClose, onUnlock }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { active: isOpen, onClose });
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPassphrase("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || busy) return;
    setBusy(true);
    setError("");
    try {
      await onUnlock(passphrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-[#020617] border border-[#334155] max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center p-4 border-b border-[#334155] bg-[#1E293B]">
          <h3 id="unlock-modal-title" className="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#34D399]" />
            Password-protected share
          </h3>
          <button onClick={onClose} aria-label="Close unlock dialog" className="text-[#94A3B8] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 flex flex-col gap-3 font-mono text-xs">
          <p className="text-[#94A3B8] leading-relaxed">
            This comparison is encrypted. Enter the password the sender gave you — it is checked here in your
            browser and never sent anywhere.
          </p>
          <label className="flex flex-col gap-1 text-[#94A3B8]">
            PASSWORD
            <input
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="bg-black border border-[#334155] text-[#E2E8F0] px-2 py-1.5"
            />
          </label>
          {error && (
            <p role="alert" className="text-[#F87171]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!passphrase || busy}
            className="self-end px-4 py-1.5 bg-[#34D399] text-black font-bold hover:bg-[#10B981] disabled:opacity-40"
          >
            {busy ? "DECRYPTING..." : "UNLOCK"}
          </button>
        </form>
      </div>
    </div>
  );
};
