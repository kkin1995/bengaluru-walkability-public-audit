# Admin Portal Design System

_Started 2026-05-20 12:30 UTC_

---

## User

Hi Claude! The admin portal of the Namma Daari app is accesible at /admin. All the code (including the admin) is located at https://github.com/kkin1995/bengaluru-walkability-public-audit

I want you to analyse the functionality and code in depth and come up with a design system (mobile-first) for the admin portal so that the administrators of the system can administrate on the and in a frictionless manner. Also the design system for the front end was also made by in an earlier project of Claude Design. If you can access it, please take a look. The citizen facing design details is also given in design-ref/ in the project root. Keep asking me questions until every single edge and corner is covered and set.

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: github_list_repos]_

_[tool: github_get_tree]_

_[tool: github_get_tree]_

_[tool: github_get_tree]_

_[tool: github_get_tree]_

_[tool: github_read_file]_

_[tool: github_read_file]_

_[tool: github_read_file]_

_[tool: github_read_file]_

_[tool: github_read_file]_

_[tool: github_get_tree]_

Excellent context. Let me read the design references and current admin code in parallel.

_[tool: github_read_file]_

_[tool: github_read_file]_

_[tool: github_read_file]_

_[tool: github_read_file]_

_[tool: github_read_file]_

_[tool: github_read_file]_

Let me peek at a few key admin files to understand the current shape, then I'll ask my questions.

_[tool: questions_v2]_

I've done a thorough read of the repo — the admin portal already has real bones (auth, reports list with duplicate expansion, status modal, stats cards, sidebar, map view, user/org management) but the UI is bare Tailwind without a coherent system. I've also pulled in the citizen-facing **Minimal Mono** design system: warm neutrals, single muted civic green accent, Inter + JetBrains Mono + Noto Sans Kannada, bilingual labels, soft shadows, oklch-tuned semantic colors.

Before I commit to a system, I want to lock down the philosophy and edges. Here are my questions.

## User

Questions answered:
- primary_persona: We do not know the GBA / Traffic police heirachy. Let the heirachy come in from the backend when update. For now work with a super admin (seeded at deployment - me) and admins that I create/
- mobile_first_meaning: Mobile-first but with a real desktop layout (sidebar, dense tables) when there's room
- aesthetic_continuity: Cousin — same DNA (warm neutrals, mono accents) but with its own utilitarian voice (e.g. ops-terminal cues, more JetBrains Mono, slightly cooler)
- bilingual_in_admin: English-only — admins are literate in English; Kannada appears only when showing citizen-submitted content
- primary_task: Triage the inbox — work through new "submitted" reports, accept or reject, move to under_review
- default_home: A stats dashboard (totals, by status, by category)
- list_density_mobile: Card stream — one report per card with thumbnail, category, ward, time, status. Lots of breathing room.
- bulk_actions: No — one report at a time keeps the audit trail clean
- duplicates_treatment: Visible badge + expand, like today, but designed properly with confidence shown
- report_detail: Big photo viewer with pinch-zoom (the photo IS the evidence), Map showing exact GPS + ward overlay, Status timeline (status_history) with notes from prior admins
- status_naming: Keep them — match the API/data model exactly
- org_scoping_chrome: Auto applied from the user's org but should show all wards for super admin because super admin will not be from one ward
- dark_mode: Yes — both light and dark from day one
- screens_in_scope: Login, Dashboard / home, Reports list with filters, Single report detail (with photo, map, timeline, status change), Reports map view, Users management, Create / invite user modal, Organizations list, Profile + change password, Empty states & error states, All of them
- deliverable_format: A design canvas with all screens laid out side by side for review
- variations: Two — one safe/sibling-of-citizen, one more distinctive
- tweakable_aspects: Report-card style (card stream vs compact rows)
- aesthetic_risk: Modern civic — distinctive but professional (think Linear / Vercel but for civic tech)

## Assistant

_[tool: update_todos]_

_[tool: copy_starter_component]_

Got it — clear brief. Let me lock in the plan:

- **Two directions:** "Daari Ops" (warm sibling of citizen app, civic green) and "Walkability Console" (cooler, more JetBrains-Mono-forward, Linear/Vercel-civic).
- **Design canvas** laying out all screens side-by-side, mobile cards as primary + desktop where it counts, with a dark-mode strip.
- **Foundations row** up top showing palette, type, and core components per direction.

Let me build it.

_[tool: grep]_

_[tool: write_file]_

_[tool: write_file]_

Now I'll build the system. Starting with tokens and data, then primitives, then screens.

_[tool: write_file]_

Now the primitives — icons, buttons, badges, all variant-aware via CSS vars.

_[tool: write_file]_

Now the foundations row, then the direction-specific screens.

_[tool: write_file]_

Now the screens for Direction A — Daari Ops.

_[tool: write_file]_

Now A's desktop screens (dashboard, reports table, report detail, users + modal, organizations).

_[tool: write_file]_

Now Direction B — Walkability Console. Mono-forward, ops-terminal voice, sharper edges.

_[tool: write_file]_

Now B's desktop screens.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me make dark mode work with an ancestor class so I can wrap screens, then compose the canvas.Now the canvas composition and index.html.

_[tool: write_file]_

_[tool: write_file]_

_[tool: show_html]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Delivered — a design canvas with the full admin system, two directions side-by-side.

**What's in there:**
- **Cover + Foundations** — both directions' palette, type, components, voice
- **Login · mobile** — warm form vs. console-style $login banner
- **Dashboard · mobile + desktop** — A leads with stats + a green "Start triage" CTA; B leads with a giant `218` on inky black + a live activity tail
- **Reports list** — card stream (default) and compact rows (tweak), both directions
- **Report detail · mobile + desktop** — photo as evidence, status timeline, location card, telemetry block, inline status change
- **Reports map · mobile + desktop** — status-colored pins, cluster bubbles, in-view rail
- **Users + invite modal** — super-admin badge, deactivated rows fade, org column, modal mirrors `POST /api/admin/users`
- **Organizations** — GBA → corporation → ward office tree with detail rail
- **Profile, inbox-zero, network error** — both directions
- **Dark mode strip** — six hero screens

**Two directions:**
- **A · Daari Ops** — warm sibling of the citizen app: stone neutrals, civic green (oklch 0.62 0.14 145), rounded radii, soft shadows, Inter-led with JetBrains Mono for IDs/timestamps
- **B · Walkability Console** — cool stone + teal (oklch 0.56 0.13 200), sharper radii, borders not shadows, JetBrains Mono in the chrome (nav, headers, status labels), ASCII banners in places, activity tail on the desktop dashboard

**Built around your data model exactly:** the three statuses (`submitted` / `under_review` / `resolved`), severity bars from the enum, `duplicate_count` + `duplicate_confidence` shown with proper signal, EXIF/pin agreement noted, `location_source` surfaced, `is_super_admin` and `is_active` reflected in user rows.

Org hierarchy is rendered as an editable tree so once the GBA/Traffic-Police structure arrives from the backend, it'll slot in without UI changes.

Drag artboards to reorder, click "Focus" on any to view fullscreen, and rename labels inline. Pick a direction and I'll go deep on it — or mix elements across the two.

