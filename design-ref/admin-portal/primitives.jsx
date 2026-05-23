/* Shared primitives — driven by CSS variables, work for both directions */
/* eslint-disable react/prop-types */

const Icon = ({ name, size = 18, stroke = 1.75, className = "", style = {} }) => {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    /* Chrome */
    menu:         <g {...p}><path d="M3 6h18M3 12h18M3 18h18"/></g>,
    close:        <g {...p}><path d="M6 6l12 12M18 6L6 18"/></g>,
    search:       <g {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></g>,
    filter:       <g {...p}><path d="M3 5h18M6 12h12M10 19h4"/></g>,
    chevron_right:<g {...p}><path d="M9 6l6 6-6 6"/></g>,
    chevron_down: <g {...p}><path d="M6 9l6 6 6-6"/></g>,
    chevron_left: <g {...p}><path d="M15 6l-6 6 6 6"/></g>,
    arrow_right:  <g {...p}><path d="M5 12h14M13 6l6 6-6 6"/></g>,
    arrow_left:   <g {...p}><path d="M19 12H5M11 6l-6 6 6 6"/></g>,
    arrow_up_right: <g {...p}><path d="M7 17L17 7M8 7h9v9"/></g>,
    plus:         <g {...p}><path d="M12 5v14M5 12h14"/></g>,
    check:        <g {...p}><path d="M4 12l5 5L20 6"/></g>,
    check_circle: <g {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></g>,
    dots:         <g {...p}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></g>,
    bell:         <g {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></g>,
    /* Domain */
    pin:          <g {...p}><path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z"/><circle cx="12" cy="9" r="2.5"/></g>,
    map:          <g {...p}><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></g>,
    image:        <g {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6"/></g>,
    camera:       <g {...p}><path d="M3 8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/><circle cx="12" cy="13" r="4"/></g>,
    user:         <g {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></g>,
    users:        <g {...p}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="3"/><path d="M21.5 20a5 5 0 0 0-6-4.9"/></g>,
    shield:       <g {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></g>,
    grid:         <g {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></g>,
    list:         <g {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></g>,
    table:        <g {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></g>,
    clock:        <g {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>,
    eye:          <g {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g>,
    download:     <g {...p}><path d="M12 3v12M6 10l6 6 6-6M4 21h16"/></g>,
    upload:       <g {...p}><path d="M12 21V9M6 14l6-6 6 6M4 3h16"/></g>,
    trash:        <g {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></g>,
    edit:         <g {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></g>,
    logout:       <g {...p}><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></g>,
    lock:         <g {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></g>,
    mail:         <g {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></g>,
    org:          <g {...p}><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="14" width="6" height="6" rx="1"/><rect x="16" y="14" width="6" height="6" rx="1"/><path d="M12 8v3M5 14v-1.5h14V14"/></g>,
    sun:          <g {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6L4 4M20 20l-1.6-1.6M5.6 18.4L4 20M20 4l-1.6 1.6"/></g>,
    moon:         <g {...p}><path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z"/></g>,
    activity:     <g {...p}><path d="M3 12h4l3-8 4 16 3-8h4"/></g>,
    alert:        <g {...p}><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h.01"/></g>,
    warn_tri:     <g {...p}><path d="M10.3 3.7L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></g>,
    info:         <g {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v5h1"/></g>,
    refresh:      <g {...p}><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 4v4h-4"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 20v-4h4"/></g>,
    inbox:        <g {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6L5.5 5z"/></g>,
    flag:         <g {...p}><path d="M4 22V4M4 4h11l-2 4 2 4H4"/></g>,
    zoom_in:      <g {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></g>,
    phone:        <g {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.5a16 16 0 0 0 6.4 6.4l1.1-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></g>,
    external:     <g {...p}><path d="M15 3h6v6M10 14L21 3M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/></g>,
    duplicate:    <g {...p}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></g>,
    settings:     <g {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></g>,
    sort:         <g {...p}><path d="M3 6h13M3 12h9M3 18h5M17 8v12M17 8l4 4M17 8l-4 4"/></g>,
    /* Categories */
    cat_no_path:   <g {...p}><path d="M4 20h16"/><path d="M8 20l2-14M16 20l-2-14" strokeDasharray="2 3"/><circle cx="12" cy="4" r="2"/></g>,
    cat_broken:    <g {...p}><path d="M3 18l4-2 3 3 4-4 3 2 4-3"/><path d="M3 18v2h18v-4"/></g>,
    cat_blocked:   <g {...p}><rect x="3" y="16" width="18" height="4" rx="1"/><path d="M7 16V8l3-4h4l3 4v8"/><path d="M10 8h4"/></g>,
    cat_crossing:  <g {...p}><path d="M3 6h4M9 6h4M15 6h4M3 12h4M9 12h4M15 12h4M3 18h4M9 18h4M15 18h4"/></g>,
    cat_lighting:  <g {...p}><path d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2M5.6 18.4l1.4-1.4M12 19v2M18.4 18.4l-1.4-1.4M19 12h2M18.4 5.6l-1.4 1.4"/><circle cx="12" cy="12" r="3.5"/></g>,
    cat_other:     <g {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.3-1 .9-1 1.7M12 17h.01"/></g>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={{ display: "block", flexShrink: 0, ...style }} aria-hidden="true">
      {icons[name] || icons.dots}
    </svg>
  );
};

/* Button */
const Btn = ({ variant = "primary", size = "md", icon, iconRight, className = "", style = {}, children, ...rest }) => {
  const sizes = {
    xs: { padding: "6px 10px",  fontSize: 12, borderRadius: "var(--r-sm)", minHeight: 28, gap: 6 },
    sm: { padding: "8px 12px",  fontSize: 13, borderRadius: "var(--r-sm)", minHeight: 34, gap: 8 },
    md: { padding: "10px 14px", fontSize: 14, borderRadius: "var(--r-md)", minHeight: 40, gap: 8 },
    lg: { padding: "14px 18px", fontSize: 15, borderRadius: "var(--r-md)", minHeight: 48, gap: 10 },
  };
  const variants = {
    primary:   { background: "var(--ink)",        color: "var(--bg)",         fontWeight: 600 },
    accent:    { background: "var(--accent)",     color: "var(--on-accent)",  fontWeight: 600 },
    secondary: { background: "var(--surface)",    color: "var(--ink)",        fontWeight: 500, boxShadow: "inset 0 0 0 1px var(--border-strong)" },
    ghost:     { background: "transparent",       color: "var(--ink-2)",      fontWeight: 500 },
    soft:      { background: "var(--surface-2)",  color: "var(--ink)",        fontWeight: 500 },
    danger:    { background: "var(--danger)",     color: "#fff",              fontWeight: 600 },
    "danger-soft": { background: "var(--danger-bg)", color: "var(--danger-ink)", fontWeight: 600, boxShadow: "inset 0 0 0 1px var(--danger-border)" },
  };
  return (
    <button
      className={`press ${className}`}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", ...sizes[size], ...variants[variant], ...style }}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "xs" ? 13 : size === "sm" ? 14 : 16}/>}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "xs" ? 13 : size === "sm" ? 14 : 16}/>}
    </button>
  );
};

/* Pill / chip */
const Pill = ({ tone = "neutral", size = "md", icon, dot, className = "", style = {}, children }) => {
  const tones = {
    neutral:  { background: "var(--surface-2)",    color: "var(--ink-2)",     border: "1px solid var(--border)" },
    outline:  { background: "transparent",         color: "var(--ink-2)",     border: "1px solid var(--border-strong)" },
    accent:   { background: "var(--accent-bg)",    color: "var(--accent-ink)",border: "1px solid var(--accent-border)" },
    danger:   { background: "var(--danger-bg)",    color: "var(--danger-ink)",border: "1px solid var(--danger-border)" },
    warn:     { background: "var(--warn-bg)",      color: "var(--warn-ink)",  border: "1px solid var(--warn-border)" },
    info:     { background: "var(--info-bg)",      color: "var(--info-ink)",  border: "1px solid var(--info-border)" },
    ink:      { background: "var(--ink)",          color: "var(--bg)",        border: "1px solid var(--ink)" },
  };
  const sizes = {
    sm: { padding: "2px 8px",  fontSize: 11, gap: 5, borderRadius: "var(--r-full)" },
    md: { padding: "4px 10px", fontSize: 12, gap: 6, borderRadius: "var(--r-full)" },
    lg: { padding: "6px 12px", fontSize: 13, gap: 7, borderRadius: "var(--r-full)" },
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontWeight: 500, lineHeight: 1, whiteSpace: "nowrap", ...sizes[size], ...tones[tone], ...style }} className={className}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, flexShrink: 0 }}/>}
      {icon && <Icon name={icon} size={12}/>}
      {children}
    </span>
  );
};

/* Status badge — derives color from status enum */
const StatusBadge = ({ status, size = "md", monoLabel = false }) => {
  const map = {
    submitted:    { tone: "info",   dot: "var(--status-submitted)", label: "Submitted" },
    under_review: { tone: "warn",   dot: "var(--status-review)",    label: "Under Review" },
    resolved:     { tone: "accent", dot: "var(--status-resolved)",  label: "Resolved" },
  };
  const m = map[status] || map.submitted;
  return (
    <Pill tone={m.tone} size={size} dot={m.dot} style={monoLabel ? { fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.02em", textTransform: "uppercase" } : {}}>
      {m.label}
    </Pill>
  );
};

/* Severity indicator — Direction A: pill, Direction B: bars */
const SeverityIndicator = ({ severity, style: bars = "pill" }) => {
  const map = { low: { color: "var(--sev-low)", label: "Low", level: 1 }, medium: { color: "var(--sev-medium)", label: "Medium", level: 2 }, high: { color: "var(--sev-high)", label: "High", level: 3 } };
  const s = map[severity] || map.medium;
  if (bars === "bars") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 12 }}>
          {[4, 8, 12].map((h, i) => (
            <span key={i} style={{ width: 3, height: h, background: i < s.level ? s.color : "var(--border-strong)", borderRadius: 1 }}/>
          ))}
        </span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-2)" }}>{s.label}</span>
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }}/>
      <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 500 }}>{s.label}</span>
    </span>
  );
};

/* Card */
const Card = ({ className = "", style = {}, children, padded = true, hoverable = false, ...rest }) => (
  <div
    className={`${hoverable ? "press" : ""} ${className}`}
    style={{
      background: "var(--surface)",
      borderRadius: "var(--r-lg)",
      boxShadow: "var(--shadow-sm)",
      border: "1px solid var(--border)",
      padding: padded ? 16 : 0,
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);

/* Section label — mono uppercase eyebrow */
const SectionLabel = ({ children, style = {} }) => (
  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", ...style }}>
    {children}
  </div>
);

/* Input */
const Input = ({ icon, suffix, style = {}, inputStyle = {}, ...rest }) => (
  <label style={{ position: "relative", display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", padding: "0 12px", height: 40, gap: 8, ...style }}>
    {icon && <Icon name={icon} size={16} style={{ color: "var(--muted)" }}/>}
    <input
      style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontSize: 14, fontFamily: "inherit", minWidth: 0, ...inputStyle }}
      {...rest}
    />
    {suffix}
  </label>
);

/* Select — visually styled, non-functional */
const Select = ({ value, icon, style = {}, chevron = true }) => (
  <span style={{ display: "inline-flex", alignItems: "center", height: 36, background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", padding: "0 10px 0 12px", gap: 8, fontSize: 13, color: "var(--ink)", whiteSpace: "nowrap", ...style }}>
    {icon && <Icon name={icon} size={14} style={{ color: "var(--muted)" }}/>}
    <span>{value}</span>
    {chevron && <Icon name="chevron_down" size={14} style={{ color: "var(--muted)" }}/>}
  </span>
);

/* Category icon block — colored tile */
const CategoryGlyph = ({ name, size = 36, tone = "neutral" }) => {
  const cat = window.CATEGORIES[name] || window.CATEGORIES.other;
  const tones = {
    neutral: { bg: "var(--surface-2)", fg: "var(--ink-2)" },
    accent:  { bg: "var(--accent-bg)", fg: "var(--accent-ink)" },
    warn:    { bg: "var(--warn-bg)", fg: "var(--warn-ink)" },
    danger:  { bg: "var(--danger-bg)", fg: "var(--danger-ink)" },
  };
  const t = tones[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "var(--r-md)", background: t.bg, color: t.fg, flexShrink: 0 }}>
      <Icon name={cat.icon} size={size * 0.55}/>
    </span>
  );
};

/* Diagonal-striped placeholder thumbnail with text */
const PhotoTile = ({ photo = "photo", size = 64, label, radius = "var(--r-md)" }) => (
  <span className={photo} style={{ display: "inline-flex", alignItems: "flex-end", justifyContent: "flex-start", width: size, height: size, borderRadius: radius, flexShrink: 0, position: "relative", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)" }}>
    {label && <span style={{ position: "absolute", bottom: 4, left: 6, fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}>{label}</span>}
  </span>
);

/* Map pin marker — for inline maps */
const MapPin = ({ status = "submitted", size = 14, style = {} }) => {
  const color = { submitted: "var(--status-submitted)", under_review: "var(--status-review)", resolved: "var(--status-resolved)" }[status];
  return (
    <span style={{ width: size, height: size, borderRadius: 999, background: color, border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", display: "inline-block", ...style }}/>
  );
};

/* Mini bar chart — sparkline-ish */
const Sparkbars = ({ values, color = "var(--accent)", height = 36, width = 120, gap = 2 }) => {
  const max = Math.max(...values, 1);
  const barW = (width - gap * (values.length - 1)) / values.length;
  return (
    <svg width={width} height={height} style={{ display: "block" }} aria-hidden="true">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return <rect key={i} x={i * (barW + gap)} y={height - h} width={barW} height={h} fill={color} rx="1"/>;
      })}
    </svg>
  );
};

/* Avatar — initials only */
const Avatar = ({ name, size = 32, tone = "neutral" }) => {
  const initials = (name || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const tones = {
    neutral: { bg: "var(--surface-3)", fg: "var(--ink-2)" },
    accent:  { bg: "var(--accent-bg)", fg: "var(--accent-ink)" },
    ink:     { bg: "var(--ink)",       fg: "var(--bg)" },
  };
  const t = tones[tone];
  return (
    <span style={{ width: size, height: size, borderRadius: "var(--r-full)", background: t.bg, color: t.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 600, fontFamily: "var(--font-sans)", letterSpacing: "0.02em", flexShrink: 0 }}>
      {initials}
    </span>
  );
};

/* Confidence pill — for dedup */
const ConfidencePill = ({ level }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "1px 7px", borderRadius: "var(--r-full)", fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", background: level === "high" ? "var(--warn-bg)" : "var(--surface-2)", color: level === "high" ? "var(--warn-ink)" : "var(--muted)", border: `1px solid ${level === "high" ? "var(--warn-border)" : "var(--border)"}`}}>
    <span style={{ width: 5, height: 5, borderRadius: 999, background: level === "high" ? "var(--warn)" : "var(--muted)" }}/>
    {level === "high" ? "HIGH CONF" : "LOW CONF"}
  </span>
);

/* Bilingual span — used for citizen content inside admin (descriptions) */
const Bi = ({ en, kn, vertical = true, style = {} }) => (
  <span style={{ display: "inline-flex", flexDirection: vertical ? "column" : "row", gap: vertical ? 2 : 8, ...style }}>
    <span>{en}</span>
    {kn && <span className="kn" style={{ color: "var(--muted)", fontSize: "0.9em" }}>{kn}</span>}
  </span>
);

/* Kbd — for command palette / shortcuts */
const Kbd = ({ children, style = {} }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", border: "1px solid var(--border-strong)", borderBottomWidth: 2, borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-2)", background: "var(--surface)", lineHeight: 1.4, ...style }}>{children}</span>
);

Object.assign(window, { Icon, Btn, Pill, StatusBadge, SeverityIndicator, Card, SectionLabel, Input, Select, CategoryGlyph, PhotoTile, MapPin, Sparkbars, Avatar, ConfidencePill, Bi, Kbd });
