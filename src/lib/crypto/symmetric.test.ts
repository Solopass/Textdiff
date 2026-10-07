import { describe, it, expect } from "vitest";
import {
  DecryptionError,
  decryptEnvelope,
  encryptWithLinkKey,
  encryptWithPassphrase,
  isEncryptedPayload,
  linkKeyFromHash,
  parseEnvelope,
  serializeEnvelope,
} from "./symmetric";
import { fromB64Url, toB64Url } from "./encoding";

const SECRET = JSON.stringify({ origText: "password = hunter2", modText: "password = correct horse" });

describe("link-key encryption", () => {
  it("round-trips", async () => {
    const { envelope, linkKey } = await encryptWithLinkKey(SECRET);
    expect(await decryptEnvelope(envelope, { linkKey })).toBe(SECRET);
  });

  it("never contains the plaintext", async () => {
    const { envelope } = await encryptWithLinkKey(SECRET);
    const stored = serializeEnvelope(envelope);
    expect(stored).not.toContain("hunter2");
    expect(stored).not.toContain("origText");
  });

  it("uses a fresh key and IV each time", async () => {
    const a = await encryptWithLinkKey(SECRET);
    const b = await encryptWithLinkKey(SECRET);
    expect(a.linkKey).not.toBe(b.linkKey);
    expect(a.envelope.iv).not.toBe(b.envelope.iv);
    expect(a.envelope.ct).not.toBe(b.envelope.ct);
  });

  it("rejects the wrong key", async () => {
    const { envelope } = await encryptWithLinkKey(SECRET);
    const { linkKey: other } = await encryptWithLinkKey("x");
    await expect(decryptEnvelope(envelope, { linkKey: other })).rejects.toBeInstanceOf(DecryptionError);
  });

  it("rejects a missing or malformed key with a specific message", async () => {
    const { envelope } = await encryptWithLinkKey(SECRET);
    await expect(decryptEnvelope(envelope, {})).rejects.toThrow(/missing its decryption key/);
    await expect(decryptEnvelope(envelope, { linkKey: "abc" })).rejects.toThrow(/malformed/);
  });

  it("detects a tampered ciphertext", async () => {
    const { envelope, linkKey } = await encryptWithLinkKey(SECRET);
    const ct = fromB64Url(envelope.ct);
    ct[0] ^= 1;
    await expect(
      decryptEnvelope({ ...envelope, ct: toB64Url(ct) }, { linkKey }),
    ).rejects.toBeInstanceOf(DecryptionError);
  });
});

describe("passphrase encryption", () => {
  it("round-trips and records its KDF parameters", async () => {
    const env = await encryptWithPassphrase(SECRET, "tr0ub4dor");
    expect(env.kdf?.iter).toBe(100_000);
    expect(await decryptEnvelope(env, { passphrase: "tr0ub4dor" })).toBe(SECRET);
  });

  it("rejects the wrong passphrase", async () => {
    const env = await encryptWithPassphrase(SECRET, "right");
    await expect(decryptEnvelope(env, { passphrase: "wrong" })).rejects.toBeInstanceOf(DecryptionError);
  });

  it("refuses an empty passphrase", async () => {
    await expect(encryptWithPassphrase(SECRET, "")).rejects.toThrow();
  });
});

describe("envelope serialization", () => {
  it("marks ciphertext distinctly from plain JSON payloads", async () => {
    const { envelope } = await encryptWithLinkKey(SECRET);
    const stored = serializeEnvelope(envelope);
    expect(isEncryptedPayload(stored)).toBe(true);
    expect(isEncryptedPayload(SECRET)).toBe(false);
    expect(parseEnvelope(stored)).toEqual(envelope);
  });

  it("rejects unknown envelope versions", () => {
    expect(() => parseEnvelope('tdsenc1:{"v":2}')).toThrow(DecryptionError);
  });

  it("reads the key out of a URL fragment", () => {
    expect(linkKeyFromHash("#key=abc_-1")).toBe("abc_-1");
    expect(linkKeyFromHash("#other=1")).toBeUndefined();
    expect(linkKeyFromHash("")).toBeUndefined();
  });
});
