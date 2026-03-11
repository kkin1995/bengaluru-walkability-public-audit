# Features Research: Civic Issue Reporting Platforms

**Dimension:** Feature landscape for civic walkability / issue reporting
**Date:** 2026-03-11
**Reference platforms:** FixMyStreet (UK/mySociety), SeeClickFix (US), Seva Sindhu (Karnataka), BBMP Sahaaya, mySidewalk

---

## Platform Analysis

### FixMyStreet (mySociety, UK) — Most Relevant Reference
**What they got right:**
- Anonymous-first reporting — no account required, just email for notification
- Photo + pin-on-map as the primary UX — simple, universal
- Public map showing all reports with status — accountability through transparency
- Ward/council auto-routing from coordinates — magic that governments love
- Open source — credibility, forkable for Indian deployments
- "Me too" button — builds signal on important issues without duplicate reports

**What they got wrong:**
- Email-dependent for notifications — fails in India where email adoption is lower than WhatsApp
- UK council integration assumed — routing logic embedded, hard to adapt to GBA's 5-corporation structure
- No analytics dashboard — data is there but not surfaced for policy use
- No data export for researchers — CSV available but not promoted

### SeeClickFix (US, commercial)
**What they got right:**
- Government-facing triage queue is the core product — built for government, not just citizens
- Status lifecycle with timestamps — accountability audit trail
- Before/after photos on resolution — powerful for trust
- Trend analytics per ward/district — exactly what GBA planners need

**What they got wrong:**
- Citizen account required — kills anonymous participation
- US-centric category taxonomy — needs heavy localization for India
- Mobile app required for best experience — web UX is secondary
- Commercial SaaS pricing — non-starter for Indian government

### Seva Sindhu (Karnataka Government Portal)
**What they got right:**
- Government-native workflow — built for how Karnataka bureaucracy works
- Hindi/Kannada support — critical for adoption
- Official endorsement drives usage

**What they got wrong:**
- Account mandatory (Aadhaar-linked in some flows) — massive barrier
- Reports disappear into bureaucracy with no public visibility
- No public map — zero accountability
- Download-heavy Android app — not accessible on low-end phones

### BBMP Sahaaya / 1533 Helpline
**What they got right:**
- Phone/WhatsApp channel — meets citizens where they are
- Physical ward office routing is familiar to staff

**What they got wrong:**
- No structured data — complaints as unstructured text, useless for analytics
- No public accountability — citizen has no way to verify action taken
- No photo evidence — reports are vague, easy to dismiss

### Lessons for This Platform
- Photo + map pin = non-negotiable for credibility
- Public map with status = non-negotiable for accountability
- Anonymous default = non-negotiable for adoption
- Government-facing triage is as important as citizen-facing submission
- Ward-level aggregation = what makes data policy-relevant

---

## Table Stakes

Features the system must have or government/citizens won't trust it.

| Feature | Complexity | Dependency | Why It's Table Stakes |
|---------|-----------|-----------|----------------------|
| Photo + GPS submission | existing | — | Core evidence; without photo it's a complaint, not a report |
| Anonymous-by-default reporting | existing | — | Removes barrier; prevents chilling effect |
| Public map with all reports | partially done | — | Accountability; press and citizens verify government action |
| Report status on public map | missing | status lifecycle | Closes loop; shows government is acting |
| Status lifecycle (Open → Assigned → Resolved) | missing | — | Government workflow foundation |
| Ward auto-tagging from coordinates | missing | ward boundary data | Routes reports to right corporation without manual triage |
| Anti-abuse: per-IP rate limiting | partially (Nginx) | — | Prevents flooding; protects system credibility |
| Duplicate detection (proximity + category) | missing | ward tagging | Prevents clutter; builds "vote on issue" signal |
| CSV export for government use | missing | — | GBA planners need data in Excel — no GeoJSON literacy assumed |
| GeoJSON export for researchers | missing | — | PWN algorithm and advocacy groups need geospatial format |
| Basic public stats (total reports, top issues) | missing | — | Press-ready numbers; GBA credibility metric |
| Image validation (type, size, basic sanity) | partially done | — | Prevents storage abuse and inappropriate content |

---

## Differentiators

Features that make this more powerful than a WhatsApp group to GBA.

| Feature | Complexity | Why It Differentiates |
|---------|-----------|----------------------|
| Ward-level heatmap on public map | Medium | Visual = political; councillors respond to ward-level pressure |
| Before/after photo comparison | Low | Proof that resolution actually happened; accountability without auditor |
| Trend charts (reports over time per category) | Medium | Shows whether problem is getting better or worse — policy feedback loop |
| Field team view (assigned reports with map) | Medium | Makes government workflow mobile-first; field teams use phones |
| Kannada / bilingual UI | existing (partial) | Required for GBA staff adoption; Kannada-first signals respect |
| "Me too" / upvote on existing report | Low | Builds severity signal from duplicate reports instead of discarding them |
| Admin analytics: ward comparison table | Medium | Councillors want to know if their ward is worse than neighbours |
| Shareable report permalink | Low | Press can link to specific reports; advocacy groups build campaigns |
| GeoJSON ward overlay on public map | Medium | Shows ward boundaries + issue density = policy map |
| Public resolution rate by ward | Medium | Accountability index; drives inter-ward competition |

---

## Anti-Features

Deliberately NOT building these.

| Feature | Why Not |
|---------|---------|
| Citizen accounts / login | Kills anonymous participation; FixMyStreet data shows 70%+ drop in submissions when account required |
| Aadhaar / phone verification | Privacy risk; excludes marginalized communities; political liability |
| CAPTCHA | Hostile UX on mobile; ineffective against determined bots; rate limiting is better |
| SMS notifications | Twilio cost + Telecom compliance (TRAI DLT registration) adds months of delay; use public map for resolution status |
| WhatsApp channel | Complexity; requires WhatsApp Business API approval; v2 feature |
| Native Android/iOS apps | Web PWA is sufficient; maintaining two codebases with 1 developer is not viable |
| Gamification (points, badges) | Trivializes serious civic infrastructure failure; GBA won't take it seriously |
| AI/ML categorization | Training data doesn't exist yet; manual categories are cleaner at this scale |
| Voting/downvoting | Enables organized suppression of reports in politically sensitive areas |
| Social sharing buttons | Adds social media dependencies; privacy risk; shareable permalink is sufficient |

---

## Feature Dependency Graph

```
Ward boundary data
    └── Ward auto-tagging
            ├── Ward-level heatmap (public map)
            ├── Ward comparison analytics (admin)
            └── Admin ward-based routing

Status lifecycle
    ├── Report status on public map
    ├── Before/after photo on resolution
    ├── Field team assigned view
    └── Public resolution rate by ward

Duplicate detection
    └── "Me too" / vote count on reports
            └── Severity signal for admin triage

CSV/GeoJSON export
    ├── GBA planner use (CSV)
    ├── Advocacy reporting (CSV + charts)
    └── PWN algorithm input (GeoJSON)
```

---

## Indian Civic Tech Context

**What works in India:**
- Photo-first evidence — visual proof is more credible than text to officials
- Ward-level aggregation — India has strong ward councillor accountability culture
- Open public map — "public shaming" dynamic drives faster resolution
- WhatsApp-shareable links — how Indian press and advocacy orgs spread civic stories
- Kannada-first for government staff — English-only tools get abandoned after launch

**What doesn't work in India:**
- Email notification — WhatsApp is primary; email is for formal documents
- Account creation barriers — even Aadhaar-linked government apps have low engagement
- Assuming GIS literacy in government — export to Excel/CSV, not shapefile
- Complex multi-step forms — 3 taps to submit is the target
- English-only UI in government interfaces — field officers may not be fluent

**MVP for GBA soft launch (6 must-haves):**
1. Report status visible on public map
2. Ward auto-tagging from GPS coordinates
3. Admin triage queue with ward filter
4. CSV export (for GBA Excel users)
5. Basic public stats page (total / by category / by ward)
6. Duplicate detection with "me too" count

---

*Confidence based on FixMyStreet published research, mySociety annual reports, Civic Hall civic tech documentation, and Karnataka government digital service patterns.*
