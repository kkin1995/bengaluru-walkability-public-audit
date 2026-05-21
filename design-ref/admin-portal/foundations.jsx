/* Foundations row — token cards per direction */

function PaletteRow({ name, vars }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <SectionLabel style={{ fontSize: 9 }}>{name}</SectionLabel>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {vars.map((v, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 6, background: `var(--${v.k})`, border: "1px solid var(--border)" }}/>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 9 }}>{v.k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const Foundations = ({ direction }) => {
  const isA = direction === "a";
  const name = isA ? "Daari Ops" : "Walkability Console";
  const tagline = isA
    ? "Sibling of the citizen app — warm stone neutrals, civic green, Inter + JetBrains Mono. Reads like the back office of a friendly civic tool."
    : "An ops console for triage — cooler stone, teal accent, JetBrains Mono in the chrome. Reads like a working tool, not a marketing site.";
  const dirClass = isA ? "dir-a" : "dir-b";

  return (
    <div className={dirClass} style={{ width: "100%", height: "100%", background: "var(--bg)", padding: 32, overflow: "hidden", display: "flex", flexDirection: "column", gap: 20, color: "var(--ink)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
          <SectionLabel>Direction {isA ? "A" : "B"}</SectionLabel>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "var(--font-display)" }}>
            {isA ? "Daari Ops" : "WLK · Console"}
          </h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>{tagline}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Pill tone="accent" icon="check_circle">Light + dark</Pill>
          <Pill tone="neutral">{isA ? "Inter · JetBrains Mono" : "JetBrains Mono · Inter"}</Pill>
          <Pill tone="outline">Mobile-first</Pill>
        </div>
      </div>

      {/* Two columns: palette + type */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
        {/* Palette */}
        <Card padded style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <SectionLabel>Palette</SectionLabel>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>oklch · semantic</span>
          </div>
          <PaletteRow name="Neutrals" vars={[
            { k: "bg" }, { k: "surface" }, { k: "surface-2" }, { k: "surface-3" }, { k: "border" }, { k: "border-strong" }, { k: "muted" }, { k: "ink-2" }, { k: "ink" },
          ]}/>
          <PaletteRow name="Accent" vars={[
            { k: "accent-bg" }, { k: "accent-border" }, { k: "accent" }, { k: "accent-ink" },
          ]}/>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <PaletteRow name="Submitted" vars={[{ k: "status-submitted-bg" }, { k: "status-submitted" }]}/>
            <PaletteRow name="Under review" vars={[{ k: "status-review-bg" }, { k: "status-review" }]}/>
            <PaletteRow name="Resolved" vars={[{ k: "status-resolved-bg" }, { k: "status-resolved" }]}/>
          </div>
          <PaletteRow name="Severity" vars={[{ k: "sev-low" }, { k: "sev-medium" }, { k: "sev-high" }]}/>
        </Card>

        {/* Type + components */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel>Type</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "var(--font-display)", lineHeight: 1 }}>1,247</span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", letterSpacing: "0.06em" }}>DISPLAY · {isA ? "Inter 700" : "Mono 700"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 22, fontWeight: 600 }}>Triage queue</span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", letterSpacing: "0.06em" }}>H1 · INTER 600</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 14 }}>Body 14 / 1.5 · Reads like a working tool, not a marketing site.</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>WLK-7AC2F · 14:23 IST · 12°59′07″N 77°36′23″E</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span className="kn" style={{ fontSize: 14, color: "var(--muted)" }}>ಬಸ್ ನಿಲ್ದಾಣದ ಬಳಿ ದೊಡ್ಡ ಗುಂಡಿ</span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>KN · CITIZEN CONTENT ONLY</span>
              </div>
            </div>
          </Card>

          <Card padded style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel>Components</SectionLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn variant="primary" size="sm">Primary</Btn>
              <Btn variant="accent" size="sm" icon="check">Accept</Btn>
              <Btn variant="secondary" size="sm">Secondary</Btn>
              <Btn variant="ghost" size="sm" icon="filter">Filter</Btn>
              <Btn variant="danger-soft" size="sm" icon="trash">Delete</Btn>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <StatusBadge status="submitted" monoLabel={!isA}/>
              <StatusBadge status="under_review" monoLabel={!isA}/>
              <StatusBadge status="resolved" monoLabel={!isA}/>
              <SeverityIndicator severity="high" style={isA ? "pill" : "bars"}/>
              <SeverityIndicator severity="medium" style={isA ? "pill" : "bars"}/>
              <ConfidencePill level="high"/>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Avatar name="Karan Kinariwala" tone="ink"/>
              <PhotoTile photo="photo" size={32}/>
              <PhotoTile photo="photo alt-1" size={32}/>
              <CategoryGlyph name="broken_footpath" size={32}/>
              <CategoryGlyph name="unsafe_crossing" size={32} tone="warn"/>
              <Pill tone="warn" icon="duplicate">+3 duplicates</Pill>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom strip: radii + shadows */}
      <Card padded style={{ display: "flex", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <SectionLabel>Radii</SectionLabel>
          {["xs", "sm", "md", "lg", "xl"].map(r => (
            <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 34, height: 34, background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: `var(--r-${r})` }}/>
              <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{r}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <SectionLabel>Shadow</SectionLabel>
          {["sm", "md", "lg"].map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 44, height: 30, background: "var(--surface)", borderRadius: "var(--r-md)", boxShadow: `var(--shadow-${s})` }}/>
              <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <SectionLabel>Voice</SectionLabel>
          <span style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink-2)", maxWidth: 280 }}>
            {isA ? '"3 new reports in Shivajinagar today — let\'s get them triaged."' : '"218 OPEN · 64 IN-REVIEW · QUEUE STABLE · UPDATED 14:38 IST"'}
          </span>
        </div>
      </Card>
    </div>
  );
};

window.Foundations = Foundations;
