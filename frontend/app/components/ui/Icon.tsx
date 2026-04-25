import type { CSSProperties, ReactElement } from "react";

export type IconName =
  | "camera" | "map" | "pin" | "arrow_right" | "arrow_left"
  | "check" | "check_circle" | "close" | "image" | "flash"
  | "flip" | "crosshair" | "edit" | "send" | "chevron_right"
  | "chevron_down" | "share" | "grid" | "list" | "filter"
  | "globe" | "menu" | "shield" | "mic"
  | "cat_no_path" | "cat_broken" | "cat_blocked" | "cat_crossing"
  | "cat_lighting" | "cat_other" | "cat_ramp" | "cat_encroach";

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

const P = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<IconName, ReactElement> = {
  camera: (<g {...P}><path d="M3 8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/><circle cx="12" cy="13" r="4"/></g>),
  map: (<g {...P}><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></g>),
  pin: (<g {...P}><path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z"/><circle cx="12" cy="9" r="2.5"/></g>),
  arrow_right: (<g {...P}><path d="M5 12h14M13 6l6 6-6 6"/></g>),
  arrow_left: (<g {...P}><path d="M19 12H5M11 6l-6 6 6 6"/></g>),
  check: (<g {...P}><path d="M4 12l5 5L20 6"/></g>),
  check_circle: (<g {...P}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></g>),
  close: (<g {...P}><path d="M6 6l12 12M18 6L6 18"/></g>),
  image: (<g {...P}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6"/></g>),
  flash: (<g {...P}><path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z"/></g>),
  flip: (<g {...P}><path d="M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M3 8V5a2 2 0 0 1 2-2h3M21 16v3a2 2 0 0 1-2 2h-3"/><circle cx="12" cy="12" r="3.5"/></g>),
  crosshair: (<g {...P}><circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></g>),
  edit: (<g {...P}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></g>),
  send: (<g {...P}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></g>),
  chevron_right: (<g {...P}><path d="M9 6l6 6-6 6"/></g>),
  chevron_down: (<g {...P}><path d="M6 9l6 6 6-6"/></g>),
  share: (<g {...P}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></g>),
  grid: (<g {...P}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></g>),
  list: (<g {...P}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></g>),
  filter: (<g {...P}><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/></g>),
  globe: (<g {...P}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></g>),
  menu: (<g {...P}><path d="M3 6h18M3 12h18M3 18h18"/></g>),
  shield: (<g {...P}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></g>),
  mic: (<g {...P}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></g>),
  cat_no_path: (<g {...P}><path d="M4 20h16"/><path d="M8 20l2-14M16 20l-2-14" strokeDasharray="2 3"/><circle cx="12" cy="4" r="2"/></g>),
  cat_broken: (<g {...P}><path d="M3 18l4-2 3 3 4-4 3 2 4-3"/><path d="M3 18v2h18v-4"/></g>),
  cat_blocked: (<g {...P}><rect x="3" y="16" width="18" height="4" rx="1"/><path d="M7 16V8l3-4h4l3 4v8"/><path d="M10 8h4"/></g>),
  cat_crossing: (<g {...P}><path d="M3 6h4M9 6h4M15 6h4M3 12h4M9 12h4M15 12h4M3 18h4M9 18h4M15 18h4"/></g>),
  cat_lighting: (<g {...P}><path d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2M5.6 18.4l1.4-1.4M12 19v2M18.4 18.4l-1.4-1.4M19 12h2M18.4 5.6l-1.4 1.4"/><circle cx="12" cy="12" r="3.5"/></g>),
  cat_other: (<g {...P}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.3-1 .9-1 1.7M12 17h.01"/></g>),
  cat_ramp: (<g {...P}><path d="M3 20h18"/><path d="M3 20L18 6h3v14"/></g>),
  cat_encroach: (<g {...P}><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 14V9h4v5M13 14V6h5v8"/></g>),
};

export function Icon({ name, size = 24, className, style, "aria-label": ariaLabel }: IconProps) {
  const sizeStyle: CSSProperties = { width: size, height: size, ...style };
  const ariaProps = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true as const };
  return (
    <svg viewBox="0 0 24 24" className={className} style={sizeStyle} {...ariaProps}>
      {ICONS[name]}
    </svg>
  );
}
