---
slug: admin-queue-delete-silent
status: resolved
trigger: manual
created: 2026-06-24T00:00:00Z
goal: find_and_fix
tdd_mode: false
---

# Debug Session: Admin Queue Delete — Silent (No UI Feedback)

## Symptoms

- On staging.nammadaari.com/admin → "Queue" page, pressing the Delete button on a report (e.g. WLK-72543) does nothing visually
- No confirmation dialog appears
- No toast notification (success or error)
- No spinner / loading state
- After refreshing the page, the report IS gone — so server-side delete IS working
- Bug is UI-only: zero feedback to the user

## Current Focus

hypothesis: CONFIRMED — handleDelete on the Queue page fired the API call directly, with no confirmation modal, no loading state, and no error feedback.
fix: Applied — added confirmDeleteId/isDeleting/deleteError state, confirmation modal, and updated handleDelete to gate on modal confirm before calling the API.
next_action: DONE

## Evidence

- timestamp: 2026-06-24
  checked: frontend/app/admin/reports/page.tsx handleDelete function (lines 537-544 pre-fix)
  found: |
    async function handleDelete(id: string) {
      try {
        await deleteReport(id);
        await fetchReports(...);
      } catch {
        // ignore
      }
    }
  implication: Delete fires immediately on button click — no confirmation dialog state (no confirmDeleteId/showDeleteModal), no isDeleting loading state, catch block silently ignores errors. Zero UI feedback.

- timestamp: 2026-06-24
  checked: frontend/app/admin/reports/page.tsx — modal state inventory
  found: changingStatusId/isStatusUpdating/statusUpdateError state exists for status changes (with a full confirmation modal rendered at the bottom of ReportsPageContent). No equivalent state or modal exists for delete.
  implication: The status-change modal pattern is the established pattern in this component. Delete was simply never given the same treatment.

- timestamp: 2026-06-24
  checked: frontend/app/admin/reports/[id]/page.tsx handleDelete + delete modal (lines 164-165, 703-763)
  found: Report detail page has showDeleteModal/isDeleting/deleteError state + a full role="dialog" confirmation modal with "Delete this report? This cannot be undone." title, Cancel/Delete buttons, and error display.
  implication: The correct UX pattern is already established in the codebase. Queue page was missing it entirely.

- timestamp: 2026-06-24
  checked: No toast library used anywhere in admin
  found: No imports of sonner, react-hot-toast, or useToast in any admin file.
  implication: Error/success feedback uses inline modal content (deleteError state + role="alert" paragraph), matching the detail page pattern exactly.

## Eliminated

- hypothesis: ReportsTable.tsx Delete button was broken / not calling onDelete
  evidence: ReportsTable correctly calls onDelete(report.id) on click in all three view modes (card-stream, compact-rows, table). The button worked — handleDelete just fired the API silently.
  timestamp: 2026-06-24

## Resolution

root_cause: The Queue page's handleDelete function fired deleteReport() immediately on button click with no confirmation dialog, no loading state, and an empty catch block — producing zero UI feedback even though the server-side delete succeeded.

fix: |
  Added to frontend/app/admin/reports/page.tsx:
  1. Three new state variables: confirmDeleteId (string|null), isDeleting (boolean), deleteError (string|null)
  2. handleDelete() changed from async API call to synchronous state setter: sets confirmDeleteId and clears deleteError
  3. New confirmDelete() async function: sets isDeleting, calls deleteReport(), clears confirmDeleteId on success, sets deleteError on failure, always clears isDeleting in finally
  4. Delete confirmation modal rendered at the bottom of ReportsPageContent (before the status-change modal), matching the exact pattern from reports/[id]/page.tsx:
     - role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"
     - "Delete this report? This cannot be undone." heading
     - role="alert" error paragraph (conditional)
     - Cancel button (clears confirmDeleteId) + Delete button (data-testid="confirm-delete-btn", calls confirmDelete)
     - Click-outside-to-dismiss (only when not deleting)
  5. Updated frontend/app/admin/__tests__/reports-page.test.tsx R-RPT-3 tests to click the modal confirm button after clicking the row-level delete button.

verification: All 16 tests in reports-page.test.tsx pass (0 failures). TypeScript compile reports zero errors in reports/page.tsx.

files_changed:
  - frontend/app/admin/reports/page.tsx
  - frontend/app/admin/__tests__/reports-page.test.tsx
