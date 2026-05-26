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
    // Corporation row title — distinct from GBA row title "Chief Commissioner, GBA"
    expect(screen.getByText("Chief Commissioner")).toBeInTheDocument();
    expect(screen.getByText("Chief Commissioner, GBA")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// D-42, D-43 — Elected chain: MLA + MP names
// ---------------------------------------------------------------------------

describe("D-42 / D-43 — GbaHierarchyPanel: elected chain MLA + MP names", () => {
  it("renders MLA name and assembly constituency when present", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy()} />);

    expect(screen.getByText("155")).toBeInTheDocument();
    expect(screen.getAllByText("Shivajinagar").length).toBeGreaterThanOrEqual(1);
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

// ---------------------------------------------------------------------------
// Phase 3.1 / ISSUE-01 — wardDisplay null and string-undefined guard
// ---------------------------------------------------------------------------

describe("Phase 3.1 / ISSUE-01 — wardDisplay: null and string-undefined guard", () => {
  it("renders only ward_name without 'undefined' prefix when ward_number is null", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy({ ward_number: null })} />);
    // Must NOT contain "undefined"
    expect(screen.queryByText(/undefined/)).toBeNull();
    // Must render ward name — use getAllByText since "Shivajinagar" also appears in assembly constituency
    expect(screen.getAllByText("Shivajinagar").length).toBeGreaterThanOrEqual(1);
  });

  it("renders only ward_name when ward_number arrives as the string 'undefined'", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<GbaHierarchyPanel hierarchy={makeHierarchy({ ward_number: "undefined" as any })} />);
    expect(screen.queryByText(/undefined/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 3.1 / ISSUE-03 — Bureaucratic chain hides null personnel rows
// ---------------------------------------------------------------------------

describe("Phase 3.1 / ISSUE-03 — Bureaucratic chain hides null personnel rows", () => {
  it("does not render the 'Asst. Revenue Officer' title when aro_sub_division is null", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy({ aro_sub_division: null })} />);
    expect(screen.queryByText("Asst. Revenue Officer")).toBeNull();
  });

  it("does not render the 'Revenue Officer' title when ro_division is null", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy({ ro_division: null })} />);
    expect(screen.queryByText("Revenue Officer")).toBeNull();
  });

  it("does not render the 'Zonal Commissioner' title when zone_name is null", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy({ zone_name: null })} />);
    expect(screen.queryByText("Zonal Commissioner")).toBeNull();
  });

  it("does not render the 'Chief Commissioner' title when corporation is null", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy({ corporation: null })} />);
    // Use $ anchor to NOT match "Chief Commissioner, GBA" (GBA row always shown)
    expect(screen.queryByText(/Chief Commissioner$/)).toBeNull();
  });

  it("always renders the Ward row even when other rows are null", () => {
    render(
      <GbaHierarchyPanel
        hierarchy={makeHierarchy({ aro_sub_division: null, ro_division: null, zone_name: null, corporation: null })}
      />
    );
    expect(screen.getByText("Ward Engineer")).toBeInTheDocument();
    // "Shivajinagar" appears in both Ward row and assembly constituency — use getAllByText
    expect(screen.getAllByText(/Shivajinagar/).length).toBeGreaterThanOrEqual(1);
  });

  it("always renders the GBA row even when other rows are null", () => {
    render(
      <GbaHierarchyPanel
        hierarchy={makeHierarchy({ aro_sub_division: null, ro_division: null, zone_name: null, corporation: null })}
      />
    );
    expect(screen.getByText("Greater Bengaluru Authority")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Phase 3.1 / ISSUE-04 — AC number and constituency name render as separate elements
// ---------------------------------------------------------------------------

describe("Phase 3.1 / ISSUE-04 — AC number and constituency name render as separate elements", () => {
  it("renders the AC number as its own text node", () => {
    render(<GbaHierarchyPanel hierarchy={makeHierarchy()} />);
    // "155" must be findable as a distinct text node (not combined "155 – Shivajinagar")
    expect(screen.getByText("155")).toBeInTheDocument();
  });

  it("renders the assembly constituency name as its own text node", () => {
    // Use a distinct assembly_constituency to avoid ambiguity with ward_name
    render(
      <GbaHierarchyPanel
        hierarchy={makeHierarchy({ assembly_constituency: "Sampangirama Nagar", assembly_constituency_no: 156 })}
      />
    );
    expect(screen.getByText("156")).toBeInTheDocument();
    expect(screen.getByText("Sampangirama Nagar")).toBeInTheDocument();
  });
});
