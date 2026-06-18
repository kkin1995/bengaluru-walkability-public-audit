---
status: partial
phase: 05-uat-stabilisation
source: [05-VERIFICATION.md]
started: 2026-06-05T12:45:00Z
updated: 2026-06-05T15:30:00Z
---

## Current Test

[testing paused — 1 item blocked on Phase 5 deployment]

## Tests

### 1. FIX-11 — NEXT_PUBLIC_BUILD_HASH shows real SHA in admin footer (not 0000000)

expected: After setting the Vercel Build Command to `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build` in the Vercel dashboard, the admin login footer on staging.nammadaari.com shows a non-zero git short SHA that matches the deployed commit's `git rev-parse --short HEAD`.
result: blocked
blocked_by: release-build
reason: "Phase 5 has not been deployed to staging yet. The Vercel build command change applies to future deployments, but testing against old deployed code would not verify the Phase 5 fix. Must ship Phase 5 first, then verify."

## Summary

total: 1
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps
