/* Report flow screens — one-tap style: photo + category on Screen 1, location+details on Screen 2 */

const CATEGORIES = [
  { v: "no_footpath", en: "No path", kn: "ಕಾಲ್ದಾರಿ ಇಲ್ಲ", icon: "cat_no_path" },
  { v: "broken_footpath", en: "Damaged", kn: "ಹಾಳಾದ", icon: "cat_broken" },
  { v: "blocked_footpath", en: "Blocked", kn: "ಮುಚ್ಚಿದ", icon: "cat_blocked" },
  { v: "unsafe_crossing", en: "Crossing", kn: "ಕ್ರಾಸಿಂಗ್", icon: "cat_crossing" },
  { v: "poor_lighting", en: "Lighting", kn: "ಬೆಳಕು", icon: "cat_lighting" },
  { v: "other", en: "Other", kn: "ಇತರ", icon: "cat_other" },
];

const SEVERITY = [
  { v: "low", en: "Minor", kn: "ಸಣ್ಣ", hint: "Inconvenient but passable" },
  { v: "medium", en: "Moderate", kn: "ಮಧ್ಯಮ", hint: "Risky for some pedestrians" },
  { v: "high", en: "Urgent", kn: "ತುರ್ತು", hint: "Immediate danger" },
];

/* ─── Screen: Home ─────────────────────────────────────── */
const HomeScreen = ({ onReport, onMap, accent }) => (
  <div className="screen">
    <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--ink)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name="pin" size={16} style={{ color: "#fafaf9" }} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>Namma <span className="kn" style={{ fontWeight: 600 }}>ದಾರಿ</span></div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted-2)", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Walkable BLR</div>
        </div>
      </div>
      <button className="press" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
        <Icon name="globe" size={14} /> EN · ಕ
      </button>
    </div>

    <div style={{ flex: 1, padding: "32px 20px 16px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <SectionLabel style={{ marginBottom: 12 }}>Citizen Audit · ನಾಗರಿಕ</SectionLabel>
      <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.02, margin: 0, color: "var(--ink)" }}>
        Fix the<br />footpath.
      </h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.5, marginTop: 14, marginBottom: 0, maxWidth: 320 }}>
        Spot a broken, blocked, or missing footpath? Snap it — it goes straight to the public map.
      </p>
    </div>

    {/* Map preview */}
    <div style={{ padding: "0 20px" }}>
      <div className="map-tile" style={{ height: 180, borderRadius: "var(--r-lg)", position: "relative", overflow: "hidden", border: "1px solid var(--border)" }}>
        {/* Scatter of report dots */}
        {[
          [22, 30], [34, 45], [45, 28], [58, 55], [70, 38], [30, 68], [65, 72], [48, 82], [78, 62], [18, 55]
        ].map(([x, y], i) => (
          <div key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`,
            width: 10, height: 10, borderRadius: "50%",
            background: i % 3 === 0 ? "var(--danger)" : i % 3 === 1 ? "var(--warn)" : accent,
            boxShadow: "0 0 0 3px rgba(255,255,255,0.7)",
          }} />
        ))}
        <div style={{ position: "absolute", left: 12, bottom: 12, display: "flex", gap: 6 }}>
          <Pill tone="glass"><span className="mono">412</span> reports</Pill>
        </div>
        <button onClick={onMap} className="press" style={{
          position: "absolute", right: 12, bottom: 12,
          background: "rgba(255,255,255,0.95)", border: "1px solid var(--border)",
          padding: "8px 12px", borderRadius: "var(--r-full)", fontSize: 12, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
        }}>
          Open map <Icon name="arrow_right" size={14} />
        </button>
      </div>
    </div>

    {/* Primary CTA */}
    <div style={{ padding: "20px", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      <Btn variant="accent" size="xl" onClick={onReport} style={{ width: "100%" }}>
        <Icon name="camera" size={22} />
        <Bi en="Report an issue" kn="ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ" style={{ alignItems: "center" }} />
      </Btn>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 12, fontSize: 11, color: "var(--muted-2)" }}>
        <span style={{ whiteSpace: "nowrap" }}>No login</span><span>·</span><span style={{ whiteSpace: "nowrap" }}>Takes 20 seconds</span><span>·</span><span style={{ whiteSpace: "nowrap" }}>Anonymous</span>
      </div>
    </div>
  </div>
);

/* ─── Screen 1: Capture (camera viewfinder + category chips) ─────── */
const CaptureScreen = ({ onBack, onNext, state, setState, accent }) => {
  const pick = (v) => setState(s => ({ ...s, category: v }));
  const canNext = state.photo && state.category;

  return (
    <div className="screen" style={{ background: "#0a0a0a", color: "#fafaf9" }}>
      {/* Top bar — translucent over viewfinder */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "16px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} className="press" style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center" }}>
          <Icon name="close" size={20} />
        </button>
        <div style={{ fontSize: 11, color: "rgba(250,250,249,0.7)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Step 1 · Capture</div>
        <button className="press" style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center" }}>
          <Icon name="flash" size={18} />
        </button>
      </div>

      {/* Viewfinder / preview */}
      <div style={{ position: "absolute", inset: 0 }}>
        {state.photo ? (
          <div style={{
            width: "100%", height: "100%",
            background: "linear-gradient(135deg, #3a4a3a 0%, #5a6a5a 50%, #8a7a6a 100%)",
            position: "relative",
          }}>
            {/* Simulated footpath photo */}
            <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.8 }}>
              <defs>
                <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fa8b0"/><stop offset="1" stopColor="#c9bfa8"/></linearGradient>
                <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6b6558"/><stop offset="1" stopColor="#3a3630"/></linearGradient>
              </defs>
              <rect x="0" y="0" width="400" height="450" fill="url(#sky)"/>
              <rect x="0" y="450" width="400" height="350" fill="url(#ground)"/>
              <polygon points="0,500 400,500 350,800 50,800" fill="#4a4a42" opacity="0.8"/>
              <polygon points="80,560 320,560 280,800 120,800" fill="#2a2a22"/>
              <rect x="160" y="600" width="80" height="50" fill="#1a1a15" opacity="0.9"/>
              <rect x="140" y="650" width="120" height="60" fill="#0a0a08" opacity="0.85"/>
            </svg>
          </div>
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#0a0a0a", display: "grid", placeItems: "center", position: "relative" }}>
            {/* Framing guides */}
            <svg viewBox="0 0 200 200" style={{ width: "70%", opacity: 0.25 }}>
              <path d="M20 20 L20 50 M20 20 L50 20 M180 20 L150 20 M180 20 L180 50 M20 180 L50 180 M20 180 L20 150 M180 180 L150 180 M180 180 L180 150" stroke="#fafaf9" strokeWidth="2" fill="none"/>
            </svg>
            <div style={{ position: "absolute", textAlign: "center" }}>
              <Icon name="camera" size={48} style={{ color: "rgba(250,250,249,0.3)", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 13, color: "rgba(250,250,249,0.5)" }}>Point at the issue</div>
            </div>
          </div>
        )}
      </div>

      {/* GPS pill — top-left under bar */}
      {state.photo && (
        <div style={{ position: "absolute", top: 68, left: 16, zIndex: 9, display: "flex", gap: 6 }}>
          <Pill tone="glass" style={{ padding: "5px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>
            <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
            <span className="mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>12.976, 77.595</span>
          </Pill>
        </div>
      )}

      {/* Bottom stack */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 60%, transparent 100%)", paddingTop: 24, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        {state.photo && (
          <>
            {/* Category prompt */}
            <div style={{ padding: "0 16px 10px" }}>
              <div style={{ fontSize: 11, color: "rgba(250,250,249,0.6)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                What's the issue?
              </div>
              {/* 2×3 grid of category chips */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {CATEGORIES.map(c => {
                  const active = state.category === c.v;
                  return (
                    <button key={c.v} onClick={() => pick(c.v)} className="press" style={{
                      background: active ? "#fafaf9" : "rgba(255,255,255,0.08)",
                      color: active ? "var(--ink)" : "#fafaf9",
                      border: active ? "1.5px solid #fafaf9" : "1.5px solid rgba(255,255,255,0.15)",
                      borderRadius: "var(--r-md)",
                      padding: "12px 8px",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      backdropFilter: "blur(8px)",
                      minHeight: 76,
                    }}>
                      <Icon name={c.icon} size={22} />
                      <Bi en={c.en} kn={c.kn} style={{ fontSize: 11, fontWeight: 600, alignItems: "center", textAlign: "center", lineHeight: 1.1 }} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary action */}
            <div style={{ padding: "12px 16px 0" }}>
              <Btn variant="accent" size="xl" onClick={onNext} disabled={!canNext} style={{
                width: "100%",
                opacity: canNext ? 1 : 0.4,
              }}>
                <Bi en="Continue" kn="ಮುಂದುವರಿಸಿ" style={{ alignItems: "center" }} />
                <Icon name="arrow_right" size={20} />
              </Btn>
            </div>
          </>
        )}

        {!state.photo && (
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Shutter */}
            <button onClick={() => setState(s => ({ ...s, photo: true }))} className="press" style={{
              width: 84, height: 84, borderRadius: "50%",
              background: "transparent", border: "4px solid #fafaf9",
              display: "grid", placeItems: "center", marginBottom: 20,
            }}>
              <div style={{ width: 66, height: 66, borderRadius: "50%", background: "#fafaf9" }} />
            </button>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <button className="press" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "rgba(250,250,249,0.8)" }}>
                <Icon name="image" size={22} />
                <span style={{ fontSize: 10 }}>Gallery</span>
              </button>
              <button className="press" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "rgba(250,250,249,0.8)" }}>
                <Icon name="flip" size={22} />
                <span style={{ fontSize: 10 }}>Flip</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { HomeScreen, CaptureScreen, CATEGORIES, SEVERITY });
