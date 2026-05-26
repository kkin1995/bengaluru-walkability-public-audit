"use client";

import type { CSSProperties } from "react";
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";
import type { WardHierarchy } from "../lib/adminApi";

// ─── GbaHierarchyPanel ────────────────────────────────────────────────────────
// Phase 03 (D-23, D-42, D-45): bureaucratic chain + elected chain display.
// Reads from ward_hierarchy (from wards table migration 008/009).

export interface GbaHierarchyPanelProps {
  hierarchy: WardHierarchy | null;
}

interface ChainRow {
  level: string;
  name: string | null;
  title: string;
  alwaysShow?: boolean;
}

const rowSeparator: CSSProperties = {
  borderTop: "1px solid var(--border)",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "var(--muted)",
  minWidth: 110,
  paddingRight: 8,
  flexShrink: 0,
};

const nameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
  flex: 1,
};

const titleStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  textAlign: "right" as const,
  flexShrink: 0,
};

function ChainRowItem({ level, name, title, isFirst }: ChainRow & { isFirst?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 0",
        gap: 8,
        ...(isFirst ? {} : rowSeparator),
      }}
    >
      <span style={labelStyle}>{level}</span>
      <span style={nameStyle}>{name ?? "—"}</span>
      <span style={titleStyle}>{title}</span>
    </div>
  );
}

export function GbaHierarchyPanel({ hierarchy }: GbaHierarchyPanelProps): JSX.Element {
  // Nothing-state: no hierarchy or ward_name is null
  if (!hierarchy || hierarchy.ward_name === null) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--muted)",
            fontFamily: "var(--font-sans)",
          }}
        >
          Ward assignment not available for this report.
        </div>
      </Card>
    );
  }

  // Build ward display value: "{ward_number} · {ward_name}"
  // ISSUE-01 fix: guard against both JS null/undefined AND the string "undefined"
  // (API may return the string "undefined" when ward_number is absent from DB row)
  const rawWardNumber = hierarchy.ward_number;
  const wardNumberValid =
    rawWardNumber != null &&
    !(typeof rawWardNumber === "string" && rawWardNumber === "undefined");
  const wardDisplay = wardNumberValid
    ? `${rawWardNumber} · ${hierarchy.ward_name}`
    : hierarchy.ward_name;

  // Build corporation display: "{corporation} Corporation, GBA"
  const corpDisplay = hierarchy.corporation
    ? `${hierarchy.corporation} Corporation, GBA`
    : null;

  // ISSUE-03 fix: tag institutional rows (always show) vs. personnel rows (hide when null)
  const bureaucraticChain: ChainRow[] = [
    { level: "Ward",             name: wardDisplay,                   title: "Ward Engineer",          alwaysShow: true },
    { level: "ARO Sub Division", name: hierarchy.aro_sub_division,   title: "Asst. Revenue Officer" },
    { level: "RO Division",      name: hierarchy.ro_division,         title: "Revenue Officer" },
    { level: "Zone",             name: hierarchy.zone_name,           title: "Zonal Commissioner" },
    { level: "Corporation",      name: corpDisplay,                   title: "Chief Commissioner" },
    { level: "GBA",              name: "Greater Bengaluru Authority", title: "Chief Commissioner, GBA", alwaysShow: true },
  ];

  // Filter: keep rows that are always-shown OR have a non-null/non-empty name
  const visibleChain = bureaucraticChain.filter(
    (row) => row.alwaysShow || (row.name !== null && row.name !== undefined && row.name !== "")
  );

  const mlaName = hierarchy.mla_name ?? "—";
  const mpName = hierarchy.mp_name ?? "—";

  return (
    <Card style={{ marginBottom: 16 }}>
      {/* Bureaucratic chain */}
      <SectionLabel style={{ marginBottom: 12 }}>Bureaucratic Chain</SectionLabel>
      <div style={{ marginBottom: 20 }}>
        {/* ISSUE-03 fix: use visibleChain (filtered) so isFirst derives from filtered index (Pitfall 2) */}
        {visibleChain.map((row, idx) => (
          <ChainRowItem
            key={row.level}
            level={row.level}
            name={row.name}
            title={row.title}
            isFirst={idx === 0}
          />
        ))}
      </div>

      {/* Elected chain */}
      <SectionLabel style={{ marginBottom: 12 }}>Elected · Assembly</SectionLabel>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "12px 16px",
        }}
      >
        {/* Assembly constituency — ISSUE-04 fix: AC number and constituency name as separate DOM elements */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            {hierarchy.assembly_constituency_no !== null && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginRight: 6 }}>
                {hierarchy.assembly_constituency_no}
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {hierarchy.assembly_constituency ?? "—"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>
            MLA:{" "}
            <span style={{ fontWeight: 600 }}>
              {mlaName}
            </span>
          </div>
        </div>

        {/* Parliamentary constituency */}
        {hierarchy.parliamentary_constituency && (
          <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {hierarchy.parliamentary_constituency}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>
              MP:{" "}
              <span style={{ fontWeight: 600 }}>
                {mpName}
              </span>
            </div>
          </div>
        )}

        {/* Disclaimer — ISSUE-05 fix: add wordBreak/overflowWrap to prevent horizontal overflow */}
        <div
          style={{
            fontSize: 11,
            color: "var(--muted)",
            marginTop: 10,
            fontFamily: "var(--font-mono)",
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          Constituency boundaries may differ from ward boundaries.
        </div>
      </div>
    </Card>
  );
}

export default GbaHierarchyPanel;
