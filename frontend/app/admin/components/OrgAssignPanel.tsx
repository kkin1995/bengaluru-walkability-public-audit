"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { Btn } from "./Btn";
import { Select } from "./Select";
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";
import { listOrganizations, assignReportOrg, type AdminReport, type Organization } from "../lib/adminApi";

// ─── OrgAssignPanel ───────────────────────────────────────────────────────────
// Phase 03 (WFLOW-03, D-08, D-09, D-10, D-11): Cascading org assignment panel.
// Corporation → Ward Office picker; saves via assignReportOrg; auto-advances
// status to "assigned" (handled server-side per D-09).

export interface OrgAssignPanelProps {
  report: AdminReport;
  onAssigned: (updated: AdminReport) => void;
}

export function OrgAssignPanel({ report, onAssigned }: OrgAssignPanelProps): JSX.Element {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [selectedCorpId, setSelectedCorpId] = useState<string | null>(null);
  const [selectedWardOfficeId, setSelectedWardOfficeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WR-04: Pre-fetch orgs on mount (not just on edit mode entry) so view mode can
  // display the full corporation↳ward-office cascade without requiring the user to
  // click "Change". The previous mode === "edit" guard left orgs=null in view mode,
  // so assignedCorp was always null and only the flat assigned_org_name was shown.
  useEffect(() => {
    if (orgs === null) {
      setLoading(true);
      listOrganizations()
        .then(setOrgs)
        .catch(() => setError("Failed to load organisations"))
        .finally(() => setLoading(false));
    }
  }, [orgs]);

  const corporations = orgs ? orgs.filter((o) => o.org_type === "corporation") : [];
  const wardOffices = selectedCorpId && orgs
    ? orgs.filter((o) => o.org_type === "ward_office" && o.parent_id === selectedCorpId)
    : [];

  // Resolve org name for view mode.
  // Prefer the server-provided assigned_org_name (avoids a client-side orgs list fetch on
  // initial render). Fall back to the in-memory orgs list only if the report is in edit
  // mode (orgs already loaded) and the name is missing for some reason.
  const assignedOrgName = report.assigned_org_name
    ?? (orgs ? (orgs.find((o) => o.id === report.assigned_org_id)?.name ?? null) : null);

  // Also resolve from orgs list when in edit mode (needed for cascade parent lookup).
  const assignedOrg = report.assigned_org_id && orgs
    ? orgs.find((o) => o.id === report.assigned_org_id) ?? null
    : null;
  const assignedCorp = assignedOrg?.org_type === "ward_office" && assignedOrg.parent_id && orgs
    ? orgs.find((o) => o.id === assignedOrg.parent_id) ?? null
    : assignedOrg?.org_type === "corporation" ? assignedOrg : null;

  async function handleSave() {
    if (!selectedCorpId) return;
    const orgId = selectedWardOfficeId ?? selectedCorpId;
    setSaving(true);
    setError(null);
    try {
      const updated = await assignReportOrg(report.id, orgId);
      onAssigned(updated);
      setMode("view");
    } catch {
      setError("Failed to save assignment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setSelectedCorpId(null);
    setSelectedWardOfficeId(null);
    setMode("view");
  }

  const rowStyle: CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  };

  if (mode === "view") {
    return (
      <Card style={{ marginBottom: 16 }}>
        <SectionLabel style={{ marginBottom: 8 }}>Organisation Assignment</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {report.assigned_org_id && assignedOrgName ? (
            <div
              data-testid="org-status"
              style={{ fontSize: 13, color: "var(--ink)" }}
            >
              <span style={{ fontWeight: 600 }}>
                {assignedCorp ? assignedCorp.name : assignedOrgName}
              </span>
              {assignedOrg && assignedOrg.org_type === "ward_office" && (
                <span style={{ color: "var(--muted)" }}> ↳ {assignedOrg.name}</span>
              )}
            </div>
          ) : (
            <span
              data-testid="org-status"
              style={{
                fontSize: 13,
                color: "var(--danger-ink)",
                fontWeight: 500,
              }}
            >
              No organisation assigned
            </span>
          )}
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => setMode("edit")}
          >
            {report.assigned_org_id ? "Change" : "Assign"}
          </Btn>
        </div>
      </Card>
    );
  }

  // Edit mode — cascade picker
  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionLabel style={{ marginBottom: 8 }}>Organisation Assignment</SectionLabel>

      {loading && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Loading organisations…</div>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 13, color: "var(--danger-ink)", marginBottom: 8 }}>
          {error}
        </div>
      )}

      {!loading && orgs && (
        <div style={rowStyle}>
          {/* Corporation select */}
          <Select
            data-testid="org-corp-select"
            value={selectedCorpId ?? ""}
            onChange={(e) => {
              setSelectedCorpId(e.target.value || null);
              setSelectedWardOfficeId(null);
            }}
            wrapperStyle={{ minWidth: 180 }}
            aria-label="Select corporation"
          >
            <option value="">Select corporation</option>
            {corporations.map((corp) => (
              <option key={corp.id} value={corp.id}>
                {corp.name}
              </option>
            ))}
          </Select>

          {/* Ward office select — only shown when corp is selected and ward offices exist */}
          {selectedCorpId && wardOffices.length > 0 && (
            <Select
              data-testid="org-ward-office-select"
              value={selectedWardOfficeId ?? ""}
              onChange={(e) => setSelectedWardOfficeId(e.target.value || null)}
              wrapperStyle={{ minWidth: 180 }}
              aria-label="Select ward office"
            >
              <option value="">Select ward office (optional)</option>
              {wardOffices.map((wo) => (
                <option key={wo.id} value={wo.id}>
                  {wo.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Btn
          variant="accent"
          size="sm"
          data-testid="org-save"
          disabled={!selectedCorpId || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save assignment"}
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          data-testid="org-discard"
          disabled={saving}
          onClick={handleDiscard}
        >
          Discard changes
        </Btn>
      </div>
    </Card>
  );
}

export default OrgAssignPanel;
