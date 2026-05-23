/* Direction A — Daari Ops (warm sibling of citizen app)
   All screens self-contain a .dir-a wrapper so they render correctly in the canvas. */
/* eslint-disable react/prop-types */

// ──────────────────────────────────────────────────────────────────────
// Common chrome — A
// ──────────────────────────────────────────────────────────────────────

function MobileTopBarA({ title, subtitle, back = false, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 8px", gap: 12 }}>
      {back
        ? <button className="press" style={{ width: 36, height: 36, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="chevron_left" size={18}/></button>
        : <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>ND</div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
              {subtitle && <span style={{ fontSize: 11, color: "var(--muted)" }}>{subtitle}</span>}
            </div>
          </div>}
      {back && <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>}
      <div style={{ display: "flex", gap: 8 }}>
        {action || (
          <>
            <button className="press" style={{ width: 36, height: 36, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", color: "var(--ink)" }}>
              <Icon name="bell" size={16}/>
              <span style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, background: "var(--danger)", borderRadius: 999 }}/>
            </button>
            <Avatar name="Karan Kinariwala" tone="ink"/>
          </>
        )}
      </div>
    </div>
  );
}

function MobileTabBarA({ active }) {
  const tabs = [
    { k: "dashboard", icon: "grid",  label: "Home" },
    { k: "reports",   icon: "inbox", label: "Reports" },
    { k: "map",       icon: "map",   label: "Map" },
    { k: "users",     icon: "users", label: "Users" },
  ];
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 16px 18px", background: "var(--surface)", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
      {tabs.map(t => (
        <button key={t.k} className="press" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", borderRadius: 12, background: active === t.k ? "var(--accent-bg)" : "transparent", color: active === t.k ? "var(--accent-ink)" : "var(--muted)" }}>
            <Icon name={t.icon} size={20}/>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.02em" }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function SidebarA({ active }) {
  const items = [
    { k: "dashboard", icon: "grid", label: "Dashboard" },
    { k: "reports",   icon: "inbox", label: "Reports", badge: "218" },
    { k: "map",       icon: "map",  label: "Map" },
    { k: "users",     icon: "users", label: "Users" },
    { k: "orgs",      icon: "org",   label: "Organizations" },
  ];
  return (
    <aside style={{ width: 240, background: "var(--surface)", borderRight: "1px solid var(--border)", padding: 16, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 16px" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>ND</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Namma Daari</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Admin · Bengaluru</span>
        </div>
      </div>
      <SectionLabel style={{ padding: "4px 8px 8px" }}>Main</SectionLabel>
      {items.map(it => (
        <button key={it.k} className="press" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: active === it.k ? "var(--accent-bg)" : "transparent", color: active === it.k ? "var(--accent-ink)" : "var(--ink-2)", fontWeight: active === it.k ? 600 : 500, fontSize: 13, justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Icon name={it.icon} size={16}/>
            {it.label}
          </span>
          {it.badge && <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "1px 6px", background: active === it.k ? "var(--accent)" : "var(--surface-2)", color: active === it.k ? "var(--on-accent)" : "var(--ink-2)", borderRadius: 999, fontWeight: 600 }}>{it.badge}</span>}
        </button>
      ))}
      <div style={{ flex: 1 }}/>
      <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name="Karan Kinariwala" tone="ink" size={32}/>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>Karan K.</span>
            <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>Super admin · GBA</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <Btn variant="secondary" size="xs" icon="settings" style={{ flex: 1 }}>Settings</Btn>
          <Btn variant="ghost" size="xs" icon="logout"/>
        </div>
      </div>
    </aside>
  );
}

function DesktopTopBarA({ title, breadcrumb = [], actions, filters }) {
  return (
    <div style={{ padding: "18px 28px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          {breadcrumb.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
              {breadcrumb.map((b, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <Icon name="chevron_right" size={12}/>}
                  <span style={{ fontFamily: "var(--font-mono)" }}>{b}</span>
                </React.Fragment>
              ))}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {actions}
        </div>
      </div>
      {filters && <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>{filters}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Dashboard
// ──────────────────────────────────────────────────────────────────────

function MobileDashboardA() {
  const s = window.SAMPLE_STATS;
  return (
    <div className="dir-a" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarA title="Karan K." subtitle="Good afternoon"/>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 96px", display: "flex", flexDirection: "column", gap: 16 }} className="no-scrollbar">
        {/* Greeting / context */}
        <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em" }}>Good afternoon</h1>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>19 MAY · 14:38 IST</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>3 new high-severity</span> reports in the last hour. Queue is stable.
          </p>
        </div>

        {/* Triage CTA */}
        <Card padded style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <SectionLabel style={{ color: "var(--accent-ink)", opacity: 0.7 }}>Triage queue</SectionLabel>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--accent-ink)" }}>218</span>
              <span style={{ fontSize: 13, color: "var(--accent-ink)", opacity: 0.7 }}>waiting</span>
            </div>
          </div>
          <Btn variant="accent" size="md" iconRight="arrow_right">Start triage</Btn>
        </Card>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SectionLabel>Total</SectionLabel>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.total_reports.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>since launch</span>
          </Card>
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SectionLabel>Resolved this week</SectionLabel>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.resolved_this_week}</span>
            <span style={{ fontSize: 11, color: "var(--accent-ink)" }}>+18% vs last week</span>
          </Card>
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SectionLabel>Under review</SectionLabel>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.by_status.under_review}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>median {s.median_resolution_hours}h to close</span>
          </Card>
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SectionLabel>Resolved</SectionLabel>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.by_status.resolved}</span>
            <span style={{ fontSize: 11, color: "var(--accent-ink)" }}>77% rate</span>
          </Card>
        </div>

        {/* Trend */}
        <Card padded style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div>
              <SectionLabel>Submissions · last 14 days</SectionLabel>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 700 }}>260</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>reports</span>
              </div>
            </div>
            <Pill tone="accent" size="sm">+12%</Pill>
          </div>
          <Sparkbars values={s.trend} color="var(--accent)" height={56} width={324}/>
        </Card>

        {/* Category split */}
        <Card padded style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <SectionLabel>By category</SectionLabel>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>6 enums</span>
          </div>
          {Object.entries(s.by_category).map(([k, v]) => {
            const pct = (v / s.total_reports) * 100;
            return (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <CategoryGlyph name={k} size={22}/>
                    {window.CATEGORIES[k].en}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{v}</span>
                </div>
                <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", opacity: 0.6 + (pct / 100) * 0.4 }}/>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <MobileTabBarA active="dashboard"/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Reports list (card stream)
// ──────────────────────────────────────────────────────────────────────

function ReportCardA({ r }) {
  return (
    <Card padded={false} style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 12, padding: 12 }}>
        <PhotoTile photo={r.photo} size={68} radius={10}/>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{window.CATEGORIES[r.category].en}</span>
              <span style={{ fontSize: 11, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="pin" size={11}/> {r.ward_name} <span style={{ opacity: 0.4 }}>·</span> {r.relative}
              </span>
            </div>
            <StatusBadge status={r.status} size="sm"/>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
            <SeverityIndicator severity={r.severity}/>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{r.id}</span>
          </div>
        </div>
      </div>
      {r.duplicate_count > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderTop: "1px dashed var(--border)", background: "var(--warn-bg)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--warn-ink)" }}>
            <Icon name="duplicate" size={13}/>
            <strong>+{r.duplicate_count} similar nearby</strong>
            <ConfidencePill level={r.duplicate_confidence}/>
          </span>
          <Icon name="chevron_right" size={14} style={{ color: "var(--warn-ink)" }}/>
        </div>
      )}
    </Card>
  );
}

function MobileReportsListA() {
  const reports = window.SAMPLE_REPORTS;
  return (
    <div className="dir-a" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarA title="Reports" subtitle="Inbox · all wards"/>

      {/* Filter strip */}
      <div style={{ padding: "8px 16px 12px", display: "flex", gap: 8, overflowX: "auto" }} className="no-scrollbar">
        <Pill tone="ink" size="md">All · {reports.length}</Pill>
        <Pill tone="neutral" size="md" dot="var(--status-submitted)">Submitted · 218</Pill>
        <Pill tone="neutral" size="md" dot="var(--status-review)">Under review · 64</Pill>
        <Pill tone="neutral" size="md" dot="var(--status-resolved)">Resolved</Pill>
      </div>
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, alignItems: "center" }}>
        <Input icon="search" placeholder="Search description, ID, ward…" style={{ flex: 1, height: 38 }}/>
        <Btn variant="secondary" size="sm" icon="filter"/>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 96px", display: "flex", flexDirection: "column", gap: 10 }} className="no-scrollbar">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 4px" }}>
          <SectionLabel>Today · 19 May</SectionLabel>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{reports.filter(r => r.relative.match(/min|h ago/)).length} reports</span>
        </div>
        {reports.slice(0, 5).map(r => <ReportCardA key={r.id} r={r}/>)}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 4px 4px" }}>
          <SectionLabel>Yesterday</SectionLabel>
        </div>
        {reports.slice(5).map(r => <ReportCardA key={r.id} r={r}/>)}
      </div>

      <MobileTabBarA active="reports"/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Reports list (compact rows, the tweak alt)
// ──────────────────────────────────────────────────────────────────────

function MobileReportsCompactA() {
  const reports = window.SAMPLE_REPORTS;
  return (
    <div className="dir-a" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarA title="Reports" subtitle="Inbox · compact"/>

      <div style={{ padding: "8px 16px 12px", display: "flex", gap: 8, overflowX: "auto" }} className="no-scrollbar">
        <Pill tone="ink" size="md">All · {reports.length}</Pill>
        <Pill tone="neutral" size="md" dot="var(--status-submitted)">Submitted</Pill>
        <Pill tone="neutral" size="md" dot="var(--status-review)">Reviewing</Pill>
      </div>

      <div style={{ padding: "0 16px 8px", display: "flex", gap: 8, alignItems: "center" }}>
        <Input icon="search" placeholder="Search…" style={{ flex: 1, height: 36 }}/>
        <Btn variant="secondary" size="sm" icon="sort"/>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 96px" }} className="no-scrollbar">
        <Card padded={false} style={{ overflow: "hidden" }}>
          {reports.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <PhotoTile photo={r.photo} size={40} radius={8}/>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{window.CATEGORIES[r.category].en}</span>
                  <StatusBadge status={r.status} size="sm"/>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--muted)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="pin" size={10}/>{r.ward_name} · {r.relative}
                  </span>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {r.duplicate_count > 0 && <span style={{ fontFamily: "var(--font-mono)", color: "var(--warn-ink)", fontWeight: 600 }}>+{r.duplicate_count}</span>}
                    <SeverityIndicator severity={r.severity}/>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <MobileTabBarA active="reports"/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Report detail
// ──────────────────────────────────────────────────────────────────────

function MobileReportDetailA() {
  const r = window.SAMPLE_REPORTS[0];
  const timeline = window.SAMPLE_TIMELINE;
  return (
    <div className="dir-a" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 20, display: "flex", justifyContent: "space-between" }}>
        <button className="press" style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(28,25,23,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="chevron_left" size={18}/></button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="press" style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(28,25,23,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="zoom_in" size={16}/></button>
          <button className="press" style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(28,25,23,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="dots" size={16}/></button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }} className="no-scrollbar">
        {/* Photo viewer */}
        <div className={r.photo} style={{ width: "100%", height: 320, position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <Pill tone="ink" style={{ background: "rgba(28,25,23,0.85)", backdropFilter: "blur(8px)", color: "#fafaf9", border: "none" }} icon="image">Photo 1 of 1</Pill>
            <Pill tone="ink" style={{ background: "rgba(28,25,23,0.85)", backdropFilter: "blur(8px)", color: "#fafaf9", border: "none", fontFamily: "var(--font-mono)" }}>EXIF · GPS confirmed</Pill>
          </div>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{r.id}</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>·</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.relative}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
              {window.CATEGORIES[r.category].en}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge status={r.status}/>
              <SeverityIndicator severity={r.severity}/>
              {r.duplicate_count > 0 && <Pill tone="warn" icon="duplicate">+{r.duplicate_count} duplicates</Pill>}
            </div>
          </div>

          {/* Quick action: change status */}
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--accent-bg)", border: "1px solid var(--accent-border)" }}>
            <SectionLabel style={{ color: "var(--accent-ink)" }}>Move to</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Btn variant="accent" size="md" icon="eye">Under review</Btn>
              <Btn variant="secondary" size="md" icon="check_circle">Resolved</Btn>
            </div>
          </Card>

          {/* Description */}
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SectionLabel>Description from citizen</SectionLabel>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{r.description}</p>
            {r.kn_description && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-kn)", lineHeight: 1.6 }}>{r.kn_description}</p>}
          </Card>

          {/* Location card with mini map */}
          <Card padded={false} style={{ overflow: "hidden" }}>
            <div className="map-tile" style={{ height: 140, position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MapPin status={r.status} size={20}/>
              </div>
              <div style={{ position: "absolute", top: 8, left: 8 }}>
                <Pill tone="glass" style={{ background: "rgba(255,255,255,0.92)", color: "var(--ink)", border: "1px solid rgba(28,25,23,0.08)" }}>Shivajinagar · BBMP East</Pill>
              </div>
            </div>
            <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <SectionLabel>Coordinates</SectionLabel>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>12.9854 N · 77.6065 E</span>
              </div>
              <Btn variant="secondary" size="sm" iconRight="external">Open in Maps</Btn>
            </div>
          </Card>

          {/* Status timeline */}
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel>Status history</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
              <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 2, background: "var(--border)" }}/>
              {timeline.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: "var(--surface)", border: `2px solid ${t.status === "submitted" ? "var(--status-submitted)" : t.status === "under_review" ? "var(--status-review)" : "var(--status-resolved)"}`, flexShrink: 0, marginTop: 3 }}/>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{window.STATUS_LABELS[t.status].label}</span>
                      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{t.at}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.who}</span>
                    {t.note && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.4 }}>{t.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Submitter — collapsed by default */}
          <Card padded style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="lock" size={16} style={{ color: "var(--muted)" }}/>
              <div>
                <SectionLabel>Submitter PII</SectionLabel>
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Reveal contact details</span>
              </div>
            </div>
            <Btn variant="ghost" size="sm" iconRight="chevron_right">Reveal</Btn>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Map view
// ──────────────────────────────────────────────────────────────────────

function MobileMapA() {
  return (
    <div className="dir-a" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <div className="map-tile" style={{ position: "absolute", inset: 0 }}/>

      {/* Top floating bar */}
      <div style={{ position: "relative", padding: "14px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, zIndex: 10 }}>
        <button className="press" style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", border: "1px solid rgba(28,25,23,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="menu" size={18}/></button>
        <div style={{ flex: 1, padding: "8px 14px", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderRadius: 12, border: "1px solid rgba(28,25,23,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="search" size={14} style={{ color: "var(--muted)" }}/>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Search Bengaluru…</span>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ position: "relative", padding: "0 16px", display: "flex", gap: 6, overflowX: "auto", zIndex: 10 }} className="no-scrollbar">
        <Pill tone="ink" size="md">All status</Pill>
        <Pill tone="neutral" size="md" dot="var(--status-submitted)" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)" }}>New</Pill>
        <Pill tone="neutral" size="md" dot="var(--status-review)" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)" }}>Reviewing</Pill>
        <Pill tone="neutral" size="md" icon="filter" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)" }}>Category</Pill>
      </div>

      {/* Pins (decorative) */}
      <div style={{ position: "absolute", left: 80,  top: 220, zIndex: 5 }}><MapPin status="submitted" size={18}/></div>
      <div style={{ position: "absolute", left: 150, top: 260, zIndex: 5 }}><MapPin status="submitted" size={18}/></div>
      <div style={{ position: "absolute", left: 220, top: 220, zIndex: 5 }}><MapPin status="under_review" size={18}/></div>
      <div style={{ position: "absolute", left: 280, top: 290, zIndex: 5 }}><MapPin status="submitted" size={18}/></div>
      <div style={{ position: "absolute", left: 110, top: 330, zIndex: 5 }}><MapPin status="resolved" size={18}/></div>
      <div style={{ position: "absolute", left: 200, top: 380, zIndex: 5 }}><MapPin status="under_review" size={18}/></div>
      <div style={{ position: "absolute", left: 60,  top: 410, zIndex: 5 }}><MapPin status="resolved" size={18}/></div>
      <div style={{ position: "absolute", left: 290, top: 410, zIndex: 5 }}><MapPin status="submitted" size={20}/></div>
      <div style={{ position: "absolute", left: 180, top: 470, zIndex: 5 }}>
        {/* selected with halo */}
        <span style={{ position: "absolute", inset: -8, borderRadius: 999, background: "var(--status-submitted)", opacity: 0.18 }}/>
        <MapPin status="submitted" size={22}/>
      </div>

      {/* Floating bottom preview card */}
      <div style={{ position: "absolute", bottom: 96, left: 16, right: 16, zIndex: 10 }}>
        <Card padded style={{ boxShadow: "var(--shadow-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <SectionLabel>Shivajinagar cluster</SectionLabel>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>4 reports</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <PhotoTile photo="photo" size={48} radius={8}/>
            <PhotoTile photo="photo alt-1" size={48} radius={8}/>
            <PhotoTile photo="photo alt-2" size={48} radius={8}/>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--surface-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>+1</div>
          </div>
          <Btn variant="primary" size="sm" iconRight="arrow_right" style={{ width: "100%" }}>Open cluster</Btn>
        </Card>
      </div>

      <MobileTabBarA active="map"/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Login
// ──────────────────────────────────────────────────────────────────────

function MobileLoginA() {
  return (
    <div className="dir-a" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", padding: 24, position: "relative" }}>
      {/* Subtle dot pattern background */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "16px 16px", opacity: 0.5, maskImage: "linear-gradient(180deg, transparent 0%, black 30%, black 70%, transparent 100%)" }}/>

      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", marginTop: 40 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18 }}>ND</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Namma Daari</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Admin · Bengaluru</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Sign in to triage.</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>For administrators of the Bengaluru Walkability Public Audit.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <SectionLabel>Email</SectionLabel>
            <Input icon="mail" placeholder="you@gba.gov.in" defaultValue="kkin1995@gmail.com" style={{ height: 48 }}/>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <SectionLabel>Password</SectionLabel>
              <a style={{ fontSize: 11, color: "var(--accent-ink)", textDecoration: "none" }}>Forgot?</a>
            </div>
            <Input icon="lock" type="password" placeholder="••••••••••" defaultValue="••••••••••••" style={{ height: 48 }}/>
          </div>
        </div>

        <Btn variant="accent" size="lg" iconRight="arrow_right" style={{ width: "100%" }}>Continue</Btn>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
          <Icon name="shield" size={12}/>
          <span>Argon2id · 24-hour session · IP rate-limited</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", letterSpacing: "0.05em", position: "relative" }}>
        <span>v2.4.1 · build a1201da</span>
        <span>© GBA 2026</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Profile + change password
// ──────────────────────────────────────────────────────────────────────

function MobileProfileA() {
  return (
    <div className="dir-a" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarA title="Profile" subtitle="Account"/>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 96px", display: "flex", flexDirection: "column", gap: 16 }} className="no-scrollbar">
        <Card padded style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
          <Avatar name="Karan Kinariwala" size={72} tone="ink"/>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Karan Kinariwala</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>kkin1995@gmail.com</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Pill tone="accent" icon="shield">Super admin</Pill>
            <Pill tone="neutral">GBA</Pill>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionLabel>Display name</SectionLabel>
          <Input defaultValue="Karan Kinariwala"/>
        </div>

        <Card padded style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionLabel>Change password</SectionLabel>
          <Input icon="lock" type="password" placeholder="Current password"/>
          <Input icon="lock" type="password" placeholder="New password (min 12)"/>
          <Input icon="lock" type="password" placeholder="Confirm new password"/>
          <Btn variant="accent" size="md">Update password</Btn>
        </Card>

        <Card padded style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <SectionLabel>Last sign-in</SectionLabel>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>2026-05-19 14:00 IST · Bengaluru</span>
        </Card>

        <Btn variant="danger-soft" size="md" icon="logout">Sign out of all sessions</Btn>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Empty / error states
// ──────────────────────────────────────────────────────────────────────

function MobileEmptyA() {
  return (
    <div className="dir-a" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarA title="Reports" subtitle="Inbox zero"/>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--accent-bg)", color: "var(--accent-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)" }}>
          <Icon name="check_circle" size={32}/>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>Inbox zero</h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
            All reports in your scope are triaged. New submissions will appear here automatically.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" size="sm" icon="refresh">Refresh</Btn>
          <Btn variant="primary" size="sm" iconRight="arrow_right">View resolved</Btn>
        </div>
        <div style={{ marginTop: 24, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>last sync · 14:38:02 IST</div>
      </div>

      <MobileTabBarA active="reports"/>
    </div>
  );
}

function MobileErrorA() {
  return (
    <div className="dir-a" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarA title="Reports" subtitle="You're offline"/>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px", gap: 16, overflowY: "auto" }} className="no-scrollbar">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--warn-bg)", color: "var(--warn-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)", border: "1px solid var(--warn-border)" }}>
            <Icon name="warn_tri" size={32}/>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>You're offline right now</h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>
              Don't worry — everything you've changed has been saved on this device. We'll send it through automatically as soon as you're back online.
            </p>
          </div>
        </div>

        {/* Pending changes — concrete reassurance */}
        <Card padded style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--accent-ink)" }}>
              <Icon name="check_circle" size={16}/>Saved on this device
            </span>
            <Pill tone="accent" size="sm">3 waiting</Pill>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
            {[
              { id: "WLK-7AC2C", action: "Marked as Under review" },
              { id: "WLK-7AC2A", action: "Note added" },
              { id: "WLK-7AC28", action: "Marked as Resolved" },
            ].map((row, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--ink-2)", padding: "6px 0", borderTop: i === 0 ? "none" : "1px dashed var(--accent-border)" }}>
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)", flexShrink: 0 }}/>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-ink)", fontWeight: 600 }}>{row.id}</span>
                <span style={{ color: "var(--muted)" }}>·</span>
                <span style={{ flex: 1, minWidth: 0 }}>{row.action}</span>
              </li>
            ))}
          </ul>
          <span style={{ fontSize: 12, color: "var(--accent-ink)", opacity: 0.85, lineHeight: 1.4 }}>
            These will go through automatically when the connection is back.
          </span>
        </Card>

        <Btn variant="primary" size="md" icon="refresh" style={{ minHeight: 48, fontSize: 15 }}>Try to reconnect</Btn>

        <Card padded style={{ display: "flex", flexDirection: "column", fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ color: "var(--muted)" }}>Last connected</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>14:35:21</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px dashed var(--border)" }}>
            <span style={{ color: "var(--muted)" }}>Reports available offline</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>218</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px dashed var(--border)" }}>
            <span style={{ color: "var(--muted)" }}>Trying again in</span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-ink)" }}>0:02</span>
          </div>
        </Card>

        <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
          You can keep working — reviewing reports, leaving notes, and changing status all still work without internet.
        </span>
      </div>
    </div>
  );
}

window.A = {
  MobileDashboardA, MobileReportsListA, MobileReportsCompactA, MobileReportDetailA,
  MobileMapA, MobileLoginA, MobileProfileA, MobileEmptyA, MobileErrorA,
  SidebarA, DesktopTopBarA, ReportCardA,
};
