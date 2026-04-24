import Link from "next/link";
import { Bi } from "@/app/components/ui/Bi";
import { Btn } from "@/app/components/ui/Btn";
import { Icon } from "@/app/components/ui/Icon";
import { Pill } from "@/app/components/ui/Pill";
import { SectionLabel } from "@/app/components/ui/SectionLabel";

// Static scatter positions for map preview (10 dots; deterministic to avoid hydration mismatch)
const MAP_DOTS: Array<[number, number, "accent" | "warn" | "danger"]> = [
  [22, 30, "danger"],
  [34, 45, "warn"],
  [45, 28, "accent"],
  [58, 55, "danger"],
  [70, 38, "warn"],
  [30, 68, "accent"],
  [65, 72, "danger"],
  [48, 82, "warn"],
  [78, 62, "accent"],
  [18, 55, "danger"],
];

const DOT_COLORS: Record<"accent" | "warn" | "danger", string> = {
  accent: "var(--accent)",
  warn: "var(--warn)",
  danger: "var(--danger)",
};

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        maxWidth: 428,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      {/* Header — brand + language toggle (display only) */}
      <header
        style={{
          padding: "20px 20px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "var(--ink)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <Icon name="pin" size={16} style={{ color: "#fafaf9" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
              }}
            >
              Namma <span className="kn" style={{ fontWeight: 600 }}>ದಾರಿ</span>
            </div>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--muted-2)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Walkable BLR
            </div>
          </div>
        </div>
        {/* Language toggle display-only (CONTEXT.md: deferred functionality) */}
        <div
          aria-label="Language toggle (display only)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--muted)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <Icon name="globe" size={14} /> EN · ಕ
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          flex: 1,
          padding: "32px 20px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <SectionLabel style={{ marginBottom: 12 }}>Citizen Audit · ನಾಗರಿಕ</SectionLabel>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            margin: 0,
            color: "var(--ink)",
          }}
        >
          Fix the footpath.
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--ink-2)",
            lineHeight: 1.5,
            marginTop: 14,
            marginBottom: 0,
            maxWidth: 320,
          }}
        >
          Spot a broken, blocked, or missing footpath? Snap it — it goes straight to the
          public map.
        </p>
      </section>

      {/* Map preview */}
      <div style={{ padding: "0 20px" }}>
        <div
          className="map-tile"
          style={{
            height: 180,
            borderRadius: "var(--r-lg)",
            position: "relative",
            overflow: "hidden",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {MAP_DOTS.map(([x, y, tone], i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: DOT_COLORS[tone],
                boxShadow: "0 0 0 3px rgba(255,255,255,0.7)",
              }}
              aria-hidden="true"
            />
          ))}
          <div style={{ position: "absolute", left: 12, bottom: 12, display: "flex", gap: 6 }}>
            <Pill tone="glass">
              <span className="mono">412</span>
              <span>reports</span>
            </Pill>
          </div>
          <Link
            href="/map"
            className="press"
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              background: "rgba(255,255,255,0.95)",
              border: "1px solid var(--border)",
              padding: "8px 12px",
              borderRadius: "var(--r-full)",
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            Open map <Icon name="arrow_right" size={14} />
          </Link>
        </div>
      </div>

      {/* Primary CTA + trust sub-copy */}
      <div
        style={{
          padding: "20px",
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }}
      >
        <Link href="/report" style={{ textDecoration: "none" }}>
          <Btn variant="accent" size="xl" style={{ width: "100%" }}>
            <Icon name="camera" size={22} />
            <Bi
              en="Report an issue"
              kn="ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ"
              style={{ alignItems: "center" }}
            />
          </Btn>
        </Link>
        <p
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 12,
            marginBottom: 0,
            fontSize: 14,
            color: "var(--muted)",
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>No login</span>
          <span aria-hidden="true">·</span>
          <span style={{ whiteSpace: "nowrap" }}>Takes 20 seconds</span>
          <span aria-hidden="true">·</span>
          <span style={{ whiteSpace: "nowrap" }}>Anonymous</span>
        </p>
      </div>
    </main>
  );
}
