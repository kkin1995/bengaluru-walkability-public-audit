/**
 * Tests for frontend/app/admin/components/ResolveModal.tsx
 *
 * Requirements covered:
 *   WFLOW-05  — Resolution photo gate: resolved/closed transitions require a photo
 *   D-13      — After-photo mandatory for resolved/closed status changes
 *   D-14      — Submit button disabled until photo attached
 *   D-16      — Optional notes field on Resolve/Close modal
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResolveModal } from "../ResolveModal";
import type { AdminReport } from "../../lib/adminApi";
import * as adminApi from "../../lib/adminApi";

jest.mock("../../lib/adminApi", () => ({
  ...jest.requireActual("../../lib/adminApi"),
  resolveReport: jest.fn(),
}));

const mockResolveReport = adminApi.resolveReport as jest.MockedFunction<typeof adminApi.resolveReport>;

// Mock URL.createObjectURL / revokeObjectURL (not available in jsdom)
beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => "blob:http://localhost/mock-url");
  global.URL.revokeObjectURL = jest.fn();
});

function makeReport(overrides: Partial<AdminReport> = {}): AdminReport {
  return {
    id: "aaaabbbbccccdddd",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    image_path: "test.jpg",
    image_url: "http://localhost:3001/uploads/test.jpg",
    latitude: 12.97,
    longitude: 77.59,
    category: "damaged_footpath",
    severity: "high",
    description: null,
    submitter_name: null,
    submitter_contact: null,
    status: "in_progress",
    location_source: "manual",
    ward_name: "Shivajinagar",
    resolution_photo_url: null,
    resolution_notes: null,
    assigned_org_id: null,
    ...overrides,
  };
}

function makeImageFile(name = "photo.jpg", type = "image/jpeg"): File {
  return new File(["(binary)"], name, { type });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// WFLOW-05 / D-13 / D-14 — Photo required for resolved/closed transitions
// ---------------------------------------------------------------------------

describe("WFLOW-05 / D-13 — ResolveModal: photo required blocks submit", () => {
  it("submit button is disabled when no photo has been attached", () => {
    render(
      <ResolveModal
        open={true}
        mode="resolve"
        report={makeReport()}
        onClose={jest.fn()}
        onResolved={jest.fn()}
      />
    );

    const submitBtn = screen.getByTestId("resolve-submit");
    expect(submitBtn).toBeDisabled();
  });

  it("shows a REQUIRED tag/alert when no photo is attached", () => {
    render(
      <ResolveModal
        open={true}
        mode="resolve"
        report={makeReport()}
        onClose={jest.fn()}
        onResolved={jest.fn()}
      />
    );

    expect(screen.getByTestId("resolve-required-alert")).toBeInTheDocument();
  });

  it("submit button is disabled for non-image file types (photo must be image)", () => {
    render(
      <ResolveModal
        open={true}
        mode="resolve"
        report={makeReport()}
        onClose={jest.fn()}
        onResolved={jest.fn()}
      />
    );

    const fileInput = screen.getByTestId("resolve-photo-input");
    const nonImageFile = new File(["content"], "document.pdf", { type: "application/pdf" });

    fireEvent.change(fileInput, { target: { files: [nonImageFile] } });

    // Submit should still be disabled since PDF was rejected
    const submitBtn = screen.getByTestId("resolve-submit");
    expect(submitBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// WFLOW-05 / D-14 — Photo provided enables submit
// ---------------------------------------------------------------------------

describe("WFLOW-05 / D-14 — ResolveModal: photo provided enables submit", () => {
  it("submit button becomes enabled after a valid image is attached", () => {
    render(
      <ResolveModal
        open={true}
        mode="resolve"
        report={makeReport()}
        onClose={jest.fn()}
        onResolved={jest.fn()}
      />
    );

    const fileInput = screen.getByTestId("resolve-photo-input");
    fireEvent.change(fileInput, { target: { files: [makeImageFile()] } });

    const submitBtn = screen.getByTestId("resolve-submit");
    expect(submitBtn).not.toBeDisabled();
  });

  it("calls resolveReport with the correct args when submitted after photo upload", async () => {
    const onResolved = jest.fn();
    const onClose = jest.fn();
    const updatedReport = makeReport({ status: "resolved" });
    mockResolveReport.mockResolvedValue(updatedReport);

    render(
      <ResolveModal
        open={true}
        mode="resolve"
        report={makeReport()}
        onClose={onClose}
        onResolved={onResolved}
      />
    );

    const file = makeImageFile();
    fireEvent.change(screen.getByTestId("resolve-photo-input"), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByTestId("resolve-submit"));

    await waitFor(() => {
      expect(mockResolveReport).toHaveBeenCalledWith(
        "aaaabbbbccccdddd",
        "resolved",
        file,
        undefined
      );
    });
    expect(onResolved).toHaveBeenCalledWith(updatedReport);
    expect(onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// D-16 — Optional notes field
// ---------------------------------------------------------------------------

describe("D-16 — ResolveModal: optional notes field", () => {
  it("renders a textarea for resolution notes", () => {
    render(
      <ResolveModal
        open={true}
        mode="resolve"
        report={makeReport()}
        onClose={jest.fn()}
        onResolved={jest.fn()}
      />
    );

    expect(screen.getByTestId("resolve-notes-input")).toBeInTheDocument();
  });

  it("submits successfully when notes field is left empty", async () => {
    const onResolved = jest.fn();
    const updatedReport = makeReport({ status: "resolved" });
    mockResolveReport.mockResolvedValue(updatedReport);

    render(
      <ResolveModal
        open={true}
        mode="resolve"
        report={makeReport()}
        onClose={jest.fn()}
        onResolved={onResolved}
      />
    );

    // Attach photo
    fireEvent.change(screen.getByTestId("resolve-photo-input"), {
      target: { files: [makeImageFile()] },
    });

    // Submit without notes
    fireEvent.click(screen.getByTestId("resolve-submit"));

    await waitFor(() => {
      expect(mockResolveReport).toHaveBeenCalledWith(
        "aaaabbbbccccdddd",
        "resolved",
        expect.any(File),
        undefined
      );
    });
    expect(onResolved).toHaveBeenCalled();
  });

  it("includes notes value in the resolveReport payload when provided", async () => {
    const onResolved = jest.fn();
    const updatedReport = makeReport({ status: "resolved" });
    mockResolveReport.mockResolvedValue(updatedReport);

    render(
      <ResolveModal
        open={true}
        mode="resolve"
        report={makeReport()}
        onClose={jest.fn()}
        onResolved={onResolved}
      />
    );

    // Attach photo
    fireEvent.change(screen.getByTestId("resolve-photo-input"), {
      target: { files: [makeImageFile()] },
    });

    // Fill in notes
    fireEvent.change(screen.getByTestId("resolve-notes-input"), {
      target: { value: "Repair completed" },
    });

    // Submit
    fireEvent.click(screen.getByTestId("resolve-submit"));

    await waitFor(() => {
      expect(mockResolveReport).toHaveBeenCalledWith(
        "aaaabbbbccccdddd",
        "resolved",
        expect.any(File),
        "Repair completed"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// UI-SPEC §D — Close variant warning
// ---------------------------------------------------------------------------

describe("UI-SPEC §D — ResolveModal: close variant amber warning", () => {
  it("renders the permanent-closure warning when mode is 'close'", () => {
    render(
      <ResolveModal
        open={true}
        mode="close"
        report={makeReport()}
        onClose={jest.fn()}
        onResolved={jest.fn()}
      />
    );

    expect(screen.getByTestId("close-warning")).toBeInTheDocument();
    expect(screen.getByText(/Closing is permanent/i)).toBeInTheDocument();
  });

  it("does NOT render the close warning when mode is 'resolve'", () => {
    render(
      <ResolveModal
        open={true}
        mode="resolve"
        report={makeReport()}
        onClose={jest.fn()}
        onResolved={jest.fn()}
      />
    );

    expect(screen.queryByTestId("close-warning")).not.toBeInTheDocument();
  });
});
