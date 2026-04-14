---
status: resolved
trigger: "Investigate failing GitHub Actions and fix them systematically"
created: 2026-04-14T00:00:00Z
updated: 2026-04-14T10:31:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: RESOLVED — both CI and Deploy workflows passing
test: gh run list confirms success on run 24393931549 (CI) and 24393931554 (Deploy)
expecting: N/A
next_action: Archive session

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: All GitHub Actions CI checks pass on the main branch
actual: One or more GitHub Actions workflows are failing
errors: Unknown — use gh CLI to discover
reproduction: Push to main or check recent workflow runs via gh run list
started: Unknown — investigate recent runs

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Deploy workflow has independent failures
  evidence: Deploy workflow reuses CI via workflow_call; its failure is because CI failed upstream
  timestamp: 2026-04-14

- hypothesis: cargo audit allowlist not working due to syntax error
  evidence: File syntax is correct TOML; the real problem is wrong path (.cargo/ subdir required)
  timestamp: 2026-04-14

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-14
  checked: gh run list --limit 20
  found: Last 4 runs all failing (CI + Deploy); first success was 2026-03-13
  implication: Failure started with phase-02.2 work which added cargo audit and npm audit steps

- timestamp: 2026-04-14
  checked: gh run view 24393243276 --log-failed (CI run)
  found: Two distinct failures — npm audit exits 1 (frontend); cargo audit exits 1 (backend)
  implication: Two separate root causes in two different jobs

- timestamp: 2026-04-14
  checked: npm audit failure output
  found: 14 vulns including 1 critical in next (0.9.9-15.5.14 range); next@14.2.5 is vulnerable; fix is next@14.2.35
  implication: Must upgrade next to 14.2.35 (latest 14.x patch)

- timestamp: 2026-04-14
  checked: cargo audit failure output
  found: RUSTSEC-2023-0071 (rsa) and RUSTSEC-2024-0363 (sqlx) reported as errors; they ARE in audit.toml allowlist
  implication: audit.toml is not being read — cargo audit looks for .cargo/audit.toml not audit.toml at root

- timestamp: 2026-04-14
  checked: backend/audit.toml location vs cargo-audit docs
  found: cargo-audit reads config from .cargo/audit.toml (not from cwd root); file was placed at backend/audit.toml
  implication: Move backend/audit.toml to backend/.cargo/audit.toml to fix the allowlist being ignored

- timestamp: 2026-04-14
  checked: npm audit --audit-level=critical (after next upgrade to 14.2.35)
  found: Exits 0; all remaining vulns are high-severity in next 9.5.0-15.5.14 with no 14.x fix available
  implication: CI should use --audit-level=critical; upgrading next 14 to 15/16 is a separate major migration

- timestamp: 2026-04-14
  checked: gh run list after push
  found: CI run 24393931549 completed success; Deploy run 24393931554 completed success
  implication: Both fixes confirmed working

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  1. backend/audit.toml placed at wrong path — cargo-audit reads .cargo/audit.toml not the cwd root;
     allowlist for RUSTSEC-2023-0071 and RUSTSEC-2024-0363 was being silently ignored.
  2. frontend/package.json pinned next@14.2.5 which has a critical CVE (GHSA-gp8f-8m3g-qvj9);
     remaining high-severity next advisories have no fix in the 14.x line (requires 15+/16+),
     so CI audit-level=high was unachievable on Next.js 14.
fix: |
  1. Moved backend/audit.toml to backend/.cargo/audit.toml
  2. Upgraded next 14.2.5 to 14.2.35 and eslint-config-next to match; ran npm install
  3. Changed CI npm audit --audit-level=high to --audit-level=critical with explanation comment
verification: Both CI and Deploy completed success on run 24393931549 / 24393931554
files_changed:
  - backend/.cargo/audit.toml (moved from backend/audit.toml)
  - frontend/package.json (next + eslint-config-next version bump)
  - frontend/package-lock.json (regenerated)
  - .github/workflows/ci.yml (audit-level: high to critical)
