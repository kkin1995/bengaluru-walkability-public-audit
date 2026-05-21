/* Direction A — Daari Ops · Desktop screens */
/* eslint-disable react/prop-types */

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Dashboard
// ──────────────────────────────────────────────────────────────────────
function DesktopDashboardA() {
  const s = window.SAMPLE_STATS;
  const reports = window.SAMPLE_REPORTS.slice(0, 5);
  return (
    <div className="dir-a" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <A.SidebarA active="dashboard"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <A.DesktopTopBarA
          title="Dashboard"
          breadcrumb={["GBA", "All wards", "Today"]}
          actions={
            <>
              <Select value="Last 14 days" icon="clock"/>
              <Btn variant="secondary" size="sm" icon="download">Export</Btn>
              <Btn variant="accent" size="sm" icon="inbox">Open triage queue</Btn>
            </>
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Greeting band */}
          <Card padded style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar name="Karan Kinariwala" tone="ink" size={44}/>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--accent-ink)" }}>Good afternoon, Karan</h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--accent-ink)", opacity: 0.85 }}>3 new high-severity reports in the last hour · 218 waiting triage</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-ink)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} className="pulse-dot"/>
                LIVE
              </span>
              <span>19 MAY · 14:38 IST</span>
            </div>
          </Card>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { label: "Total reports", value: s.total_reports.toLocaleString(), sub: "since launch · Mar 2026", spark: s.trend, sparkColor: "var(--muted-2)" },
              { label: "Submitted", value: s.by_status.submitted, sub: "needs triage", spark: [3, 5, 8, 6, 9, 11, 18], sparkColor: "var(--status-submitted)", emphasize: true },
              { label: "Under review", value: s.by_status.under_review, sub: `median ${s.median_resolution_hours}h to close`, spark: [12, 10, 14, 12, 11, 8, 9], sparkColor: "var(--status-review)" },
              { label: "Resolved this week", value: s.resolved_this_week, sub: "+18% vs last week", spark: [3, 5, 6, 8, 9, 11, 12], sparkColor: "var(--status-resolved)" },
            ].map((c, i) => (
              <Card key={i} padded style={{ display: "flex", flexDirection: "column", gap: 10, ...(c.emphasize ? { border: "1px solid var(--accent-border)", background: "var(--accent-bg)" } : {}) }}>
                <SectionLabel>{c.label}</SectionLabel>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>{c.value}</span>
                  <Sparkbars values={c.spark} color={c.sparkColor} height={36} width={86}/>
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{c.sub}</span>
              </Card>
            ))}
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, flex: 1, minHeight: 0 }}>
            {/* Chart */}
            <Card padded style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <SectionLabel>Submissions · last 14 days</SectionLabel>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 26, fontWeight: 700 }}>260</span>
                    <span style={{ fontSize: 12, color: "var(--accent-ink)" }}>+12%</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Pill tone="ink" size="sm">All</Pill>
                  <Pill tone="neutral" size="sm">My ward</Pill>
                </div>
              </div>
              <Sparkbars values={s.trend} color="var(--accent)" height={140} width={620} gap={6}/>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginTop: -4, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                {["06","07","08","09","10","11","12"].map(d => <span key={d}>MAY {d}</span>)}
              </div>
            </Card>

            {/* Category split */}
            <Card padded style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <SectionLabel>By category</SectionLabel>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>6 enums</span>
              </div>
              {Object.entries(s.by_category).map(([k, v]) => {
                const pct = (v / s.total_reports) * 100;
                return (
                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <CategoryGlyph name={k} size={22}/>
                        {window.CATEGORIES[k].en}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{v} · {pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", opacity: 0.5 + (pct / 100) }}/>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>

          {/* Recent reports */}
          <Card padded={false} style={{ overflow: "hidden" }}>
            <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
              <div>
                <SectionLabel>Recent submissions</SectionLabel>
                <h3 style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 600 }}>Triage queue</h3>
              </div>
              <Btn variant="ghost" size="sm" iconRight="arrow_right">View all reports</Btn>
            </div>
            <div>
              {reports.map((r, i) => (
                <div key={r.id} style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
                  <PhotoTile photo={r.photo} size={44} radius={8}/>
                  <CategoryGlyph name={r.category} size={28}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{window.CATEGORIES[r.category].en}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.description.slice(0, 60)}…</div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink-2)", width: 110 }}><Icon name="pin" size={11} style={{ display: "inline", marginRight: 4 }}/>{r.ward_name}</span>
                  <SeverityIndicator severity={r.severity}/>
                  <StatusBadge status={r.status} size="sm"/>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", width: 70, textAlign: "right" }}>{r.relative}</span>
                  <Btn variant="ghost" size="sm" iconRight="chevron_right"/>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Reports list (table)
// ──────────────────────────────────────────────────────────────────────
function DesktopReportsTableA() {
  const reports = window.SAMPLE_REPORTS;
  return (
    <div className="dir-a" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <A.SidebarA active="reports"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <A.DesktopTopBarA
          title="Reports"
          breadcrumb={["GBA", "All wards", "Inbox"]}
          actions={
            <>
              <Btn variant="ghost" size="sm" icon="map">Map view</Btn>
              <Btn variant="secondary" size="sm" icon="download">Export CSV</Btn>
            </>
          }
          filters={
            <>
              <Input icon="search" placeholder="Search by description, ID, ward, submitter…" style={{ flex: 1, minWidth: 280, height: 36 }}/>
              <Select value="All status" icon="filter"/>
              <Select value="All categories"/>
              <Select value="All severity"/>
              <Select value="Last 30 days" icon="clock"/>
              <Select value="All wards" icon="pin"/>
            </>
          }
        />

        <div style={{ padding: "12px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Pill tone="ink" size="md">All · 1,247</Pill>
            <Pill tone="neutral" size="md" dot="var(--status-submitted)">Submitted · 218</Pill>
            <Pill tone="neutral" size="md" dot="var(--status-review)">Under review · 64</Pill>
            <Pill tone="neutral" size="md" dot="var(--status-resolved)">Resolved · 965</Pill>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
            <span>SHOWING 1–7 OF 218</span>
            <Btn variant="ghost" size="xs" icon="chevron_left"/>
            <Btn variant="secondary" size="xs">1</Btn>
            <Btn variant="ghost" size="xs">2</Btn>
            <Btn variant="ghost" size="xs">3</Btn>
            <Btn variant="ghost" size="xs" icon="chevron_right"/>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", background: "var(--surface)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["", "Report", "Category", "Severity", "Ward", "Status", "Submitted", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <React.Fragment key={r.id}>
                  <tr style={{ borderBottom: "1px solid var(--border)" }} className="press">
                    <td style={{ padding: "12px 14px", width: 60 }}><PhotoTile photo={r.photo} size={40} radius={8}/></td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.id}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <CategoryGlyph name={r.category} size={22}/>
                        {window.CATEGORIES[r.category].en}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}><SeverityIndicator severity={r.severity}/></td>
                    <td style={{ padding: "12px 14px", color: "var(--ink-2)" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="pin" size={11}/>{r.ward_name}</span></td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <StatusBadge status={r.status} size="sm"/>
                        {r.duplicate_count > 0 && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--warn-ink)", fontWeight: 500 }}>
                            <Icon name="duplicate" size={11}/>+{r.duplicate_count} dupes
                            <ConfidencePill level={r.duplicate_confidence}/>
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{r.relative}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <Btn variant="ghost" size="xs" icon="eye"/>
                        <Btn variant="ghost" size="xs" icon="edit"/>
                        <Btn variant="ghost" size="xs" icon="dots"/>
                      </div>
                    </td>
                  </tr>
                  {r.id === "WLK-7AC2F" && (
                    <tr style={{ background: "var(--warn-bg)", borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={8} style={{ padding: "10px 14px 12px 60px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <Icon name="duplicate" size={14} style={{ color: "var(--warn-ink)" }}/>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--warn-ink)" }}>3 duplicate reports linked at this location</span>
                          <ConfidencePill level="high"/>
                          <Btn variant="ghost" size="xs" iconRight="chevron_down" style={{ marginLeft: "auto", color: "var(--warn-ink)" }}>Hide</Btn>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--surface)", padding: 8, borderRadius: 8, border: "1px solid var(--warn-border)" }}>
                          {window.SAMPLE_DUPLICATES.map(d => (
                            <div key={d.id} style={{ display: "grid", gridTemplateColumns: "100px 1fr 80px 100px 80px 60px", gap: 12, alignItems: "center", fontSize: 12, padding: "6px 8px" }}>
                              <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>{d.id}</span>
                              <span style={{ color: "var(--ink-2)" }}>{window.CATEGORIES[d.category].en}</span>
                              <span style={{ color: "var(--muted)" }}>{d.ward_name}</span>
                              <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{d.relative}</span>
                              <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", fontSize: 11 }}>{d.distance_m}m away</span>
                              <StatusBadge status={d.status} size="sm"/>
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
function DesktopReportDetailA() {
  const r = window.SAMPLE_REPORTS[0];
  const timeline = window.SAMPLE_TIMELINE;
  return (
    <div className="dir-a" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <A.SidebarA active="reports"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <A.DesktopTopBarA
          title={`Report ${r.id}`}
          breadcrumb={["Reports", "Inbox", r.id]}
          actions={
            <>
              <Btn variant="ghost" size="sm" icon="external">Open in citizen view</Btn>
              <Btn variant="secondary" size="sm" icon="dots"/>
              <Btn variant="danger-soft" size="sm" icon="trash">Delete</Btn>
              <Btn variant="accent" size="sm" icon="check">Mark resolved</Btn>
            </>
          }
        />

        <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 0 }}>
          {/* Photo viewer */}
          <div style={{ background: "var(--surface-3)", display: "flex", flexDirection: "column", position: "relative" }}>
            <div className={r.photo} style={{ flex: 1, position: "relative", borderRight: "1px solid var(--border)" }}>
              <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8 }}>
                <Pill tone="ink" style={{ background: "rgba(28,25,23,0.85)", backdropFilter: "blur(8px)", color: "#fafaf9", border: "none" }} icon="image">Photo 1 of 1</Pill>
                <Pill tone="ink" style={{ background: "rgba(28,25,23,0.85)", backdropFilter: "blur(8px)", color: "#fafaf9", border: "none", fontFamily: "var(--font-mono)" }}>EXIF · GPS confirmed</Pill>
              </div>
              <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="press" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(28,25,23,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="zoom_in" size={16}/></button>
                  <button className="press" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(28,25,23,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="download" size={16}/></button>
                </div>
                <Pill tone="glass" style={{ background: "rgba(255,255,255,0.92)", color: "var(--ink)", border: "1px solid rgba(28,25,23,0.08)", fontFamily: "var(--font-mono)" }}>SHA-256: 8f4a…2c9b</Pill>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", padding: 24, gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <StatusBadge status={r.status}/>
                <SeverityIndicator severity={r.severity}/>
                {r.duplicate_count > 0 && (
                  <Pill tone="warn" icon="duplicate">+{r.duplicate_count} duplicates</Pill>
                )}
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{r.id}</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{window.CATEGORIES[r.category].en}</h1>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>{r.description}</p>
              {r.kn_description && (
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-kn)", lineHeight: 1.7 }}>{r.kn_description}</p>
              )}
            </div>

            {/* Status change inline */}
            <Card padded style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <SectionLabel style={{ color: "var(--accent-ink)" }}>Next step</SectionLabel>
                <h3 style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: "var(--accent-ink)" }}>Move to <em style={{ fontStyle: "normal" }}>under review</em> with a note</h3>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn variant="secondary" size="sm">Skip</Btn>
                <Btn variant="accent" size="sm" icon="check">Accept &amp; move</Btn>
              </div>
            </Card>

            {/* Location */}
            <Card padded style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <SectionLabel>Location</SectionLabel>
                <Pill tone="accent" size="sm" icon="check">EXIF + pin agree</Pill>
              </div>
              <div className="map-tile" style={{ height: 160, borderRadius: "var(--r-md)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MapPin status={r.status} size={20}/>
                </div>
                <div style={{ position: "absolute", left: 60, top: 80 }}><MapPin status="submitted" size={12}/></div>
                <div style={{ position: "absolute", left: 220, top: 50 }}><MapPin status="submitted" size={12}/></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <SectionLabel>Ward</SectionLabel>
                  <span>{r.ward_name} · BBMP East</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <SectionLabel>Coords</SectionLabel>
                  <span style={{ fontFamily: "var(--font-mono)" }}>12.9854, 77.6065</span>
                </div>
              </div>
            </Card>

            {/* Timeline */}
            <Card padded style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SectionLabel>Status history</SectionLabel>
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ position: "absolute", left: 7, top: 6, bottom: 6, width: 2, background: "var(--border)" }}/>
                {timeline.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, background: "var(--surface)", border: `2px solid ${t.status === "submitted" ? "var(--status-submitted)" : t.status === "under_review" ? "var(--status-review)" : "var(--status-resolved)"}`, flexShrink: 0, marginTop: 3 }}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{window.STATUS_LABELS[t.status].label}</span>
                        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{t.at}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>by {t.who}</span>
                      {t.note && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>{t.note}</p>}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: "var(--surface-2)", border: "2px dashed var(--border-strong)", flexShrink: 0 }}/>
                  <Input placeholder="Add note &amp; move to next status…" style={{ flex: 1, height: 36, fontSize: 12 }}/>
                </div>
              </div>
            </Card>

            {/* Submitter */}
            <Card padded style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <SectionLabel>Submitter (admin-only)</SectionLabel>
                <Pill tone="outline" size="sm" icon="shield">Not in public API</Pill>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={r.submitter_name} tone="neutral"/>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.submitter_name}</span>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{r.submitter_contact}</span>
                  </div>
                </div>
                <Btn variant="ghost" size="sm" icon="phone">Call</Btn>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Users management
// ──────────────────────────────────────────────────────────────────────
function DesktopUsersA({ withModal = false } = {}) {
  const users = window.SAMPLE_USERS;
  return (
    <div className="dir-a" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden", position: "relative" }}>
      <A.SidebarA active="users"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <A.DesktopTopBarA
          title="Users"
          breadcrumb={["GBA", "Admin users"]}
          actions={
            <>
              <Input icon="search" placeholder="Search users…" style={{ width: 240, height: 36 }}/>
              <Btn variant="accent" size="sm" icon="plus">Invite admin</Btn>
            </>
          }
        />

        <div style={{ padding: "12px 28px", display: "flex", gap: 8, borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <Pill tone="ink" size="md">All · {users.length}</Pill>
          <Pill tone="neutral" size="md">Admins · {users.filter(u => u.role === "admin").length}</Pill>
          <Pill tone="neutral" size="md">Reviewers · {users.filter(u => u.role === "reviewer").length}</Pill>
          <Pill tone="warn" size="md" icon="alert">Inactive · {users.filter(u => !u.is_active).length}</Pill>
        </div>

        <div style={{ flex: 1, overflowY: "auto", background: "var(--surface)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["User", "Role", "Organization", "Status", "Last sign-in", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.email} style={{ borderBottom: "1px solid var(--border)", opacity: u.is_active ? 1 : 0.6 }}>
                  <td style={{ padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={u.name} tone={u.is_super_admin ? "ink" : "neutral"}/>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {u.name}
                          {u.is_super_admin && <Pill tone="accent" size="sm" icon="shield">Super</Pill>}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px" }}>
                    <Pill tone={u.role === "admin" ? "ink" : "neutral"} size="md">{u.role}</Pill>
                  </td>
                  <td style={{ padding: "14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <Icon name="org" size={12} style={{ color: "var(--muted)" }}/>
                      {u.org}
                    </span>
                  </td>
                  <td style={{ padding: "14px" }}>
                    {u.is_active
                      ? <Pill tone="accent" size="md" dot="var(--accent)">Active</Pill>
                      : <Pill tone="warn" size="md" dot="var(--muted)">Deactivated</Pill>}
                  </td>
                  <td style={{ padding: "14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{u.last_login}</td>
                  <td style={{ padding: "14px", textAlign: "right" }}>
                    <Btn variant="ghost" size="xs" icon="dots"/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {withModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(28,25,23,0.4)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ width: 480, background: "var(--surface)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <SectionLabel>Invite admin</SectionLabel>
                <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600 }}>New user</h2>
              </div>
              <Btn variant="ghost" size="sm" icon="close"/>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SectionLabel>Email</SectionLabel>
                <Input icon="mail" placeholder="user@gba.gov.in"/>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SectionLabel>Display name</SectionLabel>
                <Input placeholder="Full name"/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <SectionLabel>Role</SectionLabel>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn variant="accent" size="sm" style={{ flex: 1 }}>Admin</Btn>
                    <Btn variant="secondary" size="sm" style={{ flex: 1 }}>Reviewer</Btn>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <SectionLabel>Organization</SectionLabel>
                  <Select value="BBMP East · Shivajinagar" icon="org"/>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SectionLabel>Initial password</SectionLabel>
                <Input icon="lock" type="password" defaultValue="••••••••••••" suffix={<Btn variant="ghost" size="xs">Generate</Btn>}/>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Min 12 chars · Argon2id hash · user will be prompted to change on first sign-in</span>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8, background: "var(--surface-2)" }}>
              <Btn variant="ghost" size="sm">Cancel</Btn>
              <Btn variant="accent" size="sm" iconRight="arrow_right">Create &amp; send invite</Btn>
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
function DesktopOrgsA() {
  const orgs = window.SAMPLE_ORGS;
  function Node({ org, depth = 0 }) {
    return (
      <div style={{ paddingLeft: depth * 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: depth === 0 ? "var(--accent-bg)" : "transparent", border: depth === 0 ? "1px solid var(--accent-border)" : "1px solid transparent", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {depth > 0 && <span style={{ width: 12, height: 1, background: "var(--border-strong)" }}/>}
            <Icon name={org.type === "ward_office" ? "pin" : "org"} size={14} style={{ color: depth === 0 ? "var(--accent-ink)" : "var(--muted)" }}/>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: depth === 0 ? 700 : 500 }}>{org.name}</span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{org.type.replace("_", " ")}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
              {window.SAMPLE_USERS.filter(u => u.org.startsWith(org.name.split(" ")[0])).length} users
            </span>
            <Btn variant="ghost" size="xs" icon="dots"/>
          </div>
        </div>
        {org.children && org.children.map(c => <Node key={c.id} org={c} depth={depth + 1}/>)}
      </div>
    );
  }
  return (
    <div className="dir-a" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <A.SidebarA active="orgs"/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <A.DesktopTopBarA
          title="Organizations"
          breadcrumb={["GBA", "Hierarchy"]}
          actions={
            <>
              <Btn variant="ghost" size="sm" icon="download">Export tree</Btn>
              <Btn variant="accent" size="sm" icon="plus">Add organization</Btn>
            </>
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 28, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <SectionLabel>Tree</SectionLabel>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>1 GBA · 4 corps · 5 ward offices</span>
            </div>
            {orgs.map(o => <Node key={o.id} org={o}/>)}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card padded style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SectionLabel>Selected · Shivajinagar Ward Office</SectionLabel>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Shivajinagar Ward Office</h3>
                <Pill tone="accent">2 users</Pill>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Pill tone="neutral" icon="org">Ward office</Pill>
                <Pill tone="outline" icon="chevron_right">BBMP East Corporation</Pill>
              </div>
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
                <div><SectionLabel>Created</SectionLabel><div style={{ fontFamily: "var(--font-mono)", marginTop: 2 }}>2026-03-14</div></div>
                <div><SectionLabel>Last updated</SectionLabel><div style={{ fontFamily: "var(--font-mono)", marginTop: 2 }}>2026-05-04</div></div>
              </div>
            </Card>

            <Card padded style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SectionLabel>Reports scope</SectionLabel>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 700 }}>89</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>open reports</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-ink)" }}>142</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>resolved</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 700 }}>34h</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>median close</span>
                </div>
              </div>
            </Card>

            <Card padded style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SectionLabel>Users assigned</SectionLabel>
              {window.SAMPLE_USERS.filter(u => u.org.includes("Shivajinagar")).map(u => (
                <div key={u.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <Avatar name={u.name}/>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{u.email}</span>
                  </div>
                  <Pill tone="neutral" size="sm">{u.role}</Pill>
                </div>
              ))}
              <Btn variant="ghost" size="sm" icon="plus" style={{ alignSelf: "flex-start", marginTop: 4 }}>Assign user</Btn>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// DESKTOP — Map view
// ──────────────────────────────────────────────────────────────────────
function DesktopMapA() {
  const reports = window.SAMPLE_REPORTS;
  return (
    <div className="dir-a" style={{ width: 1280, height: 800, background: "var(--bg)", display: "flex", color: "var(--ink)", overflow: "hidden" }}>
      <A.SidebarA active="map"/>
      <main style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <div className="map-tile" style={{ flex: 1, position: "relative" }}>
          {/* Floating top filters */}
          <div style={{ position: "absolute", top: 20, left: 20, right: 20, display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", gap: 6 }}>
              <Pill tone="ink" size="md">All status · 282</Pill>
              <Pill tone="neutral" size="md" dot="var(--status-submitted)" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)" }}>Submitted · 218</Pill>
              <Pill tone="neutral" size="md" dot="var(--status-review)" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)" }}>Reviewing · 64</Pill>
              <Pill tone="outline" size="md" icon="filter" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)" }}>More filters</Pill>
            </div>
            <Btn variant="secondary" size="sm" icon="download" style={{ background: "rgba(255,255,255,0.95)" }}>Export geojson</Btn>
          </div>

          {/* Pins scattered */}
          {[[280, 240], [330, 280], [380, 220], [440, 300], [490, 260], [520, 320], [340, 360], [430, 400], [520, 420], [600, 380], [620, 480], [560, 540], [380, 480], [300, 500]].map(([x, y], i) => (
            <div key={i} style={{ position: "absolute", left: x, top: y }}>
              <MapPin status={i % 3 === 0 ? "submitted" : i % 3 === 1 ? "under_review" : "resolved"} size={i === 6 ? 22 : 14}/>
            </div>
          ))}

          {/* Cluster bubble */}
          <div style={{ position: "absolute", left: 420, top: 350, width: 48, height: 48, borderRadius: 999, background: "rgba(28,25,23,0.85)", color: "#fafaf9", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, border: "3px solid rgba(255,255,255,0.95)", boxShadow: "var(--shadow-md)" }}>28</div>

          {/* Legend bottom */}
          <Card padded={false} style={{ position: "absolute", bottom: 20, left: 20, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)" }}>
            <SectionLabel>Legend</SectionLabel>
            <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MapPin status="submitted" size={10}/> Submitted</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MapPin status="under_review" size={10}/> Under review</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MapPin status="resolved" size={10}/> Resolved</span>
            </div>
          </Card>

          {/* Search bottom-right */}
          <Card padded={false} style={{ position: "absolute", bottom: 20, right: 20, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)" }}>
            <Btn variant="ghost" size="xs" icon="plus"/>
            <Btn variant="ghost" size="xs" icon="zoom_in"/>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", padding: "0 6px" }}>12.97° N, 77.60° E · zoom 12</span>
          </Card>
        </div>

        {/* Side panel with selected */}
        <div style={{ width: 360, background: "var(--surface)", borderLeft: "1px solid var(--border)", padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <SectionLabel>In view</SectionLabel>
              <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600 }}>{reports.length} reports</h3>
            </div>
            <Pill tone="neutral" icon="map">Bengaluru</Pill>
          </div>
          {reports.slice(0, 6).map(r => (
            <Card key={r.id} padded={false} style={{ overflow: "hidden", padding: 10, display: "flex", gap: 10, cursor: "pointer" }}>
              <PhotoTile photo={r.photo} size={48} radius={8}/>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{window.CATEGORIES[r.category].en}</span>
                  <StatusBadge status={r.status} size="sm"/>
                </div>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.ward_name} · {r.relative}</span>
                <SeverityIndicator severity={r.severity}/>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

Object.assign(window.A, {
  DesktopDashboardA, DesktopReportsTableA, DesktopReportDetailA,
  DesktopUsersA, DesktopOrgsA, DesktopMapA,
});
