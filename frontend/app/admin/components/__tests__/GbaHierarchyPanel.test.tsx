/**
 * Tests for frontend/app/admin/components/GbaHierarchyPanel.tsx
 *
 * Requirements covered:
 *   D-23  — Bureaucratic chain (Ward → ARO Sub Division → RO Division → Zone → Corporation → GBA)
 *   D-42  — Elected chain: AC number + name + MLA + Parliamentary + MP
 *   D-43  — MLA name from wards.mla_name
 *   D-44  — MP name from wards.mp_name
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { GbaHierarchyPanel } from "../GbaHierarchyPanel";
import type { WardHierarchy } from "../../lib/adminApi";

function makeHierarchy(overrides: Partial<WardHierarchy> = {}): WardHierarchy {
  return {
    ward_name: "Shivajinagar",
    ward_number: 117,
    corporation: "West",
    zone_name: "West Zone",
    ro_division: "West Division",
    aro_sub_division: "Shivajinagar Sub Division",
    assembly_constituency: "Shivajinagar",
    assembly_constituency_no: 155,
    parliamentary_constituency: "Bangalore Central",
    mla_name: "Rizwan Arshad",
    mp_name: "P.C. Mohan",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// D-23 — Nothing-state when hierarchy is null
// ---------------------------------------------------------------------------

describe("D-23 — GbaHierarchyPanel: nothing-state when hierarchy is null", () => {
  it('renders "Ward assignment not available for this report." when hierarchy is null', () => {
    render(<GbaHierarchyPanel hierarchy={null} />);
    expect(
      screen.getByText("Ward assignment not available for this report.")
    ).toBeInTheDocument();
  });

  it('renders nothing-state when hierarchy.ward_name is null', () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy({ ward_name: null })} />);
    expect(
      screen.getByText("Ward assignment not available for this report.")
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// D-23 — Bureaucratic chain rendered when hierarchy is present
// ---------------------------------------------------------------------------

describe("D-23 — GbaHierarchyPanel: bureaucratic chain rows rendered", () => {
  it("renders all 6 bureaucratic chain rows when hierarchy is populated", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy()} />);

    // Ward row value
    expect(screen.getByText(/117 · Shivajinagar/)).toBeInTheDocument();

    // ARO Sub Division row
    expect(screen.getByText("Shivajinagar Sub Division")).toBeInTheDocument();

    // RO Division row
    expect(screen.getByText("West Division")).toBeInTheDocument();

    // Zone row
    expect(screen.getByText("West Zone")).toBeInTheDocument();

    // Corporation row
    expect(screen.getByText(/West Corporation, GBA/)).toBeInTheDocument();

    // GBA row
    expect(screen.getByText("Greater Bengaluru Authority")).toBeInTheDocument();
  });

  it("renders bureaucratic chain label/title pairs", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy()} />);

    expect(screen.getByText("Ward Engineer")).toBeInTheDocument();
    expect(screen.getByText("Asst. Revenue Officer")).toBeInTheDocument();
    expect(screen.getByText("Revenue Officer")).toBeInTheDocument();
    expect(screen.getByText("Zonal Commissioner")).toBeInTheDocument();
    expect(screen.getByText("Chief Commissioner, GBA")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// D-42, D-43 — Elected chain: MLA + MP names
// ---------------------------------------------------------------------------

describe("D-42 / D-43 — GbaHierarchyPanel: elected chain MLA + MP names", () => {
  it("renders MLA name and assembly constituency when present", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy()} />);

    expect(screen.getByText(/155 – Shivajinagar/)).toBeInTheDocument();
    expect(screen.getByText("Rizwan Arshad")).toBeInTheDocument();
  });

  it("renders MP name and parliamentary constituency when present", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy()} />);

    expect(screen.getByText("Bangalore Central")).toBeInTheDocument();
    expect(screen.getByText("P.C. Mohan")).toBeInTheDocument();
  });

  it('renders "—" placeholder when mla_name is null', () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy({ mla_name: null })} />);

    // MLA row should show "—" as the value
    const mlaLabel = screen.getByText(/MLA:/);
    expect(mlaLabel).toBeInTheDocument();
    // The sibling/child "—" placeholder should be present
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it('renders "—" placeholder when mp_name is null', () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy({ mp_name: null })} />);

    const mpLabel = screen.getByText(/MP:/);
    expect(mpLabel).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders the constituency disclaimer footnote", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy()} />);
    expect(
      screen.getByText("Constituency boundaries may differ from ward boundaries.")
    ).toBeInTheDocument();
  });
});
