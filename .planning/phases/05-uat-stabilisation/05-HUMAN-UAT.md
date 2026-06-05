---
status: partial
phase: 05-uat-stabilisation
source: [05-VERIFICATION.md]
started: 2026-06-05T12:45:00Z
updated: 2026-06-05T12:45:00Z
---

## Current Test

[awaiting human verification of Vercel dashboard build hash config]

## Tests

### 1. FIX-11 — NEXT_PUBLIC_BUILD_HASH shows real SHA in admin footer (not 0000000)

expected: After setting the Vercel Build Command to `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build` in the Vercel dashboard, the admin login footer on staging.nammadaari.com shows a non-zero git short SHA that matches the deployed commit's `git rev-parse --short HEAD`.
result: [pending]

**Steps to verify:**
1. In the Vercel dashboard → Project → Settings → Build & Development Settings → Build Command, set:
   ```
   NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build
   ```
2. Trigger a new Vercel deployment (push to the deploy branch or manually trigger)
3. Load https://staging.nammadaari.com/admin/login
4. Check the footer — it should show a real 7-character git SHA (not `0000000`)
5. Confirm that SHA matches `git rev-parse --short HEAD` of the deployed commit

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
