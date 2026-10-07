import { describe, it, expect, beforeEach } from "vitest";
import { toB64Url, utf8 } from "./encoding";
import {
  LICENSE_STORAGE_KEY,
  loadStoredLicense,
  storeLicense,
  verifyLicense,
} from "./license";

/** A throwaway signing key per run — tests never touch the real release key. */
const makeIssuer = async () => {
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pub = toB64Url(await crypto.subtle.exportKey("raw", kp.publicKey));
  const issue = async (payload: object) => {
    const seg = toB64Url(utf8(JSON.stringify(payload)));
    const sig = await crypto.subtle.sign({ name: "Ed25519" }, kp.privateKey, utf8(seg));
    return `TDS-PRO-${seg}.${toB64Url(sig)}`;
  };
  return { pub, issue };
};

const base = { licensee: "Ada", email: "ada@example.com", issuedAt: 1_700_000_000_000 };

describe("verifyLicense", () => {
  it("accepts a correctly signed licence", async () => {
    const { pub, issue } = await makeIssuer();
    const result = await verifyLicense(await issue(base), pub);
    expect(result).toEqual({ ok: true, payload: base });
  });

  it("rejects a licence signed by a different key", async () => {
    const real = await makeIssuer();
    const forger = await makeIssuer();
    const result = await verifyLicense(await forger.issue(base), real.pub);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not genuine/);
  });

  it("rejects a tampered payload", async () => {
    const { pub, issue } = await makeIssuer();
    const token = await issue(base);
    const [, sig] = token.slice("TDS-PRO-".length).split(".");
    const forgedSeg = toB64Url(utf8(JSON.stringify({ ...base, licensee: "Mallory" })));
    const result = await verifyLicense(`TDS-PRO-${forgedSeg}.${sig}`, pub);
    expect(result.ok).toBe(false);
  });

  it("rejects an expired licence", async () => {
    const { pub, issue } = await makeIssuer();
    const token = await issue({ ...base, expiresAt: 1_800_000_000_000 });
    expect((await verifyLicense(token, pub, 1_799_999_999_999)).ok).toBe(true);
    const later = await verifyLicense(token, pub, 1_800_000_000_001);
    expect(later.ok).toBe(false);
    if (!later.ok) expect(later.reason).toMatch(/expired/);
  });

  it("explains malformed input instead of throwing", async () => {
    const { pub } = await makeIssuer();
    for (const bad of ["", "hello", "TDS-PRO-", "TDS-PRO-abc", "TDS-PRO-abc.", "TDS-PRO-!!!.???"]) {
      const r = await verifyLicense(bad, pub);
      expect(r.ok).toBe(false);
    }
  });

  it("tolerates surrounding whitespace from copy-paste", async () => {
    const { pub, issue } = await makeIssuer();
    expect((await verifyLicense(`  ${await issue(base)}\n`, pub)).ok).toBe(true);
  });
});

describe("stored licence", () => {
  beforeEach(() => localStorage.clear());

  it("re-verifies on load, so a hand-edited value unlocks nothing", async () => {
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify({ licensee: "me", issuedAt: 0 }));
    expect(await loadStoredLicense()).toBeNull();
  });

  it("returns null when nothing is stored", async () => {
    storeLicense("");
    expect(await loadStoredLicense()).toBeNull();
  });
});
