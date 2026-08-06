import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "./crypto";

describe("provider-key encryption", () => {
  it("encrypts and decrypts without exposing plaintext fields", () => {
    const encrypted = encryptSecret("secret-provider-key-1234", "org:GOOGLE_NATIVE");

    expect(encrypted.ciphertext).not.toContain("secret-provider-key");
    expect(
      decryptSecret(
        {
          apiKeyCiphertext: encrypted.ciphertext,
          apiKeyIv: encrypted.iv,
          apiKeyAuthTag: encrypted.authTag,
        },
        "org:GOOGLE_NATIVE",
      ),
    ).toBe("secret-provider-key-1234");
    expect(maskSecret(encrypted.lastFour)).toBe("••••••••1234");
  });

  it("rejects a ciphertext moved to a different organisation/provider context", () => {
    const encrypted = encryptSecret(
      "secret-provider-key-1234",
      "org-a:GOOGLE_NATIVE",
    );

    expect(() =>
      decryptSecret(
        {
          apiKeyCiphertext: encrypted.ciphertext,
          apiKeyIv: encrypted.iv,
          apiKeyAuthTag: encrypted.authTag,
        },
        "org-b:GOOGLE_NATIVE",
      ),
    ).toThrow();
  });
});
