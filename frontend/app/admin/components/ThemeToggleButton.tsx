"use client";

import { useState, useEffect } from "react";
import { Icon } from "./Icon";

export function ThemeToggleButton() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
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

  return (
    <button
      className="admin-mobile-only"
      aria-label="Toggle dark mode"
      onClick={toggle}
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "var(--r-sm)",
        background: "transparent",
        border: "1px solid var(--border)",
        color: "var(--muted)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Icon name={isDark ? "sun" : "moon"} size={14} aria-hidden={true} />
    </button>
  );
}
