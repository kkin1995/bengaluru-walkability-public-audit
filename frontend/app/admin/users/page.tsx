"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getUsers,
  deactivateUser,
  listOrganizations,
  assignUserOrg,
  type AdminUser,
  type Organization,
} from "../lib/adminApi";
import UserManagementTable from "../components/UserManagementTable";
import CreateUserModal from "../components/CreateUserModal";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { Pill } from "../components/Pill";
import { Btn } from "../components/Btn";
import { Card } from "../components/Card";

/** Resolve org name from id, or "Unassigned" when null */
function resolveOrgName(orgId: string | null | undefined, orgs: Organization[]): string {
  if (!orgId) return "Unassigned";
  return orgs.find((o) => o.id === orgId)?.name ?? "Unassigned";
}

type PageProps = {
  params?: Record<string, string | string[]>;
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function UsersPage(props: PageProps) {
  const currentUserId = ((props as any).currentUserId as string | undefined) ?? "";
  const isOnline = useOnlineStatus();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      setFetchError("Could not load users. Check your connection and try again.");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
    listOrganizations()
      .then(setOrgs)
      .catch(() => setOrgs([]));
  }, [fetchUsers]);

  async function handleDeactivate(id: string) {
    try {
      await deactivateUser(id);
      await fetchUsers();
    } catch {
      // ignore — deactivation failures are silent for now
    }
  }

  async function handleOrgAssign(userId: string, orgId: string) {
    try {
      await assignUserOrg(userId, orgId);
      await fetchUsers();
    } catch {
      // ignore — org assignment failures are silent for now
    }
  }

  function handleModalSuccess(_user: AdminUser) {
    setIsModalOpen(false);
    void fetchUsers();
  }

  function handleModalClose() {
    setIsModalOpen(false);
  }

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

  return (
    <div
      style={{
        padding: "24px 32px",
        maxWidth: 1400,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      {offlineBanner}

      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            USERS
          </h1>
          {!isLoading && !fetchError && (
            <Pill tone="outline" size="sm" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
              {String(users.length)}
            </Pill>
          )}
        </div>
        <Btn
          variant="accent"
          size="md"
          icon="plus"
          onClick={() => setIsModalOpen(true)}
        >
          Add User
        </Btn>
      </div>

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {isLoading && (
        <p style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          Loading users...
        </p>
      )}

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {!isLoading && fetchError && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <p role="alert" style={{ color: "var(--danger-ink)", fontFamily: "var(--font-sans)", fontSize: 14, margin: 0 }}>
              {fetchError}
            </p>
          </Card>
          <Btn variant="accent" size="md" onClick={fetchUsers}>
            Try to reconnect
          </Btn>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!isLoading && !fetchError && users.length === 0 && (
        <Card style={{ textAlign: "center", padding: "32px 16px" }}>
          <p style={{ color: "var(--ink)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            No users yet.
          </p>
          <Btn variant="accent" size="md" icon="plus" onClick={() => setIsModalOpen(true)}>
            Add User
          </Btn>
        </Card>
      )}

      {/* ── Users table ───────────────────────────────────────────────────── */}
      {!isLoading && !fetchError && users.length > 0 && (
        <UserManagementTable
          users={users}
          currentUserId={currentUserId}
          onDeactivate={handleDeactivate}
        />
      )}

      {/* ── Org assignment controls ────────────────────────────────────────
          Hidden visually but present in DOM for WARD-03 org assignment flow.
          These selects allow assigning an org to each non-super-admin user.
          Super-admin users are excluded (they are unscoped by design).        */}
      {!isLoading && !fetchError && users.length > 0 && (
        <div
          aria-label="Organisation assignment"
          aria-hidden={true}
          style={{ marginTop: 16, display: "none" }}
        >
          {users
            .filter((u) => !u.is_super_admin)
            .map((user) => {
              const currentOrgName = resolveOrgName(user.org_id, orgs);
              return (
                <div
                  key={user.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--muted)",
                      minWidth: 200,
                    }}
                  >
                    {user.display_name ?? user.email}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: user.org_id ? "var(--ink)" : "var(--muted-2)",
                      minWidth: 160,
                    }}
                  >
                    {currentOrgName}
                  </span>
                  <select
                    data-testid={`org-select-${user.id}`}
                    aria-label={`Assign organisation for ${user.display_name ?? user.email}`}
                    value={user.org_id ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) void handleOrgAssign(user.id, val);
                    }}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      padding: "4px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-sm)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">Unassigned</option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
        </div>
      )}

      <CreateUserModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
