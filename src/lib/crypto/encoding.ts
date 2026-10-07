/** Byte <-> text helpers shared by the crypto modules. No dependencies. */

const enc = new TextEncoder();
const dec = new TextDecoder();

export const utf8 = (s: string): Uint8Array<ArrayBuffer> => enc.encode(s) as Uint8Array<ArrayBuffer>;
export const fromUtf8 = (b: ArrayBuffer | Uint8Array): string => dec.decode(b);

/**
 * URL-safe base64 without padding. Used everywhere a value may end up in a
 * URL fragment, so `+`, `/` and `=` never need escaping.
 */
export const toB64Url = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Accepts both URL-safe and standard base64, padded or not. Throws on garbage. */
export const fromB64Url = (s: string): Uint8Array<ArrayBuffer> => {
  const std = s.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*=*$/.test(std)) throw new Error("Invalid base64");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const randomBytes = (n: number): Uint8Array<ArrayBuffer> =>
  crypto.getRandomValues(new Uint8Array(n));
