export const t = {
  // Homepage
  reportAnIssue:         { en: "Report an Issue",          kn: "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ" },
  viewAllReports:        { en: "View All Reports",          kn: "ಎಲ್ಲ ವರದಿಗಳು ನೋಡಿ" },
  appName:               { en: "Bengaluru Walkability Audit", kn: "ಬೆಂಗಳೂರು ನಡಿಗೆ ಲೆಕ್ಕಪರಿಶೋಧನೆ" },

  // Wizard actions
  next:                  { en: "Next",                     kn: "ಮುಂದೆ" },
  submitReport:          { en: "Submit Report",            kn: "ವರದಿ ಸಲ್ಲಿಸಿ" },

  // Photo capture
  takePhoto:             { en: "Take Photo",               kn: "ಫೋಟೋ ತೆಗೆಯಿರಿ" },
  uploadFromGallery:     { en: "Upload from Gallery",      kn: "ಗ್ಯಾಲರಿಯಿಂದ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ" },

  // Wizard step titles
  stepPhotoTitle:        { en: "Take a photo",             kn: "ಫೋಟೋ ತೆಗೆಯಿರಿ" },
  stepLocationTitle:     { en: "Confirm location",         kn: "ಸ್ಥಳ ಖಚಿತಪಡಿಸಿ" },
  stepCategoryTitle:     { en: "What's the issue?",        kn: "ಸಮಸ್ಯೆ ಏನು?" },
  stepDetailsTitle:      { en: "Add details",              kn: "ವಿವರ ಸೇರಿಸಿ" },

  // How it works
  howStep1:              { en: "Take a photo",             kn: "ಫೋಟೋ ತೆಗೆಯಿರಿ" },
  howStep2:              { en: "Confirm location",         kn: "ಸ್ಥಳ ಖಚಿತಪಡಿಸಿ" },
  howStep3:              { en: "Describe the issue",       kn: "ಸಮಸ್ಯೆ ವಿವರಿಸಿ" },

  // Category labels
  catNoFootpath:         { en: "No Footpath",              kn: "ಕಾಲ್ದಾರಿ ಇಲ್ಲ" },
  catBrokenFootpath:     { en: "Damaged Footpath",         kn: "ಹಾಳಾದ ಕಾಲ್ದಾರಿ" },
  catBlockedFootpath:    { en: "Blocked Footpath",         kn: "ಮುಚ್ಚಿದ ಕಾಲ್ದಾರಿ" },
  catUnsafeCrossing:     { en: "Unsafe Crossing",          kn: "ಅಸುರಕ್ಷಿತ ದಾಟುವ ಜಾಗ" },
  catPoorLighting:       { en: "Poor Lighting",            kn: "ಕಡಿಮೆ ಬೆಳಕು" },
  catOther:              { en: "Other Issue",              kn: "ಇತರ ಸಮಸ್ಯೆ" },
};

const CATEGORY_LABEL_MAP: Record<string, { en: string; kn: string }> = {
  no_footpath:      t.catNoFootpath,
  broken_footpath:  t.catBrokenFootpath,
  blocked_footpath: t.catBlockedFootpath,
  unsafe_crossing:  t.catUnsafeCrossing,
  poor_lighting:    t.catPoorLighting,
  other:            t.catOther,
};

export function getCategoryLabel(value: string): { en: string; kn: string } {
  return CATEGORY_LABEL_MAP[value] ?? { en: value, kn: value };
}

// FIX-13: Canonical location_source display labels for admin detail page.
// Maps canonical backend values (GPS_API, MANUAL_ADJUST, EXIF_GPS) to bilingual labels.
// Legacy values (manual_pin, exif) included for DB rows not yet migrated.
// Threat T-05-10: values are rendered as React text (auto-escaped) — no dangerouslySetInnerHTML.
const LOCATION_SOURCE_LABEL_MAP: Record<string, { en: string; kn: string }> = {
  GPS_API:       { en: "GPS (device)",   kn: "GPS (ಸಾಧನ)" },
  MANUAL_ADJUST: { en: "Manual pin",     kn: "ಮ್ಯಾನ್ಯುಯಲ್ ಪಿನ್" },
  EXIF_GPS:      { en: "Photo GPS",      kn: "ಫೋಟೋ GPS" },
  // Legacy values — kept for DB rows not yet migrated to canonical enum
  manual_pin:    { en: "Manual pin",     kn: "ಮ್ಯಾನ್ಯುಯಲ್ ಪಿನ್" },
  exif:          { en: "Photo GPS",      kn: "ಫೋಟೋ GPS" },
};

export function getLocationSourceLabel(value: string): { en: string; kn: string } {
  return LOCATION_SOURCE_LABEL_MAP[value] ?? { en: value, kn: value };
}

// MAP-03 / D-42: public 3-state mapping for citizens — 6-state admin enum is collapsed for clarity.
// open, acknowledged, assigned → "Open" (red — attention needed)
// in_progress                  → "In progress" (amber — in motion)
// resolved, closed             → "Resolved" (green — resolved)
export function publicStatusLabel(status: string): "Open" | "In progress" | "Resolved" {
  if (status === "in_progress") return "In progress";
  if (status === "resolved" || status === "closed") return "Resolved";
  return "Open"; // open, acknowledged, assigned, and unknown statuses
}

// TRIAGE-03 / D-09: Single shared bucketing predicate — consumed by both the render filter
// (ReportsMap marker .filter()) and chip count buckets (statusCounts in map/page.tsx).
// Delegates to publicStatusLabel so bucket assignments cannot drift between the two callers.
export function publicStatusMatches(
  status: string,
  bucket: "all" | "open" | "in_progress" | "resolved"
): boolean {
  if (bucket === "all") return true;
  const labelMap: Record<"open" | "in_progress" | "resolved", "Open" | "In progress" | "Resolved"> = {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
  };
  return publicStatusLabel(status) === labelMap[bucket];
}

// Returns CSS variable string for the 3-state public status color mapping.
export function publicStatusColor(status: string): string {
  if (status === "in_progress") return "var(--warn)";
  if (status === "resolved" || status === "closed") return "var(--accent)";
  return "var(--danger)"; // open, acknowledged, assigned, unknown
}
