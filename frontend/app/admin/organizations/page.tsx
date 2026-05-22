"use client";

import { useOnlineStatus } from "../lib/useOnlineStatus";
import { Pill } from "../components/Pill";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";

export default function OrganizationsPage() {
  const isOnline = useOnlineStatus();

  // ── Offline banner ─────────────────────────────────────────────────────────
  const offlineBanner = !isOnline ? (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "var(--warn-bg)",
        border: "1px solid var(--warn-border)",
        borderRadius: "var(--r-md)",
        padding: "10px 16px",
        marginBottom: 16,
        color: "var(--warn-ink)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.01em",
      }}
    >
      {"You're offline right now. Don't worry — everything you've changed has been saved on this device. We'll send it through automatically as soon as you're back online."}
    </div>
  ) : null;

  return (
    <div
      style={{
        padding: "24px 32px",
        maxWidth: 1400,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      {offlineBanner}

      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          ORGANIZATIONS
        </h1>
        <Pill
          tone="outline"
          size="sm"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}
        >
          PREVIEW
        </Pill>
      </div>

      {/* ── Stub body ─────────────────────────────────────────────────────── */}
      <Card style={{ padding: "24px" }}>
        <SectionLabel style={{ marginBottom: 12 }}>ORG_TREE</SectionLabel>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            color: "var(--muted)",
            margin: 0,
          }}
        >
          Organization management is not configured yet.
        </p>
      </Card>
    </div>
  );
}
