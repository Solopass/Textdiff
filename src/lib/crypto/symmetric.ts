/**
 * Free-tier share encryption ("Mid Encryption").
 *
 * AES-256-GCM via the browser's own WebCrypto — no npm dependency, nothing
 * added to the bundle. Two ways to hold the key:
 *
 *   * "link"       a random 256-bit key travels in the URL fragment
 *                  (`?id=<doc>#key=<b64>`). Browsers never send the fragment
 *                  to any server, so Firestore only ever stores ciphertext.
 *   * "passphrase" the key is derived with PBKDF2-SHA256 from a passphrase the
 *                  sender passes on out of band. The link alone opens nothing.
 *
 * GCM is authenticated: a tampered ciphertext, wrong key, or wrong passphrase
 * fails decryption outright rather than producing garbage.
 */
import { fromB64Url, fromUtf8, randomBytes, toB64Url, utf8 } from "./encoding";

export const PBKDF2_ITERATIONS = 100_000;

/** Marks a stored share payload as ciphertext. Plain payloads are JSON and start with `{`. */
export const ENVELOPE_PREFIX = "tdsenc1:";

/**
 * Bound into every ciphertext as GCM additional data, so an envelope made for
 * some other purpose can't be replayed as a share.
 */
const AAD = utf8("textdiff-share-v1");

export type KeyMode = "link" | "passphrase";

export interface EncryptedEnvelope {
  v: 1;
  alg: "AES-256-GCM";
  mode: KeyMode;
  /** PBKDF2 parameters — passphrase mode only. */
  kdf?: { name: "PBKDF2-SHA256"; iter: number; salt: string };
  iv: string;
  ct: string;
}

export class DecryptionError extends Error {
  constructor(
    message = "Could not decrypt — the key or passphrase is wrong, or the data was altered.",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DecryptionError";
  }
}

const importAesKey = (raw: Uint8Array<ArrayBuffer>) =>
  crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

export const deriveKeyFromPassphrase = async (
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations = PBKDF2_ITERATIONS,
) => {
  const base = await crypto.subtle.importKey("raw", utf8(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

const seal = async (key: CryptoKey, plaintext: string) => {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: AAD }, key, utf8(plaintext));
  return { iv: toB64Url(iv), ct: toB64Url(ct) };
};

/** Encrypts under a fresh random key. Returns the envelope and the key to put in the link. */
export const encryptWithLinkKey = async (plaintext: string) => {
  const raw = randomBytes(32);
  const sealed = await seal(await importAesKey(raw), plaintext);
  const envelope: EncryptedEnvelope = { v: 1, alg: "AES-256-GCM", mode: "link", ...sealed };
  return { envelope, linkKey: toB64Url(raw) };
};

export const encryptWithPassphrase = async (plaintext: string, passphrase: string) => {
  if (!passphrase) throw new Error("A passphrase is required.");
  const salt = randomBytes(16);
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const sealed = await seal(key, plaintext);
  const envelope: EncryptedEnvelope = {
    v: 1,
    alg: "AES-256-GCM",
    mode: "passphrase",
    kdf: { name: "PBKDF2-SHA256", iter: PBKDF2_ITERATIONS, salt: toB64Url(salt) },
    ...sealed,
  };
  return envelope;
};

export const decryptEnvelope = async (
  envelope: EncryptedEnvelope,
  secret: { linkKey?: string; passphrase?: string },
): Promise<string> => {
  let key: CryptoKey;
  try {
    if (envelope.mode === "link") {
      if (!secret.linkKey) throw new DecryptionError("This link is missing its decryption key.");
      const raw = fromB64Url(secret.linkKey);
      if (raw.length !== 32) throw new DecryptionError("This link's decryption key is malformed.");
      key = await importAesKey(raw);
    } else {
      if (!envelope.kdf) throw new DecryptionError("Encrypted share is missing its key-derivation parameters.");
      if (!secret.passphrase) throw new DecryptionError("A passphrase is required to open this share.");
      key = await deriveKeyFromPassphrase(secret.passphrase, fromB64Url(envelope.kdf.salt), envelope.kdf.iter);
    }
  } catch (e) {
    if (e instanceof DecryptionError) throw e;
    throw new DecryptionError(
      envelope.mode === "link"
        ? "This link's decryption key is malformed."
        : "Could not derive a key from that passphrase.",
      { cause: e },
    );
  }

  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64Url(envelope.iv), additionalData: AAD },
      key,
      fromB64Url(envelope.ct),
    );
    return fromUtf8(pt);
  } catch {
    throw new DecryptionError();
  }
};

export const isEncryptedPayload = (stored: string) => stored.startsWith(ENVELOPE_PREFIX);

export const serializeEnvelope = (e: EncryptedEnvelope) => ENVELOPE_PREFIX + JSON.stringify(e);

export const parseEnvelope = (stored: string): EncryptedEnvelope => {
  const parsed = JSON.parse(stored.slice(ENVELOPE_PREFIX.length));
  if (
    parsed?.v !== 1 ||
    parsed.alg !== "AES-256-GCM" ||
    (parsed.mode !== "link" && parsed.mode !== "passphrase") ||
    typeof parsed.iv !== "string" ||
    typeof parsed.ct !== "string"
  ) {
    throw new DecryptionError("Unrecognised encrypted share format.");
  }
  return parsed;
};

/** Reads `key=` out of a `#key=...` style fragment. */
export const linkKeyFromHash = (hash: string): string | undefined => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("key") ?? undefined;
};
