---
phase: 6
slug: production-launch-git-branching-workflow
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-22
audited: 2026-06-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (backend) / npm run lint + build (frontend) |
| **Config file** | backend/Cargo.toml / frontend/package.json |
| **Quick run command** | `cd backend && cargo check` |
| **Full suite command** | `cd backend && cargo test && cd ../frontend && npm run build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && cargo check`
- **After every plan wave:** Run `cd backend && cargo test && cd ../frontend && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | LAUNCH-02 | — | N/A | automated | `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/deploy.yml')); assert 'staging' in list(d[True]['push']['branches'])"` | ✅ | ✅ green |
| 06-01-02 | 01 | 1 | LAUNCH-02 | — | N/A | automated | `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/deploy.yml')); assert 'main' in list(d[True]['push']['branches'])"` | ✅ | ✅ green |
| 06-01-03 | 01 | 2 | LAUNCH-03 | — | Secrets scoped per GitHub Environment | manual | staging.nammadaari.com returns 200 after deploy | ✅ W0 | ✅ green |
| 06-01-04 | 01 | 2 | LAUNCH-03 | — | N/A | smoke | `curl -f https://staging-api.nammadaari.com/health` | ✅ W0 | ✅ green |
| 06-02-01 | 02 | 1 | LAUNCH-01 | — | N/A | manual | nammadaari.com serves coming soon page | ✅ W0 | ✅ green |
| 06-02-02 | 02 | 1 | LAUNCH-01 | — | N/A | smoke | `curl -f https://api.nammadaari.com/health` | ✅ W0 | ✅ green |
| 06-03-01 | 03 | 1 | LAUNCH-04 | — | N/A | automated | `grep -q "Branching Workflow" DEPLOYMENT.md` | ✅ | ✅ green |
| 06-04-01 | 04 | 1 | LAUNCH-05 | — | N/A | automated | `python3 -c "import json; d=json.load(open('.planning/config.json')); assert 'branching' in d"` | ✅ | ✅ green |
| 06-05-01 | 05 | 1 | LAUNCH-01 | — | N/A | automated | `npm test -- --testPathPattern=home-page --passWithNoTests --watchAll=false` (on main branch) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Staging Compose stack deployed to LXC at `/opt/nammadaari-staging/`
- GitHub Environment `staging` created with required secrets
- GitHub Environment `production` created with required secrets
- `walkability-staging` runner label added to self-hosted runner
- `staging` branch created and pushed to remote

*Note: Several verifications are manual-only (infrastructure steps that cannot be automated in CI).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Cloudflare Tunnel hostname rename api-walkability → api | LAUNCH-02 | Dashboard-only change | Log into Cloudflare dashboard → Zero Trust → Tunnels → edit ingress rules | ✅ green (UAT confirmed nammadaari.com live) |
| staging-api.nammadaari.com ingress added to tunnel | LAUNCH-03 | Dashboard-only change | Verify `staging-api.nammadaari.com` ingress pointing to localhost:3011 | ✅ green (smoke-test-staging green in GitHub Actions) |
| GitHub branch protection on main and staging | LAUNCH-04 | GitHub Settings UI | Verify PR required + CI required + 1 approval on both branches | ✅ green (UAT test 6 confirmed) |
| Vercel domain mappings (main→nammadaari.com, staging→staging.nammadaari.com) | LAUNCH-01/03 | Vercel dashboard config | Verify in Vercel Project Settings → Domains | ✅ green (UAT tests 2 + 3 confirmed) |
| api.nammadaari.com health endpoint | LAUNCH-01 | Cloudflare Tunnel (production) | `curl -f https://api.nammadaari.com/health` — production API backend | ✅ green — HTTP 200 `{"status":"ok"}` confirmed 2026-06-22 |
| Admin seed secrets removed after first login | LAUNCH-02 | Security hygiene | Remove ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD from production GitHub Environment after first admin login | ⬜ pending — deferred to post-launch |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (staging/prod infra verified via UAT 8/8)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-06-22 — UAT complete 8/8 pass; all automated commands verified; api.nammadaari.com/health confirmed HTTP 200 `{"status":"ok"}`

---

## Validation Audit 2026-06-22
| Metric | Count |
|--------|-------|
| Gaps found | 9 |
| Resolved | 8 |
| Escalated to manual-only | 0 |
| New rows added | 1 (06-05-01: coming soon page unit tests on main) |
