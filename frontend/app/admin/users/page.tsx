"use client";

import { useState, useEffect, useCallback } from "react";
import { getUsers, deactivateUser, type AdminUser } from "../lib/adminApi";
import UserManagementTable from "../components/UserManagementTable";
import CreateUserModal from "../components/CreateUserModal";

type PageProps = {
  params?: Record<string, string | string[]>;
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function UsersPage(props: PageProps) {
  const currentUserId = ((props as any).currentUserId as string | undefined) ?? "";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  }, [fetchUsers]);

  async function handleDeactivate(id: string) {
    try {
      await deactivateUser(id);
      await fetchUsers();
    } catch {
      // ignore
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

        <UserManagementTable
          users={users}
          currentUserId={currentUserId}
          onDeactivate={handleDeactivate}
        />

        <CreateUserModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      </div>
    </div>
  );
}
