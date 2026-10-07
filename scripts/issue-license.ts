/**
 * Mints a TextDiff Studio Pro licence key.
 *
 *   bun scripts/issue-license.ts --name "Ada Lovelace" --email ada@example.com [--days 365]
 *
 * Signs with the Ed25519 private key (JWK) at $TDS_LICENSE_KEY, defaulting to
 * ~/.textdiff/license-signing-key.jwk. That file must never be committed; the
 * matching public key is TEXTDIFF_RELEASE_KEY in src/lib/crypto/license.ts.
 * Omit --days for a perpetual licence.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const name = arg("name");
const email = arg("email") ?? "";
const days = arg("days");
if (!name) {
  console.error('Usage: bun scripts/issue-license.ts --name "Licensee" --email you@example.com [--days 365]');
  process.exit(1);
}

const keyPath = process.env.TDS_LICENSE_KEY ?? join(homedir(), ".textdiff", "license-signing-key.jwk");
const jwk = JSON.parse(readFileSync(keyPath, "utf8"));
const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);

const issuedAt = Date.now();
const payload = {
  licensee: name,
  email,
  issuedAt,
  ...(days ? { expiresAt: issuedAt + Number(days) * 86_400_000 } : {}),
};

const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const payloadSeg = b64url(new TextEncoder().encode(JSON.stringify(payload)));
const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, new TextEncoder().encode(payloadSeg)));

console.log(`TDS-PRO-${payloadSeg}.${b64url(sig)}`);
