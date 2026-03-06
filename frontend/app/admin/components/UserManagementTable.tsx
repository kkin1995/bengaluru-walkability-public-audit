"use client";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login_at?: string | null;
}

interface UserManagementTableProps {
  users: AdminUser[];
  currentUserId: string;
  onDeactivate: (id: string) => void;
}

export default function UserManagementTable({
  users,
  currentUserId,
  onDeactivate,
}: UserManagementTableProps) {
  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">No users found.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Login
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const isDeactivateDisabled = isSelf || !user.is_active;

            return (
              <tr key={user.id} data-testid={`user-row-${user.id}`}>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {user.email}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      user.role === "admin"
                        ? "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        : "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                    }
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {/* Status dot — avoids text match collision with email substrings */}
                  <span
                    aria-label={user.is_active ? "Active" : "Account deactivated"}
                    className={
                      user.is_active
                        ? "inline-block w-2 h-2 rounded-full bg-green-500"
                        : "inline-block w-2 h-2 rounded-full bg-red-500"
                    }
                  />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-4 py-3">
                  <button
                    disabled={isDeactivateDisabled}
                    onClick={() => {
                      if (!isDeactivateDisabled) {
                        onDeactivate(user.id);
                      }
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`Deactivate user ${user.email}`}
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
