import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { AppError } from "../errors";
import { config } from "../config";

const disallowedRanges = new Set([
  "unspecified",
  "broadcast",
  "multicast",
  "linkLocal",
  "loopback",
  "private",
  "reserved",
  "carrierGradeNat",
  "uniqueLocal",
  "ipv4Mapped",
]);

export function isPrivateOrSpecialAddress(address: string): boolean {
  const parsed = ipaddr.parse(address);
  return disallowedRanges.has(parsed.range());
}

export async function assertSafeProviderBaseUrl(
  rawUrl: string,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(422, "INVALID_BASE_URL", "Base URL is invalid");
  }

  if (url.username || url.password) {
    throw new AppError(
      422,
      "URL_CREDENTIALS_FORBIDDEN",
      "Credentials must not be embedded in the Base URL",
    );
  }

  const hostname = url.hostname.toLowerCase();
  const explicitlyAllowed = config.customAiAllowedHosts.includes(hostname);

  if (!explicitlyAllowed) {
    throw new AppError(
      422,
      "AI_HOST_NOT_ALLOWLISTED",
      "The AI provider host is not in CUSTOM_AI_ALLOWED_HOSTS",
    );
  }

  if (url.protocol !== "https:") {
    if (!(config.ALLOW_PRIVATE_AI_HOSTS && url.protocol === "http:")) {
      throw new AppError(
        422,
        "HTTPS_REQUIRED",
        "Custom AI providers must use HTTPS",
      );
    }
  }

  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError(
      422,
      "AI_HOST_DNS_FAILURE",
      "The AI provider host could not be resolved",
    );
  }

  if (addresses.length === 0) {
    throw new AppError(
      422,
      "AI_HOST_DNS_FAILURE",
      "The AI provider host has no addresses",
    );
  }

  const hasSpecialAddress = addresses.some(({ address }) =>
    isPrivateOrSpecialAddress(address),
  );

  if (hasSpecialAddress && !config.ALLOW_PRIVATE_AI_HOSTS) {
    throw new AppError(
      422,
      "PRIVATE_AI_HOST_BLOCKED",
      "The AI provider resolves to a private or special network address",
    );
  }

  return url;
}
