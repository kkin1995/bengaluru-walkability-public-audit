/**
 * Wave 0 test scaffold for frontend/app/admin/components/ResolveModal.tsx
 *
 * Requirements covered:
 *   WFLOW-05  — Resolution photo gate: resolved/closed transitions require a photo
 *   D-13      — After-photo mandatory for resolved/closed status changes
 *   D-14      — Submit button disabled until photo attached
 *   D-16      — Optional notes field on Resolve/Close modal
 *
 * This file is a Wave 0 scaffold — all describe blocks use describe.skip.
 * Plan 03-03 executor must:
 *   1. Create frontend/app/admin/components/ResolveModal.tsx
 *   2. Remove describe.skip wrappers and implement the assertions
 *   3. Run `npm test -- --watchAll=false ResolveModal` to confirm green
 *
 * Implementation notes for plan 03-03:
 *   - ResolveModal receives props: reportId, currentStatus, onSuccess, onCancel
 *   - File input accepts image/* only; uses makeFile() helper for tests
 *   - Submit calls adminApi.resolveReport(reportId, { status, photo, notes })
 *   - adminApi should be mocked via jest.mock("@/app/lib/adminApi")
 */

import React from "react";

// Component is not yet implemented — import is intentionally commented out.
// import ResolveModal from "../ResolveModal";

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// WFLOW-05 / D-13 / D-14 — Photo required for resolved/closed transitions
// ---------------------------------------------------------------------------

describe.skip("WFLOW-05 / D-13 — ResolveModal: photo required blocks submit", () => {
  it("submit button is disabled when no photo has been attached", () => {
    // TODO (plan 03-03): render <ResolveModal reportId="..." currentStatus="assigned" ... />
    // and assert getByRole('button', { name: /resolve/i }).toBeDisabled()
  });

  it("shows a validation message when submit is attempted without a photo", () => {
    // TODO (plan 03-03): click submit with no photo attached, expect
    // screen.getByText(/photo required/i) to be in the document
  });

  it("submit button is disabled until a valid image file is selected", () => {
    // TODO (plan 03-03): render modal, upload a non-image file (e.g. text/plain),
    // confirm submit remains disabled; then upload image/jpeg and confirm it enables
  });
});

// ---------------------------------------------------------------------------
// WFLOW-05 / D-14 — Photo provided enables submit
// ---------------------------------------------------------------------------

describe.skip("WFLOW-05 / D-14 — ResolveModal: photo provided enables submit", () => {
  it("submit button becomes enabled after a valid image is attached", () => {
    // TODO (plan 03-03): use makeFile('photo.jpg', 'image/jpeg') + fireEvent.change
    // on the file input, then assert submit button is enabled (not disabled)
  });

  it("calls adminApi.resolveReport with the photo bytes when submitted", () => {
    // TODO (plan 03-03): mock adminApi.resolveReport, attach photo, click submit,
    // assert adminApi.resolveReport was called with correct reportId and FormData
  });
});

// ---------------------------------------------------------------------------
// D-16 — Optional notes field
// ---------------------------------------------------------------------------

describe.skip("D-16 — ResolveModal: optional notes field", () => {
  it("renders a textarea for resolution notes", () => {
    // TODO (plan 03-03): render modal and assert getByRole('textbox', { name: /notes/i })
    // is present in the document
  });

  it("submits successfully when notes field is left empty", () => {
    // TODO (plan 03-03): attach photo, leave notes empty, click submit,
    // confirm no validation error for missing notes
  });

  it("includes notes value in the adminApi.resolveReport payload when provided", () => {
    // TODO (plan 03-03): fill notes textarea with "Repair completed",
    // assert adminApi.resolveReport payload includes notes: "Repair completed"
  });
});
