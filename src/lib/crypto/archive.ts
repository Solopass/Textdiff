/**
 * Offline Encrypted Diff Archive Bundles (.tds.enc)
 *
 * AES-256-GCM + PBKDF2 (100,000 iterations) via native WebCrypto.
 * Allows users to export full diff sessions (original text, modified text,
 * filenames, syntax language, timestamp) into encrypted files with zero cloud dependencies.
 */
import { fromB64Url, fromUtf8, randomBytes, toB64Url, utf8 } from "./encoding";
import { deriveKeyFromPassphrase, PBKDF2_ITERATIONS, DecryptionError } from "./symmetric";

export const ARCHIVE_MAGIC = "TDS_ENC_V1";
export const ARCHIVE_EXTENSION = ".tds.enc";

const ARCHIVE_AAD = utf8("textdiff-archive-v1");

export interface TdsArchiveData {
  v: 1;
  origText: string;
  modText: string;
  origFileName?: string;
  modFileName?: string;
  language?: string;
  createdAt: number;
}

export interface TdsEncryptedArchiveFile {
  magic: typeof ARCHIVE_MAGIC;
  v: 1;
  alg: "AES-256-GCM";
  kdf: {
    name: "PBKDF2-SHA256";
    iter: number;
    salt: string;
  };
  iv: string;
  ct: string;
}

export const createArchive = async (
  data: {
    origText: string;
    modText: string;
    origFileName?: string;
    modFileName?: string;
    language?: string;
  },
  passphrase: string,
): Promise<string> => {
  if (!passphrase) throw new Error("A passphrase is required to encrypt the archive.");
  const payload: TdsArchiveData = {
    v: 1,
    createdAt: Date.now(),
    ...data,
  };
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKeyFromPassphrase(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = utf8(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: ARCHIVE_AAD },
    key,
    plaintext,
  );

  const archive: TdsEncryptedArchiveFile = {
    magic: ARCHIVE_MAGIC,
    v: 1,
    alg: "AES-256-GCM",
    kdf: {
      name: "PBKDF2-SHA256",
      iter: PBKDF2_ITERATIONS,
      salt: toB64Url(salt),
    },
    iv: toB64Url(iv),
    ct: toB64Url(ciphertext),
  };

  return JSON.stringify(archive, null, 2);
};

export const readArchive = async (
  fileContent: string,
  passphrase: string,
): Promise<TdsArchiveData> => {
  if (!passphrase) throw new DecryptionError("A passphrase is required to decrypt this archive.");
  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    throw new DecryptionError("The archive file is malformed or not a valid JSON document.");
  }

  if (
    parsed?.magic !== ARCHIVE_MAGIC ||
    parsed?.v !== 1 ||
    parsed?.alg !== "AES-256-GCM" ||
    !parsed?.kdf?.salt ||
    !parsed?.iv ||
    !parsed?.ct
  ) {
    throw new DecryptionError("Invalid or unsupported TextDiff archive format.");
  }

  const salt = fromB64Url(parsed.kdf.salt);
  const iv = fromB64Url(parsed.iv);
  const ct = fromB64Url(parsed.ct);
  const iter = parsed.kdf.iter || PBKDF2_ITERATIONS;

  const key = await deriveKeyFromPassphrase(passphrase, salt, iter);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: ARCHIVE_AAD },
      key,
      ct,
    );
    const text = fromUtf8(decrypted);
    const data: TdsArchiveData = JSON.parse(text);
    if (typeof data.origText !== "string" || typeof data.modText !== "string") {
      throw new Error("Invalid archive payload structure");
    }
    return data;
  } catch (e) {
    if (e instanceof DecryptionError) throw e;
    throw new DecryptionError("Could not decrypt archive — wrong passphrase or corrupted file.");
  }
};

export const isArchiveFilename = (name: string): boolean => {
  return name.toLowerCase().endsWith(ARCHIVE_EXTENSION);
};
