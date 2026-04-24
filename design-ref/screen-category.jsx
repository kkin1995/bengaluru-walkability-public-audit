/* Category selection screen — replaces the old viewfinder.
   The web app hands off to the system camera; this screen is just the 6-chip picker
   shown AFTER the user returns from the camera with a photo. */

const CategoryScreen = ({ onBack, onNext, state, setState, accent }) => {
  const pick = (v) => setState(s => ({ ...s, category: v }));
  const canNext = !!state.category;
  const activeCat = CATEGORIES.find(c => c.v === state.category);

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
        <button onClick={onBack} className="press" style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}>
          <Icon name="arrow_left" size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Pick a category</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 1 of 2</div>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <div style={{ width: 20, height: 3, borderRadius: 2, background: "var(--ink)" }} />
          <div style={{ width: 20, height: 3, borderRadius: 2, background: "var(--border-strong)" }} />
        </div>
      </div>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
        {/* Photo thumbnail + GPS pill */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)" }}>
          <div style={{ width: 56, height: 56, borderRadius: "var(--r-md)", overflow: "hidden", flexShrink: 0, background: "#3a3630" }}>
            <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }}>
              <rect width="56" height="30" fill="#8fa8b0"/>
              <rect y="30" width="56" height="26" fill="#6b6558"/>
              <polygon points="6,34 50,34 44,56 12,56" fill="#4a4a42"/>
              <rect x="22" y="40" width="12" height="8" fill="#1a1a15"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Photo ready</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>GPS found</span>
              <span className="mono" style={{ color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>12.976, 77.595</span>
            </div>
          </div>
          <button className="press" style={{ color: "var(--muted)", fontSize: 11, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", whiteSpace: "nowrap" }}>
            Retake
          </button>
        </div>

        {/* Question */}
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.2 }}>
            What's the issue?
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
            <span className="kn">ಏನು ಸಮಸ್ಯೆ?</span>
          </p>
        </div>

        {/* 2×3 chip grid */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {CATEGORIES.map(c => {
            const active = state.category === c.v;
            return (
              <button key={c.v} onClick={() => pick(c.v)} className="press" style={{
                background: active ? "var(--ink)" : "var(--surface)",
                color: active ? "#fafaf9" : "var(--ink)",
                border: active ? "1.5px solid var(--ink)" : "1.5px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "18px 14px",
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10,
                minHeight: 108,
                textAlign: "left",
                position: "relative",
              }}>
                <Icon name={c.icon} size={26} />
                <Bi en={c.en} kn={c.kn} style={{ fontSize: 14, fontWeight: 600, alignItems: "flex-start" }} />
                {active && (
                  <div style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: "50%", background: "#fafaf9", color: "var(--ink)", display: "grid", placeItems: "center" }}>
                    <Icon name="check" size={14} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
          <Icon name="shield" size={14} style={{ flexShrink: 0 }} />
          <span>Photos are stripped of private metadata before upload</span>
        </div>
      </div>

      {/* Sticky next */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, var(--bg) 60%, transparent)", padding: "16px 16px max(16px, env(safe-area-inset-bottom))" }}>
        <Btn variant="accent" size="xl" onClick={onNext} disabled={!canNext} style={{ width: "100%", opacity: canNext ? 1 : 0.4 }}>
          <Bi en={canNext ? "Continue" : "Pick a category"} kn={canNext ? "ಮುಂದುವರಿಸಿ" : "ವರ್ಗ ಆಯ್ಕೆ ಮಾಡಿ"} style={{ alignItems: "center" }} />
          {canNext && <Icon name="arrow_right" size={20} />}
        </Btn>
      </div>
    </div>
  );
};

Object.assign(window, { CategoryScreen });
