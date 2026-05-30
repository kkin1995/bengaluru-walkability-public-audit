# Phase 03 UAT Issues — Logged 2026-05-26

Source: Screenshots from manual UAT session after Wave 3 deployment.

---

## GBA Hierarchy Panel

### ISSUE-01: Ward name shows "undefined" instead of actual ward name
- **Location:** GbaHierarchyPanel, first row "WARD" in the bureaucratic chain
- **Observed:** "undefined - Sampangirama Nagar" (the ward_name field renders as the literal string "undefined" prepended to the ward name)
- **Root cause (suspected):** The `ward_name` field in `ward_hierarchy` response may be double-nested or the panel reads `ward_hierarchy.ward_name` but the value is coming through as `undefined` at render time, falling back to a string coercion
- **Severity:** Minor visual bug — data is present, label is wrong

### ISSUE-02: GBA row label shows placeholder text instead of "Greater Bengaluru Authority"
- **Observed:** "Greater Bengaluru Authority" label appears to be present but the "Ward Supervisor / Field Contact" column value on the GBA row shows placeholder/incorrect text
- **Severity:** Minor

### ISSUE-03: Hierarchy row layout — right column values misaligned or truncated
- **Observed:** In the hierarchy rows, the right-side value column (e.g. "Ward Supervisor", "Area Engineer" labels) appears to be cut off or show placeholder text like "Ward Supervisor (? )" rather than real data
- **Root cause (suspected):** The column header labels in GbaHierarchyPanel reference fields that don't exist in the ward_hierarchy data (e.g. supervisor names, engineer names) — migration 009 only backfilled zone/RO/ARO/constituency data, not personnel fields
- **Severity:** Minor — structural data is correct, personnel columns are empty

### ISSUE-04: Elected section — AC number + constituency label rendering
- **Observed:** In the elected chain section, "162 - Shivajinagar / MLA: V. Somanna (Actual)" and "Bangalore Central / MP: P.C. Mohan" display correctly. But label formatting shows "162 - Shivajinagar" as a combined string rather than separate AC number and name cells
- **Severity:** Cosmetic

### ISSUE-05: Disclaimer text overflows or is cut off
- **Observed:** The disclaimer at the bottom of the elected section ("Constituency boundaries may differ from ward boundaries.") appears to overflow the panel width on the right panel layout
- **Severity:** Cosmetic

---

## Status History

### ISSUE-06: Status history "OPEN AT" timestamp format
- **Observed:** Status history entry shows "Status: At / [date]" — the label prefix appears to be "AT" instead of the status value (e.g. "OPEN")
- **Severity:** Minor — functional but label incorrect

---

## General

### ISSUE-07: Right panel scroll — content below fold not discoverable
- **Observed:** The right panel on /admin/reports/[id] has a lot of content (StatusActionPanel + OrgAssignPanel + GbaHierarchyPanel + description + status history). On a standard 1080p display, the GBA hierarchy is below the fold with no visual scroll indicator
- **Severity:** UX — not a bug but discoverability issue

---

## Status: All logged, none fixed. To be addressed in a follow-up session.
