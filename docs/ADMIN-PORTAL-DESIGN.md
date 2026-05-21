# Admin Portal Design System

Design reference for the Namma Daari admin portal (`/admin`). Two directions were
explored in claude.ai/design; implementation targets the hybrid described below.

Source files: [`design-ref/admin-portal/`](../design-ref/admin-portal/)

---

## Design Directions

### Direction A · "Daari Ops"

A warm sibling of the citizen-facing Walkable BLR design.

| Token | Value |
|-------|-------|
| Background | `#fafaf9` (warm stone) |
| Accent | `oklch(0.62 0.14 145)` — civic green (same hue as citizen app) |
| Border radius | 6–20px (rounded) |
| Shadows | Soft, warm (`rgba(28,25,23, …)`) |
| Display font | Inter 700 |
| Body font | Inter 400/500/600 |
| Mono font | JetBrains Mono (IDs, timestamps, values) |

Character: friendly, inviting, coherent with the citizen side. Works for users who
move between submitting and triaging reports.

**Prototype files**: `screens-a-mobile.jsx`, `screens-a-desktop.jsx`

---

### Direction B · "Walkability Console"

An ops-terminal voice for professional triage work.

| Token | Value |
|-------|-------|
| Background | `#f3f3f1` (cool, slightly olive stone) |
| Accent | `oklch(0.56 0.13 200)` — teal (distinct from citizen green) |
| Border radius | 4–14px (sharper) |
| Shadows | Almost flat; hairline borders carry the elevation |
| Display font | JetBrains Mono 700 (used in nav, headers, section labels) |
| Body font | Inter 400/500/600 |
| Mono font | JetBrains Mono |

Character: precise, tool-like, Linear/Vercel civic. Signals "professional system"
rather than "friendly app". Kannada never appears in admin chrome — only in
citizen-submitted content fields.

**Prototype files**: `screens-b-mobile.jsx`, `screens-b-desktop.jsx`

---

## Final Implementation: Hybrid (B-voice × A-structure)

After iteration (see `design-ref/admin-portal/chats/`), the target for implementation is:

### What comes from Direction B
- Palette (cool stone `#f3f3f1`, teal `oklch(0.56 0.13 200)`)
- JetBrains Mono in the chrome (nav labels, section headers, status labels, IDs)
- Sharper radii (`--r-md: 8px`, `--r-lg: 10px`)
- Border-over-shadow elevation model
- `SORT:` / `ID ·` micro-labels on list cards

### What comes from Direction A
- Report card structure: **photo tile + category title + status badge + ward·time meta line**
  (Direction B's original compact rows was a dataviz table — wrong pattern for this context)
- Softer overall feel for the report detail (photo remains the hero, not a grid cell)

### Accessibility overrides (applied to both)
- Severity always encoded three ways: **bar pattern** (1/2/3 bars) + **label** + **color**
  (never color alone — tested colorblind + grayscale)
- All interactive elements ≥ 44px tap target
- Status change areas use `aria-live="polite"` for screen-reader updates
- Offline/error state uses `role="status"` on the pending-changes card

### Copy voice (for government clerks, not developers)
- Sentence case everywhere in UI copy — no `UPPERCASE_LABELS` in action buttons
- JetBrains Mono kept only for machine-truths: IDs (`WLK-7AC30`), timestamps, raw counts
- Error state: "You're offline right now" + pending-changes card showing queued actions
  ("Your work is saved — will go through automatically when you reconnect")
- Empty state: "All caught up" not `// no reports waiting triage in your scope`

---

## Color Tokens (Hybrid Implementation)

```css
/* Light mode — Direction B base */
--bg:            #f3f3f1;
--surface:       #ffffff;
--surface-2:     #eaeae6;
--surface-3:     #d8d8d4;
--border:        #d4d4d1;
--border-strong: #a8a8a3;
--ink:           #0a0a0a;
--ink-2:         #3a3a37;
--muted:         #6b6b66;
--muted-2:       #9a9a94;

--accent:        oklch(0.56 0.13 200);  /* teal */
--accent-ink:    oklch(0.38 0.13 200);
--accent-bg:     oklch(0.95 0.03 200);
--accent-border: oklch(0.86 0.06 200);
--on-accent:     #ffffff;

/* Status — matches API enum exactly */
--status-submitted:    oklch(0.56 0.13 200);   /* teal — "incoming" */
--status-submitted-bg: oklch(0.95 0.03 200);
--status-review:       oklch(0.66 0.16 60);    /* orange — "in queue" */
--status-review-bg:    oklch(0.96 0.04 60);
--status-resolved:     oklch(0.58 0.14 145);   /* green — "closed" */
--status-resolved-bg:  oklch(0.95 0.03 145);

/* Severity */
--sev-low:    oklch(0.66 0.06 200);
--sev-medium: oklch(0.66 0.16 60);
--sev-high:   oklch(0.56 0.20 25);

/* Dark mode — Direction B dark */
/* .dark prefix flips all vars; see tokens.css for full dark values */
```

---

## Typography

| Role | Font | Weight | Use |
|------|------|--------|-----|
| Display / hero numbers | JetBrains Mono | 700 | `218` open reports, nav labels |
| Section headers | JetBrains Mono | 500–600 | "REPORTS", "SORT: NEWEST" micro-labels |
| Body / readable copy | Inter | 400–600 | Card titles, descriptions, button text |
| Machine data | JetBrains Mono | 400–500 | IDs `WLK-7AC30`, timestamps, GPS coords |
| Kannada content | Noto Sans Kannada | 400–600 | Citizen-submitted text fields only |

---

## Screens in Scope

| Screen | Mobile | Desktop |
|--------|--------|---------|
| Login | ✓ | ✓ |
| Dashboard / Home | ✓ | ✓ |
| Reports list (card stream) | ✓ | ✓ |
| Reports list (compact rows) | ✓ | ✓ |
| Report detail (photo, map, timeline) | ✓ | ✓ |
| Reports map view | ✓ | ✓ |
| Users management | ✓ | ✓ |
| Create / invite user modal | ✓ | ✓ |
| Organizations list + tree | ✓ | ✓ |
| Profile + change password | ✓ | ✓ |
| Empty state (all caught up) | ✓ | — |
| Offline / error state | ✓ | — |

---

## Navigation

**Mobile**: bottom tab bar — Home / Reports / Map / Users (4 tabs, icon + label)
**Desktop**: left sidebar — Dashboard, Reports (badge count), Map, Users, Organizations,
  divider, Profile, sign-out. Width: 220px fixed.

Super admin sees all organizations; regular admins see only their assigned org scope.
The org hierarchy is data-driven — no hardcoded GBA/Traffic Police structure in the UI.

---

## Component Inventory

All components are implemented in `primitives.jsx` and reused across both directions
via CSS variable inheritance.

- `Icon` — 20+ Material Symbols paths
- `Btn` — `accent / secondary / ghost / danger` × `sm / md / lg`
- `Card` — surface + shadow-sm, optional `padded` prop
- `StatusBadge` — `submitted / under_review / resolved` in both pill and monoLabel styles
- `SeverityIndicator` — 3 bars (lit/unlit) + label + count
- `Avatar` — initials circle, `ink / accent / muted` tones
- `Pill` — `neutral / accent / danger / warn / outline`
- `Select` — dropdown trigger with icon
- `SectionLabel` — 10px mono uppercase label with tracking
- `DupBadge` — `+N DUP` with `high / medium / low` confidence tint

---

## Implementation Reference

The Next.js implementation lives in `frontend/app/admin/`. The prototype HTML files
in `design-ref/admin-portal/` can be opened in a browser to review the full canvas.

Related docs:
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system architecture
- [`design-ref/README.md`](../design-ref/README.md) — citizen-facing design (Phase 02.3.1)
- [`design-ref/admin-portal/README.md`](../design-ref/admin-portal/README.md) — detailed file index
