/**
 * Public Single-Report Page — Direction A (globals.css)
 *
 * Requirements: MAP-03 / D-26 / D-27 / D-28 / D-29
 * Privacy: T-03-04-01 — admin-only fields (notes, submitter PII) NEVER read or rendered
 *
 * This is a Next.js 14 App Router server component (no "use client").
 * Data is fetched server-side via INTERNAL_API_URL per RESEARCH.md Open Question 4.
 */

import { notFound } from "next/navigation";
import { INTERNAL_API_URL, API_BASE_URL } from "@/app/lib/config";
import { getCategoryLabel, publicStatusLabel, publicStatusColor } from "@/app/lib/translations";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StatusHistoryEntry {
  status: string;
  changed_at: string;
}

interface WardHierarchy {
  ward_name: string | null;
  corporation: string | null;
  zone_name: string | null;
  ro_division: string | null;
  aro_sub_division: string | null;
  assembly_constituency: string | null;
  assembly_constituency_no: number | null;
  parliamentary_constituency: string | null;
  mla_name: string | null;
  mp_name: string | null;
}

interface PublicReport {
  id: string;
  created_at: string;
  image_url: string;
  latitude: number;
  longitude: number;
  category: string;
  severity: string;
  description?: string | null;
  status: string;
  location_source: string;
  resolution_photo_url?: string | null;
  history: StatusHistoryEntry[];
  ward_hierarchy: WardHierarchy | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// MAP-03 / D-42: public 3-state mapping for citizens — 6-state admin enum is collapsed for clarity
// (publicStatusLabel and publicStatusColor are imported from translations.ts for shared single source)

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(isoString));
}

function severityColor(severity: string): string {
  if (severity === "high") return "var(--danger)";
  if (severity === "medium") return "var(--warn)";
  return "var(--muted)";
}

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchy helpers — GBA 6-row bureaucratic chain labels
// ─────────────────────────────────────────────────────────────────────────────

function BureaucraticRow({
  level,
  number,
  name,
  title,
  isLast,
}: {
  level: string;
  number: number;
  name: string;
  title: string;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 0",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: isLast ? "var(--ink)" : "var(--surface-2)",
          color: isLast ? "#fff" : "var(--muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 600,
          flexShrink: 0,
          fontFamily: "var(--font-mono)",
        }}
      >
        {number}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 2,
          }}
        >
          {level}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{name}</div>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--muted)",
          textAlign: "right",
          flexShrink: 0,
          maxWidth: 100,
        }}
      >
        {title}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Before/After photo components (TRIAGE-05 — D-24/D-25/D-26/D-27/D-28)
// ─────────────────────────────────────────────────────────────────────────────

/** Floating pill badge overlaid on the After photo (D-25) */
function ResolutionBadge() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        background: "var(--accent)",
        color: "#ffffff",
        borderRadius: "var(--r-full)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 400,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {/* Inline check icon — 12px, no stroke, matches check icon path from Icon.tsx */}
      <svg
        viewBox="0 0 24 24"
        width={12}
        height={12}
        aria-hidden="true"
        style={{ flexShrink: 0 }}
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12l5 5L20 6" />
      </svg>
      RESOLUTION
    </div>
  );
}

/** Single photo frame with label, mono sub-label, and image (D-26) */
function PhotoFrame({
  label,
  subLabel,
  src,
  badge,
}: {
  label: string;
  subLabel: string;
  src: string;
  badge?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Label row: label (14px/600) left + sub-label (10px mono muted) right, 4px gap */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 4,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
            fontFamily: "var(--font-sans)",
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
            letterSpacing: "0.05em",
            lineHeight: 1.4,
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          {subLabel}
        </span>
      </div>
      {/* Image wrapper — position:relative for badge overlay */}
      <div style={{ position: "relative" }}>
        {badge && <ResolutionBadge />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          style={{
            width: "100%",
            aspectRatio: "16/9",
            objectFit: "cover",
            borderRadius: "var(--r-md)",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Responsive before/after grid (TRIAGE-05).
 * Uses a CSS class (.ba-grid) toggled by a <style> block to avoid a JS
 * width check that would break SSR. Matches the page's existing inline-style
 * pattern while adding a single media query for the two-column desktop layout.
 */
function BeforeAfterGrid({
  originalSrc,
  originalSubLabel,
  resolutionSrc,
  resolutionSubLabel,
}: {
  originalSrc: string;
  originalSubLabel: string;
  resolutionSrc: string;
  resolutionSubLabel: string;
}) {
  return (
    <>
      <style>{`
        .ba-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .ba-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
        }
      `}</style>
      <div className="ba-grid">
        <PhotoFrame
          label="Before"
          subLabel={originalSubLabel}
          src={originalSrc}
        />
        <PhotoFrame
          label="After"
          subLabel={resolutionSubLabel}
          src={resolutionSrc}
          badge
        />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline entry component
// ─────────────────────────────────────────────────────────────────────────────

function TimelineEntry({
  entry,
  isCurrent,
}: {
  entry: StatusHistoryEntry;
  isCurrent: boolean;
}) {
  const dotColor = publicStatusColor(entry.status);
  const label = publicStatusLabel(entry.status);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
          boxShadow: isCurrent ? `0 0 0 2px ${dotColor}` : "none",
        }}
      />
      <div style={{ flex: 1, fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: "var(--ink)" }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "0.03em",
        }}
      >
        {formatDate(entry.changed_at)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export default async function PublicReportPage({
  params,
}: {
  params: { id: string };
}) {
  const res = await fetch(`${INTERNAL_API_URL}/api/reports/${params.id}`, {
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div role="alert" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
        Failed to load report.
      </div>
    );
  }

  const report: PublicReport = await res.json();

  // FIX-01 (D-01/D-02): Reconstruct browser-reachable URL from filename only.
  // report.image_url contains an internal Docker hostname (http://backend:3001/uploads/...)
  // which is unreachable from the browser. Extract the filename and build the public URL.
  // T-05-05: use .split("/uploads/").pop() to extract only the basename (path traversal safe).
  const imageFilename = (report.image_url ?? "").split("/uploads/").pop() ?? "";
  const publicImageUrl = imageFilename ? `${API_BASE_URL}/uploads/${imageFilename}` : "";

  const statusLabel = publicStatusLabel(report.status);
  const statusColor = publicStatusColor(report.status);
  const isResolved = report.status === "resolved" || report.status === "closed";

  // ── TRIAGE-05: Before/After photo derivation ───────────────────────────────
  // Derive resolution photo URL with the same Docker-hostname-safe extraction
  // used for the original (FIX-01 / T-05-05): split on "/uploads/" and rebuild.
  const resolutionFilename = (report.resolution_photo_url ?? "").split("/uploads/").pop() ?? "";
  const publicResolutionUrl = resolutionFilename ? `${API_BASE_URL}/uploads/${resolutionFilename}` : "";
  // WR-05: gate on isResolved so a resolution photo uploaded against a non-resolved report
  // does not show the "RESOLUTION" badge and Before/After layout to citizens.
  const hasResolutionPhoto = publicResolutionUrl !== "" && isResolved;

  // Sub-label for original: "DD MMM · CITIZEN" (D-26)
  // Uses existing formatDate but we need DD MMM only (e.g. "17 May")
  function formatShortDate(isoString: string): string {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
      new Date(isoString)
    );
  }
  const originalSubLabel = `${formatShortDate(report.created_at)} · CITIZEN`;

  // Resolution date: last history entry with status resolved or closed (Risk 6).
  // Falls back to report.created_at if no such entry found.
  // Null-guard: report.history may be null/undefined on the public endpoint (CR-03).
  const resolutionEntry = [...(report.history ?? [])]
    .reverse()
    .find((e) => e.status === "resolved" || e.status === "closed");
  const resolutionDate = resolutionEntry ? resolutionEntry.changed_at : report.created_at;

  // Corp name: ward_hierarchy?.corporation, fallback "GBA" (Assumption A2 — assigned_org_name
  // not in PublicReport; admin uploads resolution photos on behalf of their corporation).
  const corpName = report.ward_hierarchy?.corporation ?? "GBA";
  const resolutionSubLabel = `${formatShortDate(resolutionDate)} · ${corpName}`;
  // ─────────────────────────────────────────────────────────────────────────

  const hasHierarchy =
    report.ward_hierarchy !== null && report.ward_hierarchy?.ward_name !== null;
  const wh = report.ward_hierarchy;

  return (
    <div
      style={{
        maxWidth: "100%",
        minHeight: "100dvh",
        background: "var(--bg)",
        fontFamily: "var(--font-sans)",
        position: "relative",
      }}
    >
      {/* Floating header bar */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 100,
        }}
      >
        <a
          href="/map"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-full)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            textDecoration: "none",
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          ← Map
        </a>
        <button
          aria-label="Share report"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-sm)",
            color: "var(--ink)",
          }}
        >
          ↗
        </button>
      </div>

      {/* Hero photo — full-width, 260px tall */}
      <div style={{ position: "relative", width: "100%", height: 260, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={publicImageUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.45) 100%)",
          }}
        />
        {/* Report ID mono overlay bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.06em",
            color: "rgba(255,255,255,0.85)",
            textTransform: "uppercase",
          }}
        >
          {String(report.id).substring(0, 8).toUpperCase()}
        </div>
      </div>

      {/* Scrollable content area */}
      <div style={{ padding: "16px 16px 24px" }}>

        {/* Category + severity + status chip row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-full)",
              fontSize: 13,
              color: "var(--ink-2)",
            }}
          >
            {getCategoryLabel(report.category).en}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              background: `${severityColor(report.severity)}22`,
              border: `1px solid ${severityColor(report.severity)}44`,
              borderRadius: "var(--r-full)",
              fontSize: 13,
              color: severityColor(report.severity),
            }}
          >
            Severity · {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
          </span>
          {/* Status badge */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              background: `${statusColor}22`,
              border: `1px solid ${statusColor}44`,
              borderRadius: "var(--r-full)",
              fontSize: 13,
              color: statusColor,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: statusColor,
                flexShrink: 0,
              }}
            />
            {statusLabel}
          </span>
        </div>

        {/* Title + description */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            margin: "0 0 8px 0",
            lineHeight: 1.2,
          }}
        >
          {getCategoryLabel(report.category).en}
        </h1>
        {report.description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-2)",
              lineHeight: 1.55,
              margin: "0 0 16px 0",
            }}
          >
            {report.description}
          </p>
        )}

        {/* Meta grid */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              padding: "12px 14px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 4,
                }}
              >
                Submitted
              </div>
              <div style={{ fontSize: 13, color: "var(--ink)" }}>
                {formatDate(report.created_at)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 4,
                }}
              >
                Ward
              </div>
              <div style={{ fontSize: 13, color: "var(--ink)" }}>
                {wh?.ward_name ?? "—"}
              </div>
            </div>
          </div>
          {/* Row 2: GBA tag + corporation + zone */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px dashed var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--muted)",
                background: "var(--surface-2)",
                padding: "3px 7px",
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              GBA
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {wh?.corporation ?? "—"}
            </span>
            {wh?.zone_name && (
              <>
                <span style={{ color: "var(--border)" }}>·</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--muted)",
                  }}
                >
                  {wh.zone_name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status history timeline */}
        <section aria-label="Status history" style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 8,
            }}
          >
            Status history
          </div>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: "4px 14px",
            }}
          >
            {(report.history ?? []).length === 0 ? (
              <TimelineEntry
                entry={{ status: report.status, changed_at: report.created_at }}
                isCurrent
              />
            ) : (
              (report.history ?? []).map((entry, i) => (
                <TimelineEntry
                  key={`${entry.status}-${entry.changed_at}`}
                  entry={entry}
                  isCurrent={i === (report.history ?? []).length - 1}
                />
              ))
            )}
          </div>
        </section>

        {/* Photo section — Before/After (TRIAGE-05, D-24–D-28)
            Heading "Photo" always present (D-27 — heading does not change between states).
            Two-photo: BeforeAfterGrid (desktop 2-col, mobile stacked).
            Single-photo (no resolution_photo_url): one PhotoFrame, maxWidth 520px. */}
        <section aria-label="Report photo" style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 10,
            }}
          >
            Photo
          </div>
          {hasResolutionPhoto ? (
            <BeforeAfterGrid
              originalSrc={publicImageUrl}
              originalSubLabel={originalSubLabel}
              resolutionSrc={publicResolutionUrl}
              resolutionSubLabel={resolutionSubLabel}
            />
          ) : (
            <div style={{ maxWidth: 520, margin: "0 auto" }}>
              <PhotoFrame
                label="Photo"
                subLabel={originalSubLabel}
                src={publicImageUrl}
              />
            </div>
          )}
        </section>

        {/* GBA Responsibility Hierarchy */}
        <section aria-label="GBA Responsibility Hierarchy" style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 6,
            }}
          >
            GBA Responsibility Hierarchy
          </div>
          <p
            style={{
              fontSize: 11,
              color: "var(--muted)",
              marginBottom: 12,
              margin: "0 0 12px 0",
            }}
          >
            Who is accountable for this location, by office.
          </p>

          {!hasHierarchy ? (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "14px 16px",
                fontSize: 13,
                color: "var(--muted)",
                textAlign: "center",
              }}
            >
              Ward assignment not available for this report.
            </div>
          ) : (
            <>
              {/* Bureaucratic chain */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 8,
                }}
              >
                Bureaucratic chain
              </div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)",
                  padding: "0 14px",
                  marginBottom: 16,
                }}
              >
                <BureaucraticRow
                  level="Ward"
                  number={1}
                  name={wh?.ward_name ?? "—"}
                  title="Ward office"
                />
                <BureaucraticRow
                  level="ARO Sub Division"
                  number={2}
                  name={wh?.aro_sub_division ?? "—"}
                  title="Asst. Revenue Officer"
                />
                <BureaucraticRow
                  level="RO Division"
                  number={3}
                  name={wh?.ro_division ?? "—"}
                  title="Revenue Officer"
                />
                <BureaucraticRow
                  level="Zone"
                  number={4}
                  name={wh?.zone_name ?? "—"}
                  title="Zonal Commissioner"
                />
                <BureaucraticRow
                  level="Corporation"
                  number={5}
                  name={wh?.corporation ?? "—"}
                  title="Chief Commissioner"
                />
                <BureaucraticRow
                  level="GBA"
                  number={6}
                  name="Greater Bengaluru Authority"
                  title="GBA Commissioner"
                  isLast
                />
              </div>

              {/* Elected chain */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 8,
                }}
              >
                Elected · Assembly
              </div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)",
                  padding: "14px 16px",
                  marginBottom: 8,
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--muted)",
                      letterSpacing: "0.04em",
                      marginBottom: 2,
                    }}
                  >
                    Assembly Constituency
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {wh?.assembly_constituency_no != null ? `${wh.assembly_constituency_no} – ` : ""}
                    {wh?.assembly_constituency ?? "—"}
                  </div>
                  {wh?.mla_name && (
                    <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>
                      MLA: {wh.mla_name}
                    </div>
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--muted)",
                      letterSpacing: "0.04em",
                      marginBottom: 2,
                    }}
                  >
                    Parliamentary Constituency
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {wh?.parliamentary_constituency ?? "—"}
                  </div>
                  {wh?.mp_name && (
                    <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>
                      MP: {wh.mp_name}
                    </div>
                  )}
                </div>
              </div>

              {/* Disclaimer */}
              <p
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  margin: "0 0 8px 0",
                  lineHeight: 1.4,
                }}
              >
                Constituency boundaries may differ from ward boundaries.
              </p>
            </>
          )}
        </section>

        {/* Back to map link — centered at bottom */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <a
            href="/map"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-full)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            ← Back to map
          </a>
        </div>

      </div>
    </div>
  );
}
