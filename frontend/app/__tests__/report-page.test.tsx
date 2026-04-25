/**
 * Tests for frontend/app/report/page.tsx — 2-step Walkable BLR report flow (Phase 02.3.1)
 */

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportPage from "../report/page";

// Mock next/link
jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

// Mock next/dynamic — LocationMap renders a placeholder
jest.mock("next/dynamic", () => () => {
  const Mock = () => <div data-testid="location-map" />;
  Mock.displayName = "DynamicMock";
  return Mock;
});

// Mock photo-store — default: no pending photo (existing tests unaffected)
jest.mock("@/app/lib/photo-store", () => ({
  consumePendingPhoto: jest.fn().mockReturnValue(null),
  storePendingPhoto: jest.fn(),
}));

// Mock exifr — default to GPS inside Bengaluru
jest.mock("exifr", () => ({
  __esModule: true,
  default: {
    gps: jest.fn().mockResolvedValue({ latitude: 12.9716, longitude: 77.5946 }),
  },
  gps: jest.fn().mockResolvedValue({ latitude: 12.9716, longitude: 77.5946 }),
}));

function makeFile(name = "photo.jpg", size = 1000): File {
  const blob = new Blob([new Uint8Array(size)], { type: "image/jpeg" });
  return new File([blob], name, { type: "image/jpeg" });
}

async function uploadPhoto(file: File = makeFile()) {
  const cameraInput = document.querySelector(
    'input[capture="environment"]'
  ) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(cameraInput, { target: { files: [file] } });
  });
}

async function goToConfirm() {
  await uploadPhoto();
  await waitFor(() => expect(screen.getByText("Damaged")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Damaged"));
  const continueBtn = screen
    .getAllByRole("button")
    .find((b) => b.textContent?.includes("Continue"));
  fireEvent.click(continueBtn!);
  await waitFor(() => expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument());
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "test-report-123" }),
  }) as jest.Mock;

  if (!URL.createObjectURL) {
    (URL as unknown as Record<string, unknown>).createObjectURL = jest.fn(
      () => "blob:mock"
    );
    (URL as unknown as Record<string, unknown>).revokeObjectURL = jest.fn();
  } else {
    (URL.createObjectURL as jest.Mock).mockReturnValue("blob:mock");
  }
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Photo step ───────────────────────────────────────────────────────────────

describe("Report page — photo step", () => {
  it("initial render shows Take Photo label", () => {
    render(<ReportPage />);
    expect(screen.getByText(/Take Photo/i)).toBeInTheDocument();
  });

  it("initial render shows Upload from Gallery", () => {
    render(<ReportPage />);
    expect(screen.getByText(/Upload from Gallery/i)).toBeInTheDocument();
  });

  it("camera input has capture=environment for iOS", () => {
    render(<ReportPage />);
    const cameraInput = document.querySelector('input[capture="environment"]');
    expect(cameraInput).not.toBeNull();
  });

  it("gallery input has no capture attribute", () => {
    render(<ReportPage />);
    const inputs = document.querySelectorAll('input[type="file"]');
    const gallery = Array.from(inputs).find((i) => !i.hasAttribute("capture"));
    expect(gallery).toBeDefined();
  });

  it("honeypot input is present in DOM on photo step", () => {
    render(<ReportPage />);
    const honeypot = document.querySelector('input[data-hp="1"]');
    expect(honeypot).not.toBeNull();
  });

  it("honeypot is type=hidden so browser autofill never fills it", () => {
    render(<ReportPage />);
    const honeypot = document.querySelector(
      'input[data-hp="1"]'
    ) as HTMLInputElement;
    expect(honeypot.type).toBe("hidden");
  });

  it("shows 'Step 1 · Photo' section label", () => {
    render(<ReportPage />);
    expect(screen.getByText(/Step 1 · Photo/i)).toBeInTheDocument();
  });

  it("does not show 'Step 1 of 4' (old 4-step wizard removed)", () => {
    render(<ReportPage />);
    expect(screen.queryByText(/Step 1 of 4/i)).toBeNull();
  });
});

// ─── Category step ────────────────────────────────────────────────────────────

describe("Report page — category step", () => {
  it("after photo upload, advances to category step", async () => {
    render(<ReportPage />);
    await uploadPhoto();
    await waitFor(() =>
      expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument()
    );
  });

  it("shows 6 category chips after photo upload", async () => {
    render(<ReportPage />);
    await uploadPhoto();
    await waitFor(() =>
      expect(screen.getAllByRole("radio")).toHaveLength(6)
    );
  });

  it("Continue button is disabled until category selected", async () => {
    render(<ReportPage />);
    await uploadPhoto();
    await waitFor(() => expect(screen.getByText(/Continue/i)).toBeInTheDocument());
    const continueBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Continue"));
    expect(continueBtn).toBeDisabled();
  });

  it("selecting a category enables Continue", async () => {
    render(<ReportPage />);
    await uploadPhoto();
    await waitFor(() => expect(screen.getByText("Damaged")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Damaged"));
    const continueBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Continue"));
    expect(continueBtn).not.toBeDisabled();
  });

  it("honeypot is present on category step", async () => {
    render(<ReportPage />);
    await uploadPhoto();
    await waitFor(() => expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument());
    const honeypot = document.querySelector('input[data-hp="1"]');
    expect(honeypot).not.toBeNull();
  });

  it("back button on category step resets to photo step", async () => {
    render(<ReportPage />);
    await uploadPhoto();
    await waitFor(() => expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument());
    const backBtn = screen.getByRole("button", { name: /Back/i });
    fireEvent.click(backBtn);
    await waitFor(() =>
      expect(screen.getByText(/Take Photo/i)).toBeInTheDocument()
    );
  });
});

// ─── Confirm step ─────────────────────────────────────────────────────────────

describe("Report page — confirm step", () => {
  it("clicking Continue advances to Step 2 of 2", async () => {
    render(<ReportPage />);
    await goToConfirm();
    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();
  });

  it("confirm step header shows 'Confirm & submit'", async () => {
    render(<ReportPage />);
    await goToConfirm();
    expect(screen.getAllByText(/Confirm/i).length).toBeGreaterThan(0);
  });

  it("severity grid shows low/medium/high options", async () => {
    render(<ReportPage />);
    await goToConfirm();
    expect(screen.getByText("Minor")).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("note textarea is present", async () => {
    render(<ReportPage />);
    await goToConfirm();
    expect(
      screen.getByPlaceholderText(/Add context for the reviewer/i)
    ).toBeInTheDocument();
  });

  it("honeypot is present on confirm step", async () => {
    render(<ReportPage />);
    await goToConfirm();
    const honeypot = document.querySelector('input[data-hp="1"]');
    expect(honeypot).not.toBeNull();
  });

  it("back button on confirm step returns to category step", async () => {
    render(<ReportPage />);
    await goToConfirm();
    const backBtn = screen.getByRole("button", { name: /Back/i });
    fireEvent.click(backBtn);
    await waitFor(() =>
      expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument()
    );
  });
});

// ─── Submit ───────────────────────────────────────────────────────────────────

describe("Report page — submit", () => {
  it("submit button sends FormData to /api/reports", async () => {
    render(<ReportPage />);
    await goToConfirm();
    const submitBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Submit report"));
    fireEvent.click(submitBtn!);
    // Ward lookup fires on confirm mount; wait for the submit call specifically.
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls.some(([url]: [string]) => url.includes("/api/reports"))).toBe(true);
    });
    const submitCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url]: [string]) => url.includes("/api/reports")
    )!;
    expect(submitCall[0]).toContain("/api/reports");
  });

  it("submit sends FormData with required fields including honeypot", async () => {
    render(<ReportPage />);
    await goToConfirm();
    const submitBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Submit report"));
    fireEvent.click(submitBtn!);
    // Ward lookup fires on confirm mount; find the submit call by URL.
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls.some(([url]: [string]) => url.includes("/api/reports"))).toBe(true);
    });
    const submitCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url]: [string]) => url.includes("/api/reports")
    )!;
    const body = submitCall[1].body as FormData;
    expect(body.has("website")).toBe(true);
    expect(body.has("photo")).toBe(true);
    expect(body.has("category")).toBe(true);
    expect(body.has("severity")).toBe(true);
    expect(body.has("location_source")).toBe(true);
    expect(body.has("lat")).toBe(true);
    expect(body.has("lng")).toBe(true);
  });

  it("successful submit shows SuccessCard with report ID", async () => {
    render(<ReportPage />);
    await goToConfirm();
    const submitBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Submit report"));
    fireEvent.click(submitBtn!);
    await waitFor(() =>
      expect(screen.getByText(/Thank you/i)).toBeInTheDocument()
    );
    expect(screen.getByText("test-report-123")).toBeInTheDocument();
  });

  it("clicking Report another on SuccessCard resets to photo step", async () => {
    render(<ReportPage />);
    await goToConfirm();
    const submitBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Submit report"));
    fireEvent.click(submitBtn!);
    await waitFor(() =>
      expect(screen.getByText(/Thank you/i)).toBeInTheDocument()
    );
    const reportAnotherBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Report another"));
    fireEvent.click(reportAnotherBtn!);
    await waitFor(() =>
      expect(screen.getByText(/Take Photo/i)).toBeInTheDocument()
    );
  });

  it("server error shows error message", async () => {
    // Confirm mount fires ward lookup + Nominatim concurrently, then submit.
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // ward lookup
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // nominatim
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Upload failed" }),
      }); // submit
    render(<ReportPage />);
    await goToConfirm();
    const submitBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Submit report"));
    fireEvent.click(submitBtn!);
    await waitFor(() =>
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument()
    );
  });
});

// ─── Regression guards — 4-step wizard removed ────────────────────────────────

describe("Regression guards — 4-step wizard removed", () => {
  it("no longer shows 'Step 1 of 4'", () => {
    render(<ReportPage />);
    expect(screen.queryByText(/Step 1 of 4/i)).toBeNull();
  });

  it("no longer shows 'Step 3 of 4'", () => {
    render(<ReportPage />);
    expect(screen.queryByText(/Step 3 of 4/i)).toBeNull();
  });

  it("no longer imports old PhotoCapture (Step component not visible)", () => {
    render(<ReportPage />);
    // PhotoCapture rendered a camera icon button directly; new flow uses label-wrapped input
    // If PhotoCapture were imported, its 'Take Photo' button would be a <button>, not a <label>
    const cameraInput = document.querySelector('input[capture="environment"]');
    expect(cameraInput?.parentElement?.tagName).toBe("LABEL");
  });
});

// ─── Contact accordion ─────────────────────────────────────────────────────────

describe("Report page — contact accordion", () => {
  it("contact row is collapsed by default (no name input visible)", async () => {
    render(<ReportPage />);
    await goToConfirm();
    expect(screen.queryByLabelText(/Name \(optional\)/i)).toBeNull();
  });

  it("clicking contact row expands it and shows Name input", async () => {
    render(<ReportPage />);
    await goToConfirm();
    const contactRow = screen.getByRole("button", {
      name: /Add contact for follow-up/i,
    });
    fireEvent.click(contactRow);
    await waitFor(() =>
      expect(screen.getByLabelText(/Name \(optional\)/i)).toBeInTheDocument()
    );
  });

  it("clicking contact row again collapses it", async () => {
    render(<ReportPage />);
    await goToConfirm();
    const contactRow = screen.getByRole("button", {
      name: /Add contact for follow-up/i,
    });
    fireEvent.click(contactRow);
    await waitFor(() =>
      expect(screen.getByLabelText(/Name \(optional\)/i)).toBeInTheDocument()
    );
    fireEvent.click(contactRow);
    await waitFor(() =>
      expect(screen.queryByLabelText(/Name \(optional\)/i)).toBeNull()
    );
  });
});

// ─── Category label in review card ────────────────────────────────────────────

describe("Report page — category label in confirm review card", () => {
  it("confirm review card shows human-readable label not raw enum", async () => {
    render(<ReportPage />);
    await goToConfirm();
    // goToConfirm selects "Damaged" which maps to broken_footpath enum
    // The review card should show "Damaged Footpath" (getCategoryLabel result), not "broken_footpath"
    expect(screen.queryByText("broken_footpath")).toBeNull();
    // The human label from getCategoryLabel("broken_footpath").en is "Damaged Footpath"
    expect(screen.getByText("Damaged Footpath")).toBeInTheDocument();
  });
});

// ─── Photo-store mount effect ──────────────────────────────────────────────────

describe("Report page — photo-store mount effect", () => {
  it("with no pending photo, starts at photo step", () => {
    // consumePendingPhoto mock returns null by default
    render(<ReportPage />);
    expect(screen.getByText(/Take Photo/i)).toBeInTheDocument();
  });

  it("with pending photo in store, mounts directly at category step", async () => {
    const { consumePendingPhoto } = require("@/app/lib/photo-store");
    const mockFile = new File([new Uint8Array(100)], "photo.jpg", { type: "image/jpeg" });
    (consumePendingPhoto as jest.Mock).mockReturnValueOnce({
      file: mockFile,
      previewUrl: "blob:mock-pending",
      lat: 12.9716,
      lng: 77.5946,
      locationSource: "exif",
      gpsConfirmed: true,
    });
    render(<ReportPage />);
    await waitFor(() =>
      expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument()
    );
  });
});
