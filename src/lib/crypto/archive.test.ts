import { describe, expect, it } from "vitest";
import {
  createArchive,
  readArchive,
  isArchiveFilename,
  ARCHIVE_MAGIC,
} from "./archive";
import { DecryptionError } from "./symmetric";

describe("Encrypted Diff Archive (.tds.enc)", () => {
  const sampleDiff = {
    origText: "const a = 1;\nconst b = 2;",
    modText: "const a = 1;\nconst b = 3;\nconst c = 4;",
    origFileName: "before.ts",
    modFileName: "after.ts",
    language: "typescript",
  };

  it("identifies archive filenames by extension", () => {
    expect(isArchiveFilename("diff.tds.enc")).toBe(true);
    expect(isArchiveFilename("MY-PROJECT.TDS.ENC")).toBe(true);
    expect(isArchiveFilename("diff.json")).toBe(false);
    expect(isArchiveFilename("diff.txt")).toBe(false);
  });

  it("encrypts and decrypts round-trip accurately with correct passphrase", async () => {
    const archiveJson = await createArchive(sampleDiff, "super-secret-password-123");
    const parsed = JSON.parse(archiveJson);

    expect(parsed.magic).toBe(ARCHIVE_MAGIC);
    expect(parsed.v).toBe(1);
    expect(parsed.alg).toBe("AES-256-GCM");
    expect(parsed.kdf.name).toBe("PBKDF2-SHA256");
    expect(parsed.ct).toBeTypeOf("string");
    expect(archiveJson).not.toContain("const a = 1");

    const decrypted = await readArchive(archiveJson, "super-secret-password-123");
    expect(decrypted.origText).toBe(sampleDiff.origText);
    expect(decrypted.modText).toBe(sampleDiff.modText);
    expect(decrypted.origFileName).toBe(sampleDiff.origFileName);
    expect(decrypted.modFileName).toBe(sampleDiff.modFileName);
    expect(decrypted.language).toBe(sampleDiff.language);
    expect(decrypted.createdAt).toBeTypeOf("number");
  });

  it("fails with DecryptionError on incorrect passphrase", async () => {
    const archiveJson = await createArchive(sampleDiff, "correct-pass");
    await expect(readArchive(archiveJson, "wrong-pass")).rejects.toThrow(
      DecryptionError,
    );
  });

  it("rejects corrupted or tampered ciphertext", async () => {
    const archiveJson = await createArchive(sampleDiff, "correct-pass");
    const parsed = JSON.parse(archiveJson);
    // Tamper with ciphertext
    parsed.ct = "A" + parsed.ct.slice(1);
    await expect(readArchive(JSON.stringify(parsed), "correct-pass")).rejects.toThrow(
      DecryptionError,
    );
  });

  it("rejects missing passphrase or malformed input", async () => {
    await expect(createArchive(sampleDiff, "")).rejects.toThrow();
    await expect(readArchive("not json", "pass")).rejects.toThrow(DecryptionError);
    await expect(readArchive("{}", "pass")).rejects.toThrow(DecryptionError);
  });
});
