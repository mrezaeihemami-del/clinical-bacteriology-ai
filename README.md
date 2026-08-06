# Docker-only local MVP

For the simplest Windows setup, install only Docker Desktop and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Start-Docker.ps1
```

See `README.DOCKER.fa.md` for the Persian guide.

---

# Clinical Bacteriology AI Assistant — Controlled Reconstruction

This repository is a complete replacement for the supplied MVP. It removes the
in-memory data stores, simulated image analysis, browser-selected roles, fake
file paths and public destructive endpoints.

The application performs **real multipart image upload**, validates the actual
image bytes, stores the normalised image in private object storage, sends the
real image bytes to a configured multimodal provider, validates the structured
response, and requires an authenticated microbiologist or supervisor to review
the result.

> **Clinical boundary:** this software is not clinically validated, is not a
> diagnostic medical device, and must not autonomously identify organisms,
> estimate CFU/mL, or issue a final clinical report. AI output is limited to
> assistive visual observations and always requires human review.

## Stack

- React 19 and Vite
- Express 5 and TypeScript
- PostgreSQL with Prisma migrations
- Private S3-compatible object storage; MinIO is supplied for development
- Database-backed server sessions with HTTP-only cookies
- One organisation-scoped membership per user account
- Server-side RBAC and workflow transitions
- Encrypted organisation-scoped BYOK provider settings
- Google Gemini native adapter
- OpenAI-compatible multimodal adapter
- Zod validation and provider-side JSON schema
- Vitest unit and integration tests
- Docker Compose for PostgreSQL and MinIO
- GitHub Actions CI

## Quick start

Requirements:

- Node.js 20.11 or later
- npm 10 or later
- Docker with Docker Compose

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment configuration

```bash
cp .env.example .env
node scripts/generate-master-key.mjs
```

Copy the generated value into `AI_CONFIG_MASTER_KEY` in `.env`.

### 3. Start PostgreSQL and private object storage

```bash
docker compose up -d
```

### 4. Generate Prisma client and apply migrations

```bash
npm run db:generate
npm run db:migrate:deploy
```

### 5. Create development users

```bash
npm run db:seed
```

Development-only accounts:

| Role | Email | Password |
|---|---|---|
| Technologist | `technician@example.test` | `ChangeMe-123!` |
| Microbiologist | `microbiologist@example.test` | `ChangeMe-123!` |
| Supervisor | `supervisor@example.test` | `ChangeMe-123!` |
| Administrator | `admin@example.test` | `ChangeMe-123!` |

Never use these credentials outside local development.

### 6. Start the application

```bash
npm run dev
```

- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`
- MinIO console: `http://localhost:9001`

## Real image-upload flow

```text
Authenticated user
  → server-side permission check
  → multipart/FormData request
  → request and file-size limits
  → magic-byte MIME detection
  → claimed/detected MIME comparison
  → image decode and pixel limit
  → EXIF-stripping normalisation
  → SHA-256 hash
  → private object storage
  → PostgreSQL metadata transaction
  → workflow transition
  → append-only audit event
  → visible success or actionable error
```

The server accepts genuine JPEG, PNG and WebP images. It rejects non-image
content, corrupt images, MIME spoofing, images smaller than 64 × 64, excessive
pixel counts, duplicate images in the same case, and files over the configured
limit.

Images are not stored as Base64 in `file_path`. The database stores only the
private storage key and validated metadata. The UI receives short-lived signed
read URLs.

## Real multimodal provider flow

The AI adapter receives the exact bytes retrieved from private storage and
verifies their SHA-256 hash against the database before sending them to the
provider.

The Google adapter sends:

```ts
contents: [
  {
    inlineData: {
      mimeType: detectedMimeType,
      data: imageBytes.toString("base64"),
    },
  },
  { text: imageOnlyPrompt },
]
```

The prompt deliberately excludes filenames and clinical notes. It prohibits
organism identification and CFU estimates. An inadequate image must return
`unable_to_assess`.

The default Google model preset is `gemini-3.6-flash`. Model availability may
change; administrators can update the model identifier in the provider screen.
Google documents image input and structured output at:

- `https://ai.google.dev/gemini-api/docs/image-understanding`
- `https://ai.google.dev/gemini-api/docs/structured-output`
- `https://ai.google.dev/gemini-api/docs/models`

## BYOK security

Provider configuration is organisation-scoped. API keys are encrypted with
AES-256-GCM using `AI_CONFIG_MASTER_KEY`.

The raw key:

- is accepted only by an administrator endpoint;
- is never returned after submission;
- is not stored in browser storage;
- is redacted from HTTP logs;
- is not included in audit metadata;
- is displayed only as a last-four mask;
- can be replaced without reading the previous plaintext.

For OpenAI-compatible providers, the hostname must be listed in
`CUSTOM_AI_ALLOWED_HOSTS`. Custom provider URLs are checked for protocol,
embedded credentials, DNS resolution and private/special IP ranges before
requests. Redirects are blocked.

Network egress controls are still recommended in production because
application-level SSRF controls are not a substitute for firewall policy.

## Vision connection test

The provider test does not use a meaningless one-pixel probe. It generates two
64 × 64 images—one red and one blue—and passes only if the provider identifies
both correctly with schema-valid responses.

This proves image transport and basic visual differentiation. It **does not**
prove bacteriology accuracy.

## Roles

### Technologist

- create and edit mutable cases;
- upload and remove images;
- run image analysis;
- submit a completed case for review.

### Microbiologist

- view cases;
- run analysis;
- approve or reject submitted cases;
- read audit events.

### Laboratory supervisor

- perform technologist and microbiologist workflow actions;
- record a justified override;
- finalise an approved case;
- read audit events.

### Administrator

- manage AI provider settings;
- read audit events;
- cannot approve a clinical case merely because they are an administrator.

Every privileged operation is enforced by the server. Hiding a button in React
is only a usability measure.

## Workflow

```text
DRAFT
  → IMAGE_UPLOADED
  → QC_COMPLETED
  → TRIAGE_COMPLETED
  → SUBMITTED_FOR_REVIEW
  → APPROVED or REJECTED
  → FINALISED
```

An inadequate or unassessable image stops at `QC_COMPLETED`. A rejected case
can return to `IMAGE_UPLOADED` only after a new validated image is uploaded.
Only a microbiologist or supervisor can approve or reject. Only a supervisor
can override or finalise.

## Tests

Unit tests cover:

- workflow transitions and denied-role behaviour;
- fail-closed AI output schema;
- image-only prompt boundaries;
- real MIME detection;
- corrupt and one-pixel image rejection;
- API-key encryption;
- IPv4 and IPv6 SSRF classifications;
- UI role guidance.

Integration tests cover:

- real multipart upload;
- private storage and database metadata;
- workflow transition after upload;
- MIME spoofing rejection;
- server-side denial of technician review;
- encrypted and masked provider-key storage.

A Playwright browser test signs in as a technologist, creates a case,
selects a genuine PNG file through the browser file picker, submits the
multipart request and verifies the persisted upload in the UI.

Run:

```bash
npm test
npm run test:integration
npm run typecheck
npm run build
npm run test:e2e
```

The integration and browser tests require PostgreSQL and MinIO. Install the
browser once with `npx playwright install chromium`.

## Production deployment

1. Provision PostgreSQL and a private S3-compatible bucket.
2. Generate a unique production `AI_CONFIG_MASTER_KEY`; store it in a secret
   manager.
3. Set secure S3 credentials and a production `WEB_ORIGIN`.
4. Apply `npm run db:migrate:deploy` as a controlled release step.
5. Build with `npm run build`.
6. Run `node apps/server/dist/index.js`.
7. Place the service behind TLS and a reverse proxy.
8. Restrict outbound network access to approved AI providers.
9. Configure backup, restore tests, monitoring, alerting and secret rotation.
10. Complete privacy, legal and clinical validation before processing real
    patient material.

The Dockerfile intentionally does not run migrations automatically at startup.

## Important remaining boundaries

The rewrite fixes the software deficiencies identified in the supplied MVP, but
it cannot establish:

- clinical sensitivity, specificity or diagnostic accuracy;
- regulatory approval;
- compliance with local health-data law;
- suitability of a provider's free tier for patient information;
- performance under the laboratory's real workload;
- production security without operational review and penetration testing;
- model stability across provider updates.

A labelled expert dataset, pre-defined acceptance thresholds, blinded
evaluation, error analysis and human-factors study are required before any
clinical claim.


## Windows PowerShell local startup

The local API and Vite proxy are environment-driven. Port `3001` is the default,
so another project may continue using port `3000`.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Start-CBAI-Local.ps1
```

The script selects available ports, creates `.env`, starts PostgreSQL and MinIO
through Docker, applies migrations, seeds development users, and starts the API
and web development servers.

The recommended Gemini key path is the administrator UI:
sign in as `admin@example.test`, open **AI provider settings**, choose
**Google Gemini native**, paste the key, save, and run **Test real vision**.
For a temporary local fallback, set `GOOGLE_GEMINI_API_KEY` in `.env`.
