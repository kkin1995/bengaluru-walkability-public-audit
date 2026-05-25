import { APP_VERSION } from "@/app/lib/config";

export function SiteFooter() {
  return (
    <footer
      style={{
        width: "100%",
        borderTop: "1px solid var(--border)",
        padding: "8px 20px",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "var(--bg)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted)",
          letterSpacing: "0.06em",
        }}
      >
        Namma Daari · v{APP_VERSION}
      </span>
    </footer>
  );
}
