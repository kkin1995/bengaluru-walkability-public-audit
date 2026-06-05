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
  - "FIX-11: PENDING — injection method to be selected at checkpoint:decision (Task 2)"
metrics:
  duration: "~2 min (Task 1 only; Task 2 pending checkpoint)"
  completed_date: "2026-06-05T12:01:48Z"
  tasks_completed: 1
  tasks_total: 2
  files_changed: 1
status: partial — stopped at checkpoint:decision (Task 2)
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

**Status: PENDING CHECKPOINT:DECISION**

Execution paused at `type="checkpoint:decision"`. The user must choose the injection mechanism before Task 2 can be implemented. See checkpoint details below.

### Decision required

**Where is NEXT_PUBLIC_BUILD_HASH injected for the production frontend build, such that it carries a fresh per-deploy git short SHA (D-28: never a static value)?**

**Context:** The production frontend deploys to Vercel — `deploy.yml` only builds the backend Docker image on the LXC server. The frontend Dockerfile is NOT used in the production deploy path. Therefore, `NEXT_PUBLIC_BUILD_HASH` cannot be injected by the CI SSH step.

| Option | Label | Pros | Cons |
|--------|-------|------|------|
| `vercel-build-command` | Vercel build command override (recommended) | Matches production deploy path; per-deploy SHA via live `git rev-parse --short HEAD`; no Docker build added; inherently D-28-compliant | Requires user to set Vercel project Build Command in dashboard — Claude cannot do this |
| `vercel-env-var` | Vercel project environment variable | Simple dashboard toggle; no build-command change | D-28 CONSTRAINT: must map to Vercel system variable `$VERCEL_GIT_COMMIT_SHA` (per-deploy), NOT a hardcoded literal hash. Static value violates D-28. |
| `docker-build-arg` | Docker build-arg in deploy.yml | Keeps injection in version-controlled CI; D-28-compliant via live `git rev-parse` | Only valid if frontend moves to LXC Docker stack — currently it does NOT; would change deployment architecture (out of scope for a bug-fix phase) |

**D-28 constraint applies to ALL options:** The value must update per deployment. A static hash string is prohibited regardless of which option is chosen.

**Resume signal:** Select `vercel-build-command`, `vercel-env-var`, or `docker-build-arg` — and confirm whether you will set the Vercel dashboard config yourself. If you select `vercel-env-var`, confirm you will map it to `VERCEL_GIT_COMMIT_SHA` (not a static value), per D-28.

---

## Deviations from Plan

None — plan executed exactly as written for Task 1. Task 2 is gated at the plan's intended `checkpoint:decision`.

## Threat Flags

None — the CSP added is scoped to `https://*.tile.openstreetmap.org` only. No wildcard host, no `unsafe-eval`, no new trust boundary introduced. Matches T-05-12 mitigation disposition in the plan's threat model.

## Known Stubs

None in Task 1's output. The `nginx/nginx.conf` change is complete and not a stub.

## Self-Check: PARTIAL

Task 1 complete. Task 2 pending checkpoint decision from user.

- [x] nginx/nginx.conf modified — `b23cae1` confirmed in git log
- [ ] Task 2 not yet implemented (blocked at checkpoint:decision)
- [ ] deploy.yml comment/changes — pending Task 2 after checkpoint resolves
- [ ] frontend/Dockerfile changes — only applicable if `docker-build-arg` chosen
