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

    if (!email || !password) return;

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
        window.location.href = "/admin";
        return;
      }

      // SEC-06: map HTTP status to locked generic strings
      if (res.status === 401) {
        setErrorMessage(ERR_INVALID_CREDENTIALS);
        setPassword("");
      } else if (res.status === 429) {
        setErrorMessage(ERR_RATE_LIMITED);
        setRateLimitCountdown(RATE_LIMIT_SECONDS);
      } else {
        setErrorMessage(ERR_SERVER_ERROR);
      }
    } catch {
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
      flexDirection: "column",
      padding: "20px",
      color: "var(--ink)",
    }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 28 }}>
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
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, letterSpacing: "0.02em" }}>WLK.CONSOLE</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.05em" }}>BENGALURU · v0.1.0</span>
        </div>
      </div>

      {/* Centered form area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, maxWidth: 420, width: "100%" }}>

        {/* ASCII banner */}
        <pre aria-hidden="true" style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--muted)",
          margin: 0,
          lineHeight: 1.5,
          letterSpacing: 0,
        }}>{`╭──────────────────────────────────╮
│  WALKABILITY · ADMIN · CONSOLE   │
│  GBA · Bengaluru Public Audit    │
╰──────────────────────────────────╯`}</pre>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}>$ login</h1>
          <p style={{
            margin: 0,
            fontSize: 13,
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.02em",
          }}>{'// authenticate to the triage queue'}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Email — div wrapper avoids nested <label> (Input renders its own <label>) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              htmlFor="email"
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)" }}
            >
              USER_EMAIL
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              icon="mail"
              placeholder="you@nammadaari.com"
              style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
            />
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              htmlFor="password"
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)" }}
            >
              PASSWORD
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              icon="lock"
              style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
            />
          </div>

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

          <Btn
            type="submit"
            variant="accent"
            size="lg"
            iconRight="arrow_right"
            disabled={isSubmitDisabled}
            style={{ width: "100%", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginTop: 4 }}
          >
            {isLoading
              ? "Signing in..."
              : isRateLimited
              ? `Try again in ${rateLimitCountdown}s`
              : "AUTHENTICATE"}
          </Btn>
        </form>

        {/* Security hint */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
          <Icon name="shield" size={11} aria-hidden={true} />
          <span>ARGON2ID · 24H_SESSION · IP_RATELIMITED</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        color: "var(--muted)",
        letterSpacing: "0.04em",
        borderTop: "1px solid var(--border)",
        paddingTop: 12,
      }}>
        <span>BUILD_HASH: 0000000 · {new Date().getFullYear()}</span>
        <span>STATUS: <span style={{ color: "var(--accent-ink)" }}>● OK</span></span>
      </div>
    </div>
  );
}
