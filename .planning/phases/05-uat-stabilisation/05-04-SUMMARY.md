---
phase: 05-uat-stabilisation
plan: "04"
subsystem: nginx / CI
tags: [csp, nginx, ios-safari, build-hash, vercel, fix-04, fix-11]
dependency_graph:
  requires: []
  provides: [public-route-csp, osm-tile-allowlist]
  affects: [nginx/nginx.conf, .github/workflows/deploy.yml, frontend/Dockerfile]
tech_stack:
  added: []
  patterns: [nginx-add-header-per-location, vercel-build-hash-injection]
key_files:
  created: []
  modified:
    - nginx/nginx.conf
decisions:
  - "FIX-04: CSP added directly to location / block (not server block) per nginx add_header inheritance rule (PATTERNS.md Pitfall 7)"
  - "FIX-04: connect-src includes https://*.tile.openstreetmap.org — iOS Safari enforces connect-src for XHR tile fetches; admin block omitted this, public block now includes it"
  - "FIX-11: User selected vercel-build-command — Vercel Build Command set to NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build; documented in deploy.yml; D-28 compliant (per-deploy SHA, never static)"
metrics:
  duration: "~3 min (Tasks 1 + 2)"
  completed_date: "2026-06-05T12:15:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
status: complete
---

# Phase 05 Plan 04: Infrastructure CSP + Build Hash Summary

**One-liner:** nginx public `location /` now sends a CSP that allows OSM tiles in both img-src and connect-src, fixing iOS Safari tile blocking (FIX-04); FIX-11 build-hash injection paused at checkpoint:decision.

---

## Task 1: FIX-04 — Public-route CSP allowing OSM tiles

**Status: COMPLETE** — commit `b23cae1`

### What was done

Added a `Content-Security-Policy` header directly to the public `location /` block in `nginx/nginx.conf`. The header mirrors the existing admin block CSP, with one critical addition: `connect-src` now includes `https://*.tile.openstreetmap.org`.

**CSP value added:**
```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org; connect-src 'self' https://*.tile.openstreetmap.org;
```

**Why connect-src matters for iOS Safari:** Leaflet fetches map tiles via XHR (not `<img>` tags), so `img-src` alone is insufficient. iOS Safari strictly enforces `connect-src` for XHR requests. The admin block (`location /admin`) was already missing `connect-src: https://*.tile.openstreetmap.org` — the public block had no CSP at all. Both tile fetches and image loads are now permitted.

**nginx inheritance rule observed:** `add_header` placed directly in `location /` block. nginx does NOT propagate `add_header` from the `server {}` block into child location blocks that already have their own `add_header` directives.

### D-03 compliance: /uploads/ auth guard check

The `/uploads/` location block was inspected. Confirmed: no `auth_request`, `deny`, `return 401/403`, or any auth directive is present. Unauthenticated GETs to `/uploads/` work as required (D-03). No change needed.

### Verification result

```
grep "Content-Security-Policy" nginx/nginx.conf | grep -o "tile.openstreetmap.org" | wc -l
→ 3 (admin block: 1 img-src occurrence; public block: 2 — img-src + connect-src)
```

Acceptance criteria met:
- [x] Public `location /` block contains `Content-Security-Policy` `add_header` with `always`
- [x] CSP contains `https://*.tile.openstreetmap.org` in both `img-src` and `connect-src`
- [x] Config diff is syntactically valid (matching the admin block's `add_header` form)
- [x] `/uploads/` location has no auth/deny directive

---

## Task 2: FIX-11 — NEXT_PUBLIC_BUILD_HASH injection

**Status: COMPLETE** — commit `c8c5bc8`

### Checkpoint resolution

User selected: **`vercel-build-command`**

### What was done

Added a documentation comment block to `.github/workflows/deploy.yml` under the existing "Required GitHub Actions configuration" header. The comment:
- Contains the literal string `NEXT_PUBLIC_BUILD_HASH`
- Specifies the exact Vercel Build Command: `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build`
- Names the Vercel dashboard location (Build & Development Settings → Build Command)
- Explicitly prohibits static/hardcoded hash values (D-28)

No code change injects a static hash. No Docker frontend build was added to deploy.yml. frontend/Dockerfile was not modified.

### User action required

The operator must set the Vercel project Build Command in the Vercel dashboard:
```
NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build
```
(Vercel Dashboard → Project → Settings → Build & Development Settings → Build Command)

### Post-deploy verification (manual)

After the next Vercel deployment, confirm the admin footer on staging.nammadaari.com shows a non-zero git short SHA (not `0000000`) that matches `git rev-parse --short HEAD` of the deployed commit.

### Acceptance criteria

- [x] `.github/workflows/deploy.yml` contains `NEXT_PUBLIC_BUILD_HASH` in an actionable documentation comment
- [x] `grep -rn "0000000" .github frontend/Dockerfile` returns 0 lines
- [x] No static hash introduced anywhere
- [x] Comment names the exact Vercel build command and dashboard location

---

## Deviations from Plan

None — plan executed exactly as written for Task 1. Task 2 is gated at the plan's intended `checkpoint:decision`.

## Threat Flags

None — the CSP added is scoped to `https://*.tile.openstreetmap.org` only. No wildcard host, no `unsafe-eval`, no new trust boundary introduced. Matches T-05-12 mitigation disposition in the plan's threat model.

## Known Stubs

None in Task 1's output. The `nginx/nginx.conf` change is complete and not a stub.

## Self-Check: PASSED

Both tasks complete.

- [x] nginx/nginx.conf modified — `b23cae1` confirmed in git log
- [x] Public `location /` CSP allows `https://*.tile.openstreetmap.org` in both img-src and connect-src
- [x] deploy.yml documentation comment added — `c8c5bc8` — contains NEXT_PUBLIC_BUILD_HASH instruction
- [x] No static hash introduced; `grep -rn "0000000" .github frontend/Dockerfile` → 0 lines
- [x] frontend/Dockerfile not modified (vercel-build-command path does not require it)
- [x] User action recorded: set Vercel Build Command to inject per-deploy SHA
