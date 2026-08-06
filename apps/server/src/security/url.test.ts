import { describe, expect, it } from "vitest";
import { isPrivateOrSpecialAddress } from "./url";

describe("SSRF address classification", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
  ])("blocks private or special address %s", (address) => {
    expect(isPrivateOrSpecialAddress(address)).toBe(true);
  });

  it("allows a public address", () => {
    expect(isPrivateOrSpecialAddress("8.8.8.8")).toBe(false);
  });
});
