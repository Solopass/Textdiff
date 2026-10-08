/**
 * Asymmetric Public-Key Encryption for TextDiff Studio Pro.
 *
 * Implements RSA-OAEP (2048-bit, SHA-256) + AES-256-GCM via WebCrypto.
 * Allows encrypting a diff specifically for a collaborator's public key
 * without exchanging a shared password out-of-band.
 *
 * Also supports importing RSA public keys from GitHub SSH keys (ssh-rsa).
 */
import { fromB64Url, fromUtf8, randomBytes, toB64Url, utf8 } from "./encoding";
import { DecryptionError } from "./symmetric";

export const PUBLIC_KEY_PREFIX = "tdspub1:";
export const PRIVATE_KEY_PREFIX = "tdspriv1:";
export const ASYMMETRIC_AAD = utf8("textdiff-asymmetric-v1");

export interface AsymmetricKeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
}

export interface AsymmetricEnvelope {
  v: 1;
  alg: "RSA-OAEP-256+AES-256-GCM";
  mode: "asymmetric";
  recipientFingerprint: string;
  wrappedKey: string;
  iv: string;
  ct: string;
}

const computeFingerprint = async (spkiBytes: Uint8Array): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", spkiBytes as Uint8Array<ArrayBuffer>);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":");
};

/** Generates a fresh RSA-OAEP 2048-bit keypair. */
export const generateAsymmetricKeyPair = async (): Promise<AsymmetricKeyPair> => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);

  const fingerprint = await computeFingerprint(new Uint8Array(spki));

  return {
    publicKey: PUBLIC_KEY_PREFIX + toB64Url(spki),
    privateKey: PRIVATE_KEY_PREFIX + toB64Url(pkcs8),
    fingerprint,
  };
};

/** Imports an RSA-OAEP public key from tdspub1 format, PEM, or JWK. */
export const importPublicKey = async (rawKey: string): Promise<{ key: CryptoKey; fingerprint: string }> => {
  const clean = rawKey.trim();

  // 1. Direct TDS format
  if (clean.startsWith(PUBLIC_KEY_PREFIX)) {
    const bytes = fromB64Url(clean.slice(PUBLIC_KEY_PREFIX.length));
    const fingerprint = await computeFingerprint(bytes);
    const key = await crypto.subtle.importKey(
      "spki",
      bytes,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );
    return { key, fingerprint };
  }

  // 2. OpenSSH ssh-rsa format (e.g. from GitHub .keys)
  if (clean.startsWith("ssh-rsa ")) {
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      const sshBytes = fromB64Url(parts[1]);
      const jwk = parseOpenSshRsaToJwk(sshBytes);
      const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"],
      );
      const spki = await crypto.subtle.exportKey("spki", key);
      const fingerprint = await computeFingerprint(new Uint8Array(spki));
      return { key, fingerprint };
    }
  }

  // SSH key types that can only sign, never encrypt (GitHub's default is ed25519).
  // Say why, rather than falling through to the generic error below.
  const sshType = clean.split(/\s+/, 1)[0];
  if (/^(ssh-ed25519|ecdsa-sha2-|sk-)/.test(sshType)) {
    throw new Error(
      `${sshType} keys can only sign, not encrypt, so they can't be used as a recipient key. ` +
        "Use an ssh-rsa key, or ask the recipient for their TextDiff public key (tdspub1:...).",
    );
  }

  // 3. Fallback: try raw base64 SPKI or throw
  try {
    const bytes = fromB64Url(clean);
    const fingerprint = await computeFingerprint(bytes);
    const key = await crypto.subtle.importKey(
      "spki",
      bytes,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );
    return { key, fingerprint };
  } catch (e) {
    throw new Error("Unrecognised public key format. Expects tdspub1:... or ssh-rsa ...");
  }
};

/** Imports an RSA-OAEP private key from tdspriv1 format or raw base64 PKCS8. */
export const importPrivateKey = async (rawKey: string): Promise<CryptoKey> => {
  const clean = rawKey.trim();
  const token = clean.startsWith(PRIVATE_KEY_PREFIX) ? clean.slice(PRIVATE_KEY_PREFIX.length) : clean;
  try {
    const bytes = fromB64Url(token);
    return await crypto.subtle.importKey(
      "pkcs8",
      bytes,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    );
  } catch (e) {
    throw new DecryptionError("Unrecognised or invalid private key format.");
  }
};

/**
 * Encrypts a plaintext string for a recipient using their public key.
 * Generates an ephemeral 256-bit AES-GCM key, seals the data, and wraps
 * the AES key using the recipient's RSA-OAEP public key.
 */
export const encryptForRecipient = async (
  plaintext: string,
  recipientPublicKeyStr: string,
): Promise<AsymmetricEnvelope> => {
  const { key: pubKey, fingerprint } = await importPublicKey(recipientPublicKeyStr);

  // 1. Generate ephemeral AES-256-GCM key
  const aesRaw = randomBytes(32);
  const aesKey = await crypto.subtle.importKey("raw", aesRaw, { name: "AES-GCM" }, false, ["encrypt"]);

  // 2. Encrypt plaintext
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: ASYMMETRIC_AAD },
    aesKey,
    utf8(plaintext),
  );

  // 3. Wrap AES key with recipient's public key
  const wrappedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    pubKey,
    aesRaw,
  );

  return {
    v: 1,
    alg: "RSA-OAEP-256+AES-256-GCM",
    mode: "asymmetric",
    recipientFingerprint: fingerprint,
    wrappedKey: toB64Url(wrappedKey),
    iv: toB64Url(iv),
    ct: toB64Url(ct),
  };
};

/** Decrypts an asymmetric envelope using the recipient's private key. */
export const decryptWithPrivateKey = async (
  envelope: AsymmetricEnvelope,
  privateKeyStr: string,
): Promise<string> => {
  const privKey = await importPrivateKey(privateKeyStr);

  let aesRaw: ArrayBuffer;
  try {
    aesRaw = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privKey,
      fromB64Url(envelope.wrappedKey),
    );
  } catch (e) {
    throw new DecryptionError("Failed to unwrap encryption key. The private key does not match this diff.");
  }

  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesRaw as Uint8Array<ArrayBuffer>,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64Url(envelope.iv), additionalData: ASYMMETRIC_AAD },
      aesKey,
      fromB64Url(envelope.ct),
    );
    return fromUtf8(pt);
  } catch (e) {
    throw new DecryptionError("Decryption failed. The encrypted data was altered or corrupted.");
  }
};

/** Helper to parse OpenSSH wire format `ssh-rsa` key bytes into a WebCrypto JWK. */
function parseOpenSshRsaToJwk(bytes: Uint8Array): JsonWebKey {
  let offset = 0;
  const readUint32 = () => {
    const val = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4;
    return val >>> 0;
  };
  const readBytes = () => {
    const len = readUint32();
    const slice = bytes.slice(offset, offset + len);
    offset += len;
    return slice;
  };

  const keyType = new TextDecoder().decode(readBytes());
  if (keyType !== "ssh-rsa") {
    throw new Error(`Expected ssh-rsa key, got ${keyType}`);
  }

  const e = readBytes();
  const n = readBytes();

  // Strip leading zero padding if present in mpint
  const stripLeadingZero = (arr: Uint8Array) => (arr[0] === 0 ? arr.slice(1) : arr);

  return {
    kty: "RSA",
    n: toB64Url(stripLeadingZero(n)),
    e: toB64Url(stripLeadingZero(e)),
    alg: "RSA-OAEP-256",
    ext: true,
  };
}
