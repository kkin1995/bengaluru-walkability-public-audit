/* Print-only canvas — each section is a print page, artboards laid out at native size */

function Dark({ children }) {
  return <div className="dark" style={{ display: "contents" }}>{children}</div>;
}

function CoverPrint() {
  return (
    <div className="dir-a" style={{ width: 1280, height: 720, background: "var(--bg)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, color: "var(--ink)", overflow: "hidden", position: "relative", boxSizing: "border-box" }}>
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
          <Pill tone="neutral" icon="clock">v0.1 · 21 May 2026</Pill>
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

/* A printable page. Auto-scales contents to fit within an A4-landscape printable area. */
function Page({ title, subtitle, children, layout = "row", maxItemWidth }) {
  // Page printable area target: ~1500 × 950 CSS px after .5cm margins on A4 landscape.
  return (
    <section className="print-page" style={{ width: "100%", padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14, boxSizing: "border-box", pageBreakAfter: "always", breakAfter: "page", overflow: "hidden" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 8, borderBottom: "1px solid #d6d3d1" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: "#1c1917" }}>{title}</h2>
          {subtitle && <p style={{ margin: 0, fontSize: 12, color: "#78716c", lineHeight: 1.4 }}>{subtitle}</p>}
        </div>
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#a8a29e", letterSpacing: "0.05em" }}>NAMMA DAARI · ADMIN</span>
      </header>
      <div className={`print-row print-row-${layout}`} data-max-w={maxItemWidth} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: layout === "col" ? "column" : "row", gap: 16, alignItems: "flex-start", justifyContent: "flex-start", flexWrap: layout === "wrap" ? "wrap" : "nowrap" }}>
        {children}
      </div>
    </section>
  );
}

/* Artboard wrapper — the same shape as DCArtboard, but plain and print-safe. */
function Frame({ label, width, height, children }) {
  return (
    <div className="print-frame" data-w={width} data-h={height} style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "#78716c", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
      <div className="print-frame-body" style={{ width, height, background: "#fff", border: "1px solid #e7e5e4", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        {children}
      </div>
    </div>
  );
}

function AppPrint() {
  return (
    <div className="print-doc">
      {/* Cover — own page, landscape proportions */}
      <section className="print-page" style={{ width: "100%", padding: 0, pageBreakAfter: "always", breakAfter: "page", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div className="print-frame-body cover-frame" style={{ width: 1280, height: 720, transformOrigin: "center center" }}>
          <CoverPrint/>
        </div>
      </section>

      <Page title="Foundations" subtitle="Tokens, type, and components — A is the sibling, B is the console" layout="row">
        <Frame label="A · Daari Ops" width={880} height={620}><Foundations direction="a"/></Frame>
        <Frame label="B · Walkability Console" width={880} height={620}><Foundations direction="b"/></Frame>
      </Page>

      <Page title="Login" subtitle="Same surface; very different voices" layout="row">
        <Frame label="A · warm + civic green" width={390} height={780}><A.MobileLoginA/></Frame>
        <Frame label="B · console / mono" width={390} height={780}><B.MobileLoginB/></Frame>
      </Page>

      <Page title="Dashboard · mobile" subtitle="Home after login — stats-led, with the triage CTA on top" layout="row">
        <Frame label="A · stats + queue CTA" width={390} height={780}><A.MobileDashboardA/></Frame>
        <Frame label="B · ops · live feed" width={390} height={780}><B.MobileDashboardB/></Frame>
      </Page>

      <Page title="Reports · mobile · card stream (default)" subtitle="The triage queue. Cards prioritise the photo + the location + the urgency." layout="row">
        <Frame label="A · card stream" width={390} height={780}><A.MobileReportsListA/></Frame>
        <Frame label="B · card stream" width={390} height={780}><B.MobileReportsListB/></Frame>
      </Page>

      <Page title="Reports · mobile · compact rows (tweak)" subtitle="Same screen with the layout tweak flipped on — A's structural pattern, B's voice" layout="row">
        <Frame label="A · compact" width={390} height={780}><A.MobileReportsCompactA/></Frame>
        <Frame label="B · compact" width={390} height={780}><B.MobileReportsCompactB/></Frame>
      </Page>

      <Page title="Report detail · mobile" subtitle="Photo is the evidence — full-bleed at the top. Status timeline + telemetry below." layout="row">
        <Frame label="A · cards + timeline" width={390} height={780}><A.MobileReportDetailA/></Frame>
        <Frame label="B · telemetry grid" width={390} height={780}><B.MobileReportDetailB/></Frame>
      </Page>

      <Page title="Reports map · mobile" subtitle="A second axis to the queue — geographic. Cluster preview slides up from the bottom." layout="row">
        <Frame label="A · soft pins + glass" width={390} height={780}><A.MobileMapA/></Frame>
        <Frame label="B · console pins" width={390} height={780}><B.MobileMapB/></Frame>
      </Page>

      <Page title="Profile · empty · error · mobile (Direction A)" subtitle="The small stuff: account edits, inbox-zero, you're-offline reassurance" layout="row">
        <Frame label="A · profile" width={390} height={780}><A.MobileProfileA/></Frame>
        <Frame label="A · all caught up" width={390} height={780}><A.MobileEmptyA/></Frame>
        <Frame label="A · you're offline" width={390} height={780}><A.MobileErrorA/></Frame>
      </Page>

      <Page title="Profile · empty · error · mobile (Direction B)" subtitle="Same shape, B's voice — work-saved reassurance with pending-sync list" layout="row">
        <Frame label="B · profile" width={390} height={780}><B.MobileProfileB/></Frame>
        <Frame label="B · all caught up" width={390} height={780}><B.MobileEmptyB/></Frame>
        <Frame label="B · you're offline" width={390} height={780}><B.MobileErrorB/></Frame>
      </Page>

      <Page title="Dashboard · desktop" subtitle="The same data, room to breathe. Big numerals, longer chart, recent submissions inline." layout="col">
        <Frame label="A · greeted by name" width={1280} height={800}><A.DesktopDashboardA/></Frame>
        <Frame label="B · ops cockpit" width={1280} height={800}><B.DesktopDashboardB/></Frame>
      </Page>

      <Page title="Reports · desktop · table with duplicates expanded" subtitle="One row per report; the +N duplicate badge opens an inline group with confidence + distance" layout="col">
        <Frame label="A · soft table" width={1280} height={800}><A.DesktopReportsTableA/></Frame>
        <Frame label="B · mono table" width={1280} height={800}><B.DesktopReportsTableB/></Frame>
      </Page>

      <Page title="Report detail · desktop" subtitle="Photo viewer left, everything else right. Status timeline + inline note input." layout="col">
        <Frame label="A · 60/40 split" width={1280} height={800}><A.DesktopReportDetailA/></Frame>
        <Frame label="B · 60/40 split + telemetry" width={1280} height={800}><B.DesktopReportDetailB/></Frame>
      </Page>

      <Page title="Reports map · desktop" subtitle="A second axis to the queue — geographic. Right rail lists what's currently in view." layout="col">
        <Frame label="A · soft pins + side rail" width={1280} height={800}><A.DesktopMapA/></Frame>
        <Frame label="B · console pins + side rail" width={1280} height={800}><B.DesktopMapB/></Frame>
      </Page>

      <Page title="Users · desktop · admin + invite" subtitle="Admins listed; super-admin badge; deactivated rows fade. Modal mirrors POST /api/admin/users." layout="col">
        <Frame label="A · users (idle)" width={1280} height={800}><A.DesktopUsersA/></Frame>
        <Frame label="A · invite admin (open)" width={1280} height={800}><A.DesktopUsersA withModal/></Frame>
      </Page>

      <Page title="Users · desktop · admin + invite (Direction B)" subtitle="Same flow in the console voice — modal mirrors invite_user contract" layout="col">
        <Frame label="B · users (idle)" width={1280} height={800}><B.DesktopUsersB/></Frame>
        <Frame label="B · invite_user (open)" width={1280} height={800}><B.DesktopUsersB withModal/></Frame>
      </Page>

      <Page title="Organizations · desktop" subtitle="GBA → corporation → ward office. Tree on the left, detail of the selected node on the right." layout="col">
        <Frame label="A · indented tree" width={1280} height={800}><A.DesktopOrgsA/></Frame>
        <Frame label="B · ascii tree" width={1280} height={800}><B.DesktopOrgsB/></Frame>
      </Page>

      <Page title="Dark mode · mobile" subtitle="Both directions support dark from day one — same tokens, inverted neutrals." layout="row">
        <Frame label="A · dashboard" width={390} height={780}><Dark><A.MobileDashboardA/></Dark></Frame>
        <Frame label="B · dashboard" width={390} height={780}><Dark><B.MobileDashboardB/></Dark></Frame>
        <Frame label="A · report" width={390} height={780}><Dark><A.MobileReportDetailA/></Dark></Frame>
        <Frame label="B · report" width={390} height={780}><Dark><B.MobileReportDetailB/></Dark></Frame>
      </Page>

      <Page title="Dark mode · desktop" subtitle="Hero screens shown in dark." layout="col">
        <Frame label="A · desktop ops" width={1280} height={800}><Dark><A.DesktopDashboardA/></Dark></Frame>
        <Frame label="B · desktop ops" width={1280} height={800}><Dark><B.DesktopDashboardB/></Dark></Frame>
      </Page>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppPrint/>);

/* After mount, fit each frame to its page's printable area by computing a uniform scale. */
function fitFrames() {
  const pages = document.querySelectorAll(".print-page");
  pages.forEach(page => {
    const row = page.querySelector(".print-row");
    if (!row) {
      // Cover page — scale single body
      const body = page.querySelector(".cover-frame");
      if (body) {
        const pw = page.clientWidth, ph = page.clientHeight;
        const fw = parseInt(body.style.width, 10), fh = parseInt(body.style.height, 10);
        const scale = Math.min(pw / fw, ph / fh, 1);
        body.style.transform = `scale(${scale})`;
      }
      return;
    }
    const frames = row.querySelectorAll(".print-frame");
    if (!frames.length) return;

    const layout = row.classList.contains("print-row-col") ? "col" : "row";
    const pageRect = page.getBoundingClientRect();
    const header = page.querySelector("header");
    const headerH = header ? header.getBoundingClientRect().height + 14 : 0;
    const availW = pageRect.width - 56;            // matches padding
    const availH = pageRect.height - 40 - headerH; // matches padding + gap

    // Read native widths/heights from the inline style
    const dims = [...frames].map(f => {
      const body = f.querySelector(".print-frame-body");
      const w = parseInt(body.style.width, 10);
      const h = parseInt(body.style.height, 10);
      return { f, body, w, h };
    });

    if (layout === "row") {
      const gap = 16;
      const totalW = dims.reduce((acc, d) => acc + d.w, 0) + gap * (dims.length - 1);
      const maxH = Math.max(...dims.map(d => d.h));
      const scale = Math.min(availW / totalW, availH / (maxH + 16) /* label */, 1);
      dims.forEach(d => {
        d.body.style.transform = `scale(${scale})`;
        d.body.style.transformOrigin = "top left";
        d.f.style.width = (d.w * scale) + "px";
        d.f.style.height = (d.h * scale + 16) + "px";
        d.body.style.flexShrink = 0;
      });
    } else {
      // col: stack vertically; uniform scale by min(width-fit, height-fit/total)
      const gap = 16;
      const maxW = Math.max(...dims.map(d => d.w));
      const totalH = dims.reduce((acc, d) => acc + d.h + 16, 0) + gap * (dims.length - 1);
      const scale = Math.min(availW / maxW, availH / totalH, 1);
      dims.forEach(d => {
        d.body.style.transform = `scale(${scale})`;
        d.body.style.transformOrigin = "top left";
        d.f.style.width = (d.w * scale) + "px";
        d.f.style.height = (d.h * scale + 16) + "px";
      });
      // center the column horizontally
      row.style.alignItems = "center";
    }
  });
}

// Run after fonts + content settle
(function scheduleFit() {
  const go = () => {
    fitFrames();
    // re-run once more in case images/SVGs settled
    setTimeout(fitFrames, 200);
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(go, 100));
  } else {
    setTimeout(go, 400);
  }
  window.addEventListener("resize", fitFrames);
})();
