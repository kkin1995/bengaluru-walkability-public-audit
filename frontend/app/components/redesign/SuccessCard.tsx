"use client";

import { Bi } from "@/app/components/ui/Bi";
import { Btn } from "@/app/components/ui/Btn";
import { Icon } from "@/app/components/ui/Icon";
import { SectionLabel } from "@/app/components/ui/SectionLabel";

interface SuccessCardProps {
  reportId?: string;
  locationLabel?: string;
  onReportAnother: () => void;
  onClose: () => void;
}

export function SuccessCard({
  reportId,
  locationLabel,
  onReportAnother,
  onClose,
}: SuccessCardProps) {
  async function handleShare() {
    const shareData = {
      title: "Bengaluru Walkability Audit",
      text: "Help improve pedestrian infrastructure in Bengaluru — report issues near you!",
      url: typeof window !== "undefined" ? window.location.origin : "",
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled */
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareData.url);
    }
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
            <span style={{ fontSize: 14, color: "var(--muted)" }}>Save for reference</span>
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
        </div>
      </div>

      {/* Bottom buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="secondary" size="lg" onClick={handleShare} style={{ flex: 1 }}>
          <Icon name="share" size={16} />
          <span>Share</span>
        </Btn>
        <Btn variant="accent" size="lg" onClick={onReportAnother} style={{ flex: 2 }}>
          <Bi en="Report another" kn="ಇನ್ನೊಂದು" style={{ alignItems: "center" }} />
        </Btn>
      </div>
    </div>
  );
}
