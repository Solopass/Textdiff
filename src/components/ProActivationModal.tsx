import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { verifyLicense, type LicensePayload } from "../lib/crypto/license";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  license: LicensePayload | null;
  onActivate: (token: string, payload: LicensePayload) => void;
  onDeactivate: () => void;
}

// Keep the "(soon)" markers honest: drop one only when the feature ships.
const TIERS: [string, string, string][] = [
  ["Cipher", "AES-256-GCM, PBKDF2 100k", "+ RSA-OAEP / AES-256-GCM"],
  ["Key exchange", "Link key or shared password", "+ Recipient public keys"],
  ["Lifetime", "30-day expiry", "+ Burn after reading"],
  ["Hardware keys", "—", "WebAuthn / passkey binding (soon)"],
  ["Archives", "Plain exports", "Encrypted .tds.enc bundles"],
];

const PURCHASE_MAIL =
  "mailto:realsolopass@gmail.com?subject=" + encodeURIComponent("TextDiff Studio Pro licence");

/**
 * Pro activation. Verification is offline: the key is an Ed25519-signed token
 * checked against a public key compiled into the app — no account, no server
 * round trip, nothing phoned home.
 */
export const ProActivationModal: React.FC<Props> = ({ isOpen, onClose, license, onActivate, onDeactivate }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { active: isOpen, onClose });
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setToken("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await verifyLicense(token);
    setBusy(false);
    if (result.ok) onActivate(token, result.payload);
    else setError(result.reason);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-[#020617] border-2 border-[#F59E0B] max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-[6px_6px_0_#F59E0B] animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center p-4 border-b border-[#F59E0B]/40 bg-[#1C1917]">
          <h3 id="pro-modal-title" className="text-sm font-bold text-[#F59E0B] flex items-center gap-2 tracking-widest">
            <ShieldCheck className="w-4 h-4" />
            PRO ENCRYPTION
          </h3>
          <button onClick={onClose} aria-label="Close Pro activation" className="text-[#94A3B8] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 font-mono text-xs">
          <p className="text-[#94A3B8] leading-relaxed">
            Everything in TextDiff Studio is free, forever. Pro adds stronger sharing crypto — and it is the only
            thing that will ever cost money.
          </p>

          <table className="w-full border border-[#334155] text-left">
            <thead className="bg-[#0F172A] text-[#64748B]">
              <tr>
                <th className="p-2 font-normal"></th>
                <th className="p-2 font-normal">FREE</th>
                <th className="p-2 font-normal text-[#F59E0B]">PRO</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map(([feature, free, pro]) => (
                <tr key={feature} className="border-t border-[#1E293B]">
                  <th scope="row" className="p-2 font-normal text-[#94A3B8]">{feature}</th>
                  <td className="p-2 text-[#E2E8F0]">{free}</td>
                  <td className="p-2 text-[#FCD34D]">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {license ? (
            <div className="flex flex-col gap-3 border border-[#34D399] p-3">
              <p className="text-[#34D399]">
                ✓ Licensed to <strong>{license.licensee}</strong>
                {license.expiresAt
                  ? ` until ${new Date(license.expiresAt).toLocaleDateString()}`
                  : " (perpetual)"}
                .
              </p>
              <button
                onClick={onDeactivate}
                className="self-start px-3 py-1 border border-[#334155] text-[#94A3B8] hover:text-white"
              >
                REMOVE LICENCE FROM THIS BROWSER
              </button>
            </div>
          ) : (
            <form onSubmit={activate} className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-[#94A3B8]">
                LICENCE KEY
                <textarea
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  placeholder="TDS-PRO-…"
                  className="bg-black border border-[#334155] text-[#E2E8F0] px-2 py-1.5 break-all resize-none"
                />
              </label>
              {error && (
                <p role="alert" className="text-[#F87171]">
                  {error}
                </p>
              )}
              <div className="flex justify-between items-center gap-2">
                <a href={PURCHASE_MAIL} className="text-[#F59E0B] underline underline-offset-2">
                  Get a licence
                </a>
                <button
                  type="submit"
                  disabled={!token.trim() || busy}
                  className="px-4 py-1.5 bg-[#F59E0B] text-black font-bold border-2 border-black shadow-[3px_3px_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
                >
                  {busy ? "VERIFYING..." : "ACTIVATE"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
