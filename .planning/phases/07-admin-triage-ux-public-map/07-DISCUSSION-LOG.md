# Phase 7: Admin Triage UX + Public Map - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 07-admin-triage-ux-public-map
**Areas discussed:** Admin ward/corp filter control, Public map filter chips layout, Ward boundary overlay delivery, Before/after photo layout

---

## Admin Ward/Corp Filter Control

### Filter control type

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate selects — Corp + Ward | Corporation dropdown (5–7 options) + Ward dropdown (369 wards, searchable). Selecting a corp optionally narrows the ward list. | ✓ |
| One combined searchable select | Single 'Location' select listing corporations first, then wards. | |
| Text search / ward name input | Free-text input matching ward name. | |

**User's choice:** Two separate selects — Corp + Ward

---

### Corp → Ward cascading

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — selecting a corp narrows the ward list | Ward dropdown filters to only that corporation's wards. | ✓ |
| No — both are always independent | Ward dropdown always shows all 369 wards. | |

**User's choice:** Yes — cascading narrowing

---

### Filter placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline with existing filters | Add Corp and Ward selects alongside category/status/severity row. | ✓ |
| Separate filter row above the table | Geographic filters get their own row. | |
| Collapsible 'Advanced filters' panel | Ward/corp hidden behind an expand button. | |

**User's choice:** Inline with existing filters

---

### Data source for filter options

| Option | Description | Selected |
|--------|-------------|----------|
| Live from API — new /api/admin/wards and /api/admin/orgs endpoints | Fetch all corps and wards once on page mount. | ✓ |
| Derived from the current report list | Collect unique values from reports already loaded. | |

**User's choice:** Live from API — new endpoints

---

### Side note during discussion
User also requested a Claude Design prompt to generate visual design for this phase. Design prompt was provided during discussion covering: admin filter bar, status chip row, ward boundary toggle, and before/after photo layout.

---

## Public Map Filter Chips Layout

### Layout style

| Option | Description | Selected |
|--------|-------------|----------|
| Two chip rows — category on top, status below | Mirrors existing chip strip pattern. Both rows scroll horizontally. | ✓ |
| One combined filter with tabs | Tab control: 'By category' / 'By status'. | |
| Status as a dropdown, category stays as chips | Keep chips + add a compact Status dropdown. | |

**User's choice:** Two chip rows (category on top, status below)

---

### Status chip labels

| Option | Description | Selected |
|--------|-------------|----------|
| All statuses / Open / In progress / Resolved | 4 chips. Simplified 3-state for citizens. | ✓ |
| All statuses / Open / Resolved | 3 chips. Bundles acknowledged/assigned/in-progress into Open. | |
| All six states from the admin enum | Shows all 6 admin states. Potentially confusing for citizens. | |

**User's choice:** 4 chips — All / Open / In progress / Resolved

---

### Filter interaction mode

| Option | Description | Selected |
|--------|-------------|----------|
| Independent (AND logic) — both can be active simultaneously | Filter to 'Damaged + Resolved' for cross-analysis. | ✓ |
| Mutually exclusive — selecting one row resets the other | Simpler state management. | |

**User's choice:** Independent AND logic

---

### Status chip counts

| Option | Description | Selected |
|--------|-------------|----------|
| Always total counts per status (simpler) | 'Open · 47' always means 47 open reports total. | ✓ |
| Live-filtered counts (cross-filtered) | Count updates when category filter is active. | |

**User's choice:** Always total counts per status

---

### Filtering implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side — filter the already-fetched report list | Consistent with existing category filter. | ✓ |
| API-level — add ?status= param to the public reports endpoint | Server-side filtering. | |

**User's choice:** Client-side

---

### Empty state when filters yield zero results

| Option | Description | Selected |
|--------|-------------|----------|
| Empty map — no pins, no message | Consistent with existing zero-result behavior. | ✓ |
| A floating 'No reports match' overlay on the map | More explicit feedback. | |
| Auto-reset to 'All' if the combination yields zero results | Prevents empty state but overrides user's choice. | |

**User's choice:** Empty map, no message

---

### Status chip count badges

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — same format: 'Label · N' | Consistent with category chips. | ✓ |
| Label-only — no counts on status chips | Simpler chips. | |

**User's choice:** Yes — count badges

---

### URL persistence

| Option | Description | Selected |
|--------|-------------|----------|
| No — in-memory state only | Consistent with existing category chip behavior. | ✓ |
| Yes — add ?status= URL param | Shareable filtered map links. | |

**User's choice:** In-memory only

---

## Ward Boundary Overlay Delivery

### GeoJSON delivery method

| Option | Description | Selected |
|--------|-------------|----------|
| New public GET /api/wards/boundaries endpoint | No auth required. 24h nginx + Cloudflare cache. | ✓ |
| Serve as static JSON from frontend /public folder | Zero backend work but stale data risk. | |
| Reuse existing admin choropleth endpoint (add public access) | Mixes boundary data with private analytics. | |

**User's choice:** New public endpoint

---

### Ward coverage

| Option | Description | Selected |
|--------|-------------|----------|
| All 369 wards | Complete Bengaluru ward grid. | ✓ |
| Only wards with reports | Lighter response but misses wards with no reports. | |

**User's choice:** All 369 wards

---

### Polygon visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Stroke-only — thin teal outline, no fill | Ward lines without obscuring report pins. | ✓ |
| Semi-transparent fill + stroke | More visual weight, can obscure pins in dense areas. | |
| White stroke with dark outline — high contrast | Maximum legibility, heavier visual. | |

**User's choice:** Stroke-only, thin teal outline

---

### Hover/tap behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show ward name on hover/tap | Leaflet tooltip/popup with ward_name property. | ✓ |
| No — boundaries only, no interactivity | Purely decorative overlay. | |

**User's choice:** Yes — show ward name tooltip

---

### Toggle placement

| Option | Description | Selected |
|--------|-------------|----------|
| Floating control in top-right of the map | Standard Leaflet layer control position. | ✓ |
| Above the chip rows, as a text toggle link | Further from the map it affects. | |
| As a Leaflet custom LayersControl | Native Leaflet UI but more complex. | |

**User's choice:** Floating control top-right of the map

---

### Default state

| Option | Description | Selected |
|--------|-------------|----------|
| OFF by default — user toggles it on | Keeps default view clean. | ✓ |
| ON by default | Ward boundaries visible immediately. | |

**User's choice:** OFF by default

---

### Tapping a ward polygon

| Option | Description | Selected |
|--------|-------------|----------|
| No — tooltip only, no filter behavior | Overlay purely informational. | ✓ |
| Yes — tapping a ward polygon filters reports to that ward | Adds third filter dimension, significant complexity. | |

**User's choice:** Tooltip only

---

### Error handling

| Option | Description | Selected |
|--------|-------------|----------|
| Silent fail — overlay not shown, no error message | Report pins still work. Ward overlay is optional. | ✓ |
| Show a brief toast: 'Ward boundaries unavailable' | More transparent. | |

**User's choice:** Silent fail

---

### Rate limiting

| Option | Description | Selected |
|--------|-------------|----------|
| No rate limit — rely on nginx + Cloudflare caching | With 24h cache, origin hits are negligible. | ✓ |
| Yes — same rate limit as other public API endpoints (5 req/min) | Consistent policy. | |

**User's choice:** No rate limit

---

### Fetch timing

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy — fetch only when toggle is activated | Saves ~500KB for users who never use it. | ✓ |
| Eager — prefetch in background on page load | Toggle becomes instant but wastes bandwidth. | |

**User's choice:** Lazy fetch on toggle activation

---

### Caching

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — 24h nginx Cache-Control + Cloudflare caching | Ward boundaries are essentially static. | ✓ |
| No caching | Fresh on every page load. Unnecessary. | |
| Embed in Next.js bundle (static import) | Zero network cost but staleness risk. | |

**User's choice:** 24h nginx Cache-Control + ensure Cloudflare edge also caches

---

## Before/After Resolution Photo Layout

### Photo layout

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side on desktop, stacked on mobile | Two equal columns ≥768px; stacked below 768px. | ✓ |
| Before/after slider toggle | Draggable divider — dramatic but heavy implementation. | |
| Stacked on all screen sizes | Always stacked, simpler. | |

**User's choice:** Side-by-side on desktop (≥768px), stacked on mobile

---

### Photo labels

| Option | Description | Selected |
|--------|-------------|----------|
| 'Before' and 'After' | Simple, universal. | ✓ |
| 'Submitted photo' and 'Resolution photo' | More descriptive but verbose. | |
| 'Reported condition' and 'Fixed condition' | Action-oriented civic language. | |

**User's choice:** "Before" and "After"

---

### Section heading change

| Option | Description | Selected |
|--------|-------------|----------|
| No — keep current heading, Before/After labels suffice | Less conditional logic. | ✓ |
| Yes — change 'Photo' to 'Photos' when two exist | Grammatically accurate but minimal gain. | |

**User's choice:** No change to section heading

---

### Lightbox / tap behavior

| Option | Description | Selected |
|--------|-------------|----------|
| No — photos are display-only | No lightbox component needed. | ✓ |
| Yes — clicking opens in a lightbox / new tab | Useful for inspection but extra component. | |

**User's choice:** Display-only, no lightbox

---

## Claude's Discretion

None — user made all decisions explicitly.

## Deferred Ideas

- Ward-level filter on public /map by clicking a ward polygon → future phase
- Cross-filtered status chip counts → future phase
- URL-persisted filter state on public /map → future phase
- Email capture on public /map → v1.2+ (NOTIF-01/02)
