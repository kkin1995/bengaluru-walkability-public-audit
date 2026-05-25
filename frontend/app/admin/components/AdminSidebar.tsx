"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/lib/adminApi";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { Kbd } from "./Kbd";
import { Btn } from "./Btn";
import { APP_VERSION } from "@/app/lib/config";

interface AdminSidebarProps {
  role: string;
}

const NAV_ITEMS = [
  { key: "dashboard", href: "/admin",          icon: "activity" as const, label: "OPS"   },
  { key: "reports",   href: "/admin/reports",  icon: "inbox"    as const, label: "QUEUE" },
  { key: "map",       href: "/admin/reports/map", icon: "map"   as const, label: "MAP"   },
  { key: "users",     href: "/admin/users",    icon: "users"    as const, label: "USERS", roleGated: true },
];

const MOBILE_TABS = [
  { key: "dashboard", href: "/admin",          icon: "activity" as const, label: "OPS"   },
  { key: "reports",   href: "/admin/reports",  icon: "inbox"    as const, label: "QUEUE" },
  { key: "map",       href: "/admin/reports/map", icon: "map"   as const, label: "MAP"   },
  { key: "users",     href: "/admin/users",    icon: "users"    as const, label: "USERS", roleGated: true },
  { key: "logout",    href: "/api/admin/auth/logout", icon: "logout" as const, label: "OUT" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname.startsWith(href);
}

export default function AdminSidebar({ role }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(true);
  const [isDark, setIsDark] = useState(false);

  // Responsive switching: matchMedia listener
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);

    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Dark mode: read initial state from documentElement classList
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDarkMode() {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      localStorage.setItem("admin-theme", "light");
      setIsDark(false);
    } else {
      html.classList.add("dark");
      localStorage.setItem("admin-theme", "dark");
      setIsDark(true);
    }
  }

  const isAdminOrSuper = role === "admin" || role === "super_admin";

  async function handleLogout() {
    try {
      await logout();
    } finally {
      window.location.replace("/admin/login");
    }
  }

  const visibleMobileTabs = MOBILE_TABS.filter(
    (tab) => !(tab.roleGated && !isAdminOrSuper)
  );

  // ── Desktop Sidebar ─────────────────────────────────────────────────────────
  const desktopSidebar = (
    <nav
      aria-label="Admin navigation"
      role="navigation"
      aria-hidden={!isDesktop}
      style={{
        display: isDesktop ? "flex" : "none",
        flexDirection: "column",
        width: 220,
        minHeight: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        padding: "16px 12px",
        gap: 2,
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {/* Brand mark */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px 16px",
        borderBottom: "1px solid var(--border)",
        marginBottom: 12,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          background: "var(--ink)",
          color: "var(--bg)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 12,
          flexShrink: 0,
        }}>W</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>WLK.CONSOLE</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.06em" }}>BENGALURU · v{APP_VERSION}</span>
        </div>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        if (item.roleGated && !isAdminOrSuper) return null;
        const active = isActive(item.href, pathname);
        return (
          <a
            key={item.key}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 10px",
              borderRadius: "var(--r-sm)",
              background: active ? "var(--accent-bg)" : "transparent",
              color: active ? "var(--accent-ink)" : "var(--ink-2)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              letterSpacing: "0.04em",
              border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
              textDecoration: "none",
              minHeight: 44,
              boxSizing: "border-box",
            }}
          >
            <Icon name={item.icon} size={14} aria-hidden={true} />
            {item.label}
          </a>
        );
      })}

      {/* Organizations — desktop only, role-gated */}
      {isAdminOrSuper && (
        <a
          href="/admin/organizations"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 10px",
            borderRadius: "var(--r-sm)",
            background: isActive("/admin/organizations", pathname) ? "var(--accent-bg)" : "transparent",
            color: isActive("/admin/organizations", pathname) ? "var(--accent-ink)" : "var(--ink-2)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: isActive("/admin/organizations", pathname) ? 600 : 400,
            letterSpacing: "0.04em",
            border: isActive("/admin/organizations", pathname) ? "1px solid var(--accent-border)" : "1px solid transparent",
            textDecoration: "none",
            minHeight: 44,
            boxSizing: "border-box",
          }}
        >
          <Icon name="org" size={14} aria-hidden={true} />
          ORGS
        </a>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Quick CMD hint */}
      <div style={{
        padding: "8px 10px",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>QUICK CMD</span>
        <span style={{ display: "inline-flex", gap: 4 }}>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>

      {/* User panel with dark mode toggle */}
      <div style={{
        padding: 10,
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginTop: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/admin/profile" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, textDecoration: "none", color: "inherit" }}>
            <Avatar name="Admin" tone="ink" size={28} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>Admin</span>
              <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{role}</span>
            </div>
          </Link>
          <button
            aria-label="Log out"
            onClick={handleLogout}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "var(--r-sm)",
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              minHeight: 44,
              flexShrink: 0,
            }}
          >
            <Icon name="logout" size={14} aria-hidden={true} />
          </button>
        </div>

        {/* Dark mode toggle */}
        <button
          aria-label="Toggle dark mode"
          onClick={toggleDarkMode}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            borderRadius: "var(--r-xs)",
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.04em",
            cursor: "pointer",
            width: "100%",
            minHeight: 44,
            boxSizing: "border-box",
          }}
        >
          <Icon name={isDark ? "sun" : "moon"} size={12} aria-hidden={true} />
          {isDark ? "LIGHT MODE" : "DARK MODE"}
        </button>
      </div>
    </nav>
  );

  // ── Mobile Bottom Tab Bar ────────────────────────────────────────────────────
  const mobileTabBar = (
    <nav
      aria-label="Admin navigation"
      role="navigation"
      aria-hidden={isDesktop}
      style={{
        display: isDesktop ? "none" : "grid",
        gridTemplateColumns: `repeat(${visibleMobileTabs.length}, 1fr)`,
        gap: 2,
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "8px 10px 14px",
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        zIndex: 1000,
      }}
    >
      {visibleMobileTabs.map((tab) => {
        if (tab.key === "logout") {
          return (
            <button
              key="logout"
              onClick={handleLogout}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "6px 4px",
                borderRadius: "var(--r-sm)",
                background: "transparent",
                color: "var(--muted)",
                border: "1px solid transparent",
                cursor: "pointer",
                minHeight: 44,
                boxSizing: "border-box",
              }}
            >
              <Icon name="logout" size={18} aria-hidden={true} />
              <span style={{
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
              }}>OUT</span>
            </button>
          );
        }
        const active = isActive(tab.href, pathname);
        return (
          <a
            key={tab.key}
            href={tab.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "6px 4px",
              borderRadius: "var(--r-sm)",
              background: active ? "var(--accent-bg)" : "transparent",
              color: active ? "var(--accent-ink)" : "var(--muted)",
              border: active ? "1px solid var(--accent-border)" : "1px solid transparent",
              textDecoration: "none",
              minHeight: 44,
              boxSizing: "border-box",
            }}
          >
            <Icon name={tab.icon} size={18} aria-hidden={true} />
            <span style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
            }}>{tab.label}</span>
          </a>
        );
      })}
    </nav>
  );

  return (
    <>
      {desktopSidebar}
      {mobileTabBar}
      {/* Desktop sidebar spacer — pushes main content right */}
      <div
        aria-hidden="true"
        style={{
          display: isDesktop ? "block" : "none",
          width: 220,
          flexShrink: 0,
        }}
      />
    </>
  );
}
