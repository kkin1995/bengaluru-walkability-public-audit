---
phase: 06-production-launch-git-branching-workflow
plan: "03"
subsystem: infra
tags: [docker-compose, nginx, staging, isolation, ports, volumes]

requires:
  - phase: "06-01"
    provides: "staging branch exists; production compose file renamed to docker-compose.production-server.yml"
  - phase: "06-02"
    provides: "deploy.yml restructured for dual-branch staging/production deploy"
provides:
  - "docker-compose.staging-server.yml: staging Compose override with nginx port 3011:80, backend port 3011, isolated volumes postgres_staging_data + uploads_staging, PUBLIC_URL for staging API"
  - "nginx/nginx.staging-server.conf: independent nginx config for staging with upstream backend:3011"
  - "Staging stack fully isolated from production — concurrent operation is safe (no port 80 conflict)"
affects: [06-04, deploy.yml, DEPLOYMENT.md, Cloudflare Tunnel second ingress rule]

tech-stack:
  added: []
  patterns:
    - "Compose overlay isolation: staging override adds only what differs from base; does not redeclare production volumes"
    - "Nginx independent copy pattern: staging and production configs are independent files with no shared includes (D-15)"
    - "Port namespace separation: staging owns host port 3011, production owns host port 80"

key-files:
  created:
    - docker-compose.staging-server.yml
    - nginx/nginx.staging-server.conf
  modified: []

key-decisions:
  - "Staging nginx publishes on host port 3011:80 so production nginx can continue to own port 80 — both stacks can run simultaneously on the same LXC"
  - "Staging backend internal port is 3011; DATABASE_URL still uses db:5432 because that is always the container-internal port"
  - "postgres_staging_data and uploads_staging are the only volumes declared in the staging override — base volumes (postgres_data, uploads) are NOT redeclared to avoid accidental collision"
  - "nginx.staging-server.conf is a complete independent copy of nginx.server.conf with only the upstream port changed (3001 → 3011) per D-15 — no shared includes"
  - "host port 5433 exposed for staging db to support solo-developer debugging convenience (D-06)"
  - "frontend service parked behind profile frontend-only — staging stack starts db, backend, and nginx only"

patterns-established:
  - "Compose override isolation: create a minimal override file that only changes what differs; let the base file own the common config"
  - "Nginx config independence: when two nginx configs serve different environments, duplicate the entire file rather than using includes or conditionals"

requirements-completed: [LAUNCH-03]

duration: 3min
completed: 2026-06-22
status: complete
---

# Phase 06 Plan 03: Staging Docker Compose + Nginx Config Summary

**Staging infrastructure isolated from production via port 3011, independent nginx config (upstream backend:3011), and separate named volumes (postgres_staging_data, uploads_staging).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-22T10:08:51Z
- **Completed:** 2026-06-22T10:11:33Z
- **Tasks:** 2/2
- **Files modified:** 2

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create docker-compose.staging-server.yml | 5d63f14 | docker-compose.staging-server.yml |
| 2 | Create nginx/nginx.staging-server.conf | 5d63f14 | nginx/nginx.staging-server.conf |

Note: Tasks 1 and 2 were committed together in a single atomic commit per the plan's instruction ("Commit both Task 1 and Task 2 together").

## What Was Built

### docker-compose.staging-server.yml

A Compose override file that isolates the staging stack from production on the same LXC:

- **nginx**: ports `3011:80` (production owns `80:80`); mounts `nginx.staging-server.conf`; `frontend` dependency is `required: false`
- **backend**: `PORT=3011`, `PUBLIC_URL=https://staging-api.nammadaari.com`; volume override `uploads_staging:/app/uploads`; healthcheck hits `localhost:3011`
- **db**: volume override `postgres_staging_data:/var/lib/postgresql/data`; host port `5433:5432` for debugging
- **frontend**: parked behind `profiles: [frontend-only]` — does not start by default
- **volumes**: declares only `postgres_staging_data` and `uploads_staging` (base volumes `postgres_data` and `uploads` are not redeclared)

Usage: `docker compose -f docker-compose.yml -f docker-compose.staging-server.yml up -d db backend nginx`

### nginx/nginx.staging-server.conf

An independent copy of `nginx/nginx.server.conf` with the single change `server backend:3011` (was `backend:3001`). All other content is identical:
- All 4 rate limiting zones: `upload`, `admin_login`, `admin_api`, `geojson_public`
- All location blocks: `/api/reports.geojson`, `/api/admin/auth/login`, `/api/admin/`, `/api/`, `/uploads/`, `/health`, `/` (catch-all 404)
- JSON access log format
- TLS termination comment block
- All proxy timeouts and headers

Production `nginx/nginx.server.conf` is unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface

Both new network ports are in-scope per the plan's threat model:

| Flag | File | Description |
|------|------|-------------|
| in-scope T-06-03-02 | docker-compose.staging-server.yml | Host port 3011 (staging nginx) — Cloudflare Tunnel second ingress routes staging-api.nammadaari.com here |
| in-scope T-06-03-01 | docker-compose.staging-server.yml | Host port 5433 (staging db debug) — exposes PostgreSQL for solo-developer debugging; isolated from production db |

Both ports are documented in the threat model as mitigated by the volume and port isolation design.

## Known Stubs

None — all values are concrete (port 3011, staging domain, staging volume names).

## Self-Check: PASSED

- docker-compose.staging-server.yml: EXISTS
- nginx/nginx.staging-server.conf: EXISTS
- Commit 5d63f14: EXISTS (`git log --oneline | grep 5d63f14` confirms)
- Verification: `python3 yaml PASS`; `grep -c backend:3011 = 1`; `grep -c backend:3001 = 0`; production conf unchanged
