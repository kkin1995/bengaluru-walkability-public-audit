"use client";

import Link from "next/link";
import nextDynamic from "next/dynamic";
import { API_BASE_URL } from "@/app/lib/config";
import { Icon } from "@/app/components/ui/Icon";
import { Btn } from "@/app/components/ui/Btn";

// Leaflet requires `window` — ssr: false is mandatory (do not remove even in client component).
const ReportsMap = nextDynamic(() => import("../components/ReportsMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--muted)",
        fontSize: 14,
      }}
    >
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  return (
    <main
      style={{
        height: "100dvh",
        position: "relative",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Map fills entire screen behind overlays */}
      <div style={{ position: "absolute", inset: 0 }}>
        <ReportsMap apiUrl={API_BASE_URL} />
      </div>

      {/* Top overlay bar: back + location pill + filter */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          display: "flex",
          gap: 8,
          zIndex: 500,
        }}
      >
        <Link
          href="/"
          className="press"
          aria-label="Back to home"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--border)",
            display: "grid",
            placeItems: "center",
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-md)",
            color: "var(--ink)",
            textDecoration: "none",
          }}
        >
          <Icon name="arrow_left" size={20} />
        </Link>
        <div
          role="search"
          style={{
            flex: 1,
            minWidth: 0,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-full)",
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
          }}
        >
          <Icon name="pin" size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--ink-2)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Bengaluru
          </div>
        </div>
        <button
          type="button"
          className="press"
          aria-label="Filter reports"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid var(--border)",
            display: "grid",
            placeItems: "center",
            backdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-md)",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <Icon name="filter" size={18} />
        </button>
      </div>

      {/* Floating Report here CTA */}
      <Link
        href="/report"
        style={{
          position: "absolute",
          right: 16,
          bottom: "calc(16px + env(safe-area-inset-bottom))",
          zIndex: 500,
          textDecoration: "none",
        }}
      >
        <Btn
          variant="accent"
          size="lg"
          style={{
            borderRadius: "var(--r-full)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <Icon name="camera" size={18} />
          <span style={{ whiteSpace: "nowrap" }}>Report here</span>
        </Btn>
      </Link>
    </main>
  );
}
