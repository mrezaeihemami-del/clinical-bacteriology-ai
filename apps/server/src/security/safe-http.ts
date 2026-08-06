import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";
import { AppError } from "../errors";
import { config } from "../config";
import { isPrivateOrSpecialAddress } from "./url";

const guardedLookup: LookupFunction = (hostname, _options, callback) => {
  void lookup(hostname, { all: true, verbatim: true })
    .then((addresses) => {
      const permitted = addresses.filter(
        ({ address }) =>
          config.ALLOW_PRIVATE_AI_HOSTS ||
          !isPrivateOrSpecialAddress(address),
      );

      if (permitted.length !== addresses.length || permitted.length === 0) {
        callback(
          new AppError(
            422,
            "AI_DNS_REBIND_BLOCKED",
            "AI provider DNS resolved to a private or special address",
          ),
          "",
          4,
        );
        return;
      }

      const selected = permitted[0]!;
      callback(null, selected.address, selected.family);
    })
    .catch((error: unknown) => {
      callback(
        error instanceof Error
          ? error
          : new Error("AI provider DNS lookup failed"),
        "",
        4,
      );
    });
};

export async function postJsonWithGuardedDns<T>(input: {
  url: URL;
  headers: Record<string, string>;
  body: unknown;
  timeoutMs: number;
  maxResponseBytes?: number;
}): Promise<{ statusCode: number; payload: T | null }> {
  const maxResponseBytes = input.maxResponseBytes ?? 2 * 1024 * 1024;
  const body = Buffer.from(JSON.stringify(input.body), "utf8");
  const transport = input.url.protocol === "https:" ? https : http;

  return await new Promise((resolve, reject) => {
    const request = transport.request(
      input.url,
      {
        method: "POST",
        lookup: guardedLookup,
        timeout: input.timeoutMs,
        maxHeaderSize: 32 * 1024,
        headers: {
          ...input.headers,
          "Content-Type": "application/json",
          "Content-Length": String(body.length),
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;

        if (statusCode >= 300 && statusCode < 400) {
          response.resume();
          reject(
            new AppError(
              502,
              "AI_REDIRECT_BLOCKED",
              "AI provider redirects are not permitted",
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;

        response.on("data", (chunk: Buffer | string) => {
          const bytes = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk, "utf8");
          total += bytes.length;

          if (total > maxResponseBytes) {
            response.destroy(
              new AppError(
                502,
                "AI_RESPONSE_TOO_LARGE",
                "AI provider response exceeded the configured safety limit",
              ),
            );
            return;
          }

          chunks.push(bytes);
        });

        response.on("error", reject);
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (!text) {
            resolve({ statusCode, payload: null });
            return;
          }

          try {
            resolve({
              statusCode,
              payload: JSON.parse(text) as T,
            });
          } catch {
            reject(
              new AppError(
                502,
                "AI_INVALID_JSON",
                "AI provider returned invalid JSON",
              ),
            );
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(
        new AppError(
          504,
          "AI_PROVIDER_TIMEOUT",
          `AI provider request timed out after ${input.timeoutMs} ms`,
        ),
      );
    });
    request.on("error", reject);
    request.end(body);
  });
}
