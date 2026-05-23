# Namma Daari Admin Portal — Design Source Files

Exported from claude.ai/design on 2026-05-20. Two directions explored; implementation
targets the hybrid described below. See `chats/` for the full design rationale.

## Two Directions

### Direction A · "Daari Ops"
A warm sibling of the citizen-facing app. Stone neutrals, civic green accent
(`oklch(0.62 0.14 145)`), rounded radii (up to 20px), soft shadows, Inter-led
typography with JetBrains Mono for IDs and timestamps. Reads like the back office
of a friendly civic tool.

### Direction B · "Walkability Console"
An ops console for triage. Cooler stone + teal accent (`oklch(0.56 0.13 200)`),
sharper radii (4–14px), hairline borders instead of shadows, JetBrains Mono
dominates the chrome (nav, headers, status labels). Reads like a professional
working tool, not a marketing site.

## Final Hybrid (what to implement)

Design B's *voice* with Design A's *structural list patterns*:
- B's palette, typography hierarchy (mono in chrome), border-over-shadow aesthetic
- A's report card structure: photo tile + category title + status badge + ward·time meta line
- Accessibility pass: color + pattern + text for severity (no color-only signals)
- Plain language for non-technical government workers (sentence case, no `UPPERCASE_LABELS`)
- Offline: show pending-changes card, reassurance copy ("Your work is saved — will sync automatically")
- Both light and dark mode from day one

## Screens in Scope (all implemented in the prototype)

- Login
- Dashboard / Home (mobile + desktop)
- Reports list with filters (card stream + compact rows)
- Single report detail (photo full-width, map, status timeline, status change)
- Reports map view (mobile + desktop)
- Users management + create/invite modal
- Organizations list + tree
- Profile + change password
- Empty states and error/offline states

## Files

| File | Contents |
|------|----------|
| `tokens.css` | Full CSS variable system — both directions + dark variants |
| `primitives.jsx` | Shared components: Icon, Btn, Card, Badge, StatusBadge, Avatar, Pill, SeverityIndicator, etc. |
| `foundations.jsx` | Foundation row component (palette + type scale cards) |
| `data.js` | Sample data (reports, stats, users, orgs) mirroring the real API shape |
| `screens-a-mobile.jsx` | Direction A — all mobile screens |
| `screens-a-desktop.jsx` | Direction A — all desktop screens |
| `screens-b-mobile.jsx` | Direction B — all mobile screens (incl. hybrid compact rows) |
| `screens-b-desktop.jsx` | Direction B — all desktop screens |
| `design-canvas.jsx` | Canvas composition (artboard layout) |
| `canvas-app.jsx` | Main entry point — renders full canvas |
| `index.html` | Standalone HTML viewer (open in browser to see the full design) |
| `chats/chat1.md` | Design session 1 — initial questions, direction choices, full canvas build |
| `chats/chat2.md` | Design session 2 — hybrid merge, accessibility pass, offline state, photo bug fix |

## Key Token Values (hybrid implementation)

```css
/* Direction B as base */
--bg: #f3f3f1;
--surface: #ffffff;
--ink: #0a0a0a;
--accent: oklch(0.56 0.13 200);       /* teal */
--font-display: 'JetBrains Mono';     /* B: mono in chrome */
--font-sans: 'Inter';
--font-mono: 'JetBrains Mono';
--font-kn: 'Noto Sans Kannada';
--r-xs: 4px; --r-sm: 6px; --r-md: 8px; --r-lg: 10px; --r-xl: 14px;

/* Status colors */
--status-submitted: oklch(0.56 0.13 200);   /* teal */
--status-review: oklch(0.66 0.16 60);       /* orange */
--status-resolved: oklch(0.58 0.14 145);    /* green */

/* Severity (redundantly encoded — pattern + text + color) */
--sev-low: oklch(0.66 0.06 200);
--sev-medium: oklch(0.66 0.16 60);
--sev-high: oklch(0.56 0.20 25);
```

## Implementation Notes

- The Next.js implementation lives under `frontend/app/admin/`
- Admin portal is English-only; Kannada appears only in citizen-submitted content
- Org hierarchy is data-driven — no hardcoded GBA/corporation/ward structure
- Super admin sees all wards; regular admins see only their assigned org scope
- All buttons ≥ 44px tap target (accessibility requirement)
