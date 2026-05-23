/* Mock data for admin design canvas — realistic shapes mirroring API */

window.CATEGORIES = {
  no_footpath:       { en: "No Footpath",       kn: "ಪಾದಚಾರಿ ಮಾರ್ಗವಿಲ್ಲ",       short: "No path",   icon: "cat_no_path" },
  broken_footpath:   { en: "Broken Footpath",   kn: "ಮುರಿದ ಪಾದಚಾರಿ ಮಾರ್ಗ",     short: "Broken",    icon: "cat_broken" },
  blocked_footpath:  { en: "Blocked Footpath",  kn: "ಮುಚ್ಚಿದ ಪಾದಚಾರಿ ಮಾರ್ಗ",   short: "Blocked",   icon: "cat_blocked" },
  unsafe_crossing:   { en: "Unsafe Crossing",   kn: "ಅಸುರಕ್ಷಿತ ಕ್ರಾಸಿಂಗ್",      short: "Crossing",  icon: "cat_crossing" },
  poor_lighting:     { en: "Poor Lighting",     kn: "ಕಳಪೆ ಬೆಳಕು",                 short: "Lighting",  icon: "cat_lighting" },
  other:             { en: "Other",             kn: "ಇತರೆ",                       short: "Other",     icon: "cat_other" },
};

window.STATUS_LABELS = {
  submitted:    { label: "Submitted",    dot: "var(--status-submitted)" },
  under_review: { label: "Under Review", dot: "var(--status-review)" },
  resolved:     { label: "Resolved",     dot: "var(--status-resolved)" },
};

window.SEVERITY_LABELS = {
  low:    { label: "Low",    color: "var(--sev-low)" },
  medium: { label: "Medium", color: "var(--sev-medium)" },
  high:   { label: "High",   color: "var(--sev-high)" },
};

// Photo placeholder class — abstract, not AI-drawn street
function ph(i) { return ["photo", "photo alt-1", "photo alt-2", "photo alt-3", "photo alt-4"][i % 5]; }

window.SAMPLE_REPORTS = [
  {
    id: "WLK-7AC2F", uuid: "018f1a2b-3c4d-7e5f-9a0b-1c2d3e4f5a6b",
    created_at: "2026-05-19T14:23:00Z", relative: "12 min ago",
    category: "broken_footpath", severity: "high", status: "submitted",
    ward_name: "Shivajinagar", lat: 12.9854, lng: 77.6065,
    description: "Large open pit near the bus stop, exposed rebar. Wheelchair-blocked.",
    kn_description: "ಬಸ್ ನಿಲ್ದಾಣದ ಬಳಿ ದೊಡ್ಡ ಗುಂಡಿ.",
    submitter_name: "Kumar S.", submitter_contact: "+91 98XX XX 4421",
    location_source: "exif", photo: ph(0),
    duplicate_count: 3, duplicate_confidence: "high",
  },
  {
    id: "WLK-7AC2E", uuid: "018f1a2b-3c4d-7e5f-9a0b-1c2d3e4f5a6c",
    created_at: "2026-05-19T13:51:00Z", relative: "44 min ago",
    category: "unsafe_crossing", severity: "high", status: "submitted",
    ward_name: "Domlur", lat: 12.9617, lng: 77.6386,
    description: "Signal not working at junction. Pedestrians dodging vehicles.",
    submitter_name: "Anita P.", submitter_contact: "anita.p@gmail.com",
    location_source: "exif", photo: ph(1),
    duplicate_count: 0, duplicate_confidence: "low",
  },
  {
    id: "WLK-7AC2D", uuid: "018f1a2b-3c4d-7e5f-9a0b-1c2d3e4f5a6d",
    created_at: "2026-05-19T11:08:00Z", relative: "3h ago",
    category: "blocked_footpath", severity: "medium", status: "submitted",
    ward_name: "Shivajinagar", lat: 12.9856, lng: 77.6070,
    description: "Construction debris from a new building taking up the entire path.",
    location_source: "manual_pin", photo: ph(2),
    duplicate_count: 1, duplicate_confidence: "high",
  },
  {
    id: "WLK-7AC2C", uuid: "018f1a2b-3c4d-7e5f-9a0b-1c2d3e4f5a6e",
    created_at: "2026-05-19T10:14:00Z", relative: "4h ago",
    category: "poor_lighting", severity: "medium", status: "under_review",
    ward_name: "Indiranagar", lat: 12.9784, lng: 77.6408,
    description: "Three streetlights out on the stretch from 12th Main to CMH road. Unsafe after 7pm.",
    location_source: "exif", photo: ph(3),
    duplicate_count: 0, duplicate_confidence: "low",
  },
  {
    id: "WLK-7AC2B", uuid: "018f1a2b-3c4d-7e5f-9a0b-1c2d3e4f5a6f",
    created_at: "2026-05-19T09:42:00Z", relative: "5h ago",
    category: "no_footpath", severity: "low", status: "under_review",
    ward_name: "HSR Layout", lat: 12.9081, lng: 77.6476,
    description: "Stretch in front of school has no footpath; kids walking on the road.",
    location_source: "exif", photo: ph(4),
    duplicate_count: 0, duplicate_confidence: "low",
  },
  {
    id: "WLK-7AC2A", uuid: "018f1a2b-3c4d-7e5f-9a0b-1c2d3e4f5a70",
    created_at: "2026-05-18T16:30:00Z", relative: "Yesterday",
    category: "broken_footpath", severity: "low", status: "resolved",
    ward_name: "Koramangala", lat: 12.9352, lng: 77.6245,
    description: "Tile dislodgement on 80 Feet Road — repaired by BBMP team.",
    location_source: "manual_pin", photo: ph(0),
    duplicate_count: 0, duplicate_confidence: "low",
  },
  {
    id: "WLK-7AC29", uuid: "018f1a2b-3c4d-7e5f-9a0b-1c2d3e4f5a71",
    created_at: "2026-05-18T12:15:00Z", relative: "Yesterday",
    category: "blocked_footpath", severity: "medium", status: "resolved",
    ward_name: "Jayanagar", lat: 12.9279, lng: 77.5937,
    description: "Vendor encroachment cleared after notice.",
    location_source: "exif", photo: ph(1),
    duplicate_count: 0, duplicate_confidence: "low",
  },
];

window.SAMPLE_DUPLICATES = [
  { id: "WLK-7AC30", ward_name: "Shivajinagar", created_at: "2026-05-19T15:02:00Z", relative: "5m ago", category: "broken_footpath", status: "submitted", severity: "medium", confidence: "high", distance_m: 8 },
  { id: "WLK-7AC2F", ward_name: "Shivajinagar", created_at: "2026-05-19T14:23:00Z", relative: "12m ago", category: "broken_footpath", status: "submitted", severity: "high",   confidence: "high", distance_m: 0 },
  { id: "WLK-7AC18", ward_name: "Shivajinagar", created_at: "2026-05-19T08:51:00Z", relative: "6h ago",  category: "broken_footpath", status: "submitted", severity: "high",   confidence: "high", distance_m: 14 },
];

window.SAMPLE_TIMELINE = [
  { status: "submitted",    at: "2026-05-19 14:23",  who: "anonymous citizen", note: null },
  { status: "under_review", at: "2026-05-19 15:10",  who: "ravi.k@gba.gov.in", note: "Verified location, escalating to BBMP East ward office. Photo evidence sufficient." },
  { status: "under_review", at: "2026-05-19 17:40",  who: "system",            note: "2 duplicate reports auto-linked (WLK-7AC30, WLK-7AC18)." },
];

window.SAMPLE_USERS = [
  { email: "kkin1995@gmail.com",       name: "Karan Kinariwala",  role: "admin",    is_super_admin: true,  is_active: true,  org: "GBA — Greater Bengaluru Authority", last_login: "2026-05-19 14:00" },
  { email: "ravi.k@gba.gov.in",        name: "Ravi Krishnan",     role: "admin",    is_super_admin: false, is_active: true,  org: "BBMP East Corporation",              last_login: "2026-05-19 13:22" },
  { email: "anita.s@bbmp.gov.in",      name: "Anita Shankar",     role: "admin",    is_super_admin: false, is_active: true,  org: "BBMP Mahadevapura",                  last_login: "2026-05-18 09:14" },
  { email: "priya.m@trafficpolice.gov.in", name: "Priya M.",      role: "reviewer", is_super_admin: false, is_active: true,  org: "Traffic Police — East",              last_login: "2026-05-19 10:48" },
  { email: "sanjay.r@bbmp.gov.in",     name: "Sanjay R.",         role: "reviewer", is_super_admin: false, is_active: false, org: "BBMP East · Shivajinagar Ward",      last_login: "2026-04-12 11:30" },
  { email: "meera.h@gba.gov.in",       name: "Meera Hegde",       role: "reviewer", is_super_admin: false, is_active: true,  org: "BBMP East · Shivajinagar Ward",      last_login: "2026-05-19 09:01" },
];

window.SAMPLE_ORGS = [
  { id: "gba", name: "Greater Bengaluru Authority", type: "gba", parent: null,
    children: [
      { id: "bbmp-e",  name: "BBMP East Corporation",   type: "corporation", parent: "gba",
        children: [
          { id: "shiv", name: "Shivajinagar Ward Office", type: "ward_office", parent: "bbmp-e", children: [] },
          { id: "doml", name: "Domlur Ward Office",       type: "ward_office", parent: "bbmp-e", children: [] },
          { id: "indi", name: "Indiranagar Ward Office",  type: "ward_office", parent: "bbmp-e", children: [] },
        ]},
      { id: "bbmp-s",  name: "BBMP South Corporation",  type: "corporation", parent: "gba",
        children: [
          { id: "hsr",  name: "HSR Layout Ward Office",   type: "ward_office", parent: "bbmp-s", children: [] },
          { id: "jaya", name: "Jayanagar Ward Office",    type: "ward_office", parent: "bbmp-s", children: [] },
        ]},
      { id: "bbmp-w",  name: "BBMP West Corporation",   type: "corporation", parent: "gba", children: [] },
      { id: "tp",      name: "Traffic Police — Bengaluru City", type: "corporation", parent: "gba", children: [] },
    ]},
];

window.SAMPLE_STATS = {
  total_reports: 1247,
  by_status:   { submitted: 218, under_review: 64,  resolved: 965 },
  by_category: { broken_footpath: 412, blocked_footpath: 286, no_footpath: 198, unsafe_crossing: 184, poor_lighting: 122, other: 45 },
  by_severity: { low: 412, medium: 624, high: 211 },
  // last 14 days submission counts
  trend: [12, 18, 23, 14, 9, 11, 19, 22, 17, 14, 28, 31, 24, 18],
  median_resolution_hours: 38,
  resolved_this_week: 47,
};
