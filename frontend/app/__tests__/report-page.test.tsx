/**
 * Tests for frontend/app/report/page.tsx — 4-step wizard
 *
 * Requirements covered:
 *   R1 / AC1.2 — Photo chosen → auto-advance to step 1 (Location)
 *   R1 / AC1.3 — Photo with EXIF GPS → step 1 shows green badge
 *   R1 / AC1.4 — Photo without EXIF GPS → step 1 shows amber "drop the pin" badge
 *   R2 / AC2.2 — Pin outside Bengaluru bbox → Next disabled + inline error
 *   R2 / AC2.3 — EXIF GPS detected then user drags pin → locationSource = manual_pin, badge cleared
 *   R2 / AC2.4 — EXIF GPS detected, user doesn't adjust → locationSource = exif in submitted form
 *   R3 / AC3.1 — No category → Next disabled; category selected → Next enabled
 *   R3 / AC3.2 — (Styling tested in CategoryPicker.test; here we test wizard step advance)
 *   R4 / AC4.1 — Description counter shows n/500; input blocked at 500
 *   R4 / AC4.2 — Severity defaults to "medium"; hint text shown per selection
 *   R4 / AC4.3 — Submit button disabled while submitting (spinner shown)
 *   R4 / AC4.4 — On success → SubmitSuccess replaces wizard
 *   R4 / AC4.5 — On server error → red error message; button re-enables
 *
 * Mocking strategy:
 *   - PhotoCapture is mocked so we can call onPhoto programmatically.
 *   - CategoryPicker is mocked so we can call onChange programmatically.
 *   - LocationMap (loaded via next/dynamic) is mocked via __mocks__/nextDynamic.js,
 *     which renders the loading fallback ("Loading map…").
 *     The LocationMap onChange is also exposed via a test helper data attribute.
 *   - next/link renders an <a> tag.
 *   - fetch is mocked via jest.spyOn(global, "fetch").
 *   - exifr is not imported directly by page.tsx — it is used inside PhotoCapture,
 *     which is fully mocked here.
 */

import React from "react";
import {
  render,
  screen,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportPage from "../report/page";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// next/link
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

// PhotoCapture — expose onPhoto via a test button so tests can trigger it
jest.mock("../components/PhotoCapture", () => {
  const MockPhotoCapture = ({
    onPhoto,
  }: {
    onPhoto: (file: File, gps: { latitude: number; longitude: number } | null) => void;
  }) => (
    <div data-testid="photo-capture">
      <button
        data-testid="mock-photo-with-gps"
        onClick={() =>
          onPhoto(
            new File(["img"], "photo.jpg", { type: "image/jpeg" }),
            { latitude: 12.9716, longitude: 77.5946 }
          )
        }
      >
        Simulate Photo With GPS
      </button>
      <button
        data-testid="mock-photo-no-gps"
        onClick={() =>
          onPhoto(new File(["img"], "photo.jpg", { type: "image/jpeg" }), null)
        }
      >
        Simulate Photo No GPS
      </button>
    </div>
  );
  MockPhotoCapture.displayName = "MockPhotoCapture";
  return MockPhotoCapture;
});

// CategoryPicker — expose onChange via a test button
jest.mock("../components/CategoryPicker", () => {
  const MockCategoryPicker = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div data-testid="category-picker" data-value={value}>
      <button
        data-testid="mock-select-no-footpath"
        onClick={() => onChange("no_footpath")}
      >
        Select no_footpath
      </button>
    </div>
  );
  MockCategoryPicker.displayName = "MockCategoryPicker";
  return MockCategoryPicker;
});

// SubmitSuccess — minimal mock so we can detect when it renders
jest.mock("../components/SubmitSuccess", () => {
  const MockSubmitSuccess = ({ onReset }: { onReset: () => void }) => (
    <div data-testid="submit-success">
      <p>Report received</p>
      <button data-testid="mock-reset" onClick={onReset}>
        Submit another report
      </button>
    </div>
  );
  MockSubmitSuccess.displayName = "MockSubmitSuccess";
  return MockSubmitSuccess;
});

// LocationMap — next/dynamic renders loading fallback in tests (see __mocks__/nextDynamic.js).
// To test the onChange callback we need to expose it. We intercept the dynamic import
// by mocking the module path directly.
jest.mock("../components/LocationMap", () => {
  const MockLocationMap = ({
    onChange,
  }: {
    lat: number;
    lng: number;
    onChange: (lat: number, lng: number) => void;
  }) => (
    <div data-testid="location-map">
      {/* Simulate pin drop inside Bengaluru */}
      <button
        data-testid="mock-pin-inside"
        onClick={() => onChange(12.9716, 77.5946)}
      >
        Pin Inside Bengaluru
      </button>
      {/* Simulate pin drop outside Bengaluru */}
      <button
        data-testid="mock-pin-outside"
        onClick={() => onChange(0, 0)}
      >
        Pin Outside Bengaluru
      </button>
    </div>
  );
  MockLocationMap.displayName = "MockLocationMap";
  return MockLocationMap;
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Advance through step 0 (Photo) by simulating a photo with GPS. */
async function completeStep0WithGps() {
  await act(async () => {
    await userEvent.click(screen.getByTestId("mock-photo-with-gps"));
  });
}

/** Advance through step 0 (Photo) by simulating a photo without GPS. */
async function completeStep0NoGps() {
  await act(async () => {
    await userEvent.click(screen.getByTestId("mock-photo-no-gps"));
  });
}

/** Advance from step 1 (Location) to step 2 (Category). */
async function advanceFromStep1() {
  await act(async () => {
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
  });
}

/** Select a category in step 2 and advance to step 3. */
async function completeStep2() {
  await act(async () => {
    await userEvent.click(screen.getByTestId("mock-select-no-footpath"));
  });
  await act(async () => {
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
  });
}

/** Navigate the wizard to step 3 (Details). */
async function navigateToStep3() {
  await completeStep0WithGps();     // step 0 → 1 (auto-advance)
  await advanceFromStep1();         // step 1 → 2
  await completeStep2();            // step 2 → 3
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicators
// ─────────────────────────────────────────────────────────────────────────────
describe("Wizard structure", () => {
  it("starts at step 1 of 4 (Photo)", () => {
    render(<ReportPage />);
    expect(screen.getByText(/step 1 of 4: photo/i)).toBeInTheDocument();
  });

  it("shows a Back button from step 2 onward", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("pressing Back from step 2 returns to step 1", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /back/i }));
    });
    expect(screen.getByText(/step 1 of 4: photo/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R1 / AC1.2 — Photo chosen → auto-advances to step 2 (Location)
// ─────────────────────────────────────────────────────────────────────────────
describe("R1 / AC1.2 — Photo selection auto-advances to Location step", () => {
  it("advances to Step 2 (Location) immediately after a photo with GPS is chosen", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();
    expect(screen.getByText(/step 2 of 4: location/i)).toBeInTheDocument();
  });

  it("advances to Step 2 (Location) immediately after a photo without GPS is chosen", async () => {
    render(<ReportPage />);
    await completeStep0NoGps();
    expect(screen.getByText(/step 2 of 4: location/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R1 / AC1.3 — Photo with GPS EXIF → green badge in step 1
// ─────────────────────────────────────────────────────────────────────────────
describe("R1 / AC1.3 — GPS from EXIF shows green 'Location found' badge", () => {
  it("shows the green 'Location found from photo' badge when GPS is present — AC1.3", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();
    expect(screen.getByText(/location found from photo/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R1 / AC1.4 — Photo without GPS EXIF → amber badge in step 1
// ─────────────────────────────────────────────────────────────────────────────
describe("R1 / AC1.4 — No GPS EXIF shows amber 'drop the pin' badge", () => {
  it("shows amber badge when photo has no GPS — AC1.4", async () => {
    render(<ReportPage />);
    await completeStep0NoGps();
    expect(
      screen.getByText(/couldn't read location from photo/i)
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R2 / AC2.2 — Pin outside Bengaluru bbox → Next disabled + inline error
// ─────────────────────────────────────────────────────────────────────────────
describe("R2 / AC2.2 — Out-of-bounds pin disables Next and shows error", () => {
  it("Next button is enabled when location is inside Bengaluru — AC2.2 (baseline)", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();
    // The GPS coordinates from the mock (12.9716, 77.5946) are inside Bengaluru
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it("Next button is disabled after pin is moved outside Bengaluru — AC2.2", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();

    // Drag pin outside Bengaluru
    await act(async () => {
      await userEvent.click(screen.getByTestId("mock-pin-outside"));
    });

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it("inline error 'Please drop the pin within Bengaluru' appears when pin is outside — AC2.2", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();

    await act(async () => {
      await userEvent.click(screen.getByTestId("mock-pin-outside"));
    });

    expect(
      screen.getByText(/please drop the pin within bengaluru/i)
    ).toBeInTheDocument();
  });

  it("error clears and Next re-enables when pin is moved back inside — AC2.2", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();

    // Move outside
    await act(async () => {
      await userEvent.click(screen.getByTestId("mock-pin-outside"));
    });
    expect(screen.getByText(/please drop the pin within bengaluru/i)).toBeInTheDocument();

    // Move back inside
    await act(async () => {
      await userEvent.click(screen.getByTestId("mock-pin-inside"));
    });

    expect(
      screen.queryByText(/please drop the pin within bengaluru/i)
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R2 / AC2.3 — EXIF GPS detected; user drags pin → green badge clears
// ─────────────────────────────────────────────────────────────────────────────
describe("R2 / AC2.3 — Dragging pin after GPS auto-detect clears the green badge", () => {
  it("green badge disappears after user adjusts the pin — AC2.3", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();

    // Confirm the green badge is present
    expect(screen.getByText(/location found from photo/i)).toBeInTheDocument();

    // User drags the pin (inside Bengaluru)
    await act(async () => {
      await userEvent.click(screen.getByTestId("mock-pin-inside"));
    });

    // Green badge should be replaced by the amber "drop the pin" badge
    expect(
      screen.queryByText(/location found from photo/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/couldn't read location from photo/i)
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R2 / AC2.4 — EXIF GPS detected, user does NOT adjust → locationSource = "exif"
// The submit payload is tested by verifying FormData contains location_source=exif
// ─────────────────────────────────────────────────────────────────────────────
describe("R2 / AC2.4 — locationSource = exif when GPS auto-detected and pin not moved", () => {
  it("submits location_source=exif when user did not drag the pin — AC2.4", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "new-report-id" }),
    } as Response);

    render(<ReportPage />);
    await navigateToStep3();

    // Submit without moving the pin (GPS came from EXIF)
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = (options as RequestInit).body as FormData;
    expect(body.get("location_source")).toBe("exif");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R3 / AC3.1 — No category → Next disabled; category selected → Next enabled
// ─────────────────────────────────────────────────────────────────────────────
describe("R3 / AC3.1 — Category step gate", () => {
  it("Next button is disabled before a category is selected — AC3.1", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();
    await advanceFromStep1();

    // Step 2 — no category selected yet
    expect(screen.getByText(/step 3 of 4: category/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("Next button enables once a category is selected — AC3.1", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();
    await advanceFromStep1();

    await act(async () => {
      await userEvent.click(screen.getByTestId("mock-select-no-footpath"));
    });

    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R4 / AC4.1 — Description counter shows n/500; blocked at 500
// ─────────────────────────────────────────────────────────────────────────────
describe("R4 / AC4.1 — Description character counter", () => {
  it("shows '0/500' counter before any input is typed — AC4.1", async () => {
    render(<ReportPage />);
    await navigateToStep3();
    expect(screen.getByText("0/500")).toBeInTheDocument();
  });

  it("counter updates as the user types — AC4.1", async () => {
    render(<ReportPage />);
    await navigateToStep3();

    const textarea = screen.getByPlaceholderText(/describe the issue/i);
    await act(async () => {
      await userEvent.type(textarea, "Hello");
    });

    expect(screen.getByText("5/500")).toBeInTheDocument();
  });

  it("textarea has maxLength=500 — AC4.1 (browser enforcement)", async () => {
    render(<ReportPage />);
    await navigateToStep3();

    const textarea = screen.getByPlaceholderText(/describe the issue/i);
    expect(textarea).toHaveAttribute("maxLength", "500");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R4 / AC4.2 — Severity defaults to "medium"; hint text shown per selection
// ─────────────────────────────────────────────────────────────────────────────
describe("R4 / AC4.2 — Severity selection and hint text", () => {
  it("severity defaults to 'medium' — AC4.2", async () => {
    render(<ReportPage />);
    await navigateToStep3();

    // The hint for "medium" must be visible by default
    expect(
      screen.getByText("Difficult or risky for some pedestrians")
    ).toBeInTheDocument();
  });

  it("shows correct hint text for each severity level — AC4.2", async () => {
    render(<ReportPage />);
    await navigateToStep3();

    const hintMap: Record<string, string> = {
      low: "Inconvenient but passable",
      medium: "Difficult or risky for some pedestrians",
      high: "Immediate danger — open pit, no path, safety risk",
    };

    for (const [severity, hint] of Object.entries(hintMap)) {
      await act(async () => {
        await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${severity}$`, "i") }));
      });
      expect(screen.getByText(hint)).toBeInTheDocument();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R4 / AC4.3 — Submit button disabled while submitting; spinner shown
// ─────────────────────────────────────────────────────────────────────────────
describe("R4 / AC4.3 — Submit button disabled while submitting", () => {
  it("submit button shows 'Submitting…' and is disabled during in-flight fetch — AC4.3", async () => {
    // fetch never resolves — simulates slow network
    jest.spyOn(global, "fetch").mockReturnValueOnce(new Promise(() => {}));

    render(<ReportPage />);
    await navigateToStep3();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    expect(screen.getByText(/submitting/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R4 / AC4.4 — On success → SubmitSuccess replaces wizard
// ─────────────────────────────────────────────────────────────────────────────
describe("R4 / AC4.4 — Successful submit shows SubmitSuccess component", () => {
  it("replaces the wizard with SubmitSuccess after a successful submit — AC4.4", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "report-uuid-002" }),
    } as Response);

    render(<ReportPage />);
    await navigateToStep3();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("submit-success")).toBeInTheDocument();
    });
  });

  it("the wizard header is no longer shown after success — AC4.4", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "report-uuid-003" }),
    } as Response);

    render(<ReportPage />);
    await navigateToStep3();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/report an issue/i)).not.toBeInTheDocument();
    });
  });

  it("clicking 'Submit another report' in SubmitSuccess resets to step 1 — AC4.4", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "report-uuid-004" }),
    } as Response);

    render(<ReportPage />);
    await navigateToStep3();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("submit-success")).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId("mock-reset"));
    });

    // Back at step 1
    expect(screen.getByText(/step 1 of 4: photo/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R4 / AC4.5 — On error → red message; button re-enables
// ─────────────────────────────────────────────────────────────────────────────
describe("R4 / AC4.5 — Submit error shows message and re-enables button", () => {
  it("shows a red error message when the server returns an error — AC4.5", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Please drop the pin within Bengaluru" }),
    } as Response);

    render(<ReportPage />);
    await navigateToStep3();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Please drop the pin within Bengaluru")
      ).toBeInTheDocument();
    });
  });

  it("shows generic error message when fetch throws (network failure) — AC4.5", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(<ReportPage />);
    await navigateToStep3();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't submit — check your connection and try again.")
      ).toBeInTheDocument();
    });
  });

  it("submit button is re-enabled after a submit error — AC4.5", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(<ReportPage />);
    await navigateToStep3();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't submit — check your connection and try again.")
      ).toBeInTheDocument();
    });

    // The submit button should be re-enabled so the user can retry
    expect(
      screen.getByRole("button", { name: /submit report/i })
    ).not.toBeDisabled();
  });

  it("SubmitSuccess is NOT shown after a submit error — AC4.5", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(<ReportPage />);
    await navigateToStep3();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't submit — check your connection and try again.")
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId("submit-success")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Track E — Step 1 back-to-home link
//
// On step 0 (wizard "Step 1 of 4: Photo") the intra-wizard Back button does not
// exist because there is no previous step.  Instead, the empty placeholder
// `<div className="w-9" />` must be replaced with a <Link href="/"> so the user
// can navigate back to the home page.  Steps 2–4 (step > 0) keep their existing
// intra-wizard Back button; the home link must NOT appear there.
// ─────────────────────────────────────────────────────────────────────────────
describe("Step 1 back to home link", () => {
  it("back-to-home link is present on wizard step 1 (Photo) — Track E", () => {
    render(<ReportPage />);

    // The wizard opens at step 0 ("Step 1 of 4: Photo").
    // A <Link href="/"> with aria-label="Back to home" must be rendered in the
    // header slot that currently holds an empty <div className="w-9" />.
    const link = screen.getByRole("link", { name: /back to home/i });

    expect(link).toBeInTheDocument();
    // The link must navigate to the home page, not a relative sub-path.
    expect(link).toHaveAttribute("href", "/");
  });

  it("back-to-home link is NOT present on wizard step 2 (Location) — Track E", async () => {
    render(<ReportPage />);

    // Advancing past step 0 (Photo) must replace the home link with the
    // intra-wizard Back button; the home link must disappear.
    await completeStep0WithGps(); // step 0 → step 1 (Location), auto-advance

    expect(screen.getByText(/step 2 of 4: location/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /back to home/i })
    ).not.toBeInTheDocument();
  });

  it("back-to-home link is NOT present on wizard step 3 (Category) — Track E", async () => {
    render(<ReportPage />);

    // Advance to step 2 (Category) — three moves from the start.
    await completeStep0WithGps();  // step 0 → step 1 (Location)
    await advanceFromStep1();      // step 1 → step 2 (Category)

    expect(screen.getByText(/step 3 of 4: category/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /back to home/i })
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FormData payload verification
// ─────────────────────────────────────────────────────────────────────────────
describe("Submit FormData payload", () => {
  it("sends photo, lat, lng, category, severity, and location_source in the POST body", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "payload-test-id" }),
    } as Response);

    render(<ReportPage />);
    await navigateToStep3();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/reports$/);

    const body = (options as RequestInit).body as FormData;
    expect(body.get("photo")).toBeInstanceOf(File);
    expect(body.get("lat")).not.toBeNull();
    expect(body.get("lng")).not.toBeNull();
    expect(body.get("category")).toBe("no_footpath");
    expect(body.get("severity")).toBe("medium"); // default
    expect(body.get("location_source")).toBe("exif"); // came from GPS mock
  });

  it("severity reflects the selected value in the submitted payload — AC4.2", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "severity-test-id" }),
    } as Response);

    render(<ReportPage />);
    await navigateToStep3();

    // Change severity to "high"
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /^high$/i }));
    });

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = (options as RequestInit).body as FormData;
    expect(body.get("severity")).toBe("high");
  });

  it("description is included in the payload when the user enters text — AC4.1", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "desc-test-id" }),
    } as Response);

    render(<ReportPage />);
    await navigateToStep3();

    const textarea = screen.getByPlaceholderText(/describe the issue/i);
    await act(async () => {
      await userEvent.type(textarea, "Big pothole on main road");
    });

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit report/i }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = (options as RequestInit).body as FormData;
    expect(body.get("description")).toBe("Big pothole on main road");
  });
});
