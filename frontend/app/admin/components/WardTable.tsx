"use client";

import type { WardAnalytics } from "../lib/adminApi";

interface WardTableProps {
  data: WardAnalytics[];
  selectedWard?: string | null;
}

export default function WardTable({ data, selectedWard }: WardTableProps) {
  const filtered = selectedWard
    ? data.filter((w) => w.ward_name === selectedWard)
    : data;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Ward", "Ward #", "Unresolved", "Total"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((w) => {
            const isSelected = w.ward_name === selectedWard;
            return (
              <tr
                key={w.ward_name}
                style={{
                  background: isSelected ? "var(--accent-bg)" : "transparent",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <td
                  style={{
                    padding: "8px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: isSelected ? "var(--accent-ink)" : "var(--ink)",
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {w.ward_name}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  {w.ward_number}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: w.unresolved_count > 0 ? "var(--danger)" : "var(--ink)",
                    fontWeight: w.unresolved_count > 0 ? 600 : 400,
                  }}
                >
                  {w.unresolved_count}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  {w.total_count}
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: "24px 12px",
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
