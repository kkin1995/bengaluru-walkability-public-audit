"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMe, updateProfile, changePassword } from "../lib/adminApi";
import type { AdminUser } from "../lib/adminApi";

export default function ProfilePage() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

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
      setProfileSuccess("Profile saved successfully.");
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
      setPasswordSuccess("Password changed successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      clearPasswordFields();
      if (message.includes("401")) {
        setPasswordError("Current password is incorrect. Please try again.");
      } else {
        setPasswordError("Failed to change password. Please try again.");
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div role="alert" className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <p className="text-red-700">{loadError}</p>
        </div>
        <button
          onClick={loadProfile}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {/* ── Profile Section ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Profile</h2>

        {/* Email — read-only */}
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
          <p className="text-gray-900">{user.email}</p>
        </div>

        {/* Role badge */}
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">Role</p>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {user.role}
          </span>
        </div>

        {/* Display name — editable */}
        <div>
          <label
            htmlFor="display-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Display Name
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setProfileSuccess(null);
              setProfileError(null);
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {profileSuccess && (
          <p className="text-sm text-green-700">{profileSuccess}</p>
        )}
        {profileError && (
          <p className="text-sm text-red-600">{profileError}</p>
        )}

        <button
          onClick={handleSaveProfile}
          disabled={!isDirty || profileSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {profileSaving ? "Saving..." : "Save"}
        </button>
      </section>

      {/* ── Change Password Section ─────────────────────────────────────── */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Change Password</h2>

        <div>
          <label
            htmlFor="current-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Current Password
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setPasswordSuccess(null);
              setPasswordError(null);
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="new-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordSuccess(null);
              setPasswordError(null);
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordSuccess(null);
              setPasswordError(null);
            }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {passwordSuccess && (
          <p className="text-sm text-green-700">{passwordSuccess}</p>
        )}
        {passwordError && (
          <p className="text-sm text-red-600">{passwordError}</p>
        )}

        <button
          onClick={handleChangePassword}
          disabled={passwordSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {passwordSaving ? "Changing..." : "Change Password"}
        </button>
      </section>
    </div>
  );
}
