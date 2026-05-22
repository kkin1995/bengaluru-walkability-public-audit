"use client";

import type { CSSProperties, ReactElement } from "react";

export type IconName =
  | "menu" | "close" | "search" | "filter" | "chevron_right" | "chevron_down"
  | "chevron_left" | "arrow_right" | "arrow_left" | "arrow_up_right" | "plus"
  | "check" | "check_circle" | "dots" | "bell" | "pin" | "map" | "image"
  | "camera" | "user" | "users" | "shield" | "grid" | "list" | "table"
  | "clock" | "eye" | "download" | "upload" | "trash" | "edit" | "logout"
  | "lock" | "mail" | "org" | "sun" | "moon" | "activity" | "alert"
  | "warn_tri" | "info" | "refresh" | "inbox" | "flag" | "zoom_in"
  | "phone" | "external" | "duplicate" | "settings" | "sort"
  | "cat_no_path" | "cat_broken" | "cat_blocked" | "cat_crossing"
  | "cat_lighting" | "cat_other";

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
}

const P = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<IconName, ReactElement> = {
  /* Chrome */
  menu:          (<g {...P}><path d="M3 6h18M3 12h18M3 18h18"/></g>),
  close:         (<g {...P}><path d="M6 6l12 12M18 6L6 18"/></g>),
  search:        (<g {...P}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></g>),
  filter:        (<g {...P}><path d="M3 5h18M6 12h12M10 19h4"/></g>),
  chevron_right: (<g {...P}><path d="M9 6l6 6-6 6"/></g>),
  chevron_down:  (<g {...P}><path d="M6 9l6 6 6-6"/></g>),
  chevron_left:  (<g {...P}><path d="M15 6l-6 6 6 6"/></g>),
  arrow_right:   (<g {...P}><path d="M5 12h14M13 6l6 6-6 6"/></g>),
  arrow_left:    (<g {...P}><path d="M19 12H5M11 6l-6 6 6 6"/></g>),
  arrow_up_right:(<g {...P}><path d="M7 17L17 7M8 7h9v9"/></g>),
  plus:          (<g {...P}><path d="M12 5v14M5 12h14"/></g>),
  check:         (<g {...P}><path d="M4 12l5 5L20 6"/></g>),
  check_circle:  (<g {...P}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></g>),
  dots:          (<g {...P}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></g>),
  bell:          (<g {...P}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></g>),
  /* Domain */
  pin:           (<g {...P}><path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z"/><circle cx="12" cy="9" r="2.5"/></g>),
  map:           (<g {...P}><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></g>),
  image:         (<g {...P}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6"/></g>),
  camera:        (<g {...P}><path d="M3 8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/><circle cx="12" cy="13" r="4"/></g>),
  user:          (<g {...P}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></g>),
  users:         (<g {...P}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="3"/><path d="M21.5 20a5 5 0 0 0-6-4.9"/></g>),
  shield:        (<g {...P}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></g>),
  grid:          (<g {...P}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></g>),
  list:          (<g {...P}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></g>),
  table:         (<g {...P}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></g>),
  clock:         (<g {...P}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>),
  eye:           (<g {...P}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g>),
  download:      (<g {...P}><path d="M12 3v12M6 10l6 6 6-6M4 21h16"/></g>),
  upload:        (<g {...P}><path d="M12 21V9M6 14l6-6 6 6M4 3h16"/></g>),
  trash:         (<g {...P}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></g>),
  edit:          (<g {...P}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></g>),
  logout:        (<g {...P}><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></g>),
  lock:          (<g {...P}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></g>),
  mail:          (<g {...P}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></g>),
  org:           (<g {...P}><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="14" width="6" height="6" rx="1"/><rect x="16" y="14" width="6" height="6" rx="1"/><path d="M12 8v3M5 14v-1.5h14V14"/></g>),
  sun:           (<g {...P}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6L4 4M20 20l-1.6-1.6M5.6 18.4L4 20M20 4l-1.6 1.6"/></g>),
  moon:          (<g {...P}><path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z"/></g>),
  activity:      (<g {...P}><path d="M3 12h4l3-8 4 16 3-8h4"/></g>),
  alert:         (<g {...P}><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h.01"/></g>),
  warn_tri:      (<g {...P}><path d="M10.3 3.7L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></g>),
  info:          (<g {...P}><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v5h1"/></g>),
  refresh:       (<g {...P}><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 4v4h-4"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 20v-4h4"/></g>),
  inbox:         (<g {...P}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6L5.5 5z"/></g>),
  flag:          (<g {...P}><path d="M4 22V4M4 4h11l-2 4 2 4H4"/></g>),
  zoom_in:       (<g {...P}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></g>),
  phone:         (<g {...P}><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.5a16 16 0 0 0 6.4 6.4l1.1-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></g>),
  external:      (<g {...P}><path d="M15 3h6v6M10 14L21 3M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/></g>),
  duplicate:     (<g {...P}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></g>),
  settings:      (<g {...P}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></g>),
  sort:          (<g {...P}><path d="M3 6h13M3 12h9M3 18h5M17 8v12M17 8l4 4M17 8l-4 4"/></g>),
  /* Categories */
  cat_no_path:   (<g {...P}><path d="M4 20h16"/><path d="M8 20l2-14M16 20l-2-14" strokeDasharray="2 3"/><circle cx="12" cy="4" r="2"/></g>),
  cat_broken:    (<g {...P}><path d="M3 18l4-2 3 3 4-4 3 2 4-3"/><path d="M3 18v2h18v-4"/></g>),
  cat_blocked:   (<g {...P}><rect x="3" y="16" width="18" height="4" rx="1"/><path d="M7 16V8l3-4h4l3 4v8"/><path d="M10 8h4"/></g>),
  cat_crossing:  (<g {...P}><path d="M3 6h4M9 6h4M15 6h4M3 12h4M9 12h4M15 12h4M3 18h4M9 18h4M15 18h4"/></g>),
  cat_lighting:  (<g {...P}><path d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2M5.6 18.4l1.4-1.4M12 19v2M18.4 18.4l-1.4-1.4M19 12h2M18.4 5.6l-1.4 1.4"/><circle cx="12" cy="12" r="3.5"/></g>),
  cat_other:     (<g {...P}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.3-1 .9-1 1.7M12 17h.01"/></g>),
};

export function Icon({
  name,
  size = 24,
  className,
  style,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
}: IconProps): JSX.Element {
  const sizeStyle: CSSProperties = {
    display: "block",
    flexShrink: 0,
    ...style,
  };

  // Aria contract: when aria-label provided, render role="img" + label
  // Otherwise render aria-hidden="true" (decorative)
  const ariaProps =
    ariaLabel
      ? { role: "img" as const, "aria-label": ariaLabel }
      : { "aria-hidden": (ariaHidden !== false ? true : undefined) as true | undefined };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={sizeStyle}
      {...ariaProps}
    >
      {ICONS[name] ?? ICONS.dots}
    </svg>
  );
}
