"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMe, updateProfile, changePassword, logout } from "../lib/adminApi";
import type { AdminUser } from "../lib/adminApi";
import { Avatar } from "../components/Avatar";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { Btn } from "../components/Btn";
import { Input } from "../components/Input";
import { SectionLabel } from "../components/SectionLabel";
import { useOnlineStatus } from "../lib/useOnlineStatus";

export default function ProfilePage() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const isOnline = useOnlineStatus();

  // ── Profile state ──────────────────────────────────────────────────────────
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Display name form
  const [displayName, setDisplayName] = useState("");
  const [initialDisplayName, setInitialDisplayName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Dark mode toggle (D-12)
  const [isDark, setIsDark] = useState(false);

  // ── Sync dark mode state from DOM on mount ─────────────────────────────────
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  // ── Load profile on mount ──────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getMe();
      setUser(data);
      const name = data.display_name ?? "";
      setDisplayName(name);
      setInitialDisplayName(name);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("401")) {
        routerRef.current.push("/admin/login");
        return;
      }
      setLoadError("Could not load profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── Save display name ──────────────────────────────────────────────────────
  const isDirty = displayName !== initialDisplayName;

  const handleSaveProfile = async () => {
    if (!isDirty) return;
    setProfileSaving(true);
    setProfileSuccess(null);
    setProfileError(null);
    try {
      const updated = await updateProfile({ display_name: displayName });
      setUser(updated);
      const newName = updated.display_name ?? "";
      setDisplayName(newName);
      setInitialDisplayName(newName);
      setProfileSuccess("Profile saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("401")) {
        routerRef.current.push("/admin/login");
        return;
      }
      setProfileError("Failed to save profile. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const clearPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleChangePassword = async () => {
    setPasswordSuccess(null);
    setPasswordError(null);

    // Client-side validation — do not call API on any failure
    if (!currentPassword || !newPassword || !confirmPassword) {
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      clearPasswordFields();
      // UI-SPEC success string: "Password updated." (embedded in "Password updated successfully.")
      setPasswordSuccess("Password updated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      clearPasswordFields();
      if (message.includes("401")) {
        setPasswordError("Could not update password. Check your current password and try again.");
      } else {
        setPasswordError("Could not update password. Check your current password and try again.");
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── Dark mode toggle (D-12) ────────────────────────────────────────────────
  const handleToggleDark = () => {
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
  };

  // ── Log out ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      routerRef.current.push("/admin/login");
    }
  };

  // ── Offline banner ─────────────────────────────────────────────────────────
  const offlineBanner = !isOnline ? (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "var(--warn-bg)",
        border: "1px solid var(--warn-border)",
        borderRadius: "var(--r-md)",
        padding: "10px 16px",
        marginBottom: 16,
        color: "var(--warn-ink)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.01em",
      }}
    >
      {"You're offline right now. Don't worry — everything you've changed has been saved on this device. We'll send it through automatically as soon as you're back online."}
    </div>
  ) : null;

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        style={{
          padding: "24px 32px",
          maxWidth: 720,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <p
          style={{
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          Loading profile...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          padding: "24px 32px",
          maxWidth: 720,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <Card style={{ marginBottom: 16 }}>
          <p
            role="alert"
            style={{
              color: "var(--danger-ink)",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              margin: 0,
            }}
          >
            {loadError}
          </p>
        </Card>
        <Btn variant="accent" size="md" onClick={loadProfile}>
          Retry
        </Btn>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayNameOrEmail = user.display_name || user.email;
  const formattedLastLogin = user.last_login_at
    ? new Date(user.last_login_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Never";

  return (
    <div
      style={{
        padding: "24px 32px",
        maxWidth: 720,
        marginLeft: "auto",
        marginRight: "auto",
        paddingBottom: 80,
      }}
    >
      {offlineBanner}

      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <h1
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink)",
          margin: 0,
          marginBottom: 24,
        }}
      >
        PROFILE
      </h1>

      {/* ── Identity card ─────────────────────────────────────────────────── */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Avatar
            name={displayNameOrEmail}
            tone={user.is_super_admin ? "accent" : "neutral"}
            size={48}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 2,
              }}
            >
              {displayNameOrEmail}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--muted)",
                marginBottom: 8,
              }}
            >
              {user.email}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Pill
                tone={user.role === "admin" ? "accent" : "neutral"}
                size="sm"
              >
                {user.role === "admin" ? "ADMIN" : "REVIEWER"}
              </Pill>
              {user.org_id && (
                <Pill tone="outline" size="sm">
                  {user.org_id}
                </Pill>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Display name ──────────────────────────────────────────────────── */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <SectionLabel style={{ marginBottom: 12 }}>Display Name</SectionLabel>
        <Input
          type="text"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setProfileSuccess(null);
            setProfileError(null);
          }}
          placeholder="Your display name"
          aria-label="Display name"
          icon="user"
        />
        {profileSuccess && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: 10,
              padding: "8px 12px",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              borderRadius: "var(--r-sm)",
              color: "var(--accent-ink)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
            }}
          >
            {profileSuccess}
          </div>
        )}
        {profileError && (
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "var(--danger-ink)",
              fontFamily: "var(--font-sans)",
            }}
          >
            {profileError}
          </p>
        )}
        <div style={{ marginTop: 14 }}>
          <Btn
            variant="accent"
            size="md"
            disabled={!isDirty || profileSaving}
            onClick={handleSaveProfile}
          >
            {profileSaving ? "Saving..." : "Save"}
          </Btn>
        </div>
      </Card>

      {/* ── Change password ───────────────────────────────────────────────── */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <SectionLabel style={{ marginBottom: 12 }}>Change Password</SectionLabel>

        <div style={{ marginBottom: 12 }}>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setPasswordSuccess(null);
              setPasswordError(null);
            }}
            placeholder="Current password"
            aria-label="Current password"
            icon="lock"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordSuccess(null);
              setPasswordError(null);
            }}
            placeholder="New password"
            aria-label="New password"
            icon="lock"
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordSuccess(null);
              setPasswordError(null);
            }}
            placeholder="Confirm password"
            aria-label="Confirm password"
            icon="lock"
          />
        </div>

        {/* Password requirement hint */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
            marginBottom: 14,
            letterSpacing: "0.01em",
          }}
        >
          {"Min. 12 characters · Argon2id"}
        </p>

        {passwordSuccess && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              borderRadius: "var(--r-sm)",
              color: "var(--accent-ink)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
            }}
          >
            {passwordSuccess}
          </div>
        )}
        {passwordError && (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              borderRadius: "var(--r-sm)",
              color: "var(--danger-ink)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
            }}
          >
            {passwordError}
          </div>
        )}

        <Btn
          variant="accent"
          size="md"
          disabled={passwordSaving}
          onClick={handleChangePassword}
        >
          {passwordSaving ? "Changing..." : "Change password"}
        </Btn>
      </Card>

      {/* ── Session telemetry ─────────────────────────────────────────────── */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <SectionLabel style={{ marginBottom: 12 }}>SESSION</SectionLabel>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            <span style={{ color: "var(--muted-2)", marginRight: 8 }}>
              Last Login
            </span>
            {formattedLastLogin}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            <span style={{ color: "var(--muted-2)", marginRight: 8 }}>
              Session Expires
            </span>
            — (not available)
          </div>
        </div>
      </Card>

      {/* ── Appearance (dark mode toggle, D-12) ───────────────────────────── */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <SectionLabel style={{ marginBottom: 8 }}>APPEARANCE</SectionLabel>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 14,
          }}
        >
          Switch between light and dark display.
        </p>
        <Btn
          variant="secondary"
          size="md"
          icon={isDark ? "sun" : "moon"}
          onClick={handleToggleDark}
        >
          {isDark ? "Switch to light" : "Switch to dark"}
        </Btn>
      </Card>

      {/* ── Security: log out all sessions ───────────────────────────────── */}
      <Card style={{ padding: 20 }}>
        <SectionLabel style={{ marginBottom: 8 }}>SECURITY</SectionLabel>
        <Btn
          variant="ghost"
          size="md"
          icon="logout"
          aria-label="Log out all sessions"
          onClick={handleLogout}
          style={{
            color: "var(--danger-ink)",
            borderColor: "var(--danger-border)",
          }}
        >
          Log out all sessions
        </Btn>
      </Card>
    </div>
  );
}
