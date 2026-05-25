---
phase: 03
slug: government-triage-workflow
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-25
reviewed_at: 2026-05-25
---

# Phase 03 — UI Design Contract

> Visual and interaction contract for Phase 03: Government Triage Workflow.
> Source: Claude Design handoff bundles — admin portal (Direction B) + citizen portal (Direction A).
> Two surfaces: admin portal (admin.css, Direction B tokens) + public citizen UI (globals.css, Direction A tokens).

---

## Surfaces Overview

Phase 03 touches two distinct design surfaces that must stay coherent but have their own voice:

| Surface | System | File | Voice |
|---------|--------|------|-------|
| Admin portal | Direction B — Walkability Console | `frontend/app/admin/admin.css` | Cool stone + teal, JetBrains Mono chrome, ops-terminal |
| Public citizen UI | Direction A — Minimal Mono | `frontend/app/globals.css` | Warm stone + civic green, Inter-led, bilingual |

---

## Design System

| Property | Admin (Direction B) | Public (Direction A) |
|----------|--------------------|--------------------|
| Tool | none | none |
| Component library | none (custom primitives in `design-ref/primitives.jsx`) | none (custom primitives) |
| Icon library | Custom SVG set in `primitives.jsx` (Lucide-style, 24px viewBox) | Same icon set |
| Font — primary | Inter + JetBrains Mono (display = mono) | Inter (display = sans) |
| Font — secondary | Noto Sans Kannada (citizen content only) | Noto Sans Kannada (bilingual labels) |
| CSS architecture | CSS custom properties via inline `style` objects — no Tailwind | CSS custom properties — no Tailwind |

---

## Spacing Scale

Both surfaces share the same 8px grid.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, dot–label gap |
| sm | 8px | Compact element padding, chip gap |
| md | 16px | Default card padding, section gap |
| lg | 24px | Section padding, modal internal spacing |
| xl | 32px | Layout column gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level vertical rhythm |

**Grid base:** `--grid: 8px` on both `.dir-a` and `.dir-b`.

**Exceptions:** Map popup bottom-sheet uses 12px horizontal padding (= sm + xs = 8 + 4) to match the existing popup visual. Photo hero on public report page uses no horizontal padding (full-bleed, height 260px).

---

## Typography

### Admin Portal (Direction B)

4 sizes, 2 weights. Values must not be mixed with sizes from other roles.

| Role | Family | Size | Weight | Line Height | Notes |
|------|--------|------|--------|-------------|-------|
| Label / mono | JetBrains Mono | 10px | 400 | 1 | Section eyebrows, IDs, timestamps; `letter-spacing: 0.08–0.10em; text-transform: uppercase` |
| Body / UI copy | Inter | 14px | 400 | 1.5 | Report descriptions, button labels, nav items, field values |
| Heading | Inter | 16px | 600 | 1.3 | Card headers, page titles, section headings |
| Display | JetBrains Mono | 40px | 600 | 1.0 | Dashboard hero numerals |
| Citizen content | Noto Sans Kannada | 0.9× parent | 400 | — | Kannada fallback for citizen-submitted descriptions (relative — not a size declaration) |

**Weight rule:** 400 = all body/label text. 600 = all emphasized text (headings, buttons, display). No 500 or 700.

**Plain-language rule:** All admin-facing copy uses sentence case. No `CAPSLOCK_COMMANDS` in buttons or labels. Mono is reserved for IDs (`WLK-7AC30`), timestamps, percentages, coordinates.

### Public Portal (Direction A)

4 sizes, 2 weights. Values must not be mixed with sizes from other roles.

| Role | Family | Size | Weight | Line Height | Notes |
|------|--------|------|--------|-------------|-------|
| Label / meta | JetBrains Mono | 11px | 400 | 1 | Section eyebrows, coordinates, report ID; `letter-spacing: 0.05–0.06em; text-transform: uppercase` |
| Body / UI copy | Inter | 13px | 400 | 1.55 | Report description, chip labels, status badge labels, meta field values |
| UI emphasis | Inter | 14px | 600 | 1.4 | Button labels, card title text, popup category name |
| Heading | Inter | 22px | 600 | 1.2 | Public report page `<h1>` |
| Bilingual sub | Noto Sans Kannada | 0.72× parent | 400 | 1.15 | `.bi-kn` sublabel below English, `opacity: 0.7` (relative — not a size declaration) |

**Weight rule:** 400 = all body/label/meta text. 600 = all emphasized UI text (headings, button labels, card titles). No 500 or 700.

---

## Color

### Admin Portal (Direction B — Walkability Console)

| Role | Light value | Dark value | Usage |
|------|-------------|------------|-------|
| Background | `#f3f3f1` | `#0a0a0a` | Page background |
| Surface | `#ffffff` | `#131313` | Cards, modal |
| Surface-2 | `#eaeae6` | `#1d1d1c` | Input backgrounds, row alt |
| Surface-3 | `#d8d8d4` | `#2a2a28` | Hover states |
| Border | `#d4d4d1` | `#262624` | Default borders |
| Border-strong | `#a8a8a3` | `#3a3a36` | Input borders, active borders |
| Ink | `#0a0a0a` | `#fafaf9` | Primary text |
| Ink-2 | `#3a3a37` | `#d4d4d1` | Secondary text |
| Muted | `#6b6b66` | `#8a8a85` | Placeholder, eyebrow labels |
| Accent | `oklch(0.56 0.13 200)` | `oklch(0.72 0.13 200)` | Teal — primary interactive |
| On-accent | `#ffffff` | `#0a0a0a` | Text on accent buttons |
| Danger | `oklch(0.56 0.20 25)` | — | Destructive actions |
| Warn | `oklch(0.70 0.15 70)` | — | Amber warnings |

**Split (60/30/10):** Background + Surface tokens cover ~60% of visible area (page bg, card faces); Surface-2/Surface-3/border tones cover ~30% (input fields, row alternates, sidebar); Accent covers ~10% (primary action buttons, active chips, focus rings, live dots only).

**Accent reserved for:** Primary action buttons (Acknowledge, Assign, Resolve, Close), active filter chips, focus rings, live indicator dots.

**Shadows:** Almost flat — `0 0 0 1px` inset for `shadow-sm`; rely on borders, not elevation.

**Radii (Direction B):**
| Token | Value |
|-------|-------|
| `--r-xs` | 4px |
| `--r-sm` | 6px |
| `--r-md` | 8px |
| `--r-lg` | 10px |
| `--r-xl` | 14px |
| `--r-full` | 999px |

### Public Portal (Direction A — Minimal Mono)

| Role | Value | Usage |
|------|-------|-------|
| Background | `#fafaf9` | Page background |
| Surface | `#ffffff` | Cards, popups |
| Surface-2 | `#f5f5f4` | Input backgrounds |
| Border | `#e7e5e4` | Default borders |
| Border-strong | `#d6d3d1` | Active/hover borders |
| Ink | `#1c1917` | Primary text |
| Ink-2 | `#44403c` | Secondary text |
| Muted | `#78716c` | Placeholder, meta |
| Accent | `oklch(0.62 0.14 145)` | Civic green — submit CTA, GPS pulse, check icons |
| Danger | `oklch(0.62 0.14 30)` | High severity, destructive |
| Warn | `oklch(0.72 0.14 75)` | Medium severity, amber |

**Split (60/30/10):** Background + Surface tokens cover ~60% of visible area; Surface-2/border tones cover ~30% (input fields, cards, meta lines); Accent covers ~10% (submit CTA, GPS pulse, check icon, resolved status indicator only).

**Accent reserved for:** Submit button, GPS confirmed pulse dot, success checkmark, resolved/closed status indicator on public pages.

**Radii (Direction A):**
| Token | Value |
|-------|-------|
| `--r-sm` | 8px |
| `--r-md` | 12px |
| `--r-lg` | 16px |
| `--r-xl` | 20px |
| `--r-full` | 999px |

---

## Status Color System

### 6-State Admin StatusBadge (Direction B tokens)

This is the canonical mapping for `StatusBadge.tsx`. Both `open`/`acknowledged` share teal; `assigned`/`in_progress` share amber; visual distinction via dot treatment.

| Status | Dot treatment | Bg token | Ink | Border | Label |
|--------|--------------|----------|-----|--------|-------|
| `open` | Filled teal | `--status-open-bg` = `oklch(0.95 0.03 200)` | `var(--info-ink)` | `oklch(0.86 0.06 200)` | Open |
| `acknowledged` | Ring (hollow) teal | `--status-acknowledged-bg` = `oklch(0.95 0.03 200)` | `var(--info-ink)` | `oklch(0.86 0.06 200)` | Acknowledged |
| `assigned` | Filled amber | `--status-assigned-bg` = `oklch(0.96 0.04 60)` | `var(--warn-ink)` | `oklch(0.84 0.12 60)` | Assigned |
| `in_progress` | Pulsing amber (`.pulse-dot`) | `--status-in-progress-bg` = `oklch(0.96 0.04 60)` | `var(--warn-ink)` | `oklch(0.84 0.12 60)` | In Progress |
| `resolved` | Filled green | `--status-resolved-bg` = `oklch(0.95 0.03 145)` | `var(--accent-ink)` | `var(--accent-border)` | Resolved |
| `closed` | Filled muted/grey | `#eaeae6` | `var(--muted)` | `#d4d4d1` | Closed |

**Ring dot implementation:** `background: transparent; box-shadow: inset 0 0 0 1.5px <color>`.
**Pulse dot implementation:** Add class `pulse-dot` (defined in `tokens.css` — `animation: pulse-dot 1.6s ease-in-out infinite`).
**monoLabel mode:** Font JetBrains Mono, `font-size: 11px`, `letter-spacing: 0.04em`, `text-transform: uppercase`, `font-weight: 600`. Used in reports list.

### 3-State Public Status Colors (for map + public report page)

| Visual group | Statuses | Color | Hex |
|-------------|----------|-------|-----|
| Red — attention needed | `open`, `acknowledged`, `assigned` | `var(--danger)` | `oklch(0.62 0.14 30)` |
| Amber — in motion | `in_progress` | `var(--warn)` | `oklch(0.72 0.14 75)` |
| Green — resolved | `resolved`, `closed` | `var(--accent)` | `oklch(0.62 0.14 145)` |

**Map pin sizes:** Default 10px circle; prominent pins 14px (every 5th pin). White ring: `box-shadow: 0 0 0 2.5px rgba(255,255,255,0.85), 0 2px 6px rgba(0,0,0,0.2)`.

---

## New Admin Components — Direction B

All new admin components use Direction-B primitives: `Btn`, `Input`, `Select`, `Icon` from `design-ref/primitives.jsx`. CSS custom properties via inline `style` objects. No Tailwind.

### A. StatusActionPanel

Contextual button bar on `/admin/reports/[id]` page. Renders based on `report.status`.

| Current status | Buttons shown | Variant |
|---------------|---------------|---------|
| `open` | "Acknowledge" | `Btn variant="accent"` |
| `acknowledged` | "Assign to Organisation" + "Mark In Progress" | `variant="secondary"` + `variant="accent"` |
| `assigned` | "Mark In Progress" + "Resolve" | `variant="secondary"` + `variant="accent"` |
| `in_progress` | "Resolve" | `variant="accent"` |
| `resolved` | "Close Report" | `variant="secondary"` |
| `closed` | Locked panel — "This report is closed" | Static, no buttons |

**"Resolve" and "Close Report" buttons** are tagged as `OPENS_MODAL` — they open the Resolve/Close Modal (D-16), not direct transitions.

**Layout:** Horizontal flex row, gap 8px, right-aligned within a `Card` at the top of the report detail view below the header.

**Button labels:** Sentence case. Never `MARK_RESOLVED` — always "Mark as resolved".

### B. OrgAssignPanel

Assignment section on `/admin/reports/[id]`. Always visible (below StatusActionPanel).

**States:**
- **Unassigned:** Shows "No organisation assigned" in `color: var(--danger-ink)` with a danger-soft tag. "Assign" button opens inline cascade picker.
- **Assigned:** Shows `CorporationName ↳ WardOfficeName` as two stacked lines. "Change" ghost button.
- **Cascade picker (open):** Two `Select` dropdowns side by side: Corporation (required) → Ward Office (filtered by selected corp). "Save assignment" accent button + "Discard changes" ghost. Note: auto-advances status to `assigned` on save.

**Implementation note (D-11):** Use `listOrganizations()` from `adminApi.ts`. Filter: `corporations = orgs.filter(o => o.org_type === 'corporation')`, `wardOffices = orgs.filter(o => o.org_type === 'ward_office' && o.parent_id === selectedCorpId)`.

### C. GbaHierarchyPanel

Read-only info section on `/admin/reports/[id]`. Shows bureaucratic + elected chains.

**Bureaucratic chain layout:** Each row: `[level label mono] [name bold] [official title muted]`. Rows separated by `1px solid var(--border)`. Top row = Ward (most granular), bottom row = GBA (apex).

```
Ward                →  Ward 117 · Shivajinagar           Ward Engineer
ARO Sub Division    →  Shivajinagar Sub Division         Asst. Revenue Officer
RO Division         →  East Division                     Revenue Officer
Zone                →  East Zone                         Zonal Commissioner
Corporation         →  West Corporation, GBA             Chief Commissioner
GBA                 →  Greater Bengaluru Authority        Chief Commissioner, GBA
```

**Design note from brief:** Rendered as structured label/value list with mono eyebrows. The design brief shows an ASCII tree style for Direction B (`└─`) but a numbered list is acceptable. Use `SectionLabel` for the "BUREAUCRATIC CHAIN" and "ELECTED · ASSEMBLY" eyebrows.

**Elected chain:** Single card below. Shows assembly constituency name + AC number + "MLA" label. Disclaimer: "Constituency boundaries may differ from ward boundaries."

**When ward data is unavailable:** Show muted text "Ward assignment not available for this report."

### D. Resolve/Close Modal

Combined modal triggered by "Resolve" or "Close Report" buttons.

**Title:** "Resolve report" or "Close report" (sentence case, matches triggering action).

**Fields:**
1. **After-photo upload** (mandatory):
   - Dropzone with red `1px dashed var(--danger-border)` border when empty
   - "REQUIRED" tag in `danger-soft` pill in top-right corner of dropzone
   - Alert banner: "A photo is required to mark this report as resolved." (`--danger-bg` background)
   - Submit button disabled until photo provided
   - On photo selected: preview thumbnail replaces dropzone; remove button available
2. **Resolution notes** (optional):
   - `Input` textarea-style, placeholder "Optional — describe what was done"
   - Max visible height ~80px
3. **Audit echo** (read-only):
   - Small muted block showing report ID + current status + transition target
   - e.g., "WLK-7AC30 · In Progress → Resolved"
4. **Submit button:** `Btn variant="accent"` with label "Mark as resolved" or "Mark as closed"
5. **Dismiss:** `Btn variant="ghost"` labeled "Discard"

**Close variant warning:** On the "Close Report" modal, show an additional amber warning: "Closing is permanent. The report will be archived and removed from the active queue."

**Multipart note (implementation):** Submit via `FormData` — do NOT set `Content-Type` manually. Browser sets `multipart/form-data; boundary=...` automatically.

### E. StatusBadge Extension

Extend `STATUS_MAP` in `frontend/app/admin/components/StatusBadge.tsx` to all 6 values. New CSS tokens to add to `admin.css`:

```css
/* In .dir-b {} block */
--status-open: oklch(0.56 0.13 200);
--status-open-bg: oklch(0.95 0.03 200);
--status-open-border: oklch(0.86 0.06 200);
--status-acknowledged: oklch(0.56 0.13 200);
--status-acknowledged-bg: oklch(0.95 0.03 200);
--status-acknowledged-border: oklch(0.86 0.06 200);
--status-assigned: oklch(0.66 0.16 60);
--status-assigned-bg: oklch(0.96 0.04 60);
--status-assigned-border: oklch(0.84 0.12 60);
--status-in-progress: oklch(0.66 0.16 60);
--status-in-progress-bg: oklch(0.96 0.04 60);
--status-in-progress-border: oklch(0.84 0.12 60);
--status-closed: #6b6b66;
--status-closed-bg: #eaeae6;
--status-closed-border: #d4d4d1;

/* In .dir-b.dark block */
--status-open: oklch(0.72 0.13 200);
--status-open-bg: oklch(0.26 0.05 200);
--status-open-border: oklch(0.36 0.08 200);
--status-acknowledged: oklch(0.72 0.13 200);
--status-acknowledged-bg: oklch(0.26 0.05 200);
--status-acknowledged-border: oklch(0.36 0.08 200);
--status-assigned: oklch(0.76 0.15 60);
--status-assigned-bg: oklch(0.26 0.05 60);
--status-assigned-border: oklch(0.36 0.10 60);
--status-in-progress: oklch(0.76 0.15 60);
--status-in-progress-bg: oklch(0.26 0.05 60);
--status-in-progress-border: oklch(0.36 0.10 60);
--status-closed: #8a8a85;
--status-closed-bg: #1d1d1c;
--status-closed-border: #2a2a28;
```

### F. Reports List — Corporation Column

Add `CORP` column to `/admin/reports` table between WARD and SEV columns.
- Short labels: Central / North / East / South / West
- Derived client-side via `WARD_TO_CORP` map (no new API field needed — derive from `ward_id` → `corporation` via JOIN at API level or from existing ward data)
- Column header: `SectionLabel` "CORP" (mono uppercase, 10px)

---

## New Public Components — Direction A

### G. Map Popup Update (`ReportsMap.tsx`)

Add to the existing bottom-sheet popup card:

**New elements (additive — no layout restructuring):**
1. GBA jurisdiction line (between description row and footer):
   - `[GBA tag mono]` + `[Corporation name bold]` + `·` + `[Ward · Name]`
   - Example: `GBA  West Corporation · Ward 117 · Shivajinagar`
2. Status badge (in the title row, after category + title):
   - Inline status chip with colored dot + label text
   - Colors per 3-state public mapping above (red/amber/green)
3. "Read More →" link (replacing/updating the chevron in footer):
   - `<a href={/reports/${report.id}}>` with `arrow_right` icon (14px)
   - Color: `var(--accent-ink)`, font-weight 600, font-size 12px
   - Pattern: `Read More  →`

**GBA tag styling:** `font-size: 9px; font-family: var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); background: var(--surface-2); padding: 4px 8px; border-radius: 4px`.

### H. Map Legend Update

Replace existing category-based legend with status legend chip.

**Position:** Absolute, top-left, below filter chips row. `top: 108px, left: 12px`.

**Layout:** 3 items in a horizontal row, each: `[8px circle dot]  [label text]`
- `[red dot]  Open`
- `[amber dot]  In progress`
- `[green dot]  Resolved`

**Container:** `background: rgba(255,255,255,0.95); border: 1px solid var(--border); border-radius: var(--r-md); padding: 8px 12px; font-size: 10px; font-weight: 400; backdrop-filter: blur(8px)`.

### I. Map Pin Colors (STATUS_COLORS)

Replace `CATEGORY_COLORS` as the `fillColor` source for `CircleMarker`.

```typescript
const STATUS_COLORS: Record<string, string> = {
  open:         "var(--danger)",   // #ef4444 equivalent
  acknowledged: "var(--danger)",
  assigned:     "var(--danger)",
  in_progress:  "var(--warn)",     // #f59e0b equivalent
  resolved:     "var(--accent)",   // oklch(0.62 0.14 145)
  closed:       "var(--accent)",
};
// Usage: fillColor={STATUS_COLORS[report.status] ?? "var(--danger)"}
```

**Fallback:** `"var(--danger)"` (red) — treats unknown status as unresolved.

### J. Public Single-Report Page (`/reports/[id]`)

New page using Direction A (globals.css). Full mobile-first layout.

**Layout (top to bottom):**

1. **Floating header bar** (absolute, top 12px):
   - Left: "← Map" pill button (`rgba(255,255,255,0.95)`, blur backdrop, pill shape)
   - Right: Share icon button (36px circle)

2. **Hero photo** (full-width, height 260px, no horizontal padding):
   - Gradient overlay: `linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.45) 100%)`
   - Bottom-left: Report ID mono (`font-size: 10px; letter-spacing: 0.06em; color: rgba(255,255,255,0.85)`)
   - Use `<img src={report.image_url}>` with `object-fit: cover`

3. **Scrollable content area** (padding: `16px 16px 24px`):

   a. **Category + severity + status badge row** (flex, wrap):
      - Category chip: `[Icon] [Category name]` in bordered pill
      - Severity chip: `Severity · High/Medium/Low` in warn/accent/muted pill
      - Status badge: right-aligned, colored dot + label per 3-state public mapping

   b. **Title + description**:
      - `<h1>` at 22px/700/letter-spacing -0.02em
      - `<p>` at 13px/ink-2/line-height 1.55

   c. **Meta grid** (2-column card, `var(--r-lg)`, `1px solid var(--border)`):
      - Row 1: Submitted date (col 1) | Ward name + sub-name (col 2)
      - Row 2 (full-width, dashed top border): `[GBA tag]  [Corporation name bold]  [Zone · GBA muted mono]`

   d. **Status history timeline** (section label: "Status history"):
      - Vertical timeline: each step has a 16px colored circle dot + connector line (1.5px `var(--border)`)
      - Current (last) step: ring glow `box-shadow: 0 0 0 2px <dot-color>`
      - Each entry: status label (bold if current) + mono date (right-aligned) + actor name (muted, 11px)
      - Dot colors: same 3-state public palette (red/amber/green per status)

   e. **Resolution section** (conditional — only when `resolved` or `closed`):
      - Container: `var(--accent-bg)` background, `1px solid var(--accent-border)` border, `var(--r-lg)` radius
      - Header: `[check_circle icon accent]  [RESOLUTION section label]`
      - After-photo: full-width, height 180px, `var(--r-md)` border-radius
      - Photo caption: mono, 10px, `var(--accent-ink)` — "After · [date]" + "Field verified"
      - Resolution notes: 12px, `var(--ink-2)`, line-height 1.55
      - Footer: "Closed by" muted + name/role ink-2

   f. **GBA Responsibility Hierarchy** (section label: "GBA Responsibility Hierarchy"):
      - Intro: 11px muted — "Who is accountable for this location, by office."
      
      - *Bureaucratic chain* eyebrow: "BUREAUCRATIC CHAIN" (mono 10px uppercase)
      - Bordered card, each row: numbered circle (22px) + level label (mono 10px muted uppercase) + name (bold 13px) + official title (muted 10px right-aligned)
      - 6 rows: Ward → ARO Sub Division → RO Division → Zone → Corporation → GBA
      - Last row (GBA): circle uses `var(--ink)` bg + white text
      
      - *Elected chain* eyebrow: "ELECTED · ASSEMBLY" (mono 10px uppercase)
      - Single card: constituency name + AC number + "MLA" label + disclaimer footnote (11px muted)

   g. **Back-to-map link** (bottom, centered):
      - Inline pill button: "← Back to map", `var(--surface)` bg, `1px solid var(--border-strong)`

---

## Interaction & Motion

| Interaction | Implementation |
|-------------|----------------|
| Press / tap feedback | `.press` class → `transform: scale(0.985)` on `:active` |
| Pulsing dot (in_progress) | `.pulse-dot` — `pulse-dot` keyframe, 1.6s ease-in-out infinite |
| GPS confirmed pulse | `.pulse` — `pulse-soft` keyframe, 2s ease-in-out |
| Transition default | `transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease` |
| Modal open/close | No animation spec in design briefs — use simple opacity fade (100ms) |
| Disabled button | `opacity: 0.5; cursor: not-allowed` (resolve modal submit when no photo) |

**Minimum tap target:** 40px × 40px (admin); 44px × 44px (public/citizen — outdoor walking use).

---

## Accessibility

Per design brief decisions (Chat 2, accessibility pass):

1. **Severity indicators:** Never color-only. Use bar pattern (3 bars at heights 4/8/12px, lit count = severity level) + text label. Implementation in `SeverityIndicator` component with `style="bars"` prop.
2. **Status badges:** Always include text label alongside dot — dot is decoration, not the only signal.
3. **Map legend:** Always show text labels alongside color dots.
4. **Offline state:** `role="status"` + `aria-live="polite"` on pending-sync count.
5. **WCAG contrast:** All text–background combinations using oklch tokens were designed to meet AA contrast at their given lightness/chroma values.
6. **Admin buttons:** Minimum 40px height (`minHeight` in `Btn` primitive for `md` size = 40px, `lg` = 48px).

---

## Copywriting Contract

### Admin Portal

| Element | Copy |
|---------|------|
| StatusActionPanel — open | "Acknowledge" |
| StatusActionPanel — acknowledged | "Assign to organisation" / "Mark as in progress" |
| StatusActionPanel — assigned | "Mark as in progress" / "Resolve" |
| StatusActionPanel — in_progress | "Resolve" |
| StatusActionPanel — resolved | "Close report" |
| StatusActionPanel — closed | "This report is closed." |
| OrgAssignPanel — unassigned | "No organisation assigned" |
| OrgAssignPanel — save | "Save assignment" |
| ResolveModal title (resolve) | "Resolve report" |
| ResolveModal title (close) | "Close report" |
| ResolveModal photo required alert | "A photo is required to mark this report as resolved." |
| ResolveModal close warning | "Closing is permanent. The report will be archived and removed from the active queue." |
| ResolveModal submit (resolve) | "Mark as resolved" |
| ResolveModal submit (close) | "Mark as closed" |
| ResolveModal dismiss | "Discard" |
| OrgAssignPanel dismiss | "Discard changes" |
| ResolveModal notes placeholder | "Optional — describe what was done" |
| GbaHierarchyPanel — no ward | "Ward assignment not available for this report." |
| Reports list column header | "CORP" |

### Public Portal

| Element | Copy |
|---------|------|
| Map popup link | "Read More →" |
| Map legend — red | "Open" |
| Map legend — amber | "In progress" |
| Map legend — green | "Resolved" |
| Report page back button | "← Map" |
| Report page share button | (icon only, `aria-label="Share report"`) |
| GBA hierarchy intro | "Who is accountable for this location, by office." |
| Bureaucratic chain eyebrow | "Bureaucratic chain" |
| Elected chain eyebrow | "Elected · Assembly" |
| Elected disclaimer | "Constituency boundaries may differ from ward boundaries." |
| Resolution section label | "Resolution" |
| Status history label | "Status history" |
| After-photo caption | "After · [date]" |
| After-photo verification | "Field verified" |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| No external registries | All components are custom primitives | Not required |

No new npm/crate dependencies for Phase 03 frontend. All required primitives (`Btn`, `Input`, `Select`, `Icon`, `StatusBadge`, `SectionLabel`, `Card`) already exist in the project from Phase 02.5.

---

## File Locations

| New/changed file | Type | Direction |
|-----------------|------|-----------|
| `frontend/app/admin/admin.css` | Add 6-state status tokens | Direction B |
| `frontend/app/admin/components/StatusBadge.tsx` | Extend STATUS_MAP to 6 values + new dot treatments | Direction B |
| `frontend/app/admin/components/StatusActionPanel.tsx` | NEW — contextual action bar | Direction B |
| `frontend/app/admin/components/OrgAssignPanel.tsx` | NEW — cascading org picker | Direction B |
| `frontend/app/admin/components/GbaHierarchyPanel.tsx` | NEW — hierarchy display | Direction B |
| `frontend/app/admin/components/ResolveModal.tsx` | NEW — resolve/close modal | Direction B |
| `frontend/app/admin/reports/[id]/page.tsx` | Extend — add 3 panels | Direction B |
| `frontend/app/admin/reports/page.tsx` | Extend — add CORP column | Direction B |
| `frontend/app/components/ReportsMap.tsx` | Extend — status colors, popup, legend | Direction A |
| `frontend/app/map/page.tsx` | Extend — update legend component | Direction A |
| `frontend/app/reports/[id]/page.tsx` | NEW — public single-report page | Direction A |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (non-blocking — "Acknowledge", "Resolve", "Discard" are single-word CTAs; no BLOCK-level generic labels)
- [x] Dimension 2 Visuals: FLAG (non-blocking — hierarchy implied via layout; no dedicated focal point sentence)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: FLAG (non-blocking — public portal 13px/14px 1px apart; semantically distinct via weight)
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-25
