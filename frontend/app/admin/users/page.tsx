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

type PageProps = {
  params?: Record<string, string | string[]>;
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function UsersPage(props: PageProps) {
  const currentUserId = ((props as any).currentUserId as string | undefined) ?? "";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orgAssignError, setOrgAssignError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
    listOrganizations()
      .then(setOrgs)
      .catch(() => setOrgs([]));
  }, [fetchUsers]);

  function getOrgName(orgId: string | null): string {
    if (!orgId) return "Unassigned";
    const org = orgs.find((o) => o.id === orgId);
    return org ? org.name : "Unassigned";
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateUser(id);
      await fetchUsers();
    } catch {
      // ignore
    }
  }

  async function handleOrgChange(userId: string, orgId: string | null) {
    setOrgAssignError(null);
    try {
      await assignUserOrg(userId, orgId);
      await fetchUsers();
    } catch {
      setOrgAssignError("Failed to assign org. Please try again.");
    }
  }

  function handleModalSuccess(_user: AdminUser) {
    setIsModalOpen(false);
    void fetchUsers();
  }

  function handleModalClose() {
    setIsModalOpen(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            Add User
          </button>
        </div>

        {orgAssignError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {orgAssignError}
          </div>
        )}

        <UserManagementTable
          users={users}
          currentUserId={currentUserId}
          onDeactivate={handleDeactivate}
        />

        {/* Org assignment section — shown per user below the table */}
        {users.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Organisation Assignments
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {users.map((user) => {
                if (user.is_super_admin) return null;
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">{user.email}</span>
                      <span className="ml-2 text-gray-500">
                        — {getOrgName(user.org_id)}
                      </span>
                    </div>
                    <select
                      data-testid={`org-select-${user.id}`}
                      value={user.org_id ?? ""}
                      onChange={(e) =>
                        handleOrgChange(user.id, e.target.value || null)
                      }
                      className="ml-4 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          </div>
        )}

        <CreateUserModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      </div>
    </div>
  );
}
