"use client";

import { useState } from "react";
import { Bi } from "@/app/components/ui/Bi";
import { Btn } from "@/app/components/ui/Btn";
import { Icon } from "@/app/components/ui/Icon";
import { SectionLabel } from "@/app/components/ui/SectionLabel";

interface SuccessCardProps {
  reportId?: string;
  locationLabel?: string;
  wardLabel?: string;
  onReportAnother: () => void;
  onClose: () => void;
}

export function SuccessCard({
  reportId,
  locationLabel,
  wardLabel,
  onReportAnother,
  onClose,
}: SuccessCardProps) {
  const [flash, setFlash] = useState<"share" | "id" | null>(null);

  function flashFor(which: "share" | "id") {
    setFlash(which);
    setTimeout(() => setFlash(null), 2000);
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (nav && "share" in nav) {
      try {
        await (nav as Navigator).share({ title: "Bengaluru Walkability Audit", url });
        return;
      } catch { /* user cancelled */ }
    }
    if (nav?.clipboard) {
      await nav.clipboard.writeText(url);
      flashFor("share");
    }
  }

  async function handleSaveId() {
    if (!reportId || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(reportId);
    flashFor("id");
  }

  return (
    <div
      style={{
        padding: "24px 20px",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        background: "var(--bg)",
      }}
    >
      {/* Close button row */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onClose}
          className="press"
          aria-label="Close"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "transparent",
            border: "none",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      {/* Center content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--accent-bg)",
            display: "grid",
            placeItems: "center",
            marginBottom: 16,
          }}
          aria-hidden="true"
        >
          <Icon name="check_circle" size={36} style={{ color: "var(--accent-ink)" }} />
        </div>
        <SectionLabel style={{ marginBottom: 8 }}>Submitted</SectionLabel>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          Thank you. It&apos;s on the map.
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--ink-2)",
            lineHeight: 1.5,
            marginTop: 16,
            marginBottom: 0,
            maxWidth: 360,
          }}
        >
          Your report is{" "}
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>public</strong> on the map
          immediately. This is a citizen-led project — reports build evidence pressure for the
          city to act.
        </p>

        {/* Report ID card */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <SectionLabel>Report ID</SectionLabel>
            <button
              type="button"
              onClick={handleSaveId}
              style={{ fontSize: 14, color: "var(--muted)", background: "none", border: "none", cursor: reportId ? "pointer" : "default", padding: 0 }}
            >
              {flash === "id" ? "Copied!" : "Save for reference"}
            </button>
          </div>
          <div
            className="mono"
            style={{ fontSize: 14, fontWeight: 500, marginTop: 6, color: "var(--ink)" }}
          >
            {reportId ?? "—"}
          </div>
          <div
            style={{
              borderTop: "1px dashed var(--border)",
              marginTop: 12,
              paddingTop: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              fontSize: 14,
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Status
              </div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }}
                  aria-hidden="true"
                />
                Submitted
              </div>
            </div>
            {locationLabel && (
              <div>
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Near
                </div>
                <div style={{ marginTop: 4 }}>{locationLabel}</div>
              </div>
            )}
          </div>

          {/* GBA ward row — shown when ward was auto-detected */}
          {wardLabel && (
            <div
              style={{
                borderTop: "1px dashed var(--border)",
                marginTop: 12,
                paddingTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  background: "var(--surface-2)",
                  padding: "3px 6px",
                  borderRadius: 4,
                }}
              >
                GBA
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 500 }}>
                {wardLabel}
              </span>
              <span style={{ fontSize: 10, color: "var(--muted-2)", marginLeft: "auto" }}>
                Auto-detected
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="secondary" size="lg" onClick={handleShare} style={{ flex: 1 }}>
          <Icon name="share" size={16} />
          <span>{flash === "share" ? "Copied!" : "Share"}</span>
        </Btn>
        <Btn variant="accent" size="lg" onClick={onReportAnother} style={{ flex: 2 }}>
          <Bi en="Report another" kn="ಇನ್ನೊಂದು" style={{ alignItems: "center" }} />
        </Btn>
      </div>
    </div>
  );
}
