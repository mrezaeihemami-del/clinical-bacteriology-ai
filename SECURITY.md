# Security policy

This repository handles potentially sensitive laboratory data. Do not deploy it
with real patient material until the organisation has completed privacy,
security, legal and clinical reviews.

## Secrets

- Store `AI_CONFIG_MASTER_KEY`, database credentials, object-storage
  credentials and provider API keys in a managed secret store.
- Never commit `.env` files.
- Rotate provider keys and the application master key under a documented
  procedure.
- Restrict administrator access and outbound network destinations.

## Reporting

Report suspected vulnerabilities privately to the owning laboratory or
deployment operator. Include the affected version, route, preconditions and a
minimal reproduction. Do not include patient data, API keys or live
credentials.

## Operational verification still required

Static source review and automated tests are not a penetration test. A
production deployment requires threat modelling, dependency scanning,
penetration testing, backup/restore exercises, monitoring, incident response
and periodic access review.
