"use client";

import { Avatar } from "./Avatar";
import { Pill } from "./Pill";
import { Btn } from "./Btn";
import { Card } from "./Card";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  display_name?: string | null;
  is_active: boolean;
  is_super_admin?: boolean;
  last_login_at?: string | null;
  org_id?: string | null;
}

interface UserManagementTableProps {
  users: AdminUser[];
  currentUserId: string;
  onDeactivate: (id: string) => void;
}

function formatLastLogin(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function UserManagementTable({
  users,
  currentUserId,
  onDeactivate,
}: UserManagementTableProps) {
  // ── Empty state ────────────────────────────────────────────────────────────
  if (users.length === 0) {
    return (
      <Card style={{ textAlign: "center", padding: "32px 16px" }}>
        <p style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          No users found.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
        }}
      >
        <thead
          style={{
            background: "var(--surface-2)",
          }}
        >
          <tr>
            <th
              scope="col"
              style={{
                padding: "10px 16px",
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.10em",
                color: "var(--muted)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              USER
            </th>
            <th
              scope="col"
              style={{
                padding: "10px 16px",
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.10em",
                color: "var(--muted)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              ROLE
            </th>
            <th
              scope="col"
              style={{
                padding: "10px 16px",
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.10em",
                color: "var(--muted)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              ORG
            </th>
            <th
              scope="col"
              style={{
                padding: "10px 16px",
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.10em",
                color: "var(--muted)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              STATUS
            </th>
            <th
              scope="col"
              style={{
                padding: "10px 16px",
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.10em",
                color: "var(--muted)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              LAST_LOGIN
            </th>
            <th
              scope="col"
              style={{
                padding: "10px 16px",
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.10em",
                color: "var(--muted)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              ACTIONS
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const isSuperAdmin = user.is_super_admin === true;
            const isDeactivateDisabled = isSelf || !user.is_active || isSuperAdmin;
            const displayName = user.display_name || user.email;

            return (
              <tr
                key={user.id}
                data-testid={`user-row-${user.id}`}
                style={{
                  borderTop: "1px solid var(--border)",
                  opacity: user.is_active ? 1 : 0.55,
                  background: "var(--surface)",
                }}
              >
                {/* USER: Avatar + name + email */}
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={displayName} tone={isSuperAdmin ? "accent" : "neutral"} size={32} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600, color: "var(--ink)", fontSize: 13 }}>
                          {displayName}
                        </span>
                        {isSuperAdmin && (
                          <span
                            data-testid="super-admin-badge"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "1px 6px",
                              background: "var(--accent-bg)",
                              color: "var(--accent-ink)",
                              border: "1px solid var(--accent-border)",
                              borderRadius: "var(--r-full)",
                              fontFamily: "var(--font-mono)",
                              fontSize: 9,
                              fontWeight: 600,
                              letterSpacing: "0.04em",
                            }}
                          >
                            SUPER
                          </span>
                        )}
                      </div>
                      {/* Only render email as secondary line when display_name is set and differs from email */}
                      {user.display_name && user.display_name !== user.email && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                          {user.email}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* ROLE: Pill */}
                <td style={{ padding: "12px 16px" }}>
                  <Pill
                    tone={user.role === "admin" ? "accent" : "neutral"}
                    size="sm"
                  >
                    {user.role === "admin" ? "ADMIN" : "REVIEWER"}
                  </Pill>
                </td>

                {/* ORG */}
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted-2)" }}>
                    {user.org_id ? "—" : "UNASSIGNED"}
                  </span>
                </td>

                {/* STATUS: dot + text */}
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: user.is_active ? "var(--accent)" : "var(--muted-2)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      aria-label={user.is_active ? "Active" : "Account deactivated"}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      {user.is_active ? "ACTIVE" : "OFF"}
                    </span>
                  </div>
                </td>

                {/* LAST_LOGIN */}
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                    {formatLastLogin(user.last_login_at)}
                  </span>
                </td>

                {/* ACTIONS: dots icon button + inline deactivate button
                    The deactivate button is always in DOM (required by test suite).
                    Confirmation copy rendered as title tooltip per UI-SPEC:
                    "Deactivate {name}? They will lose access immediately." */}
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Dots menu icon — purely decorative, identifies the actions cell */}
                    <Btn
                      variant="ghost"
                      size="sm"
                      icon="dots"
                      aria-label={`User actions for ${displayName}`}
                      style={{ minHeight: 32, padding: "4px 8px" }}
                      disabled
                      tabIndex={-1}
                    />
                    {/* Primary action: Deactivate button — always mounted for accessibility */}
                    <button
                      disabled={isDeactivateDisabled}
                      title={
                        isSuperAdmin
                          ? "Cannot deactivate super-admin"
                          : isSelf
                          ? "You cannot deactivate your own account"
                          : !user.is_active
                          ? "Account already deactivated"
                          : `Deactivate ${displayName}? They will lose access immediately.`
                      }
                      aria-label={`Deactivate user ${displayName}`}
                      onClick={() => {
                        if (!isDeactivateDisabled) {
                          onDeactivate(user.id);
                        }
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "6px 10px",
                        border: isDeactivateDisabled
                          ? "1px solid var(--border)"
                          : "1px solid var(--danger-border)",
                        borderRadius: "var(--r-sm)",
                        background: isDeactivateDisabled ? "transparent" : "var(--danger-bg)",
                        color: isDeactivateDisabled ? "var(--muted-2)" : "var(--danger-ink)",
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: isDeactivateDisabled ? "not-allowed" : "pointer",
                        opacity: isDeactivateDisabled ? 0.5 : 1,
                        minHeight: 32,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Deactivate
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
