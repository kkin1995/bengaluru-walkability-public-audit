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
