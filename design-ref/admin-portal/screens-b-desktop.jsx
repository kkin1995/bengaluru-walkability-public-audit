/* Direction B — Walkability Console · Desktop screens */
/* eslint-disable react/prop-types */

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Dashboard / OPS
// ──────────────────────────────────────────────────────────────────────
function DesktopDashboardB() {
  const s = window.SAMPLE_STATS;
  const reports = window.SAMPLE_REPORTS.slice(0, 4);
  return (
    <div className="dir-b" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <B.SidebarB active="dashboard"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <B.DesktopTopBarB
          title="ops"
          breadcrumb={["GBA", "ALL WARDS", "LIVE"]}
          actions={
            <>
              <span style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent-ink)" }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} className="pulse-dot"/>
                LIVE · 14:38:02
              </span>
              <Btn variant="secondary" size="sm" icon="download" style={{ fontFamily: "var(--font-mono)" }}>EXPORT</Btn>
              <Btn variant="accent" size="sm" icon="inbox" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>BEGIN_TRIAGE</Btn>
            </>
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Big metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 10 }}>
            {/* Hero metric */}
            <div style={{ background: "var(--ink)", color: "var(--bg)", borderRadius: 8, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--bg)", opacity: 0.6, letterSpacing: "0.08em" }}>OPEN_REPORTS · TRIAGE_QUEUE</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.06em", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--accent)" }} className="pulse-dot"/>
                  LIVE
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 84, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 0.9 }}>218</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>+12 SINCE 06:00</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6 }}>3 HIGH_SEVERITY</span>
                </div>
              </div>
              <Sparkbars values={s.trend} color="var(--accent)" height={48} width={400} gap={3}/>
            </div>

            {[
              { label: "UNDER_REVIEW",    value: s.by_status.under_review, sub: "MED " + s.median_resolution_hours + "h TO CLOSE", color: "var(--status-review)" },
              { label: "RESOLVED_WEEK",   value: s.resolved_this_week, sub: "+18% W-OVER-W", color: "var(--status-resolved)" },
              { label: "LIFETIME_TOTAL",  value: s.total_reports.toLocaleString(), sub: "SINCE 2026-03-04", color: "var(--ink-2)" },
            ].map((c, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionLabel>{c.label}</SectionLabel>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", color: c.color, lineHeight: 1 }}>{c.value}</span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>{c.sub}</span>
              </div>
            ))}
          </div>

          {/* Trend strip */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <SectionLabel>INTAKE · 14_DAY_TIMESERIES</SectionLabel>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600 }}>260</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-ink)" }}>+12% Δ</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <span style={{ padding: "4px 10px", borderRadius: 4, background: "var(--ink)", color: "var(--bg)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em" }}>14D</span>
                <span style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-2)" }}>30D</span>
                <span style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-2)" }}>QTD</span>
              </div>
            </div>
            <Sparkbars values={s.trend} color="var(--accent)" height={86} width={1180} gap={4}/>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", marginTop: -4, fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--muted)", letterSpacing: "0.04em" }}>
              {["06","07","08","09","10","11","12","13","14","15","16","17","18","19"].map(d => <span key={d}>{d}</span>)}
            </div>
          </div>

          {/* Two columns: severity bar + activity tail */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 10, flex: 1, minHeight: 0 }}>
            {/* Severity & category */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <SectionLabel style={{ marginBottom: 8 }}>SEVERITY_DIST · OPEN_ONLY</SectionLabel>
                <div style={{ display: "flex", height: 12, borderRadius: 2, overflow: "hidden", border: "1px solid var(--border-strong)" }}>
                  <div style={{ width: "13%", background: "var(--sev-low)" }}/>
                  <div style={{ width: "55%", background: "var(--sev-medium)" }}/>
                  <div style={{ width: "32%", background: "var(--sev-high)" }}/>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ color: "var(--sev-low)" }}>LOW</span><span>37 · 13%</span></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ color: "var(--sev-medium)" }}>MED</span><span>156 · 55%</span></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ color: "var(--sev-high)" }}>HIGH</span><span>89 · 32%</span></div>
                </div>
              </div>
              <div>
                <SectionLabel style={{ marginBottom: 10 }}>CATEGORY_DIST</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(s.by_category).map(([k, v]) => {
                    const pct = (v / s.total_reports) * 100;
                    return (
                      <div key={k} style={{ display: "grid", gridTemplateColumns: "180px 1fr 60px", gap: 8, alignItems: "center" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{k.replace("_", "_")}</span>
                        <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 1, overflow: "hidden", border: "1px solid var(--border)" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)" }}/>
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right", color: "var(--muted)" }}>{v} · {pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Activity tail */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--font-mono)", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <SectionLabel>ACTIVITY · TAIL -f</SectionLabel>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>STREAMING · TICK 5s</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", fontSize: 11, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  ["14:35:18", "NEW",    "var(--status-submitted)", "WLK-7AC30 · broken_footpath · Shivajinagar · sev=med"],
                  ["14:23:04", "NEW",    "var(--status-submitted)", "WLK-7AC2F · broken_footpath · Shivajinagar · sev=high · DUP-HIGH-LINKED"],
                  ["13:51:52", "NEW",    "var(--status-submitted)", "WLK-7AC2E · unsafe_crossing · Domlur · sev=high"],
                  ["11:08:30", "NEW",    "var(--status-submitted)", "WLK-7AC2D · blocked_footpath · Shivajinagar · sev=med"],
                  ["10:48:00", "LOGIN",  "var(--info)",             "priya.m@trafficpolice.gov.in · IP 203.0.113.42"],
                  ["10:14:12", "REVIEW", "var(--status-review)",    "WLK-7AC2C · by ravi.k@gba.gov.in"],
                  ["09:42:08", "REVIEW", "var(--status-review)",    "WLK-7AC2B · by anita.s@bbmp.gov.in"],
                  ["09:14:31", "AUTO",   "var(--muted)",            "dup detection cycle complete · 24 newly linked · t=841ms"],
                  ["08:30:00", "RESOLVE","var(--status-resolved)",  "WLK-7AC1F · by meera.h@gba.gov.in · note='cleared after notice'"],
                ].map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "76px 70px 1fr", gap: 10, padding: "6px 0", borderTop: i === 0 ? "none" : "1px dashed var(--border)" }}>
                    <span style={{ color: "var(--muted)" }}>{row[0]}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: row[2], fontWeight: 600 }}>
                      <span style={{ width: 5, height: 5, borderRadius: 999, background: row[2] }}/>
                      {row[1]}
                    </span>
                    <span>{row[3]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Reports table
// ──────────────────────────────────────────────────────────────────────
function DesktopReportsTableB() {
  const reports = window.SAMPLE_REPORTS;
  return (
    <div className="dir-b" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <B.SidebarB active="reports"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <B.DesktopTopBarB
          title="queue"
          breadcrumb={["GBA", "ALL WARDS", "INBOX"]}
          actions={
            <>
              <Btn variant="ghost" size="sm" icon="map" style={{ fontFamily: "var(--font-mono)" }}>MAP</Btn>
              <Btn variant="secondary" size="sm" icon="download" style={{ fontFamily: "var(--font-mono)" }}>CSV</Btn>
            </>
          }
          filters={
            <>
              <Input icon="search" placeholder="grep description · id · ward · submitter…" style={{ flex: 1, minWidth: 280, height: 32, borderRadius: 4 }} inputStyle={{ fontFamily: "var(--font-mono)" }}/>
              <Select value="STATUS: ALL" icon="filter" style={{ fontFamily: "var(--font-mono)", borderRadius: 4 }}/>
              <Select value="CAT: ALL" style={{ fontFamily: "var(--font-mono)", borderRadius: 4 }}/>
              <Select value="SEV: ALL" style={{ fontFamily: "var(--font-mono)", borderRadius: 4 }}/>
              <Select value="LAST 30D" icon="clock" style={{ fontFamily: "var(--font-mono)", borderRadius: 4 }}/>
              <Select value="WARDS: ALL" icon="pin" style={{ fontFamily: "var(--font-mono)", borderRadius: 4 }}/>
            </>
          }
        />

        <div style={{ padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { label: "ALL", v: 1247, on: true },
              { label: "SUBMITTED", v: 218, dot: "var(--status-submitted)" },
              { label: "REVIEW", v: 64, dot: "var(--status-review)" },
              { label: "RESOLVED", v: 965, dot: "var(--status-resolved)" },
            ].map((p, i) => (
              <span key={i} style={{ padding: "4px 10px", borderRadius: 4, background: p.on ? "var(--ink)" : "transparent", color: p.on ? "var(--bg)" : "var(--ink-2)", border: p.on ? "1px solid var(--ink)" : "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 5 }}>
                {p.dot && <span style={{ width: 5, height: 5, borderRadius: 999, background: p.dot }}/>}
                {p.label} · {p.v}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
            <span>1–7 / 218</span>
            <Btn variant="ghost" size="xs" icon="chevron_left"/>
            <Btn variant="secondary" size="xs" style={{ fontFamily: "var(--font-mono)" }}>1</Btn>
            <Btn variant="ghost" size="xs" style={{ fontFamily: "var(--font-mono)" }}>2</Btn>
            <Btn variant="ghost" size="xs" style={{ fontFamily: "var(--font-mono)" }}>3</Btn>
            <Btn variant="ghost" size="xs" icon="chevron_right"/>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", background: "var(--surface)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)" }}>
                {[
                  { label: "ID", w: 110 },
                  { label: "TIME", w: 80 },
                  { label: "CATEGORY · DESC" },
                  { label: "WARD", w: 130 },
                  { label: "SEV", w: 90 },
                  { label: "STATUS", w: 110 },
                  { label: "DUP", w: 80 },
                  { label: "", w: 80 },
                ].map((h, i) => (
                  <th key={i} style={{ padding: "8px 14px", fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, width: h.w }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <React.Fragment key={r.id}>
                  <tr style={{ borderBottom: "1px solid var(--border)" }} className="press">
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PhotoTile photo={r.photo} size={28} radius={3}/>
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{r.id}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--muted)" }}>{r.relative.replace(" ago", "")}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "var(--font-sans)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 500 }}>{window.CATEGORIES[r.category].en}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11 }}>{r.ward_name}</td>
                    <td style={{ padding: "10px 14px" }}><SeverityIndicator severity={r.severity} style="bars"/></td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 11, color: r.status === "submitted" ? "var(--status-submitted)" : r.status === "under_review" ? "var(--status-review)" : "var(--status-resolved)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }}/>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {r.duplicate_count > 0
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--warn-ink)", fontWeight: 600 }}><Icon name="duplicate" size={11}/>+{r.duplicate_count}</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 2 }}>
                        <Btn variant="ghost" size="xs" icon="eye"/>
                        <Btn variant="ghost" size="xs" icon="dots"/>
                      </div>
                    </td>
                  </tr>
                  {r.id === "WLK-7AC2F" && (
                    <tr style={{ background: "var(--warn-bg)", borderBottom: "1px solid var(--warn-border)" }}>
                      <td colSpan={8} style={{ padding: "10px 14px 12px 38px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                          <Icon name="duplicate" size={14} style={{ color: "var(--warn-ink)" }}/>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--warn-ink)", letterSpacing: "0.04em", textTransform: "uppercase" }}>DUP_GROUP · {window.SAMPLE_DUPLICATES.length} LINKED · CONF=HIGH</span>
                          <span style={{ fontSize: 10, color: "var(--warn-ink)", opacity: 0.7 }}>radius=14m · auto-linked t-2h</span>
                          <Btn variant="ghost" size="xs" iconRight="chevron_down" style={{ marginLeft: "auto", color: "var(--warn-ink)", fontFamily: "var(--font-mono)" }}>COLLAPSE</Btn>
                        </div>
                        <div style={{ background: "var(--surface)", padding: 4, borderRadius: 4, border: "1px solid var(--warn-border)" }}>
                          {window.SAMPLE_DUPLICATES.map(d => (
                            <div key={d.id} style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 90px 70px 110px 80px", gap: 12, alignItems: "center", fontSize: 11, padding: "6px 10px", borderBottom: "1px dashed var(--border)" }}>
                              <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{d.id}</span>
                              <span style={{ color: "var(--ink-2)", fontFamily: "var(--font-sans)" }}>{window.CATEGORIES[d.category].en}</span>
                              <span style={{ color: "var(--muted)", textTransform: "uppercase" }}>{d.ward_name}</span>
                              <span style={{ color: "var(--muted)" }}>{d.relative}</span>
                              <span style={{ color: "var(--muted)" }}>Δ={d.distance_m}m</span>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: "var(--status-submitted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--status-submitted)" }}/>
                                {d.status.replace("_", " ")}
                              </span>
                              <SeverityIndicator severity={d.severity} style="bars"/>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Report detail
// ──────────────────────────────────────────────────────────────────────
function DesktopReportDetailB() {
  const r = window.SAMPLE_REPORTS[0];
  const timeline = window.SAMPLE_TIMELINE;
  return (
    <div className="dir-b" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <B.SidebarB active="reports"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <B.DesktopTopBarB
          title={r.id.toLowerCase()}
          breadcrumb={["QUEUE", "INBOX", r.id]}
          actions={
            <>
              <Btn variant="ghost" size="sm" icon="external" style={{ fontFamily: "var(--font-mono)" }}>VIEW_PUBLIC</Btn>
              <Btn variant="danger-soft" size="sm" icon="trash" style={{ fontFamily: "var(--font-mono)" }}>DELETE</Btn>
              <Btn variant="accent" size="sm" icon="check" style={{ fontFamily: "var(--font-mono)" }}>RESOLVE</Btn>
            </>
          }
        />

        <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "1.3fr 1fr" }}>
          {/* Photo panel */}
          <div style={{ background: "var(--surface-2)", display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
            <div className={r.photo} style={{ flex: 1, position: "relative" }}>
              <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 6 }}>
                <span style={{ padding: "4px 8px", background: "rgba(10,10,10,0.85)", color: "#fafaf9", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", borderRadius: 4 }}>PHOTO 1 / 1</span>
                <span style={{ padding: "4px 8px", background: "rgba(10,10,10,0.85)", color: "#fafaf9", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", borderRadius: 4 }}>EXIF · GPS_CONFIRMED</span>
              </div>
              <div style={{ position: "absolute", bottom: 14, left: 14, right: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="press" style={{ width: 32, height: 32, borderRadius: 4, background: "rgba(255,255,255,0.95)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="zoom_in" size={14}/></button>
                  <button className="press" style={{ width: 32, height: 32, borderRadius: 4, background: "rgba(255,255,255,0.95)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="download" size={14}/></button>
                </div>
                <span style={{ padding: "4px 8px", background: "rgba(255,255,255,0.95)", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", borderRadius: 4 }}>SHA: 8f4a…2c9b</span>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", padding: 22, gap: 14 }}>
            {/* Header */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{r.id}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--status-submitted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--status-submitted)" }}/>
                  {r.status.replace("_", " ")}
                </span>
                <SeverityIndicator severity={r.severity} style="bars"/>
                {r.duplicate_count > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 4, background: "var(--warn-bg)", border: "1px solid var(--warn-border)", color: "var(--warn-ink)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}>
                    <Icon name="duplicate" size={10}/>DUP +{r.duplicate_count}
                  </span>
                )}
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{window.CATEGORIES[r.category].en}</h1>
            </div>

            {/* Telemetry */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", background: "var(--surface)" }}>
              {[
                ["LAT_LNG",       "12.985400, 77.606500"],
                ["WARD",          "Shivajinagar · BBMP East"],
                ["LOCATION_SRC",  r.location_source.toUpperCase()],
                ["SUBMITTED_AT",  "2026-05-19 14:23:00 IST"],
                ["EXIF_PIN_DIFF", "0m (exif and pin agree)"],
                ["DUP_CONF",      r.duplicate_confidence.toUpperCase() + " · radius=14m"],
                ["PHOTO_HASH",    "sha256:8f4a3c9b…2c9b"],
                ["UUID",          r.uuid],
              ].map(([k, v], i) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "130px 1fr", padding: "6px 12px", borderTop: i === 0 ? "none" : "1px dashed var(--border)" }}>
                  <span style={{ color: "var(--muted)", letterSpacing: "0.04em" }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>

            {/* Status action */}
            <div style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: 6, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <SectionLabel style={{ color: "var(--accent-ink)" }}>NEXT_STEP</SectionLabel>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-ink)", fontWeight: 600, marginTop: 4, display: "block" }}>submitted → under_review</span>
              </div>
              <Btn variant="accent" size="sm" icon="check" style={{ fontFamily: "var(--font-mono)" }}>MOVE</Btn>
            </div>

            {/* Description */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 14, background: "var(--surface)" }}>
              <SectionLabel style={{ marginBottom: 6 }}>CITIZEN_DESCRIPTION</SectionLabel>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{r.description}</p>
              {r.kn_description && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-kn)", lineHeight: 1.7 }}>{r.kn_description}</p>}
            </div>

            {/* Map */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <div className="map-tile" style={{ height: 140, position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MapPin status={r.status} size={18}/>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 14, background: "var(--surface)" }}>
              <SectionLabel style={{ marginBottom: 10 }}>STATUS_HISTORY · TAIL</SectionLabel>
              {timeline.map((t, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 10, padding: "6px 0", borderTop: i === 0 ? "none" : "1px dashed var(--border)" }}>
                  <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: 2, background: t.status === "submitted" ? "var(--status-submitted)" : t.status === "under_review" ? "var(--status-review)" : "var(--status-resolved)" }}/>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.status.replace("_", " ")}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{t.at}</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>BY · {t.who}</span>
                    {t.note && <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45 }}>{t.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Users
// ──────────────────────────────────────────────────────────────────────
function DesktopUsersB({ withModal = false } = {}) {
  const users = window.SAMPLE_USERS;
  return (
    <div className="dir-b" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden", position: "relative" }}>
      <B.SidebarB active="users"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <B.DesktopTopBarB
          title="users"
          breadcrumb={["GBA", "ADMIN_USERS"]}
          actions={
            <>
              <Input icon="search" placeholder="grep email · name · org" style={{ width: 260, height: 32, borderRadius: 4 }} inputStyle={{ fontFamily: "var(--font-mono)" }}/>
              <Btn variant="accent" size="sm" icon="plus" style={{ fontFamily: "var(--font-mono)" }}>INVITE</Btn>
            </>
          }
        />

        <div style={{ padding: "10px 24px", display: "flex", gap: 6, borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          {[
            { label: "ALL", v: users.length, on: true },
            { label: "ADMIN", v: users.filter(u => u.role === "admin").length },
            { label: "REVIEWER", v: users.filter(u => u.role === "reviewer").length },
            { label: "DEACTIVATED", v: users.filter(u => !u.is_active).length },
          ].map((p, i) => (
            <span key={i} style={{ padding: "4px 10px", borderRadius: 4, background: p.on ? "var(--ink)" : "transparent", color: p.on ? "var(--bg)" : "var(--ink-2)", border: p.on ? "1px solid var(--ink)" : "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>{p.label} · {p.v}</span>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", background: "var(--surface)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)" }}>
                {["USER", "ROLE", "ORG", "STATUS", "LAST_LOGIN", ""].map((h, i) => (
                  <th key={i} style={{ padding: "8px 14px", fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.email} style={{ borderBottom: "1px solid var(--border)", opacity: u.is_active ? 1 : 0.55 }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={u.name} tone={u.is_super_admin ? "ink" : "neutral"} size={32}/>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 600, fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {u.name}
                          {u.is_super_admin && <span style={{ padding: "1px 6px", borderRadius: 4, background: "var(--accent-bg)", color: "var(--accent-ink)", border: "1px solid var(--accent-border)", fontSize: 9, letterSpacing: "0.06em" }}>SUPER</span>}
                        </span>
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, background: u.role === "admin" ? "var(--ink)" : "var(--surface-2)", color: u.role === "admin" ? "var(--bg)" : "var(--ink-2)", fontWeight: 600, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>{u.role}</span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--ink-2)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{u.org}</td>
                  <td style={{ padding: "12px 14px" }}>
                    {u.is_active
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--accent-ink)", fontWeight: 600, letterSpacing: "0.04em" }}><span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--accent)" }}/>ACTIVE</span>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.04em" }}><span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--muted)" }}/>OFF</span>}
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--muted)" }}>{u.last_login}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <Btn variant="ghost" size="xs" icon="dots"/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {withModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ width: 480, background: "var(--surface)", borderRadius: 8, boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-strong)", overflow: "hidden" }}>
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-2)" }}>
              <div>
                <SectionLabel>POST /api/admin/users</SectionLabel>
                <h2 style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)" }}>invite_user</h2>
              </div>
              <Btn variant="ghost" size="sm" icon="close"/>
            </div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <SectionLabel>EMAIL</SectionLabel>
                <Input icon="mail" placeholder="user@gba.gov.in" style={{ borderRadius: 4 }} inputStyle={{ fontFamily: "var(--font-mono)" }}/>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <SectionLabel>DISPLAY_NAME</SectionLabel>
                <Input placeholder="Full name" style={{ borderRadius: 4 }}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <SectionLabel>ROLE</SectionLabel>
                  <div style={{ display: "flex", border: "1px solid var(--border-strong)", borderRadius: 4, padding: 2 }}>
                    <span style={{ flex: 1, padding: "6px 8px", textAlign: "center", background: "var(--ink)", color: "var(--bg)", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>ADMIN</span>
                    <span style={{ flex: 1, padding: "6px 8px", textAlign: "center", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, letterSpacing: "0.04em" }}>REVIEWER</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <SectionLabel>ORG_ID</SectionLabel>
                  <Select value="bbmp-east-shivajinagar" icon="org" style={{ fontFamily: "var(--font-mono)", borderRadius: 4 }}/>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <SectionLabel>INITIAL_PASSWORD</SectionLabel>
                <Input icon="lock" type="password" defaultValue="••••••••••••" style={{ borderRadius: 4 }} suffix={<Btn variant="ghost" size="xs" style={{ fontFamily: "var(--font-mono)" }}>GEN</Btn>}/>
                <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>// MIN 12 · ARGON2ID · CHANGE_ON_FIRST_LOGIN</span>
              </div>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 6, background: "var(--surface-2)" }}>
              <Btn variant="ghost" size="sm" style={{ fontFamily: "var(--font-mono)" }}>CANCEL</Btn>
              <Btn variant="accent" size="sm" iconRight="arrow_right" style={{ fontFamily: "var(--font-mono)" }}>CREATE</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Organizations (tree)
// ──────────────────────────────────────────────────────────────────────
function DesktopOrgsB() {
  const orgs = window.SAMPLE_ORGS;
  function Node({ org, depth = 0, last = false }) {
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: `${depth * 20}px 1fr auto auto`, alignItems: "center", padding: "8px 10px", borderBottom: "1px dashed var(--border)", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 11 }}>{depth === 0 ? "" : "└─"}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name={org.type === "ward_office" ? "pin" : "org"} size={13} style={{ color: depth === 0 ? "var(--accent-ink)" : "var(--muted)" }}/>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: depth === 0 ? 600 : 500 }}>{org.name}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{org.type} · ID={org.id}</span>
            </div>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            {window.SAMPLE_USERS.filter(u => u.org.startsWith(org.name.split(" ")[0])).length} USERS
          </span>
          <Btn variant="ghost" size="xs" icon="dots"/>
        </div>
        {org.children && org.children.map((c, i) => <Node key={c.id} org={c} depth={depth + 1} last={i === org.children.length - 1}/>)}
      </div>
    );
  }
  return (
    <div className="dir-b" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <B.SidebarB active="orgs"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <B.DesktopTopBarB
          title="orgs"
          breadcrumb={["GBA", "HIERARCHY"]}
          actions={
            <>
              <Btn variant="ghost" size="sm" icon="download" style={{ fontFamily: "var(--font-mono)" }}>EXPORT</Btn>
              <Btn variant="accent" size="sm" icon="plus" style={{ fontFamily: "var(--font-mono)" }}>ADD_ORG</Btn>
            </>
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 22, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-strong)", display: "flex", justifyContent: "space-between", alignItems: "baseline", background: "var(--surface-2)" }}>
              <SectionLabel>ORG_TREE</SectionLabel>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>1 GBA · 4 CORP · 5 WARD_OFFICE</span>
            </div>
            <div>
              {orgs.map(o => <Node key={o.id} org={o}/>)}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 14, background: "var(--surface)" }}>
              <SectionLabel>SELECTED · shivajinagar_ward_office</SectionLabel>
              <h3 style={{ margin: "8px 0", fontSize: 18, fontWeight: 600, fontFamily: "var(--font-mono)" }}>Shivajinagar Ward Office</h3>
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ padding: "2px 8px", borderRadius: 4, background: "var(--accent-bg)", color: "var(--accent-ink)", border: "1px solid var(--accent-border)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em" }}>WARD_OFFICE</span>
                <span style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border-strong)", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em" }}>↳ BBMP East Corporation</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)" }}>
                {[["CREATED", "2026-03-14"], ["UPDATED", "2026-05-04"], ["ID", "shiv"]].map(([k, v]) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "80px 1fr", padding: "4px 0", borderTop: "1px dashed var(--border)" }}>
                    <span style={{ color: "var(--muted)" }}>{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 14, background: "var(--surface)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div><SectionLabel>OPEN</SectionLabel><div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, marginTop: 4 }}>89</div></div>
              <div><SectionLabel>RESOLVED</SectionLabel><div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, marginTop: 4, color: "var(--accent-ink)" }}>142</div></div>
              <div><SectionLabel>MED_CLOSE</SectionLabel><div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, marginTop: 4 }}>34h</div></div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <SectionLabel>USERS_ASSIGNED</SectionLabel>
                <Btn variant="ghost" size="xs" icon="plus" style={{ fontFamily: "var(--font-mono)" }}>ADD</Btn>
              </div>
              {window.SAMPLE_USERS.filter(u => u.org.includes("Shivajinagar")).map(u => (
                <div key={u.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px dashed var(--border)" }}>
                  <Avatar name={u.name} size={28}/>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</span>
                    <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{u.email}</span>
                  </div>
                  <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--surface-2)", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" }}>{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Map
// ──────────────────────────────────────────────────────────────────────
function DesktopMapB() {
  const reports = window.SAMPLE_REPORTS;
  return (
    <div className="dir-b" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <B.SidebarB active="map"/>
      <main style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <div className="map-tile" style={{ flex: 1, position: "relative" }}>
          {/* Top */}
          <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", gap: 6 }}>
              {[["ALL · 282", true], ["NEW · 218", false, "var(--status-submitted)"], ["REVIEW · 64", false, "var(--status-review)"], ["HIGH_SEV", false]].map(([label, on, dot], i) => (
                <span key={i} style={{ padding: "4px 10px", borderRadius: 4, background: on ? "var(--ink)" : "rgba(255,255,255,0.95)", color: on ? "var(--bg)" : "var(--ink-2)", border: on ? "1px solid var(--ink)" : "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", backdropFilter: "blur(8px)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {dot && <span style={{ width: 5, height: 5, borderRadius: 999, background: dot }}/>}
                  {label}
                </span>
              ))}
            </div>
            <span style={{ padding: "5px 10px", borderRadius: 4, background: "rgba(255,255,255,0.95)", border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>12.97° N · 77.60° E · z=12</span>
          </div>

          {[[280, 240], [330, 280], [380, 220], [440, 300], [490, 260], [520, 320], [340, 360], [430, 400], [520, 420], [600, 380], [620, 480], [560, 540], [380, 480], [300, 500]].map(([x, y], i) => (
            <div key={i} style={{ position: "absolute", left: x, top: y }}>
              <MapPin status={i % 3 === 0 ? "submitted" : i % 3 === 1 ? "under_review" : "resolved"} size={i === 6 ? 22 : 14}/>
            </div>
          ))}

          <div style={{ position: "absolute", left: 420, top: 350, width: 46, height: 46, borderRadius: 4, background: "var(--ink)", color: "var(--bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, border: "3px solid rgba(255,255,255,0.95)", boxShadow: "var(--shadow-md)" }}>28</div>

          <div style={{ position: "absolute", bottom: 16, left: 16, padding: "10px 14px", borderRadius: 4, background: "rgba(255,255,255,0.95)", border: "1px solid var(--border-strong)", backdropFilter: "blur(8px)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <SectionLabel style={{ marginBottom: 6 }}>LEGEND</SectionLabel>
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MapPin status="submitted" size={9}/> SUBMITTED</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MapPin status="under_review" size={9}/> REVIEW</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MapPin status="resolved" size={9}/> RESOLVED</span>
            </div>
          </div>
        </div>

        <div style={{ width: 340, background: "var(--surface)", borderLeft: "1px solid var(--border)", padding: 18, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <SectionLabel>IN_VIEW</SectionLabel>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{reports.length} RESULTS</span>
          </div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600 }}>bengaluru</h2>
          {reports.slice(0, 6).map(r => (
            <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 10, display: "flex", gap: 10, cursor: "pointer" }} className="press">
              <PhotoTile photo={r.photo} size={44} radius={3}/>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{r.id}</span>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: window.STATUS_LABELS[r.status].dot }}/>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{window.CATEGORIES[r.category].en}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{r.ward_name} · {r.relative}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

Object.assign(window.B, {
  DesktopDashboardB, DesktopReportsTableB, DesktopReportDetailB,
  DesktopUsersB, DesktopOrgsB, DesktopMapB,
});
