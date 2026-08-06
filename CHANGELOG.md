## 2.0.3-v7

- Added client-side validation for case codes of 3 to 64 characters.
- Trimmed case code and culture media before case creation.
- Replaced generic Zod validation responses with field-specific messages.
- Added an integration regression test for short case codes.
- Updated runtime version identification to `2.0.3-v7`.

# Changelog

## 2.0.2-v6

- Fixed the ADMIN `case:read` forbidden error that could obscure AI-provider configuration.
- Added read-only case access for ADMIN without case mutation permissions.
- Prevented stale browser bundles by disabling cache for `index.html`.
- Added runtime build identification at `/api/version`.
- Force-recreated the application container during startup.


## 2.0.1-fixed-v5

- Reworked AI provider form submission and visible save confirmation.
- Added server-side save acknowledgement and transactional audit write.
- Preserved encrypted API keys when updating provider settings without a new key.
- Added provider-specific stored-key testing.
- Added exact API error codes and request IDs to the settings dialog.
- Fixed invalid Pino redact path.
- Removed duplicate initial migration constraints.
- Removed unavailable `@types/ipaddr.js` package.
- Fixed strict optional-property and Vite configuration build failures.
- Added Docker dependency resilience and fail-fast startup diagnostics.

## 2.0.4 — Windows PowerShell Docker output handling

- Fixed false build failure caused by normal Docker/BuildKit stderr progress
  being promoted to a terminating PowerShell error.
- Startup now waits for Docker's actual exit code.
- Full build output is shown and retained in `logs/`.

# Change log

## 2.0.0 — Controlled reconstruction

This is a replacement implementation rather than a cosmetic patch.

### Removed

- Browser-selected roles and client-only access control.
- Express and FastAPI backends owning separate in-memory state.
- Filename and clinical-note image heuristics.
- Fake paths and Base64 image data stored as `file_path`.
- Simulated AI confidence and success fallbacks.
- Public mutation, sign-off, reset and audit routes.

### Added

- One TypeScript backend with PostgreSQL as the source of truth.
- Prisma schema and versioned migration.
- Database sessions, server-side roles and organisation scoping.
- Real multipart upload with byte-level MIME verification.
- Image decode, pixel limits, metadata stripping and SHA-256 integrity.
- Private S3/MinIO object storage.
- Real Gemini `inlineData` and OpenAI-compatible multimodal adapters.
- Structured provider output plus fail-closed Zod validation.
- Pre-model low-information image rejection and post-model clinical-scope
  checks.
- Encrypted organisation-scoped BYOK settings.
- Allowlists, DNS validation, guarded connection-time lookup and redirect
  blocking for custom AI endpoints.
- Database workflow transitions, concurrency controls and human review.
- Append-only audit events and database-backed rate limiting.
- Unit, integration and Playwright upload tests.
- Docker, CI, API, architecture and clinical-validation documentation.

### Deliberately not claimed

- Clinical accuracy or regulatory approval.
- Fitness for processing identifiable patient data.
- Absence of security vulnerabilities.
- Runtime verification in every deployment environment.

## 2.0.1-local-port-ready

- Made API, web, PostgreSQL, and MinIO host ports configurable through `.env`.
- Changed the local API default from port 3000 to 3001.
- Made the Vite API proxy and Playwright URLs environment-driven.
- Made the server load the repository-root `.env` deterministically from workspace scripts.
- Added `Start-CBAI-Local.ps1` for Windows setup and startup.
- Documented the recommended encrypted Gemini BYOK path through the administrator UI.
