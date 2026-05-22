"use client";

import { useState } from "react";
import { createUser, type AdminUser } from "../lib/adminApi";
import { Card } from "./Card";
import { Btn } from "./Btn";
import { Input } from "./Input";
import { SectionLabel } from "./SectionLabel";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AdminUser) => void;
}

interface FormErrors {
  email?: string;
  password?: string;
  role?: string;
  api?: string;
}

export default function CreateUserModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateUserModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "reviewer" | "">("");
  const [displayName, setDisplayName] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "A valid email address is required.";
    }
    if (!password || password.length < 12) {
      errs.password = "Password must be at least 12 characters.";
    }
    if (!role) {
      errs.role = "A role is required.";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const newUser = await createUser({
        email,
        password,
        role: role as "admin" | "reviewer",
        display_name: displayName || undefined,
      });
      onSuccess(newUser);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("409")) {
        setErrors({ api: "An account with this email already exists." });
      } else {
        setErrors({ api: "Something went wrong. Please try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 16; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    setPassword(pwd);
  }

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(10,10,10,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      {/* Modal card — click inside does not close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
        }}
      >
        <Card
          style={{
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow-lg)",
            padding: 24,
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h2
              id="create-user-title"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              NEW USER
            </h2>
          </div>

          {/* API error */}
          {errors.api && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--r-md)",
                color: "var(--danger-ink)",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
              }}
            >
              {errors.api}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* EMAIL field */}
            <div style={{ marginBottom: 14 }}>
              <SectionLabel style={{ marginBottom: 6 }}>EMAIL</SectionLabel>
              <Input
                icon="mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                aria-label="Email address"
              />
              {errors.email && (
                <p style={{ marginTop: 4, fontSize: 11, color: "var(--danger-ink)", fontFamily: "var(--font-sans)" }}>
                  {errors.email}
                </p>
              )}
            </div>

            {/* DISPLAY_NAME field */}
            <div style={{ marginBottom: 14 }}>
              <SectionLabel style={{ marginBottom: 6 }}>DISPLAY_NAME</SectionLabel>
              <Input
                icon="user"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Full name (optional)"
                aria-label="Display name"
              />
            </div>

            {/* ROLE toggle — two Btn group */}
            <div style={{ marginBottom: 14 }}>
              <SectionLabel style={{ marginBottom: 6 }}>ROLE</SectionLabel>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn
                  type="button"
                  variant={role === "admin" ? "accent" : "ghost"}
                  size="sm"
                  onClick={() => setRole("admin")}
                  style={{ flex: 1 }}
                >
                  ADMIN
                </Btn>
                <Btn
                  type="button"
                  variant={role === "reviewer" ? "accent" : "ghost"}
                  size="sm"
                  onClick={() => setRole("reviewer")}
                  style={{ flex: 1 }}
                >
                  REVIEWER
                </Btn>
              </div>
              {errors.role && (
                <p style={{ marginTop: 4, fontSize: 11, color: "var(--danger-ink)", fontFamily: "var(--font-sans)" }}>
                  {errors.role}
                </p>
              )}
            </div>

            {/* INITIAL_PASSWORD field with Generate button */}
            <div style={{ marginBottom: 8 }}>
              <SectionLabel style={{ marginBottom: 6 }}>INITIAL_PASSWORD</SectionLabel>
              <Input
                icon="lock"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 12 characters"
                aria-label="Initial password"
                suffix={
                  <Btn
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={generatePassword}
                    style={{ padding: "4px 8px", minHeight: 28, fontSize: 11 }}
                  >
                    Generate
                  </Btn>
                }
              />
              {errors.password && (
                <p style={{ marginTop: 4, fontSize: 11, color: "var(--danger-ink)", fontFamily: "var(--font-sans)" }}>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Password hint — EXACT UI-SPEC string */}
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--muted)",
                marginBottom: 20,
                letterSpacing: "0.01em",
              }}
            >
              {`// MIN 12 · ARGON2ID · CHANGE_ON_FIRST_LOGIN`}
            </p>

            {/* Footer: Cancel + CREATE USER */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn
                type="button"
                variant="ghost"
                size="md"
                onClick={onClose}
              >
                Cancel
              </Btn>
              <Btn
                type="submit"
                variant="accent"
                size="md"
                iconRight="arrow_right"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "CREATE USER"}
              </Btn>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
