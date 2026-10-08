import { describe, expect, it } from "vitest";
import {
  generateAsymmetricKeyPair,
  importPublicKey,
  importPrivateKey,
  encryptForRecipient,
  decryptWithPrivateKey,
  PUBLIC_KEY_PREFIX,
  PRIVATE_KEY_PREFIX,
} from "./asymmetric";
import { DecryptionError } from "./symmetric";

describe("Asymmetric Public-Key Encryption (RSA-OAEP + AES-GCM)", () => {
  const secretMessage = JSON.stringify({
    a: "sensitive proprietary code before patch",
    b: "sensitive proprietary code after patch",
  });

  it("generates a valid keypair with formatted prefixes and fingerprint", async () => {
    const pair = await generateAsymmetricKeyPair();
    expect(pair.publicKey.startsWith(PUBLIC_KEY_PREFIX)).toBe(true);
    expect(pair.privateKey.startsWith(PRIVATE_KEY_PREFIX)).toBe(true);
    expect(pair.fingerprint).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/);

    const { key, fingerprint } = await importPublicKey(pair.publicKey);
    expect(key.algorithm.name).toBe("RSA-OAEP");
    expect(fingerprint).toBe(pair.fingerprint);
  });

  it("encrypts and decrypts round-trip with recipient keypair", async () => {
    const recipient = await generateAsymmetricKeyPair();

    const envelope = await encryptForRecipient(secretMessage, recipient.publicKey);
    expect(envelope.v).toBe(1);
    expect(envelope.alg).toBe("RSA-OAEP-256+AES-256-GCM");
    expect(envelope.mode).toBe("asymmetric");
    expect(envelope.recipientFingerprint).toBe(recipient.fingerprint);
    expect(envelope.ct).toBeTypeOf("string");
    expect(envelope.wrappedKey).toBeTypeOf("string");

    const decrypted = await decryptWithPrivateKey(envelope, recipient.privateKey);
    expect(decrypted).toBe(secretMessage);
  });

  it("fails decryption when attempted with wrong private key", async () => {
    const alice = await generateAsymmetricKeyPair();
    const eve = await generateAsymmetricKeyPair();

    const envelope = await encryptForRecipient(secretMessage, alice.publicKey);

    // Eve tries to decrypt Alice's envelope
    await expect(
      decryptWithPrivateKey(envelope, eve.privateKey),
    ).rejects.toThrow(DecryptionError);
  });

  it("rejects tampered wrapped key or tampered ciphertext", async () => {
    const pair = await generateAsymmetricKeyPair();
    const envelope = await encryptForRecipient(secretMessage, pair.publicKey);

    // Tamper ciphertext
    const tamperedCt = { ...envelope, ct: "A" + envelope.ct.slice(1) };
    await expect(
      decryptWithPrivateKey(tamperedCt, pair.privateKey),
    ).rejects.toThrow(DecryptionError);

    // Tamper wrapped key
    const tamperedKey = { ...envelope, wrappedKey: "B" + envelope.wrappedKey.slice(1) };
    await expect(
      decryptWithPrivateKey(tamperedKey, pair.privateKey),
    ).rejects.toThrow(DecryptionError);
  });

  it("rejects malformed public and private keys", async () => {
    await expect(importPublicKey("garbage-key")).rejects.toThrow();
    await expect(importPrivateKey("garbage-key")).rejects.toThrow(DecryptionError);
  });

  it("explains why sign-only SSH keys (GitHub's default ed25519) can't be recipients", async () => {
    const ed25519 = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl user@host";
    await expect(importPublicKey(ed25519)).rejects.toThrow(/ssh-ed25519 keys can only sign/);
    await expect(importPublicKey("ecdsa-sha2-nistp256 AAAAE2VjZHNh")).rejects.toThrow(/can only sign/);
    await expect(importPublicKey("sk-ssh-ed25519@openssh.com AAAA")).rejects.toThrow(/can only sign/);
  });
});
