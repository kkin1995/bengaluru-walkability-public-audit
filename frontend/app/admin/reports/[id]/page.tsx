"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminReport,
  deleteReport,
  updateReportStatus,
  getMe,
  type AdminReport,
} from "../../lib/adminApi";
import { getCategoryLabel } from "@/app/lib/translations";
import StatusBadge from "../../components/StatusBadge";
import { SeverityIndicator } from "../../components/SeverityIndicator";
import { Card } from "../../components/Card";
import { Btn } from "../../components/Btn";
import { Pill } from "../../components/Pill";
import { PhotoTile } from "../../components/PhotoTile";
import { SectionLabel } from "../../components/SectionLabel";
import { ConfidencePill } from "../../components/ConfidencePill";
// Phase 03 (WFLOW-01, WFLOW-03, WFLOW-04, WFLOW-05): New admin lifecycle components
import StatusActionPanel from "../../components/StatusActionPanel";
import OrgAssignPanel from "../../components/OrgAssignPanel";
import GbaHierarchyPanel from "../../components/GbaHierarchyPanel";
import ResolveModal from "../../components/ResolveModal";

// ─── Status timeline constants ─────────────────────────────────────────────────

const STATUS_HISTORY = "Status History";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSevLevel(severity: string): "high" | "medium" | "low" {
  if (severity === "high" || severity === "medium" || severity === "low") return severity;
  return "low";
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString();
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [report, setReport] = useState<AdminReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [is404, setIs404] = useState(false);
  const [role, setRole] = useState<"admin" | "reviewer">("admin");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  // Phase 03: ResolveModal state (WFLOW-04, WFLOW-05)
  const [resolveModalState, setResolveModalState] = useState<{open: boolean; mode: "resolve" | "close"}>({
    open: false,
    mode: "resolve",
  });

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(min-width: 1024px)");
      setIsDesktop(mq.matches);
      const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  useEffect(() => {
    const promise = getMe();
    // getMe() may return undefined in test environments (jest.fn() without mockResolvedValue)
    if (promise && typeof promise.then === "function") {
      promise
        .then((user: { role?: string }) => {
          setRole(user.role === "reviewer" ? "reviewer" : "admin");
        })
        .catch(() => {/* keep default admin */});
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setIs404(false);

    getAdminReport(params.id)
      .then(setReport)
      .catch((err: Error) => {
        if (err.message?.includes("404") || err.message?.includes("HTTP 404")) {
          setIs404(true);
        } else {
          setError("Failed to load report");
        }
      })
      .finally(() => setIsLoading(false));
  }, [params.id]);

  async function handleStatusMove(newStatus: string) {
    if (!report) return;
    // Phase 03: resolved/closed transitions flow through ResolveModal (D-13, D-16)
    if (newStatus === "resolved" || newStatus === "closed") {
      setResolveModalState({ open: true, mode: newStatus === "resolved" ? "resolve" : "close" });
      return;
    }
    setStatusUpdateLoading(true);
    setStatusUpdateError(null);
    try {
      const updated = await updateReportStatus(report.id, newStatus);
      setReport(updated);
    } catch {
      setStatusUpdateError("Failed to update status. Please try again.");
    } finally {
      setStatusUpdateLoading(false);
    }
  }

  async function handleDelete() {
    if (!report) return;
    setIsDeleting(true);
    try {
      await deleteReport(report.id);
      setShowDeleteModal(false);
      router.push("/admin/reports");
    } catch {
      setIsDeleting(false);
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        data-testid="report-detail-loading"
        style={{ padding: "24px 32px" }}
      >
        <div style={{
          height: 40,
          background: "var(--surface-2)",
          borderRadius: "var(--r-md)",
          width: 200,
          marginBottom: 16,
        }} />
        <div style={{
          height: 280,
          background: "var(--surface-2)",
          borderRadius: "var(--r-md)",
          marginBottom: 16,
        }} />
      </div>
    );
  }

  // ── 404 state — EXACT UI-SPEC string ────────────────────────────────────────
  if (is404) {
    return (
      <div
        data-testid="report-detail-error"
        style={{ padding: "24px 32px" }}
      >
        <Card style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            This report no longer exists or was removed.
          </div>
          <Btn variant="ghost" size="sm" onClick={() => router.push("/admin/reports")}>
            Back to reports
          </Btn>
        </Card>
      </div>
    );
  }

  // ── Generic error state ──────────────────────────────────────────────────────
  if (error || !report) {
    return (
      <div data-testid="report-detail-error" style={{ padding: "24px 32px" }}>
        <Card style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            {error ?? "Report not found"}
          </div>
          <Btn variant="ghost" size="sm" onClick={() => router.push("/admin/reports")}>
            Back to reports
          </Btn>
        </Card>
      </div>
    );
  }

  const categoryLabel = getCategoryLabel(report.category).en;
  const sevValue = getSevLevel(report.severity);
  const dupCount = report.duplicate_count ?? 0;

  // ── Photo section ─────────────────────────────────────────────────────────────
  const photoSection = (
    <div style={{ position: "relative", height: 280, background: "var(--surface-2)", overflow: "hidden" }}>
      {(report.image_url || report.image_path) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={report.image_url || `/uploads/${report.image_path}`}
          alt={`Citizen-submitted photo of ${categoryLabel} at ${report.ward_name ?? "unknown ward"}`}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <PhotoTile
          size={undefined as unknown as number}
          style={{ width: "100%", height: "100%", display: "block", borderRadius: 0 }}
          aria-hidden="true"
        />
      )}

      {/* Overlays — positioned over the photo */}
      {/* Top-left: photo count chip */}
      <div style={{ position: "absolute", top: 8, left: 8 }}>
        <Pill tone="outline" size="sm" style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>
          1 PHOTO
        </Pill>
      </div>

      {/* Top-right: EXIF chip */}
      <div style={{ position: "absolute", top: 8, right: 8 }}>
        {report.location_source === "exif" && (
          <Pill tone="accent" size="sm" style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>
            EXIF_OK
          </Pill>
        )}
      </div>

      {/* Bottom-left: SHA chip */}
      <div style={{ position: "absolute", bottom: 8, left: 8 }}>
        <Pill tone="neutral" size="sm" style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>
          SHA: {report.id.slice(0, 5).toUpperCase()}…
        </Pill>
      </div>

      {/* Bottom-right: zoom button */}
      <button
        aria-label="Zoom photo"
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          background: "rgba(10,10,10,0.5)",
          border: "none",
          borderRadius: "var(--r-sm)",
          color: "var(--on-danger)",
          padding: "6px 8px",
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
        }}
      >
        ⌕
      </button>
    </div>
  );

  // ── Right panel content (shared mobile + desktop) ─────────────────────────────
  const rightPanel = (
    <div style={{ padding: isDesktop ? "0 0 0 24px" : "16px" }}>
      {/* Status badges row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <StatusBadge status={report.status} />
        <SeverityIndicator severity={sevValue} />
        {report.duplicate_confidence && (
          <ConfidencePill confidence={report.duplicate_confidence === "high" ? "high" : "low"} />
        )}
        {dupCount > 0 && (
          <Pill tone="warn" size="sm" style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>
            DUP +{dupCount}
          </Pill>
        )}
      </div>

      {/* Phase 03: StatusActionPanel — replaces inline status PATCH buttons (WFLOW-01) */}
      <StatusActionPanel
        report={report}
        onStatusChange={handleStatusMove}
        onResolveClick={() => setResolveModalState({ open: true, mode: "resolve" })}
        onCloseClick={() => setResolveModalState({ open: true, mode: "close" })}
        onAssignClick={() => {
          document.getElementById("org-assign-panel")?.scrollIntoView({ behavior: "smooth" });
        }}
        disabled={statusUpdateLoading}
      />

      {statusUpdateError && (
        <p role="alert" style={{ fontSize: 13, color: "var(--danger-ink)", marginBottom: 12 }}>
          {statusUpdateError}
        </p>
      )}

      {/* Category title */}
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
        marginBottom: 16,
      }}>
        {categoryLabel}
      </div>

      {/* Telemetry block — 2-column grid */}
      <Card padded={false} style={{ marginBottom: 16, overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}>
          {[
            { key: "LAT", value: report.latitude?.toFixed(5) ?? "—" },
            { key: "LNG", value: report.longitude?.toFixed(5) ?? "—" },
            { key: "WARD", value: report.ward_name ?? "—" },
            { key: "LOCATION_SRC", value: (report.location_source ?? "—").toUpperCase() },
            { key: "SUBMITTED_AT", value: formatDate(report.created_at) },
            // Raw category slug — machine truth for admin telemetry (test: "renders the category text")
            { key: "CATEGORY", value: report.category },
            { key: "DUP_CONF", value: report.duplicate_confidence?.toUpperCase() ?? "—" },
            { key: "UUID", value: report.id.slice(0, 8).toUpperCase() + "…" },
          ].map((item, idx) => (
            <div
              key={item.key}
              style={{
                padding: "10px 12px",
                borderTop: idx >= 2 ? "1px dashed var(--border)" : undefined,
                gridColumn: (item.key === "UUID" || item.key === "DUP_CONF") ? "1 / -1" : undefined,
              }}
            >
              <SectionLabel style={{ marginBottom: 3 }}>{item.key}</SectionLabel>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--ink-2)",
                fontWeight: 500,
              }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Phase 03: OrgAssignPanel (WFLOW-03, D-08, D-09) */}
      <div id="org-assign-panel">
        <OrgAssignPanel
          report={report}
          onAssigned={(updated) => setReport(updated)}
        />
      </div>

      {/* Phase 03: GbaHierarchyPanel (D-23, D-42, D-43, D-44) */}
      <GbaHierarchyPanel hierarchy={report.ward_hierarchy ?? null} />

      {/* Citizen description */}
      <Card style={{ marginBottom: 16 }}>
        <SectionLabel style={{ marginBottom: 8 }}>CITIZEN_DESCRIPTION</SectionLabel>
        <div style={{
          fontSize: 14,
          fontFamily: "var(--font-sans)",
          color: "var(--ink)",
          lineHeight: 1.6,
        }}>
          {report.description ?? "No description"}
        </div>
        {/* Kannada description would render here when the API exposes a locale-tagged field */}
      </Card>

      {/* Map placeholder + Open in Maps link */}
      <Card padded={false} style={{ marginBottom: 16, overflow: "hidden" }}>
        <div style={{
          height: 140,
          background: "linear-gradient(135deg, var(--surface-2), var(--surface-3))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
            MAP
          </span>
        </div>
        <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            {report.ward_name && (
              <Pill tone="neutral" size="sm" style={{ fontFamily: "var(--font-mono)", fontSize: 10, marginRight: 6 }}>
                {report.ward_name.toUpperCase()}
              </Pill>
            )}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
              {report.latitude?.toFixed(4)}, {report.longitude?.toFixed(4)}
            </span>
          </div>
          <a
            href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--accent-ink)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Open in Maps ↗
          </a>
        </div>
      </Card>

      {/* Status timeline — STATUS_HISTORY · TAIL */}
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>{STATUS_HISTORY}</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Current status as fallback timeline entry (API doesn't expose status_history yet) */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background:
                  report.status === "submitted" ? "var(--status-submitted)" :
                  report.status === "under_review" ? "var(--status-review)" :
                  "var(--status-resolved)",
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <div>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--ink)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}>
                {report.status.replace("_", " ")}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                {formatDate(report.updated_at)} · BY · SYSTEM
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  // ── Desktop top action bar ────────────────────────────────────────────────────
  const desktopActionBar = isDesktop ? (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    }}>
      <button
        onClick={() => router.back()}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--muted)",
          padding: 0,
        }}
      >
        ← BACK
      </button>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Btn
          variant="ghost"
          size="sm"
          style={{ minHeight: 40 }}
          onClick={() => window.open(`/reports/${report.id}`, "_blank", "noopener noreferrer")}
        >
          View public
        </Btn>
        {role === "admin" && (
          <Btn
            variant="danger-soft"
            size="sm"
            style={{ minHeight: 40 }}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Btn>
        )}
        {/* Phase 03: Resolve button moved to StatusActionPanel — removed from desktop top bar */}
      </div>
    </div>
  ) : null;

  return (
    <div
      data-testid="report-detail"
      style={{ padding: "24px 32px", maxWidth: 1400, marginLeft: "auto", marginRight: "auto", paddingBottom: 80 }}
    >
      {desktopActionBar}

      {/* Layout: desktop split panel | mobile single column */}
      {isDesktop ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 0, minHeight: "calc(100vh - 120px)" }}>
          {/* Left panel: large photo */}
          <div style={{ background: "var(--surface-2)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            {(report.image_url || report.image_path) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={report.image_url || `/uploads/${report.image_path}`}
                alt={`Citizen-submitted photo of ${categoryLabel} at ${report.ward_name ?? "unknown ward"}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, var(--surface-2), var(--surface-3))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 400,
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
                  NO PHOTO
                </span>
              </div>
            )}
          </div>

          {/* Right panel: scrollable detail content */}
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 120px)", borderLeft: "1px solid var(--border)" }}>
            {rightPanel}
          </div>
        </div>
      ) : (
        /* Mobile: single column */
        <div>
          {/* Mobile back button */}
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--muted)",
              padding: "0 0 12px",
              display: "block",
            }}
          >
            ← BACK
          </button>

          {/* Mobile delete button (role-gated) */}
          {role === "admin" && (
            <div style={{ marginBottom: 8 }}>
              <Btn
                variant="danger-soft"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete
              </Btn>
            </div>
          )}

          {photoSection}
          {rightPanel}
        </div>
      )}

      {/* Phase 03: ResolveModal (WFLOW-04, WFLOW-05) — mounted at root to overlay full page */}
      <ResolveModal
        open={resolveModalState.open}
        mode={resolveModalState.mode}
        report={report}
        onClose={() => setResolveModalState({ open: false, mode: resolveModalState.mode })}
        onResolved={(updated) => {
          setReport(updated);
          setResolveModalState({ open: false, mode: resolveModalState.mode });
        }}
      />

      {/* Delete confirmation modal — inline modal per UI-SPEC */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(10,10,10,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        >
          <Card
            style={{ width: "100%", maxWidth: 480, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-modal-title"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--ink)",
                margin: "0 0 16px",
              }}
            >
              {/* EXACT UI-SPEC string */}
              Delete this report? This cannot be undone.
            </h2>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </Btn>
              <Btn
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
