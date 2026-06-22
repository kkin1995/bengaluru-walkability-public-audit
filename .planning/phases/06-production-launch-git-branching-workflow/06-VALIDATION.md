---
phase: 6
slug: production-launch-git-branching-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
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
| 06-01-01 | 01 | 1 | LAUNCH-01 | — | N/A | manual | verify deploy.yml triggers on staging branch | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | LAUNCH-02 | — | N/A | manual | verify deploy.yml triggers on main branch | ✅ | ⬜ pending |
| 06-01-03 | 01 | 2 | LAUNCH-03 | — | Secrets scoped per GitHub Environment | manual | staging.nammadaari.com returns 200 after deploy | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 2 | LAUNCH-03 | — | N/A | smoke | `curl -f https://staging-api.nammadaari.com/health` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | LAUNCH-01 | — | N/A | manual | nammadaari.com serves coming soon page | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | LAUNCH-01 | — | N/A | smoke | `curl -f https://api.nammadaari.com/health` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 1 | LAUNCH-04 | — | N/A | manual | DEPLOYMENT.md contains branching model docs | ✅ | ⬜ pending |
| 06-04-01 | 04 | 1 | LAUNCH-05 | — | N/A | automated | `.planning/config.json` contains `branching` key | ✅ | ⬜ pending |

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

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cloudflare Tunnel hostname rename api-walkability → api | LAUNCH-02 | Dashboard-only change | Log into Cloudflare dashboard → Zero Trust → Tunnels → edit ingress rules |
| staging-api.nammadaari.com ingress added to tunnel | LAUNCH-03 | Dashboard-only change | Verify `staging-api.nammadaari.com` ingress pointing to localhost:3011 |
| GitHub branch protection on main and staging | LAUNCH-04 | GitHub Settings UI | Verify PR required + CI required + 1 approval on both branches |
| Vercel domain mappings (main→nammadaari.com, staging→staging.nammadaari.com) | LAUNCH-01/03 | Vercel dashboard config | Verify in Vercel Project Settings → Domains |
| Admin seed secrets removed after first login | LAUNCH-02 | Security hygiene | Remove ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD from production GitHub Environment after first admin login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
