/* Canvas composition — design canvas with all sections + artboards */

function Dark({ children }) {
  return <div className="dark" style={{ display: "contents" }}>{children}</div>;
}

function Cover() {
  return (
    <div className="dir-a" style={{ width: 1280, height: 720, background: "var(--bg)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, color: "var(--ink)", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(var(--border-strong) 1.4px, transparent 1.4px)", backgroundSize: "20px 20px", opacity: 0.45, maskImage: "linear-gradient(125deg, transparent 0%, black 25%, black 75%, transparent 100%)" }}/>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18 }}>ND</div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Namma Daari</span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Admin · Bengaluru Walkability Public Audit</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill tone="neutral" icon="clock">v0.1 · 20 May 2026</Pill>
          <Pill tone="accent">Two directions</Pill>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <SectionLabel>Design system</SectionLabel>
        <h1 style={{ margin: "10px 0 14px", fontSize: 84, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, textWrap: "balance", maxWidth: 980 }}>
          A console for triaging Bengaluru's <em style={{ fontStyle: "normal", color: "var(--accent-ink)" }}>broken footpaths.</em>
        </h1>
        <p style={{ margin: 0, fontSize: 17, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: 720 }}>
          Mobile-first system for admins of the Namma Daari public audit — built around the
          single core loop of <strong>submitted → under_review → resolved</strong>, with org-scoped
          visibility, status timelines, and proper handling of duplicate evidence.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, position: "relative" }}>
        {[
          { label: "Directions",  value: "2",  sub: "Daari Ops · Walkability Console" },
          { label: "Tokens",      value: "60+",sub: "oklch · light + dark per direction" },
          { label: "Screens",     value: "11", sub: "from login to org tree" },
          { label: "Devices",     value: "2",  sub: "mobile-first · desktop where it earns" },
        ].map((c, i) => (
          <Card key={i} padded style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--surface)" }}>
            <SectionLabel>{c.label}</SectionLabel>
            <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>{c.value}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{c.sub}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <DesignCanvas>
      <DCSection id="cover" title="Namma Daari · Admin Design System" subtitle="Two directions × 10+ screens · Mobile-first · Light + dark · Built on the citizen-app DNA">
        <DCArtboard id="cover" label="Cover" width={1280} height={720}>
          <Cover/>
        </DCArtboard>
      </DCSection>

      <DCSection id="foundations" title="Foundations" subtitle="Tokens, type, and components — A is the sibling, B is the console">
        <DCArtboard id="found-a" label="A · Daari Ops" width={880} height={620}>
          <Foundations direction="a"/>
        </DCArtboard>
        <DCArtboard id="found-b" label="B · Walkability Console" width={880} height={620}>
          <Foundations direction="b"/>
        </DCArtboard>
      </DCSection>

      <DCSection id="login" title="Login" subtitle="Same surface; very different voices">
        <DCArtboard id="login-a" label="A · warm + civic green" width={390} height={780}>
          <A.MobileLoginA/>
        </DCArtboard>
        <DCArtboard id="login-b" label="B · console / mono" width={390} height={780}>
          <B.MobileLoginB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="mob-dash" title="Dashboard · mobile" subtitle="Home after login — stats-led, with the triage CTA on top">
        <DCArtboard id="mdash-a" label="A · stats + queue CTA" width={390} height={780}>
          <A.MobileDashboardA/>
        </DCArtboard>
        <DCArtboard id="mdash-b" label="B · ops · live feed" width={390} height={780}>
          <B.MobileDashboardB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="mob-reports" title="Reports · mobile · card stream (default)" subtitle="The triage queue. Cards prioritise the photo + the location + the urgency.">
        <DCArtboard id="mrep-a-cards" label="A · card stream" width={390} height={780}>
          <A.MobileReportsListA/>
        </DCArtboard>
        <DCArtboard id="mrep-b-cards" label="B · card stream" width={390} height={780}>
          <B.MobileReportsListB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="mob-reports-compact" title="Reports · mobile · compact rows (tweak)" subtitle="The same screen with the layout tweak flipped on — for desk reviewers who want density">
        <DCArtboard id="mrep-a-compact" label="A · compact" width={390} height={780}>
          <A.MobileReportsCompactA/>
        </DCArtboard>
        <DCArtboard id="mrep-b-compact" label="B · compact" width={390} height={780}>
          <B.MobileReportsCompactB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="mob-detail" title="Report detail · mobile" subtitle="Photo is the evidence — full-bleed at the top. Status timeline + telemetry below.">
        <DCArtboard id="mdet-a" label="A · cards + timeline" width={390} height={780}>
          <A.MobileReportDetailA/>
        </DCArtboard>
        <DCArtboard id="mdet-b" label="B · telemetry grid" width={390} height={780}>
          <B.MobileReportDetailB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="mob-map" title="Reports map · mobile" subtitle="A second axis to the queue — geographic. Cluster preview slides up from the bottom.">
        <DCArtboard id="mmap-a" label="A · soft pins + glass" width={390} height={780}>
          <A.MobileMapA/>
        </DCArtboard>
        <DCArtboard id="mmap-b" label="B · console pins" width={390} height={780}>
          <B.MobileMapB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="mob-profile-states" title="Profile · empty · error · mobile" subtitle="The small stuff: account edits, inbox-zero, network failure">
        <DCArtboard id="mprof-a" label="A · profile" width={390} height={780}>
          <A.MobileProfileA/>
        </DCArtboard>
        <DCArtboard id="mempty-a" label="A · inbox zero" width={390} height={780}>
          <A.MobileEmptyA/>
        </DCArtboard>
        <DCArtboard id="merr-a" label="A · network error" width={390} height={780}>
          <A.MobileErrorA/>
        </DCArtboard>
        <DCArtboard id="mprof-b" label="B · profile" width={390} height={780}>
          <B.MobileProfileB/>
        </DCArtboard>
        <DCArtboard id="mempty-b" label="B · queue empty" width={390} height={780}>
          <B.MobileEmptyB/>
        </DCArtboard>
        <DCArtboard id="merr-b" label="B · connection lost" width={390} height={780}>
          <B.MobileErrorB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="dt-dash" title="Dashboard · desktop" subtitle="The same data, room to breathe. Big numerals, longer chart, recent submissions inline.">
        <DCArtboard id="ddash-a" label="A · greeted by name" width={1280} height={800}>
          <A.DesktopDashboardA/>
        </DCArtboard>
        <DCArtboard id="ddash-b" label="B · ops cockpit" width={1280} height={800}>
          <B.DesktopDashboardB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="dt-reports" title="Reports · desktop · table with duplicates expanded" subtitle="One row per report; the +N duplicate badge opens an inline group with confidence + distance">
        <DCArtboard id="drep-a" label="A · soft table" width={1280} height={800}>
          <A.DesktopReportsTableA/>
        </DCArtboard>
        <DCArtboard id="drep-b" label="B · mono table" width={1280} height={800}>
          <B.DesktopReportsTableB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="dt-detail" title="Report detail · desktop" subtitle="Photo viewer left, everything else right. Status timeline + inline note input.">
        <DCArtboard id="ddet-a" label="A · 60/40 split" width={1280} height={800}>
          <A.DesktopReportDetailA/>
        </DCArtboard>
        <DCArtboard id="ddet-b" label="B · 60/40 split + telemetry" width={1280} height={800}>
          <B.DesktopReportDetailB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="dt-map" title="Reports map · desktop" subtitle="A second axis to the queue — geographic. Right rail lists what's currently in view.">
        <DCArtboard id="dmap-a" label="A · soft pins + side rail" width={1280} height={800}>
          <A.DesktopMapA/>
        </DCArtboard>
        <DCArtboard id="dmap-b" label="B · console pins + side rail" width={1280} height={800}>
          <B.DesktopMapB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="dt-users" title="Users · desktop · with invite modal" subtitle="Admins listed; super-admin badge; deactivated rows fade. Modal mirrors the POST /api/admin/users contract.">
        <DCArtboard id="dusr-a" label="A · users (idle)" width={1280} height={800}>
          <A.DesktopUsersA/>
        </DCArtboard>
        <DCArtboard id="dusr-a-modal" label="A · invite admin (open)" width={1280} height={800}>
          <A.DesktopUsersA withModal/>
        </DCArtboard>
        <DCArtboard id="dusr-b" label="B · users (idle)" width={1280} height={800}>
          <B.DesktopUsersB/>
        </DCArtboard>
        <DCArtboard id="dusr-b-modal" label="B · invite_user (open)" width={1280} height={800}>
          <B.DesktopUsersB withModal/>
        </DCArtboard>
      </DCSection>

      <DCSection id="dt-orgs" title="Organizations · desktop" subtitle="GBA → corporation → ward office. Tree on the left, detail of the selected node on the right.">
        <DCArtboard id="dorg-a" label="A · indented tree" width={1280} height={800}>
          <A.DesktopOrgsA/>
        </DCArtboard>
        <DCArtboard id="dorg-b" label="B · ascii tree" width={1280} height={800}>
          <B.DesktopOrgsB/>
        </DCArtboard>
      </DCSection>

      <DCSection id="dark" title="Dark mode" subtitle="Both directions support dark from day one — same tokens, inverted neutrals. Hero screens shown.">
        <DCArtboard id="dark-mdash-a" label="A · mobile dashboard" width={390} height={780}>
          <Dark><A.MobileDashboardA/></Dark>
        </DCArtboard>
        <DCArtboard id="dark-mdash-b" label="B · mobile dashboard" width={390} height={780}>
          <Dark><B.MobileDashboardB/></Dark>
        </DCArtboard>
        <DCArtboard id="dark-mdet-a" label="A · mobile report" width={390} height={780}>
          <Dark><A.MobileReportDetailA/></Dark>
        </DCArtboard>
        <DCArtboard id="dark-mdet-b" label="B · mobile report" width={390} height={780}>
          <Dark><B.MobileReportDetailB/></Dark>
        </DCArtboard>
        <DCArtboard id="dark-ddash-a" label="A · desktop ops" width={1280} height={800}>
          <Dark><A.DesktopDashboardA/></Dark>
        </DCArtboard>
        <DCArtboard id="dark-ddash-b" label="B · desktop ops" width={1280} height={800}>
          <Dark><B.DesktopDashboardB/></Dark>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
