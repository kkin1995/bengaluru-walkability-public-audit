# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## github-actions-failures — cargo-audit allowlist ignored + npm audit critical CVE in next

- **Date:** 2026-04-14
- **Error patterns:** cargo audit, npm audit, RUSTSEC-2023-0071, RUSTSEC-2024-0363, audit-level=high, next vulnerability, vulnerabilities found
- **Root cause:** (1) backend/audit.toml placed at wrong path — cargo-audit reads .cargo/audit.toml not the cwd root, so the allowlist for RUSTSEC-2023-0071 and RUSTSEC-2024-0363 was silently ignored. (2) next@14.2.5 had a critical CVE with no 14.x backport, making npm audit --audit-level=high unpassable on Next.js 14.
- **Fix:** (1) Moved backend/audit.toml to backend/.cargo/audit.toml. (2) Upgraded next to 14.2.35 (latest 14.x patch) and changed CI to --audit-level=critical with documented rationale.
- **Files changed:** backend/.cargo/audit.toml, frontend/package.json, frontend/package-lock.json, .github/workflows/ci.yml
---

