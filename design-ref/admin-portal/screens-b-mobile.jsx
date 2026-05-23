/* Direction B — Walkability Console (ops-terminal voice, cool stone + teal) */
/* eslint-disable react/prop-types */

// ──────────────────────────────────────────────────────────────────────
// Common chrome — B
// ──────────────────────────────────────────────────────────────────────

function MobileTopBarB({ title, meta, back = false, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 10px", borderBottom: "1px solid var(--border)", background: "var(--surface)", gap: 10 }}>
      {back
        ? <button className="press" style={{ width: 32, height: 32, borderRadius: 6, background: "transparent", border: "1px solid var(--border-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="chevron_left" size={16}/></button>
        : <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 4, background: "var(--ink)", color: "var(--bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11 }}>W</div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>WLK.CONSOLE</span>
              {meta && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{meta}</span>}
            </div>
          </div>}
      {back && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase" }}>{title}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--accent)" }} className="pulse-dot"/>
          LIVE
        </span>
        {action || <button className="press" style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid var(--border-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)", background: "transparent" }}><Icon name="bell" size={14}/></button>}
      </div>
    </div>
  );
}

function MobileTabBarB({ active }) {
  const tabs = [
    { k: "dashboard", icon: "activity", label: "OPS" },
    { k: "reports",   icon: "inbox",    label: "QUEUE" },
    { k: "map",       icon: "map",      label: "MAP" },
    { k: "users",     icon: "users",    label: "USERS" },
  ];
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 10px 14px", background: "var(--surface)", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
      {tabs.map(t => (
        <button key={t.k} className="press" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 4px", borderRadius: 6, background: active === t.k ? "var(--accent-bg)" : "transparent", color: active === t.k ? "var(--accent-ink)" : "var(--muted)", border: active === t.k ? "1px solid var(--accent-border)" : "1px solid transparent" }}>
            <Icon name={t.icon} size={18}/>
            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.06em" }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function SidebarB({ active }) {
  const items = [
    { k: "dashboard", icon: "activity", label: "OPS"             },
    { k: "reports",   icon: "inbox",    label: "QUEUE", badge: "218" },
    { k: "map",       icon: "map",      label: "MAP"             },
    { k: "users",     icon: "users",    label: "USERS"           },
    { k: "orgs",      icon: "org",      label: "ORGS"            },
  ];
  return (
    <aside style={{ width: 220, background: "var(--surface)", borderRight: "1px solid var(--border)", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 16px", borderBottom: "1px solid var(--border)", marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 4, background: "var(--ink)", color: "var(--bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>W</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>WLK.CONSOLE</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.06em" }}>v2.4.1 · BENGALURU</span>
        </div>
      </div>
      {items.map(it => (
        <button key={it.k} className="press" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 4, background: active === it.k ? "var(--accent-bg)" : "transparent", color: active === it.k ? "var(--accent-ink)" : "var(--ink-2)", fontWeight: 500, fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.04em", border: active === it.k ? "1px solid var(--accent-border)" : "1px solid transparent", justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Icon name={it.icon} size={14}/>
            {it.label}
          </span>
          {it.badge && <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", padding: "1px 6px", background: active === it.k ? "var(--accent)" : "transparent", color: active === it.k ? "var(--on-accent)" : "var(--muted)", border: active === it.k ? "none" : "1px solid var(--border-strong)", borderRadius: 999, fontWeight: 600 }}>{it.badge}</span>}
        </button>
      ))}
      <div style={{ flex: 1 }}/>
      {/* Command hint */}
      <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>QUICK CMD</span>
        <span style={{ display: "inline-flex", gap: 4 }}>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>
      <div style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 4, display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <Avatar name="Karan Kinariwala" tone="ink" size={28}/>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>Karan K.</span>
          <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>SUPER · GBA</span>
        </div>
        <Btn variant="ghost" size="xs" icon="logout"/>
      </div>
    </aside>
  );
}

function DesktopTopBarB({ title, breadcrumb = [], actions, filters }) {
  return (
    <div style={{ padding: "14px 24px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          {breadcrumb.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {breadcrumb.map((b, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span>/</span>}
                  <span>{b}</span>
                </React.Fragment>
              ))}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "0", fontFamily: "var(--font-mono)" }}>{title}</h1>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 8, marginRight: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
            <Icon name="search" size={12}/>
            <span>Search anywhere</span>
            <Kbd>⌘</Kbd><Kbd>K</Kbd>
          </div>
          {actions}
        </div>
      </div>
      {filters && <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>{filters}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Dashboard
// ──────────────────────────────────────────────────────────────────────
function MobileDashboardB() {
  const s = window.SAMPLE_STATS;
  return (
    <div className="dir-b" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarB meta="19 May · 14:38"/>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 96px", display: "flex", flexDirection: "column", gap: 12 }} className="no-scrollbar">
        {/* Sync state — plain language, reads at a glance */}
        <div role="status" aria-live="polite" style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--ink-2)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-bg)" }}/>
            <span>Synced just now</span>
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>14:38:02</span>
        </div>

        {/* Hero metric: open count */}
        <Card padded style={{ display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--accent-border)", background: "var(--accent-bg)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)" }}>Open reports</span>
            <span style={{ fontSize: 12, color: "var(--accent-ink)", opacity: 0.8 }}>Waiting for review</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 56, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--accent-ink)", lineHeight: 1 }} aria-label="218 open reports">218</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--accent-ink)" }}>+12 since 6 am</span>
              <span style={{ fontSize: 12, color: "var(--accent-ink)", opacity: 0.8 }}>3 marked high severity</span>
            </div>
          </div>
          <Btn variant="accent" size="md" iconRight="arrow_right" style={{ width: "100%", minHeight: 44 }}>Start reviewing</Btn>
        </Card>

        {/* Metrics grid — plain labels, mono numerals */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Under review",     value: s.by_status.under_review,            sub: `Median ${s.median_resolution_hours}h to close` },
            { label: "Resolved this week", value: s.resolved_this_week,              sub: "+18% vs last week" },
            { label: "Total reports",    value: s.total_reports.toLocaleString(),    sub: "Since 1 Mar 2026" },
            { label: "Duplicates merged",value: "8.4%",                              sub: "Matched by photo + location" },
          ].map((c, i) => (
            <Card key={i} padded style={{ borderRadius: 6, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{c.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>{c.value}</span>
              <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.3 }}>{c.sub}</span>
            </Card>
          ))}
        </div>

        {/* Severity composition — accessible: bar-pattern + count + percent, color is supporting only */}
        <Card padded style={{ borderRadius: 6, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Severity of open reports</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>282 open</span>
          </div>
          <div role="list" aria-label="Open reports by severity" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { sev: "high",   label: "High",   count: 89,  pct: 32, note: "needs attention" },
              { sev: "medium", label: "Medium", count: 156, pct: 55, note: null },
              { sev: "low",    label: "Low",    count: 37,  pct: 13, note: null },
            ].map((row) => (
              <div role="listitem" key={row.sev} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}>
                <SeverityIndicator severity={row.sev} style="bars"/>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${row.pct}%`, height: "100%", background: `var(--sev-${row.sev})` }}/>
                  </div>
                  {row.note && <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{row.note}</span>}
                </div>
                <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{row.count}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{row.pct}%</span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent activity — plain English headings, mono fingerprint kept on IDs + times */}
        <Card padded style={{ borderRadius: 6, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Recent activity</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Last 6 hours</span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
            {[
              { t: "14:35", action: "New",          c: "var(--status-submitted)", id: "WLK-7AC30", cat: "Broken footpath", ward: "Shivajinagar", flag: null },
              { t: "14:23", action: "New",          c: "var(--status-submitted)", id: "WLK-7AC2F", cat: "Broken footpath", ward: "Shivajinagar", flag: "likely duplicate" },
              { t: "13:51", action: "New",          c: "var(--status-submitted)", id: "WLK-7AC2E", cat: "Unsafe crossing", ward: "Domlur",         flag: null },
              { t: "11:08", action: "New",          c: "var(--status-submitted)", id: "WLK-7AC2D", cat: "Blocked footpath",ward: "Shivajinagar", flag: null },
              { t: "10:14", action: "Under review", c: "var(--status-review)",    id: "WLK-7AC2C", cat: "Ravi K.",          ward: "GBA",          flag: null },
              { t: "09:42", action: "Under review", c: "var(--status-review)",    id: "WLK-7AC2B", cat: "Anita S.",         ward: "BBMP",         flag: null },
            ].map((row, i) => (
              <li key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: i === 0 ? "none" : "1px dashed var(--border)", fontSize: 12, minHeight: 36 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", flexShrink: 0, width: 38 }}>{row.t}</span>
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: row.c, flexShrink: 0 }}/>
                <span style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{row.action}</span>
                  <span style={{ color: "var(--muted)" }}> · </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{row.id}</span>
                  <span style={{ color: "var(--muted)" }}> · </span>
                  <span>{row.cat}</span>
                  <span style={{ color: "var(--muted)" }}>, {row.ward}</span>
                  {row.flag && <span style={{ color: "var(--warn-ink)", fontWeight: 600 }}> · {row.flag}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <MobileTabBarB active="dashboard"/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Reports list (card stream)
// ──────────────────────────────────────────────────────────────────────
function ReportCardB({ r }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: window.STATUS_LABELS[r.status].dot }}/>
          <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{r.id}</span>
        </span>
        <span>{r.relative.toUpperCase()}</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <PhotoTile photo={r.photo} size={64} radius={4}/>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{window.CATEGORIES[r.category].en}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {r.ward_name} · {r.location_source.toUpperCase()}
          </span>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.description}</p>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
        <SeverityIndicator severity={r.severity} style="bars"/>
        {r.duplicate_count > 0
          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--warn-ink)" }}>
              <Icon name="duplicate" size={12}/>
              DUP +{r.duplicate_count}
              <ConfidencePill level={r.duplicate_confidence}/>
            </span>
          : <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>NO_DUPES</span>}
      </div>
    </div>
  );
}

function MobileReportsListB() {
  const reports = window.SAMPLE_REPORTS;
  return (
    <div className="dir-b" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarB meta="QUEUE · 218 OPEN"/>

      {/* Filter strip */}
      <div style={{ padding: "10px 14px 8px", display: "flex", gap: 6, overflowX: "auto", background: "var(--surface)", borderBottom: "1px solid var(--border)" }} className="no-scrollbar">
        <span style={{ padding: "4px 10px", borderRadius: 4, background: "var(--ink)", color: "var(--bg)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 5 }}>ALL · 7</span>
        <span style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--status-submitted)"}}/>SUBMITTED · 218</span>
        <span style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--status-review)"}}/>REVIEW · 64</span>
        <span style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.04em" }}>SEV: HIGH</span>
      </div>
      <div style={{ padding: "8px 14px", display: "flex", gap: 6, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <Input icon="search" placeholder="Search · ward · id · text…" style={{ flex: 1, height: 34, borderRadius: 4 }}/>
        <Btn variant="secondary" size="sm" icon="sort"/>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 96px", display: "flex", flexDirection: "column", gap: 8 }} className="no-scrollbar">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.05em" }}>
          <span>TODAY · 19 MAY · 5 REPORTS</span>
          <span>SORT: NEWEST</span>
        </div>
        {reports.slice(0, 5).map(r => <ReportCardB key={r.id} r={r}/>)}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 2px 0", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.05em" }}>
          <span>YESTERDAY · 18 MAY</span>
        </div>
        {reports.slice(5).map(r => <ReportCardB key={r.id} r={r}/>)}
      </div>

      <MobileTabBarB active="reports"/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Reports compact rows (tweak alt)
// ──────────────────────────────────────────────────────────────────────
function MobileReportsCompactB() {
  const reports = window.SAMPLE_REPORTS;
  return (
    <div className="dir-b" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarB meta="QUEUE · COMPACT"/>

      {/* Filter chips — same vocabulary as the card-stream view */}
      <div style={{ padding: "10px 14px 8px", display: "flex", gap: 6, overflowX: "auto", background: "var(--surface)", borderBottom: "1px solid var(--border)" }} className="no-scrollbar">
        <span style={{ padding: "4px 10px", borderRadius: 4, background: "var(--ink)", color: "var(--bg)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>ALL · {reports.length}</span>
        <span style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--status-submitted)"}}/>SUBMITTED</span>
        <span style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--status-review)"}}/>REVIEW</span>
      </div>

      <div style={{ padding: "8px 14px", display: "flex", gap: 6, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <Input icon="search" placeholder="Filter · ward · id · text…" style={{ flex: 1, height: 32, borderRadius: 4 }}/>
        <Btn variant="secondary" size="sm" icon="sort"/>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 96px" }} className="no-scrollbar">
        {/* Day group label — preserves B's tabular voice */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px 6px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.05em" }}>
          <span>TODAY · 19 MAY · {reports.slice(0, 5).length} REPORTS</span>
          <span>SORT: NEWEST</span>
        </div>

        {/* One bordered list card containing all rows — A's structural pattern, B's surface treatment */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          {reports.slice(0, 5).map((r, i) => (
            <div key={r.id} className="press" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <PhotoTile photo={r.photo} size={44} radius={4}/>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{window.CATEGORIES[r.category].en}</span>
                  <StatusBadge status={r.status} size="sm" monoLabel/>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{r.id}</span>
                    <span>·</span>
                    <span style={{ textTransform: "uppercase" }}>{r.ward_name}</span>
                    <span>·</span>
                    <span>{r.relative.toUpperCase()}</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {r.duplicate_count > 0 && <span style={{ color: "var(--warn-ink)", fontWeight: 600 }}>+{r.duplicate_count}</span>}
                    <SeverityIndicator severity={r.severity} style="bars"/>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 2px 6px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.05em" }}>
          <span>YESTERDAY · 18 MAY</span>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          {reports.slice(5).map((r, i) => (
            <div key={r.id} className="press" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <PhotoTile photo={r.photo} size={44} radius={4}/>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{window.CATEGORIES[r.category].en}</span>
                  <StatusBadge status={r.status} size="sm" monoLabel/>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{r.id}</span>
                    <span>·</span>
                    <span style={{ textTransform: "uppercase" }}>{r.ward_name}</span>
                    <span>·</span>
                    <span>{r.relative.toUpperCase()}</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {r.duplicate_count > 0 && <span style={{ color: "var(--warn-ink)", fontWeight: 600 }}>+{r.duplicate_count}</span>}
                    <SeverityIndicator severity={r.severity} style="bars"/>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MobileTabBarB active="reports"/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Report detail
// ──────────────────────────────────────────────────────────────────────
function MobileReportDetailB() {
  const r = window.SAMPLE_REPORTS[0];
  const timeline = window.SAMPLE_TIMELINE;
  return (
    <div className="dir-b" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarB back title={r.id} meta=""/>

      <div style={{ flex: 1, overflowY: "auto" }} className="no-scrollbar">
        {/* Photo */}
        <div className={r.photo} style={{ width: "100%", height: 280, position: "relative" }}>
          <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between" }}>
            <span style={{ padding: "4px 8px", background: "rgba(10,10,10,0.85)", color: "#fafaf9", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", borderRadius: 4, backdropFilter: "blur(8px)" }}>1 / 1</span>
            <span style={{ padding: "4px 8px", background: "rgba(10,10,10,0.85)", color: "#fafaf9", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", borderRadius: 4, backdropFilter: "blur(8px)" }}>EXIF · CONFIRMED</span>
          </div>
          <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between" }}>
            <button className="press" style={{ width: 36, height: 36, borderRadius: 4, background: "rgba(255,255,255,0.95)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon name="zoom_in" size={16}/></button>
            <span style={{ padding: "4px 8px", background: "rgba(255,255,255,0.95)", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", borderRadius: 4 }}>SHA: 8f4a…2c9b</span>
          </div>
        </div>

        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge status={r.status} monoLabel/>
              <SeverityIndicator severity={r.severity} style="bars"/>
              {r.duplicate_count > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 4, background: "var(--warn-bg)", border: "1px solid var(--warn-border)", color: "var(--warn-ink)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}>
                  <Icon name="duplicate" size={11}/>DUP +{r.duplicate_count}
                </span>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>{window.CATEGORIES[r.category].en}</h1>
          </div>

          {/* Telemetry block */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)" }}>
            {[
              ["LAT/LNG",       "12.9854, 77.6065"],
              ["WARD",          "Shivajinagar · BBMP East"],
              ["LOCATION_SRC",  r.location_source.toUpperCase()],
              ["SUBMITTED_AT",  "2026-05-19 14:23 IST"],
              ["DUP_CONF",      r.duplicate_confidence.toUpperCase()],
              ["UUID",          r.uuid.slice(0, 18) + "…"],
            ].map(([k, v], i) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "110px 1fr", padding: "8px 12px", borderTop: i === 0 ? "none" : "1px dashed var(--border)" }}>
                <span style={{ color: "var(--muted)", letterSpacing: "0.04em" }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>

          {/* Action */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <Btn variant="accent" size="md" icon="eye">MOVE_TO_REVIEW</Btn>
            <Btn variant="secondary" size="md" icon="check">RESOLVE</Btn>
          </div>

          {/* Description */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12, background: "var(--surface)" }}>
            <SectionLabel style={{ marginBottom: 6 }}>CITIZEN_DESCRIPTION</SectionLabel>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{r.description}</p>
            {r.kn_description && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-kn)", lineHeight: 1.7 }}>{r.kn_description}</p>}
          </div>

          {/* Map */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <div className="map-tile" style={{ height: 140, position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MapPin status={r.status} size={18}/>
              </div>
              <div style={{ position: "absolute", top: 8, left: 8 }}>
                <span style={{ padding: "3px 8px", background: "rgba(255,255,255,0.92)", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em", borderRadius: 4 }}>WARD: SHIVAJINAGAR</span>
              </div>
            </div>
            <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
              <span>12.9854° N · 77.6065° E</span>
              <Btn variant="ghost" size="xs" iconRight="external">MAPS</Btn>
            </div>
          </div>

          {/* Timeline as Gantt strip */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12, background: "var(--surface)" }}>
            <SectionLabel style={{ marginBottom: 10 }}>STATUS_HISTORY · TAIL</SectionLabel>
            {timeline.map((t, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 10, paddingTop: i === 0 ? 0 : 10, borderTop: i === 0 ? "none" : "1px dashed var(--border)", marginTop: i === 0 ? 0 : 4 }}>
                <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: 2, background: t.status === "submitted" ? "var(--status-submitted)" : t.status === "under_review" ? "var(--status-review)" : "var(--status-resolved)" }}/>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.status.replace("_", " ")}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{t.at}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>BY · {t.who}</span>
                  {t.note && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.4 }}>{t.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Map
// ──────────────────────────────────────────────────────────────────────
function MobileMapB() {
  return (
    <div className="dir-b" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <div className="map-tile" style={{ position: "absolute", inset: 0 }}/>

      {/* Top bar */}
      <div style={{ position: "relative", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, zIndex: 10, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>WLK.MAP</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>28 IN VIEW · 218 TOTAL</span>
      </div>

      {/* Filter chips */}
      <div style={{ position: "relative", padding: "8px 14px", display: "flex", gap: 6, overflowX: "auto", zIndex: 10 }} className="no-scrollbar">
        {[["ALL", true], ["NEW", false], ["REVIEW", false], ["HIGH", false]].map(([label, on], i) => (
          <span key={i} style={{ padding: "4px 10px", borderRadius: 4, background: on ? "var(--ink)" : "rgba(255,255,255,0.95)", color: on ? "var(--bg)" : "var(--ink-2)", border: on ? "1px solid var(--ink)" : "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", backdropFilter: "blur(8px)" }}>{label}</span>
        ))}
      </div>

      {/* Pins */}
      {[[80, 220, "submitted"], [150, 260, "submitted"], [220, 220, "under_review"], [280, 290, "submitted"], [110, 330, "resolved"], [200, 380, "under_review"], [60, 410, "resolved"], [290, 410, "submitted"], [180, 470, "submitted"]].map(([x, y, s], i) => (
        <div key={i} style={{ position: "absolute", left: x, top: y, zIndex: 5 }}>
          <MapPin status={s} size={i === 8 ? 22 : 14}/>
        </div>
      ))}

      {/* Bottom card */}
      <div style={{ position: "absolute", bottom: 96, left: 14, right: 14, zIndex: 10 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 6, padding: 12, boxShadow: "var(--shadow-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <SectionLabel>CLUSTER · SHIVAJINAGAR</SectionLabel>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>4 REPORTS · 220m RADIUS</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <PhotoTile photo="photo" size={42} radius={4}/>
            <PhotoTile photo="photo alt-1" size={42} radius={4}/>
            <PhotoTile photo="photo alt-2" size={42} radius={4}/>
            <div style={{ width: 42, height: 42, borderRadius: 4, background: "var(--surface-2)", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>+1</div>
          </div>
          <Btn variant="accent" size="sm" iconRight="arrow_right" style={{ width: "100%" }}>OPEN_CLUSTER</Btn>
        </div>
      </div>

      <MobileTabBarB active="map"/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Login
// ──────────────────────────────────────────────────────────────────────
function MobileLoginB() {
  return (
    <div className="dir-b" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", padding: 20, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 28 }}>
        <div style={{ width: 36, height: 36, borderRadius: 4, background: "var(--ink)", color: "var(--bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>W</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, letterSpacing: "0.02em" }}>WLK.CONSOLE</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.05em" }}>BENGALURU · v2.4.1</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
        {/* ASCII style banner */}
        <pre style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: 0, lineHeight: 1.5, letterSpacing: 0 }}>
{`╭──────────────────────────────────╮
│  WALKABILITY · ADMIN · CONSOLE   │
│  GBA · Bengaluru Public Audit    │
╰──────────────────────────────────╯`}
        </pre>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "-0.01em", lineHeight: 1.15 }}>$ login</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}>// authenticate to the triage queue</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SectionLabel>USER_EMAIL</SectionLabel>
            <Input icon="mail" placeholder="you@gba.gov.in" defaultValue="kkin1995@gmail.com" style={{ height: 44, borderRadius: 4, inputStyle: { fontFamily: "var(--font-mono)" } }} inputStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}/>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <SectionLabel>PASSWORD</SectionLabel>
            <Input icon="lock" type="password" defaultValue="••••••••••••" style={{ height: 44, borderRadius: 4 }} inputStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}/>
          </div>
        </div>

        <Btn variant="accent" size="lg" iconRight="arrow_right" style={{ width: "100%", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>AUTHENTICATE</Btn>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          <Icon name="shield" size={11}/>
          <span>ARGON2ID · 24H_SESSION · IP_RATELIMITED</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", letterSpacing: "0.04em", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <span>BUILD a1201da · 2026.05.19</span>
        <span>STATUS: <span style={{ color: "var(--accent-ink)" }}>● OK</span></span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Profile
// ──────────────────────────────────────────────────────────────────────
function MobileProfileB() {
  return (
    <div className="dir-b" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarB back title="PROFILE" meta=""/>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 96px", display: "flex", flexDirection: "column", gap: 12 }} className="no-scrollbar">
        <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 16, background: "var(--surface)", display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name="Karan Kinariwala" size={56} tone="ink"/>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Karan Kinariwala</h2>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>kkin1995@gmail.com</span>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <Pill tone="accent" size="sm" icon="shield" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>SUPER</Pill>
              <Pill tone="neutral" size="sm" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>GBA</Pill>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SectionLabel>DISPLAY_NAME</SectionLabel>
          <Input defaultValue="Karan Kinariwala" style={{ height: 40, borderRadius: 4 }}/>
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 14, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionLabel>CHANGE_PASSWORD</SectionLabel>
          <Input icon="lock" type="password" placeholder="Current password" style={{ height: 40, borderRadius: 4 }}/>
          <Input icon="lock" type="password" placeholder="New password (min 12 chars)" style={{ height: 40, borderRadius: 4 }}/>
          <Input icon="lock" type="password" placeholder="Confirm new password" style={{ height: 40, borderRadius: 4 }}/>
          <Btn variant="accent" size="md" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>UPDATE_PASSWORD</Btn>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>// HASH: ARGON2ID · MIN 12 CHARS</span>
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12, background: "var(--surface)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)" }}>
          <SectionLabel style={{ marginBottom: 8 }}>SESSION</SectionLabel>
          {[["LAST_LOGIN", "2026-05-19 14:00 IST"], ["IP", "203.0.113.42"], ["EXPIRES", "2026-05-20 14:00 IST"], ["AGENT", "Mobile Safari · iOS"]].map(([k, v]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "100px 1fr", padding: "5px 0", borderTop: "1px dashed var(--border)" }}>
              <span style={{ color: "var(--muted)" }}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>

        <Btn variant="danger-soft" size="md" icon="logout" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>LOGOUT_ALL_SESSIONS</Btn>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MOBILE — Empty / error
// ──────────────────────────────────────────────────────────────────────
function MobileEmptyB() {
  return (
    <div className="dir-b" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarB meta="No reports waiting"/>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 20, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 8, background: "var(--accent-bg)", color: "var(--accent-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--accent-border)" }}>
          <Icon name="check_circle" size={32}/>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 280 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>All caught up</h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
            There are no reports waiting for your review. New ones will appear here automatically as citizens submit them.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" size="md" icon="refresh" style={{ minHeight: 44 }}>Check again</Btn>
          <Btn variant="primary" size="md" iconRight="arrow_right" style={{ minHeight: 44 }}>View resolved</Btn>
        </div>
        <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", display: "flex", gap: 14 }}>
          <span>Last sync · 14:38:02</span>
          <span>Next · 14:43:02</span>
        </div>
      </div>

      <MobileTabBarB active="reports"/>
    </div>
  );
}

function MobileErrorB() {
  return (
    <div className="dir-b" style={{ width: 390, height: 780, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden", color: "var(--ink)", position: "relative" }}>
      <MobileTopBarB meta="You're offline"/>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px", gap: 16, alignItems: "stretch", overflowY: "auto" }} className="no-scrollbar">
        {/* Headline + plain-language reassurance */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 8, background: "var(--warn-bg)", color: "var(--warn-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--warn-border)" }}>
            <Icon name="warn_tri" size={32}/>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>You're offline right now</h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>
              Don't worry — everything you've changed has been saved on this device. We'll send it through automatically as soon as you're back online.
            </p>
          </div>
        </div>

        {/* Pending sync — the reassurance, made concrete */}
        <div role="status" aria-live="polite" style={{ border: "1px solid var(--accent-border)", background: "var(--accent-bg)", borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--accent-ink)" }}>
              <Icon name="check_circle" size={16}/>Saved on this device
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-ink)", opacity: 0.8 }}>3 waiting</span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
            {[
              { id: "WLK-7AC2C", action: "Marked as Under review" },
              { id: "WLK-7AC2A", action: "Note added" },
              { id: "WLK-7AC28", action: "Marked as Resolved" },
            ].map((row, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--ink-2)", padding: "6px 0", borderTop: i === 0 ? "none" : "1px dashed var(--accent-border)" }}>
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)", flexShrink: 0 }}/>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-ink)", fontWeight: 600 }}>{row.id}</span>
                <span style={{ color: "var(--muted)" }}>·</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.action}</span>
              </li>
            ))}
          </ul>
          <span style={{ fontSize: 12, color: "var(--accent-ink)", opacity: 0.85, lineHeight: 1.4 }}>
            These will go through automatically when the connection is back.
          </span>
        </div>

        {/* Reconnect action — primary and large */}
        <Btn variant="primary" size="md" icon="refresh" style={{ minHeight: 48, fontSize: 15 }}>Try to reconnect</Btn>

        {/* Connection telemetry — mono kept here; this is the place it earns its keep */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12, fontSize: 12, color: "var(--ink-2)", textAlign: "left", display: "flex", flexDirection: "column" }}>
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
        </div>

        <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
          You can keep working — reviewing reports, leaving notes, and changing status all still work without internet.
        </span>
      </div>
    </div>
  );
}

window.B = {
  MobileDashboardB, MobileReportsListB, MobileReportsCompactB, MobileReportDetailB,
  MobileMapB, MobileLoginB, MobileProfileB, MobileEmptyB, MobileErrorB,
  SidebarB, DesktopTopBarB, ReportCardB,
};
