/* Screen 2: Confirm (location + details + submit) & Success & Map */

const ConfirmScreen = ({ onBack, onSubmit, state, setState, accent }) => {
  const setSev = v => setState(s => ({ ...s, severity: v }));
  const activeCat = CATEGORIES.find(c => c.v === state.category);

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
        <button onClick={onBack} className="press" style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}>
          <Icon name="arrow_left" size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Confirm & submit</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 2 of 2</div>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <div style={{ width: 20, height: 3, borderRadius: 2, background: "var(--ink)" }} />
          <div style={{ width: 20, height: 3, borderRadius: 2, background: "var(--ink)" }} />
        </div>
      </div>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
        {/* Review card — photo + category */}
        <div style={{ display: "flex", gap: 12, padding: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)" }}>
          <div style={{ width: 72, height: 72, borderRadius: "var(--r-md)", overflow: "hidden", flexShrink: 0, background: "#3a3630" }}>
            <svg viewBox="0 0 72 72" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }}>
              <rect width="72" height="40" fill="#8fa8b0"/>
              <rect y="40" width="72" height="32" fill="#6b6558"/>
              <polygon points="8,44 64,44 58,72 14,72" fill="#4a4a42"/>
              <rect x="28" y="54" width="16" height="10" fill="#1a1a15"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Reporting</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              {activeCat && <Icon name={activeCat.icon} size={16} />}
              <Bi en={activeCat?.en || "—"} kn={activeCat?.kn} style={{ flexDirection: "row", gap: 6, alignItems: "baseline" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · Just now
            </div>
          </div>
          <button className="press" style={{ alignSelf: "flex-start", color: "var(--muted)", fontSize: 12, padding: 6 }}>
            <Icon name="edit" size={16} />
          </button>
        </div>

        {/* Location — mini strip */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <SectionLabel>Location · ಸ್ಥಳ</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-ink)" }}>
              <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />
              GPS confirmed
            </div>
          </div>
          <div className="map-tile" style={{ height: 120, borderRadius: "var(--r-md)", border: "1px solid var(--border)", position: "relative", overflow: "hidden" }}>
            {/* center pin */}
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)" }}>
              <svg width="32" height="40" viewBox="0 0 32 40">
                <path d="M16 0C7.2 0 0 7.2 0 16c0 10 16 24 16 24s16-14 16-24C32 7.2 24.8 0 16 0z" fill={accent} />
                <circle cx="16" cy="16" r="5" fill="#fff"/>
              </svg>
            </div>
            <button className="press" style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(255,255,255,0.95)", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: "var(--r-full)", fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="crosshair" size={12} /> Adjust
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            <span>12.9762° N, 77.5951° E</span>
            <span>±8m</span>
          </div>
          {/* GBA ward auto-detected from coords */}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", background: "var(--surface-2)", padding: "3px 6px", borderRadius: 4, flexShrink: 0 }}>GBA</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Ward 117 · Shivajinagar
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1, fontFamily: "var(--font-mono)" }}>
                Auto-detected · Zone East
              </div>
            </div>
            <Icon name="check_circle" size={16} style={{ color: "var(--accent-ink)", flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8 }}>
            Near MG Road, Shivajinagar
          </div>
        </div>

        {/* Severity */}
        <div style={{ marginTop: 24 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Severity · ತೀವ್ರತೆ</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {SEVERITY.map(s => {
              const active = state.severity === s.v;
              const colors = {
                low: { bg: "var(--accent-bg)", border: "var(--accent-border)", ink: "var(--accent-ink)" },
                medium: { bg: "var(--warn-bg)", border: "oklch(0.85 0.08 75)", ink: "oklch(0.4 0.14 75)" },
                high: { bg: "var(--danger-bg)", border: "oklch(0.85 0.08 30)", ink: "var(--danger)" },
              }[s.v];
              return (
                <button key={s.v} onClick={() => setSev(s.v)} className="press" style={{
                  padding: "12px 8px",
                  borderRadius: "var(--r-md)",
                  background: active ? colors.bg : "var(--surface)",
                  border: `1.5px solid ${active ? colors.border : "var(--border)"}`,
                  color: active ? colors.ink : "var(--ink-2)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  fontWeight: 500,
                }}>
                  <Bi en={s.en} kn={s.kn} style={{ fontSize: 13, fontWeight: 600, alignItems: "center" }} />
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            {SEVERITY.find(s => s.v === state.severity)?.hint}
          </div>
        </div>

        {/* Optional note */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <SectionLabel>Note · ಟಿಪ್ಪಣಿ</SectionLabel>
            <span style={{ fontSize: 10, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Optional</span>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 12, fontSize: 13, color: "var(--muted)", minHeight: 64 }}>
            Add context for the reviewer…
          </div>
        </div>

        <button className="press" style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 4px", fontSize: 13, color: "var(--muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="shield" size={16} />
            Add contact for follow-up (private)
          </span>
          <Icon name="chevron_right" size={16} />
        </button>
      </div>

      {/* Sticky submit */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, var(--bg) 60%, transparent)", padding: "16px 16px max(16px, env(safe-area-inset-bottom))" }}>
        <Btn variant="accent" size="xl" onClick={onSubmit} style={{ width: "100%" }}>
          <Icon name="send" size={18} />
          <Bi en="Submit report" kn="ವರದಿ ಸಲ್ಲಿಸಿ" style={{ alignItems: "center" }} />
        </Btn>
      </div>
    </div>
  );
};

/* ─── Success ─────────────────────────────────────────── */
const SuccessScreen = ({ onDone, accent }) => (
  <div className="screen" style={{ padding: "24px 20px", justifyContent: "space-between" }}>
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <button onClick={onDone} className="press" style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}>
        <Icon name="close" size={20} />
      </button>
    </div>

    <div style={{ textAlign: "left", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-bg)", display: "grid", placeItems: "center", marginBottom: 24 }}>
        <Icon name="check" size={32} style={{ color: "var(--accent-ink)" }} />
      </div>
      <SectionLabel style={{ marginBottom: 8 }}>Submitted</SectionLabel>
      <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
        Thank you.<br />It's on the map.
      </h1>
      <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.55, marginTop: 16, maxWidth: 320 }}>
        Your report is <strong style={{ color: "var(--ink-2)", fontWeight: 600 }}>public</strong> on the map immediately. This is a citizen-led project — reports build evidence pressure for the city to act.
      </p>

      {/* Report id card */}
      <div style={{ marginTop: 24, padding: 16, border: "1px solid var(--border)", borderRadius: "var(--r-lg)", background: "var(--surface)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <SectionLabel>Report ID</SectionLabel>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Save for reference</span>
        </div>
        <div className="mono" style={{ fontSize: 15, fontWeight: 500, marginTop: 6, color: "var(--ink)" }}>018F1A2B-3C4D</div>
        <div style={{ borderTop: "1px dashed var(--border)", marginTop: 12, paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
          <div>
            <div style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</div>
            <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />
              Submitted
            </div>
          </div>
          <div>
            <div style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Near</div>
            <div style={{ marginTop: 2 }}>MG Road</div>
          </div>
        </div>
        <div style={{ borderTop: "1px dashed var(--border)", marginTop: 12, paddingTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", background: "var(--surface-2)", padding: "3px 6px", borderRadius: 4 }}>GBA</span>
          <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 500 }}>Ward 117 · Shivajinagar</span>
          <span style={{ fontSize: 10, color: "var(--muted-2)", marginLeft: "auto" }}>Auto-routed</span>
        </div>
      </div>
    </div>

    <div style={{ display: "flex", gap: 10 }}>
      <Btn variant="secondary" size="lg" style={{ flex: 1 }}>
        <Icon name="share" size={16} /> Share
      </Btn>
      <Btn variant="primary" size="lg" onClick={onDone} style={{ flex: 2 }}>
        <Bi en="Report another" kn="ಇನ್ನೊಂದು" style={{ alignItems: "center" }} />
      </Btn>
    </div>
  </div>
);

/* ─── Public map view ──────────────────────────────────── */
const MapScreen = ({ onBack, onReport, accent }) => {
  const [filter, setFilter] = React.useState("all");
  return (
    <div className="screen">
      <div style={{ position: "absolute", inset: 0 }} className="map-tile">
        {/* Dense cluster of pins */}
        {Array.from({ length: 42 }).map((_, i) => {
          const x = (i * 37) % 95 + 2;
          const y = (i * 23 + 11) % 85 + 7;
          const size = i % 5 === 0 ? 14 : 10;
          const kind = i % 3;
          const colors = [accent, "var(--warn)", "var(--danger)"];
          return (
            <div key={i} style={{
              position: "absolute", left: `${x}%`, top: `${y}%`,
              width: size, height: size, borderRadius: "50%",
              background: colors[kind],
              boxShadow: "0 0 0 2.5px rgba(255,255,255,0.85), 0 2px 6px rgba(0,0,0,0.2)",
              cursor: "pointer",
            }} />
          );
        })}

        {/* Roads hint */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.3 }}>
          <path d="M 0 200 Q 200 180 400 220" stroke="#78716c" strokeWidth="3" fill="none" />
          <path d="M 180 0 Q 200 300 240 600" stroke="#78716c" strokeWidth="3" fill="none" />
          <path d="M 50 400 Q 200 420 350 380" stroke="#a8a29e" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* Top bar */}
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 8, zIndex: 10 }}>
        <button onClick={onBack} className="press" style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.95)", border: "1px solid var(--border)", display: "grid", placeItems: "center", backdropFilter: "blur(8px)" }}>
          <Icon name="arrow_left" size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.95)", border: "1px solid var(--border)", borderRadius: "var(--r-full)", padding: "0 14px", display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)", overflow: "hidden" }}>
          <Icon name="pin" size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Bengaluru · <span className="mono" style={{ fontSize: 11 }}>412 reports</span></div>
        </div>
        <button className="press" style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.95)", border: "1px solid var(--border)", display: "grid", placeItems: "center", backdropFilter: "blur(8px)" }}>
          <Icon name="filter" size={18} />
        </button>
      </div>

      {/* Filter chips */}
      <div className="no-scrollbar" style={{ position: "absolute", top: 68, left: 0, right: 0, overflowX: "auto", display: "flex", gap: 6, padding: "0 12px", zIndex: 10 }}>
        {[
          { v: "all", label: "All · 412" },
          { v: "broken", label: "Damaged · 118" },
          { v: "blocked", label: "Blocked · 89" },
          { v: "no_path", label: "No path · 73" },
          { v: "crossing", label: "Crossing · 67" },
          { v: "lighting", label: "Lighting · 45" },
        ].map(f => {
          const active = filter === f.v;
          return (
            <button key={f.v} onClick={() => setFilter(f.v)} className="press" style={{
              padding: "7px 14px",
              borderRadius: "var(--r-full)",
              background: active ? "var(--ink)" : "rgba(255,255,255,0.95)",
              color: active ? "#fafaf9" : "var(--ink-2)",
              border: `1px solid ${active ? "var(--ink)" : "var(--border)"}`,
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: "nowrap",
              backdropFilter: "blur(8px)",
              flexShrink: 0,
            }}>{f.label}</button>
          );
        })}
      </div>

      {/* Bottom sheet — selected report */}
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 80, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 14, boxShadow: "var(--shadow-lg)", zIndex: 9 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: "var(--r-md)", overflow: "hidden", flexShrink: 0 }}>
            <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }}>
              <rect width="56" height="30" fill="#8fa8b0"/>
              <rect y="30" width="56" height="26" fill="#6b6558"/>
              <polygon points="6,34 50,34 44,56 12,56" fill="#4a4a42"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Icon name="cat_broken" size={14} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>Damaged footpath</span>
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: "var(--r-full)", background: "var(--warn-bg)", color: "oklch(0.4 0.14 75)", fontWeight: 500, whiteSpace: "nowrap" }}>Under review</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>MG Road · Reported 2 days ago</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted-2)", marginTop: 3, whiteSpace: "nowrap" }}>12.976, 77.595</div>
          </div>
          <button className="press" style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center" }}>
            <Icon name="chevron_right" size={18} />
          </button>
        </div>
      </div>

      {/* Floating report CTA */}
      <button onClick={onReport} className="press" style={{
        position: "absolute", right: 16, bottom: 16,
        background: accent, color: "#fff",
        padding: "14px 18px", borderRadius: "var(--r-full)",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 14, fontWeight: 600,
        boxShadow: "var(--shadow-lg)",
        zIndex: 10,
        whiteSpace: "nowrap",
      }}>
        <Icon name="camera" size={18} />
        Report here
      </button>
    </div>
  );
};

Object.assign(window, { ConfirmScreen, SuccessScreen, MapScreen });
