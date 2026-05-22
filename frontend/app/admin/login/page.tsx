"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_BASE_URL as BASE } from "@/app/lib/config";
import { Input } from "../components/Input";
import { Btn } from "../components/Btn";
import { Icon } from "../components/Icon";

const RATE_LIMIT_SECONDS = 60;

// SEC-06 locked generic error strings — NEVER expose raw server messages
const ERR_INVALID_CREDENTIALS = "Incorrect email or password.";
const ERR_RATE_LIMITED = "Too many attempts. Please wait a few minutes before trying again.";
const ERR_SERVER_ERROR = "Something went wrong. Please try again.";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  // Countdown timer for 429 rate limit lockout
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) {
      if (rateLimitCountdown !== null && rateLimitCountdown <= 0) {
        setRateLimitCountdown(null);
      }
      return;
    }

    const timer = setTimeout(() => {
      setRateLimitCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [rateLimitCountdown]);

  const isRateLimited = rateLimitCountdown !== null && rateLimitCountdown > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Guard: don't call fetch if email or password is empty
    if (!email || !password) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${BASE}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        // Success — replace /admin/login in history and invalidate the RSC cache
        router.replace("/admin");
        router.refresh();
        return;
      }

      // SEC-06: map HTTP status to locked generic strings — never expose raw server messages
      if (res.status === 401) {
        setErrorMessage(ERR_INVALID_CREDENTIALS);
        setPassword("");
        // email is retained
      } else if (res.status === 429) {
        setErrorMessage(ERR_RATE_LIMITED);
        setRateLimitCountdown(RATE_LIMIT_SECONDS);
      } else {
        // All other error responses (400, 403, 5xx, etc.) → generic server error
        setErrorMessage(ERR_SERVER_ERROR);
      }
    } catch {
      // Network error (fetch threw — no HTTP response) — falls back to generic string per plan
      setErrorMessage(ERR_SERVER_ERROR);
    } finally {
      setIsLoading(false);
    }
  }

  const isSubmitDisabled = isLoading || isRateLimited;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: "16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 4,
            background: "var(--ink)",
            color: "var(--bg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}>W</div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em" }}>WLK.CONSOLE</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>BENGALURU · v2.4.1</span>
          </div>
        </div>

        {/* ASCII banner — decorative */}
        <pre aria-hidden="true" style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--muted)",
          margin: 0,
          lineHeight: 1.4,
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xs)",
          padding: "10px 12px",
          overflow: "hidden",
        }}>{`┌──────────────────────────────┐
│  WLK.CONSOLE v2.4.1          │
│  BENGALURU WALKABILITY AUDIT │
│  STATUS: OPERATIONAL         │
│  UPTIME: 99.9%  REPORTS: OK  │
└──────────────────────────────┘`}</pre>

        {/* Headline */}
        <div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            marginBottom: 6,
          }}>$ login</div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 400,
            color: "var(--muted)",
          }}>// authenticate to the triage queue</div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Email */}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)" }}>USER_EMAIL</span>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              icon="mail"
              aria-label="Email"
              placeholder="admin@example.com"
            />
          </label>

          {/* Password */}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)" }}>PASSWORD</span>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              icon="lock"
              aria-label="Password"
            />
          </label>

          {/* Error message — SEC-06 compliant, generic strings only */}
          {errorMessage && (
            <div
              role="status"
              aria-live="polite"
              style={{
                color: "var(--danger-ink)",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                padding: "8px 12px",
                borderRadius: "var(--r-sm)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Authenticate button */}
          <Btn
            type="submit"
            variant="accent"
            size="lg"
            disabled={isSubmitDisabled}
            style={{ width: "100%", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", minHeight: 48 }}
          >
            {isLoading
              ? "Signing in..."
              : isRateLimited
              ? `Try again in ${rateLimitCountdown}s`
              : "AUTHENTICATE"}
          </Btn>
        </form>

        {/* Security hint */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="shield" size={12} aria-hidden={true} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>
            ARGON2ID · 24H_SESSION · IP_RATELIMITED
          </span>
        </div>

        {/* Footer */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted-2)", letterSpacing: "0.02em" }}>
          BUILD_HASH: 0000000 · {new Date().getFullYear()} / STATUS: OK
        </div>
      </div>
    </div>
  );
}
