import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, Flame, KeyRound, Link2, Lock, Share2, X } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { SHARE_TTL_DAYS } from "../lib/constants";

export type ShareProtection = "link-key" | "passphrase" | "recipient" | "none";

export interface ShareOptions {
  note: string;
  protection: ShareProtection;
  passphrase: string;
  recipientPublicKey?: string;
  burnAfterReading: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Creates the share and resolves to the URL, or rejects with a user-facing message. */
  onCreate: (opts: ShareOptions) => Promise<string>;
  isPro: boolean;
  onRequestPro: () => void;
}

const PROTECTIONS: { id: ShareProtection; label: string; hint: string; icon: React.ReactNode; isProOnly?: boolean }[] = [
  {
    id: "link-key",
    label: "ENCRYPTED LINK",
    hint: "AES-256 encrypted in your browser. The key rides in the link's #fragment, which is never sent to any server.",
    icon: <Link2 className="w-3.5 h-3.5" />,
  },
  {
    id: "passphrase",
    label: "PASSWORD",
    hint: "Encrypted with a key derived from a password. Send the password separately — the link alone opens nothing.",
    icon: <KeyRound className="w-3.5 h-3.5" />,
  },
  {
    id: "recipient",
    label: "RECIPIENT PUBLIC KEY",
    hint: "Encrypt specifically for your collaborator's public key (tdspub1:... or ssh-rsa). Only their private key can decrypt it.",
    icon: <Lock className="w-3.5 h-3.5 text-[#F59E0B]" />,
    isProOnly: true,
  },
  {
    id: "none",
    label: "OPEN",
    hint: "Stored unencrypted. Anyone with the link — and the database — can read it.",
    icon: <Share2 className="w-3.5 h-3.5" />,
  },
];

export const ShareModal: React.FC<Props> = ({ isOpen, onClose, onCreate, isPro, onRequestPro }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { active: isOpen, onClose });

  const [note, setNote] = useState("");
  const [protection, setProtection] = useState<ShareProtection>("link-key");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recipientKey, setRecipientKey] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [burn, setBurn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Each opening starts fresh — a stale link or password must not linger.
  useEffect(() => {
    if (isOpen) {
      setNote("");
      setPassphrase("");
      setConfirm("");
      setRecipientKey("");
      setKeyCopied(false);
      setBurn(false);
      setError("");
      setUrl("");
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const mismatch = protection === "passphrase" && confirm !== "" && passphrase !== confirm;
  const canSubmit =
    !busy &&
    (protection === "link-key" ||
      protection === "none" ||
      (protection === "passphrase" && passphrase.length > 0 && passphrase === confirm) ||
      (protection === "recipient" && isPro && recipientKey.trim().length > 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const link = await onCreate({
        note,
        protection,
        passphrase,
        recipientPublicKey: recipientKey.trim(),
        burnAfterReading: burn && isPro,
      });
      setUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      } catch {
        /* clipboard denied — the link is still shown for manual copy */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-[#020617] border border-[#334155] max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center p-4 border-b border-[#334155] bg-[#1E293B]">
          <h3 id="share-modal-title" className="text-sm font-bold text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#34D399]" />
            Share Comparison
          </h3>
          <button onClick={onClose} aria-label="Close share dialog" className="text-[#94A3B8] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {url ? (
          <div className="p-4 flex flex-col gap-3 font-mono text-xs">
            <p className="text-[#34D399] flex items-center gap-2">
              <Check className="w-4 h-4" />
              {copied ? "Link created and copied to clipboard." : "Link created."}
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                aria-label="Share link"
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 bg-black border border-[#334155] text-[#E2E8F0] px-2 py-1.5"
              />
              <button
                onClick={copy}
                className="px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] text-white border border-[#334155] flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> COPY
              </button>
            </div>
            <p className="text-[#94A3B8] leading-relaxed">
              {protection === "passphrase" && "Send the password through a different channel than the link. "}
              {protection === "recipient" && "Only the holder of the matching private key can decrypt this comparison. "}
              {burn && isPro
                ? "This link self-destructs the first time it is opened. "
                : `It expires in ${SHARE_TTL_DAYS} days. `}
              {protection === "none" && "Anyone with the link can read it."}
            </p>
            <button onClick={onClose} className="self-end px-4 py-1.5 bg-[#34D399] text-black font-bold hover:bg-[#10B981]">
              DONE
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-4 flex flex-col gap-4 font-mono text-xs overflow-y-auto">
            <label className="flex flex-col gap-1 text-[#94A3B8]">
              NOTE (optional)
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="What changed and why"
                className="bg-black border border-[#334155] text-[#E2E8F0] px-2 py-1.5"
              />
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-[#94A3B8] mb-1">PROTECTION</legend>
              {PROTECTIONS.map((p) => (
                <label
                  key={p.id}
                  className={`flex gap-2 p-2 border cursor-pointer ${protection === p.id ? "border-[#34D399] bg-[#0F172A]" : "border-[#334155]"}`}
                >
                  <input
                    type="radio"
                    name="share-protection"
                    value={p.id}
                    checked={protection === p.id}
                    onChange={() => {
                      if (p.isProOnly && !isPro) {
                        onRequestPro();
                        return;
                      }
                      setProtection(p.id);
                    }}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-white flex items-center gap-1.5">
                      {p.icon} {p.label}
                      {p.isProOnly && !isPro && (
                        <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-[#F59E0B] text-black font-bold flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> PRO
                        </span>
                      )}
                    </span>
                    <span className="text-[#64748B] leading-snug">{p.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {protection === "recipient" && (
              <div className="flex flex-col gap-2 p-3 bg-[#0F172A] border border-[#334155]">
                <label className="flex flex-col gap-1 text-[#94A3B8]">
                  RECIPIENT PUBLIC KEY
                  <textarea
                    rows={3}
                    value={recipientKey}
                    onChange={(e) => setRecipientKey(e.target.value)}
                    placeholder="Paste tdspub1:... or ssh-rsa AAAA..."
                    aria-label="Recipient public key"
                    className="bg-black border border-[#334155] text-[#E2E8F0] p-2 font-mono text-xs resize-none"
                  />
                </label>
                <div className="flex justify-between items-center text-[10px] text-[#64748B]">
                  <span>Recipient needs their matching private key to open.</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { generateAsymmetricKeyPair } = await import("../lib/crypto/asymmetric");
                        const pair = await generateAsymmetricKeyPair();
                        localStorage.setItem("tds_priv_key", pair.privateKey);
                        localStorage.setItem("tds_pub_key", pair.publicKey);
                        await navigator.clipboard.writeText(pair.publicKey);
                        setKeyCopied(true);
                        setTimeout(() => setKeyCopied(false), 2000);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="text-[#F59E0B] hover:underline cursor-pointer"
                  >
                    {keyCopied ? "✓ Public key copied!" : "Generate My Keypair"}
                  </button>
                </div>
              </div>
            )}

            {protection === "passphrase" && (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-[#94A3B8]">
                  PASSWORD
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="bg-black border border-[#334155] text-[#E2E8F0] px-2 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[#94A3B8]">
                  CONFIRM PASSWORD
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    aria-invalid={mismatch}
                    className={`bg-black border text-[#E2E8F0] px-2 py-1.5 ${mismatch ? "border-[#F87171]" : "border-[#334155]"}`}
                  />
                </label>
                {mismatch && <span className="text-[#F87171]">Passwords don't match.</span>}
              </div>
            )}

            <label className="flex items-start gap-2 p-2 border border-[#334155]">
              <input
                type="checkbox"
                checked={burn && isPro}
                onChange={(e) => (isPro ? setBurn(e.target.checked) : onRequestPro())}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-1">
                <span className="text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#F59E0B]" /> BURN AFTER READING
                  {!isPro && (
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-[#F59E0B] text-black font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> PRO
                    </span>
                  )}
                </span>
                <span className="text-[#64748B] leading-snug">Deleted the first time someone opens it.</span>
              </span>
            </label>

            {error && (
              <p role="alert" className="text-[#F87171]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="self-end px-4 py-1.5 bg-[#34D399] text-black font-bold hover:bg-[#10B981] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (protection === "none" ? "SHARING..." : "ENCRYPTING...") : "CREATE LINK"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
