# API summary

All routes except health and login require an HTTP-only session cookie.

## Authentication

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

## Cases

- `GET /api/cases`
- `POST /api/cases`
- `GET /api/cases/:caseId`
- `PATCH /api/cases/:caseId`
- `DELETE /api/cases/:caseId` — archives only an empty draft
- `POST /api/cases/:caseId/submit`
- `POST /api/cases/:caseId/reviews`
- `POST /api/cases/:caseId/finalise`

## Images

- `POST /api/cases/:caseId/images` — multipart field `image`
- `GET /api/images/:imageId/url`
- `DELETE /api/images/:imageId`
- `POST /api/images/:imageId/analyse`

## Provider settings

Administrator only:

- `GET /api/settings/ai-providers`
- `PUT /api/settings/ai-providers`
- `POST /api/settings/ai-providers/test`

## Audit

- `GET /api/audit?limit=100&caseId=...`

There is no public seed endpoint, audit reset endpoint or client-supplied role.
