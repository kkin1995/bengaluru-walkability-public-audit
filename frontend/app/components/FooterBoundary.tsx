"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./SiteFooter";

export function FooterBoundary() {
  const pathname = usePathname();
  if (pathname === "/map") return null;
  if (pathname.startsWith("/admin")) return null;
  return <SiteFooter />;
}
