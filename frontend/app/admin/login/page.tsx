"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const RATE_LIMIT_SECONDS = 60;

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(
    null
  );

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
        // Success — redirect to /admin
        router.push("/admin");
        return;
      }

      // Parse error body
      let body: { error?: string; message?: string } = {};
      try {
        body = await res.json();
      } catch {
        // ignore parse errors
      }

      if (res.status === 401) {
        setErrorMessage("Invalid email or password");
        setPassword("");
        // email is retained
      } else if (res.status === 429) {
        setErrorMessage("Too many attempts. Please wait before trying again.");
        setRateLimitCountdown(RATE_LIMIT_SECONDS);
      } else if (res.status >= 500) {
        setErrorMessage("Something went wrong. Please try again.");
      } else {
        // 400 or other client errors — surface server message or generic
        setErrorMessage(
          body.message ?? "Something went wrong. Please try again."
        );
      }
    } catch {
      // Network error
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const isSubmitDisabled = isLoading || isRateLimited;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Sign In</h1>
          <p className="text-sm text-gray-600 mt-1">
            Bengaluru Walkability Audit
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Error message */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          {/* Email field */}
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50 disabled:bg-gray-100"
              placeholder="admin@example.com"
            />
          </div>

          {/* Password field */}
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50 disabled:bg-gray-100"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading
              ? "Signing in..."
              : isRateLimited
              ? `Try again in ${rateLimitCountdown}s`
              : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
