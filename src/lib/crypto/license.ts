/**
 * Offline Pro licence verification.
 *
 * The app is a static site with no account server, so a licence is a
 * self-contained signed token checked entirely in the browser:
 *
 *     TDS-PRO-<base64url(payload JSON)>.<base64url(Ed25519 signature)>
 *
 * The signature covers the base64url payload segment exactly as written (the
 * same convention as JWS), so there is no canonical-JSON ambiguity. Only the
 * public half of the release key ships in the bundle; licences are minted
 * with `scripts/issue-license.ts` and the private key, which never enters the
 * repository.
 *
 * This is honour-system enforcement, as any client-side check must be: the
 * code is open and a determined user can patch it out. The point is to make
 * paying the easy path, not to fight people who read the source.
 */
import { fromB64Url, fromUtf8, utf8 } from "./encoding";
import { safeSetItem } from "../storage";

/** Raw Ed25519 public key (32 bytes, base64url) matching the release signing key. */
export const TEXTDIFF_RELEASE_KEY = "di4oZklrOksCt-hCdewN-l_hx8HGVEkzORJVpQti3HY";

export const LICENSE_PREFIX = "TDS-PRO-";
export const LICENSE_STORAGE_KEY = "tds_pro_license";

export interface LicensePayload {
  licensee: string;
  email: string;
  /** ms since epoch */
  issuedAt: number;
  /** ms since epoch; absent means perpetual */
  expiresAt?: number;
}

// Both arms name both fields: the project compiles without strictNullChecks,
// under which `ok` alone does not narrow the union.
export type LicenseResult =
  | { ok: true; payload: LicensePayload; reason?: undefined }
  | { ok: false; reason: string; payload?: undefined };

export const isEd25519Supported = async () => {
  try {
    await crypto.subtle.importKey("raw", fromB64Url(TEXTDIFF_RELEASE_KEY), { name: "Ed25519" }, false, ["verify"]);
    return true;
  } catch {
    return false;
  }
};

export const verifyLicense = async (
  token: string,
  publicKey: string = TEXTDIFF_RELEASE_KEY,
  now: number = Date.now(),
): Promise<LicenseResult> => {
  const trimmed = token.trim();
  if (!trimmed.startsWith(LICENSE_PREFIX)) {
    return { ok: false, reason: `Licence keys start with "${LICENSE_PREFIX}".` };
  }
  const body = trimmed.slice(LICENSE_PREFIX.length);
  const parts = body.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "Licence key is incomplete — check it was copied in full." };
  }
  const [payloadSeg, sigSeg] = parts;

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey("raw", fromB64Url(publicKey), { name: "Ed25519" }, false, ["verify"]);
  } catch {
    return { ok: false, reason: "This browser can't verify licences (no Ed25519 support). Try a current Chrome, Firefox or Safari." };
  }

  let valid = false;
  try {
    valid = await crypto.subtle.verify({ name: "Ed25519" }, key, fromB64Url(sigSeg), utf8(payloadSeg));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: "Signature check failed — this licence key is not genuine or has been altered." };

  let payload: LicensePayload;
  try {
    payload = JSON.parse(fromUtf8(fromB64Url(payloadSeg)));
  } catch {
    return { ok: false, reason: "Licence payload is unreadable." };
  }
  if (typeof payload?.licensee !== "string" || typeof payload.issuedAt !== "number") {
    return { ok: false, reason: "Licence payload is missing required fields." };
  }
  if (typeof payload.expiresAt === "number" && now > payload.expiresAt) {
    return { ok: false, reason: `This licence expired on ${new Date(payload.expiresAt).toLocaleDateString()}.` };
  }
  return { ok: true, payload };
};

/**
 * The raw token is stored, not just the decoded payload, so it is
 * re-verified on every load — editing localStorage by hand gains nothing.
 */
export const storeLicense = (token: string) => safeSetItem(LICENSE_STORAGE_KEY, token.trim());

export const clearLicense = () => {
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
};

export const loadStoredLicense = async (): Promise<LicensePayload | null> => {
  let token: string | null = null;
  try {
    token = localStorage.getItem(LICENSE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!token) return null;
  const result = await verifyLicense(token);
  return result.ok ? result.payload : null;
};
