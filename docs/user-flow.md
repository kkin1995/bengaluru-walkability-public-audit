# User Flow — Bengaluru Walkability Audit

Documented from a live walkthrough on 2026-03-04.

---

## Home Page

**URL:** `/`

The landing page greets citizens with a clear call to action.

- **Headline:** "Bengaluru Walkability Audit"
- **Tagline:** "Spot a broken footpath, blocked crossing, or unsafe road? Take a photo and pin the location — your report goes straight to our public map."
- **Primary CTA:** "Report an Issue" (green button)
- **Secondary CTA:** "View All Reports" (outlined button)

A "How It Works" section below explains the 3-step process:
1. Take a photo — Use your camera or gallery
2. Confirm location — GPS auto-detected or drop a pin
3. Describe the issue — Pick a category and add details

Footer reads: "Open-source civic tech · Data stored publicly"

---

## Report Flow

The report wizard is a 4-step form with a progress bar at the top. A back arrow allows navigation to the previous step.

---

### Step 1 of 4: Photo

**Heading:** "Take a photo"
**Subtext:** "Photograph the pedestrian infrastructure issue clearly."

Two options:
- **Take Photo** (large green button with camera icon) — opens device camera
- **Upload from Gallery** (outlined button) — opens file picker

The **Next** button is disabled until a photo is selected.

---

### Step 2 of 4: Location

**Heading:** "Confirm location"

**When photo has no GPS EXIF data** (e.g., screenshots or stripped images):
- A yellow banner appears: *"Couldn't read location from photo — drop the pin below"*
- The map is centered on Bengaluru with a draggable blue pin
- Hint text: *"Tap the map or drag the pin to adjust"*

The user can:
- Tap anywhere on the map to move the pin
- Drag the pin to fine-tune the location
- Zoom in/out with `+`/`–` controls

Map uses OpenStreetMap tiles via Leaflet. The **Next** button is enabled once a pin is placed within Bengaluru's bounding box.

---

### Step 3 of 4: Category

**Heading:** "What's the issue?"
**Subtext:** "Select the best matching category."

Six category cards displayed in a 2-column grid:

| Category | Icon | Description |
|---|---|---|
| **No Footpath** | 🚶 | No path — walking on the road |
| **Damaged Footpath** | ⚫ | Cracked tiles, open drain, dug-up surface |
| **Blocked Footpath** | 🚧 | Bikes, vendors, or debris blocking the path |
| **Unsafe Crossing** | ⚠️ | No signal, faded zebra, or no crossing at all |
| **Poor Lighting** | 🌑 | Street lights out or missing in this area |
| **Other Issue** | 📍 | Doesn't fit above — describe in details |

Selected card gets a green highlight border. The **Next** button is enabled once a category is chosen.

---

### Step 4 of 4: Details

**Heading:** "Add details"

**Severity** (required, toggle buttons):
- Low
- Medium
- **High** — "Immediate danger — open pit, no path, safety risk" (shown in red when selected)

**Description** *(optional)*
Free-text area, 500 character limit with live counter (e.g., "28/500").

**Your name** *(optional)*
Plain text field.

**Contact (email/phone)** *(optional)*
Plain text field.

Bottom CTA: **"Submit Report"** (full-width green button).

---

## All Reports Map

**URL:** `/reports`

Full-screen Leaflet map showing all submitted reports across Bengaluru.

- **Top-left:** "All Reports" heading with subtext "Tap a marker to see photo and details"
- **Top-right:** "Report" button (green, with camera icon) — navigates back to the report flow
- **Legend bar** below heading shows color-coded categories:
  - 🔴 No footpath
  - 🟠 Broken
  - 🟡 Blocked
  - 🟣 Crossing
  - ⚫ Lighting
  - 🔵 Other

Each submitted report appears as a color-coded circular marker on the map. Tapping a marker shows the photo and details.

---

## Privacy Notes

- GPS coordinates are extracted client-side from EXIF data (never sent raw to server)
- EXIF metadata is stripped server-side before images are stored
- Public coordinates are rounded to ~111m precision
- Name and contact fields are optional and not displayed on the public map
