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
  const wardDisplay = hierarchy.ward_number != null
    ? `${hierarchy.ward_number} · ${hierarchy.ward_name}`
    : hierarchy.ward_name;

  // Build corporation display: "{corporation} Corporation, GBA"
  const corpDisplay = hierarchy.corporation
    ? `${hierarchy.corporation} Corporation, GBA`
    : null;

  const bureaucraticChain: ChainRow[] = [
    { level: "Ward", name: wardDisplay, title: "Ward Engineer" },
    { level: "ARO Sub Division", name: hierarchy.aro_sub_division, title: "Asst. Revenue Officer" },
    { level: "RO Division", name: hierarchy.ro_division, title: "Revenue Officer" },
    { level: "Zone", name: hierarchy.zone_name, title: "Zonal Commissioner" },
    { level: "Corporation", name: corpDisplay, title: "Chief Commissioner" },
    { level: "GBA", name: "Greater Bengaluru Authority", title: "Chief Commissioner, GBA" },
  ];

  const mlaName = hierarchy.mla_name ?? "—";
  const mpName = hierarchy.mp_name ?? "—";
  const acLabel = hierarchy.assembly_constituency_no !== null && hierarchy.assembly_constituency
    ? `${hierarchy.assembly_constituency_no} – ${hierarchy.assembly_constituency}`
    : hierarchy.assembly_constituency ?? "—";

  return (
    <Card style={{ marginBottom: 16 }}>
      {/* Bureaucratic chain */}
      <SectionLabel style={{ marginBottom: 12 }}>Bureaucratic Chain</SectionLabel>
      <div style={{ marginBottom: 20 }}>
        {bureaucraticChain.map((row, idx) => (
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
        {/* Assembly constituency */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            {acLabel}
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

        {/* Disclaimer */}
        <div
          style={{
            fontSize: 11,
            color: "var(--muted)",
            marginTop: 10,
            fontFamily: "var(--font-mono)",
          }}
        >
          Constituency boundaries may differ from ward boundaries.
        </div>
      </div>
    </Card>
  );
}

export default GbaHierarchyPanel;
