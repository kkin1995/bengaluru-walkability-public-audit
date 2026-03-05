/**
 * Tests for frontend/app/components/ReviewStrip.tsx
 *
 * P2-B: Compact review strip shown on steps 1-3 showing:
 *   - 32x32 photo thumbnail when photo exists
 *   - Location label or lat/lng coordinates
 *   - Category label when category is set
 * Reverse geocode via Nominatim (fallback to coordinates on failure).
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import ReviewStrip from "../ReviewStrip";

const mockPhoto = new File(["img"], "photo.jpg", { type: "image/jpeg" });

// ─────────────────────────────────────────────────────────────────────────────
// Photo thumbnail
// ─────────────────────────────────────────────────────────────────────────────
describe("photo thumbnail", () => {
  it("shows a thumbnail img when photo is provided", () => {
    render(<ReviewStrip photo={mockPhoto} lat={12.9716} lng={77.5946} category="" />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "blob:mock-url");
  });

  it("does not show thumbnail when photo is null", () => {
    render(<ReviewStrip photo={null} lat={12.9716} lng={77.5946} category="" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Location display
// ─────────────────────────────────────────────────────────────────────────────
describe("location display", () => {
  it("shows locationLabel prop when provided (skips geocode)", () => {
    render(
      <ReviewStrip
        photo={null}
        lat={12.9716}
        lng={77.5946}
        locationLabel="Koramangala"
        category=""
      />
    );
    expect(screen.getByText("Koramangala")).toBeInTheDocument();
  });

  it("shows lat/lng coordinates while geocode is pending", () => {
    jest.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));
    render(<ReviewStrip photo={null} lat={12.9716} lng={77.5946} category="" />);
    expect(screen.getByText("12.972, 77.595")).toBeInTheDocument();
  });

  it("shows geocoded suburb name when fetch succeeds", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      json: async () => ({
        address: { suburb: "Koramangala" },
        display_name: "Koramangala, Bengaluru, Karnataka",
      }),
    } as Response);

    await act(async () => {
      render(<ReviewStrip photo={null} lat={12.9716} lng={77.5946} category="" />);
    });

    await waitFor(() => {
      expect(screen.getByText("Koramangala")).toBeInTheDocument();
    });
  });

  it("falls back to coordinates when fetch fails", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    await act(async () => {
      render(<ReviewStrip photo={null} lat={12.9716} lng={77.5946} category="" />);
    });

    // Should still show coordinates (geocode failed silently)
    await waitFor(() => {
      expect(screen.getByText("12.972, 77.595")).toBeInTheDocument();
    });
  });

  it("uses display_name fallback when address.suburb is absent", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      json: async () => ({
        address: {},
        display_name: "MG Road, Bengaluru, Karnataka",
      }),
    } as Response);

    await act(async () => {
      render(<ReviewStrip photo={null} lat={12.9716} lng={77.5946} category="" />);
    });

    await waitFor(() => {
      expect(screen.getByText("MG Road")).toBeInTheDocument();
    });
  });

  it("fires fetch with the correct Nominatim URL", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      json: async () => ({ address: { suburb: "Indiranagar" }, display_name: "Indiranagar" }),
    } as Response);

    await act(async () => {
      render(<ReviewStrip photo={null} lat={12.9716} lng={77.5946} category="" />);
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("nominatim.openstreetmap.org/reverse");
    expect(url).toContain("lat=12.9716");
    expect(url).toContain("lon=77.5946");
    expect(url).toContain("format=json");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Category display
// ─────────────────────────────────────────────────────────────────────────────
describe("category display", () => {
  it("shows the English category label when category is set", () => {
    render(
      <ReviewStrip photo={null} lat={12.9716} lng={77.5946} category="no_footpath" />
    );
    expect(screen.getByText("No Footpath")).toBeInTheDocument();
  });

  it("shows Kannada category label when category is set", () => {
    render(
      <ReviewStrip photo={null} lat={12.9716} lng={77.5946} category="no_footpath" />
    );
    expect(screen.getByText("ಕಾಲ್ದಾರಿ ಇಲ್ಲ")).toBeInTheDocument();
  });

  it("does not show a category label when category is empty", () => {
    render(<ReviewStrip photo={null} lat={12.9716} lng={77.5946} category="" />);
    expect(screen.queryByText("No Footpath")).not.toBeInTheDocument();
  });
});
