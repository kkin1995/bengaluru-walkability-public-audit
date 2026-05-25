# Phase 3: Government Triage Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 03-government-triage-workflow
**Areas discussed:** GBA meeting outcome + scope pivot, Corporation tagging, GBA hierarchy levels, Hierarchy display locations, Public single-report page, Org assignment, Phase 02.6 sequencing

---

## Update Session 2 — 2026-05-25

**Areas discussed:** Parliamentary Constituency (MP) in elected chain

### Parliamentary Constituency Addition

**User's request (free text):** "I just want to ensure that the MP (Member of Parliament) is also there in the accountability hierarchy. Earlier I saw MLA, but I did not see MP."

**Context check:** The GeoJSON (`data/gba_wards_2025.geojson`) has `ac` and `ac_no` (Assembly Constituency / MLA) but no Parliamentary Constituency (Lok Sabha) field. The chain is: Report → Ward (via GPS+ST_Within) → `wards.ac_no` → `wards.parliamentary_constituency` (new column). No second GPS lookup required.

### Data Source for PC

| Option | Description | Selected |
|--------|-------------|----------|
| Derive at migration time from a lookup | Hardcoded AC_no → Lok Sabha seat mapping in migration SQL (Delimitation Commission order) | ✓ |
| Add to GeoJSON as new field | Enrich GeoJSON manually then backfill | |
| Skip MP for now | MLA-only for this phase | |

**User's choice:** Derive at migration time

### PC Display Location

| Option | Description | Selected |
|--------|-------------|----------|
| Same elected chain as MLA | Both AC (MLA) and PC (MP) on admin detail + public /reports/[id] | ✓ |
| Public page only, not admin | PC visible to citizens but not admins | |
| Separate "Elected Officials" section | Dedicated section apart from bureaucratic chain | |

**User's choice:** Same elected chain as MLA (Recommended)

### Decisions captured: D-41, D-42; D-21, D-23, D-25 updated

---

## Context Check

| Option | Description | Selected |
|--------|-------------|----------|
| Update it | Load existing context and continue discussion | ✓ |
| View it | Show current CONTEXT.md without changes | |
| Skip | Exit — context already good | |

**User's choice:** Update it
**Notes:** Existing context (2026-03-14) predates Phase 02.5 completion and a key GBA stakeholder meeting that changed the entire scope of the phase.

---

## Plans Exist Warning

| Option | Description | Selected |
|--------|-------------|----------|
| Continue and replan after | Update context now, then replan | ✓ |
| View existing plans | Show what plans already exist | |
| Cancel | Exit without changes | |

**User's choice:** Continue and replan after
**Notes:** Plans 03-01 and 03-02 were written in March 2026 and do not reflect the GBA meeting outcome or the hierarchy data requirements. They will need replanning.

---

## GBA Scope Pivot (primary topic)

**User's choice (free text):** "We had a meeting with the GBA Urban Design Cell and the IT Cell and they said that they have a lot of data coming in to their system from many many apps and do not have the bandwidth to integrate another app into their system. Therefore, for now, we have decided to change the administration of the reports to us only. We will administer through the existing admin UI. I want to discuss how to implement this. In addition, I also want to tag and show the hierarchy of who is responsible for fixing each complaint. Currently we are tagging the ward. I want to tag the city corporation also. Also I want to show the entire hierarchy (both bureaucratic and elected) from the bottom most officer to the Chief Commissioner of the GBA. I want to discuss how to do this as well. First check what data on the GBA we do have and in the .kml file in the repo, then we will have to do research to find all other verified information."

**Notes:** This is the central pivot. The phase goal shifts from "GBA admins use the app" to "show who is bureaucratically responsible + Nammadaari manages internally." The KML/GeoJSON already has all 5 corporations, 10 zones, 15 RO divisions, ARO sub-divisions, and assembly constituencies.

---

## Corporation Tagging

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-derive at query time | JOIN reports → wards at query time; no new column on reports | ✓ |
| Add corporation_id to reports | Denormalize for query speed and filtering | |
| Both — store + JOIN | Best for filtering but most migration work | |

**User's choice:** Auto-derive at query time (Recommended)
**Notes:** The `wards` table already has `corporation TEXT` (Central/North/East/South/West). A JOIN is sufficient and avoids denormalization.

---

## GBA Hierarchy Levels

| Option | Description | Selected |
|--------|-------------|----------|
| Ward → Zone → Corporation (top 3) | Clean, actionable — 3 levels only | |
| Full bureaucratic chain incl. RO/ARO Divisions | Ward → ARO → RO → Zone → Corporation → GBA | ✓ |
| Elected officials chain (Corporator → MLA) | Assembly Constituency from ward's `ac` field | ✓ |

**User's choice:** Full bureaucratic chain + Elected officials chain (multi-select)
**Notes:** User wants the complete picture — all 6 bureaucratic levels plus the elected representative chain. Data for both already exists in the GeoJSON.

---

## Hierarchy Display Locations

| Option | Description | Selected |
|--------|-------------|----------|
| Admin detail page only | Full chain in admin portal only | |
| Public map popup (summary) | Corporation name in popup — citizens see who's responsible | |
| Both admin detail (full) + public popup (summary) | Admin full; public popup summary | ✓ |

**User's choice:** Both + new public report page
**Notes (free text):** "In the frontend map, when someone taps on a report dot, it now opens a small pop up box with the photo and other small details. I want a 'Read More' link that will open that single report in a separate page which shows the entire hierarchy and full details of the report."

**New surface identified:** Public single-report page `/reports/[id]` — not previously in scope.

---

## Public Single-Report Page Contents

| Option | Description | Selected |
|--------|-------------|----------|
| Report photo + category + severity + description | Core submission details | ✓ |
| Current status + status history timeline | Full lifecycle history with dates | ✓ |
| Full GBA hierarchy chain | 6-level bureaucratic + Assembly Constituency | ✓ |
| Resolution photo + notes (when resolved) | After-photo and resolution notes | ✓ |

**User's choice:** All four (multi-select)

---

## Researcher Data Task

| Option | Description | Selected |
|--------|-------------|----------|
| Org structure only (names of offices/designations) | Official designation titles at each level; no named individuals | ✓ |
| Current officer names + contact info | Named individuals; changes frequently | |
| Just 5 corporation names + official addresses | Minimal verified data | |

**User's choice:** Org structure only (names of offices/designations)
**Notes:** Researcher should find official designation titles (e.g., "Zone Assistant Executive Engineer") — NOT named individuals, which change frequently and require manual upkeep.

---

## Org Assignment (Internal Routing)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep org assignment — for our own internal routing | Nammadaari tracks which corp they're coordinating with | ✓ |
| Remove org assignment entirely | Corporation auto-tagged from ward; assignment adds no value | |
| Simplify — just show corporation (auto-tagged) | Display only, no assign action | |

**User's choice:** Keep org assignment for internal routing (Recommended)

---

## DB Approach for Hierarchy Columns

| Option | Description | Selected |
|--------|-------------|----------|
| Add columns to wards table | Add zone_name, ro_division, aro_sub_division, assembly_constituency to wards | ✓ |
| Separate hierarchy lookup table | New ward_hierarchy table; more normalized | |

**User's choice:** Add columns directly to wards table (Recommended)

---

## Phase 02.6 Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Do 02.6 first (small, fast) then Phase 3 | Knock out version stamping, then Phase 3 on clean branch | ✓ |
| Skip 02.6 for now, go straight to Phase 3 | Version stamping not blocking | |
| Run them in parallel on separate branches | Different files, can proceed simultaneously | |

**User's choice:** Do 02.6 first (small, fast) — then Phase 3

---

## Admin UI Design System

**User's choice (free text):** "Can you please write details of what is required for the UI change in the admin portal and I will pass it to our AI design team?"

**Notes:** The user will pass the UI requirements to their AI design team. Frontend plans 03-03 and 03-04 are blocked on receiving the design spec back. A detailed brief has been written in CONTEXT.md `<specifics>` covering both admin portal changes and public citizen UI changes.

---

## Claude's Discretion

- StatusBadge color tone choices for 6 new status values (suggested semantics in CONTEXT.md)
- Admin detail page layout for action buttons, org picker, and hierarchy panel
- Resolution modal UX details (pending design spec)
- Whether status history goes in existing `GET /api/reports/:id` or a new endpoint

## Deferred Ideas

- GBA-facing admin portal — deferred indefinitely pending renewed GBA engagement
- Named officer lookup — too volatile for persistent storage; deferred to content management phase
- SMS/WhatsApp notifications to GBA officers — deferred post-launch
- Report social sharing — deferred to polish phase
