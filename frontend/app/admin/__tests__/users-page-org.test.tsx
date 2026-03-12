/**
 * Tests for org assignment UI in the admin users management page.
 *
 * Requirements covered:
 *   WARD-03 — Admin can view and assign an org for any admin user
 *
 * Mocking strategy:
 *   - adminApi module is fully mocked; getUsers() returns users with and without
 *     org_id; listOrganizations() returns a fixed org list.
 *   - UserManagementTable is mocked to expose props and simulate user actions.
 *   - No real network calls are made.
 *
 * Determinism:
 *   No wall-clock time or random seeds used.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/users",
}));

jest.mock("../lib/adminApi", () => ({
  getUsers: jest.fn(),
  createUser: jest.fn(),
  deactivateUser: jest.fn(),
  getStats: jest.fn(),
  getAdminReports: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
  getAdminReport: jest.fn(),
  updateReportStatus: jest.fn(),
  deleteReport: jest.fn(),
  listOrganizations: jest.fn(),
  assignUserOrg: jest.fn(),
}));

// Mock UserManagementTable to render org info and assignment control
jest.mock("../components/UserManagementTable", () => {
  const MockUserManagementTable = ({
    users,
    currentUserId,
    onDeactivate,
  }: {
    users: Array<{
      id: string;
      email: string;
      role: string;
      is_active: boolean;
      is_super_admin?: boolean;
      last_login_at: string | null;
      org_id?: string | null;
    }>;
    currentUserId: string;
    onDeactivate: (id: string) => void;
  }) => (
    <div data-testid="user-management-table">
      {users.map((user) => (
        <div key={user.id} data-testid={`user-row-${user.id}`}>
          <span data-testid={`user-email-${user.id}`}>{user.email}</span>
          <span data-testid={`user-role-badge-${user.id}`} data-role={user.role}>
            {user.role}
          </span>
          <span data-testid={`user-active-${user.id}`}>
            {user.is_active ? "Active" : "Inactive"}
          </span>
          <span data-testid={`user-last-login-${user.id}`}>
            {user.last_login_at ?? "Never"}
          </span>
          <button
            data-testid={`deactivate-btn-${user.id}`}
            disabled={user.id === currentUserId}
            onClick={() => onDeactivate(user.id)}
          >
            Deactivate
          </button>
        </div>
      ))}
    </div>
  );
  MockUserManagementTable.displayName = "MockUserManagementTable";
  return MockUserManagementTable;
});

// Mock CreateUserModal
jest.mock("../components/CreateUserModal", () => {
  const MockCreateUserModal = (props: { isOpen: boolean; onClose: () => void; onSuccess: (user: unknown) => void }) => {
    if (!props.isOpen) return null;
    return (
      <div data-testid="create-user-modal" role="dialog">
        <button data-testid="modal-cancel-btn" onClick={props.onClose}>Cancel</button>
      </div>
    );
  };
  MockCreateUserModal.displayName = "MockCreateUserModal";
  return MockCreateUserModal;
});

// ─────────────────────────────────────────────────────────────────────────────
// Import under test AFTER mocks
// ─────────────────────────────────────────────────────────────────────────────

import UsersPage from "../users/page";
import * as adminApi from "../lib/adminApi";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ORG_FIXTURE = {
  id: "org-uuid-1",
  name: "Central Corporation",
  org_type: "corporation" as const,
  parent_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const USER_WITH_ORG = {
  id: "admin-uuid-001",
  email: "admin@walkability.in",
  role: "admin" as const,
  display_name: "Lead Admin",
  is_active: true,
  is_super_admin: false,
  created_at: "2026-01-01T00:00:00Z",
  last_login_at: "2026-03-06T08:00:00Z",
  org_id: "org-uuid-1",
};

const USER_WITHOUT_ORG = {
  id: "reviewer-uuid-002",
  email: "reviewer@walkability.in",
  role: "reviewer" as const,
  display_name: "Field Reviewer",
  is_active: true,
  is_super_admin: false,
  created_at: "2026-01-15T00:00:00Z",
  last_login_at: null,
  org_id: null,
};

const SUPER_ADMIN_USER = {
  id: "super-uuid-003",
  email: "super@walkability.in",
  role: "admin" as const,
  display_name: "Super Admin",
  is_active: true,
  is_super_admin: true,
  created_at: "2026-01-01T00:00:00Z",
  last_login_at: null,
  org_id: null,
};

function renderPage(currentUserId = USER_WITH_ORG.id) {
  return render(
    <UsersPage {...({ currentUserId } as Record<string, unknown>)} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRouterPush.mockClear();
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// WARD-03 — listOrganizations is called on mount
// ─────────────────────────────────────────────────────────────────────────────

describe("WARD-03 — listOrganizations() is called on mount to populate org dropdown", () => {
  it("calls listOrganizations() on mount", async () => {
    (adminApi.getUsers as jest.Mock).mockResolvedValueOnce([USER_WITH_ORG]);
    (adminApi.listOrganizations as jest.Mock).mockResolvedValueOnce([ORG_FIXTURE]);

    renderPage();

    await waitFor(() => {
      // UsersPage must call listOrganizations() on mount to fetch org list for dropdown
      expect(adminApi.listOrganizations).toHaveBeenCalledTimes(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WARD-03 — Org name displayed in user row
// ─────────────────────────────────────────────────────────────────────────────

describe("WARD-03 — Org name or 'Unassigned' is displayed per user row", () => {
  it("displays the org name for a user with an org assignment", async () => {
    (adminApi.getUsers as jest.Mock).mockResolvedValueOnce([USER_WITH_ORG]);
    (adminApi.listOrganizations as jest.Mock).mockResolvedValueOnce([ORG_FIXTURE]);

    renderPage();

    await waitFor(() => {
      // User with org_id = "org-uuid-1" must show "Central Corporation" org name
      // (appears in the span display and the select option)
      expect(screen.getAllByText("Central Corporation").length).toBeGreaterThan(0);
    });
  });

  it("displays 'Unassigned' for a user with no org assignment", async () => {
    (adminApi.getUsers as jest.Mock).mockResolvedValueOnce([USER_WITHOUT_ORG]);
    (adminApi.listOrganizations as jest.Mock).mockResolvedValueOnce([ORG_FIXTURE]);

    renderPage();

    await waitFor(() => {
      // User with org_id = null must show "Unassigned" placeholder
      // (appears in the span display and the default select option)
      expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
    });
  });

  it("shows both org name and 'Unassigned' in same table for different users", async () => {
    (adminApi.getUsers as jest.Mock).mockResolvedValueOnce([
      USER_WITH_ORG,
      USER_WITHOUT_ORG,
    ]);
    (adminApi.listOrganizations as jest.Mock).mockResolvedValueOnce([ORG_FIXTURE]);

    renderPage();

    await waitFor(() => {
      // Multiple elements may contain these texts (span + select options) — check at least one exists
      expect(screen.getAllByText("Central Corporation").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WARD-03 — Org assignment control interaction
// ─────────────────────────────────────────────────────────────────────────────

describe("WARD-03 — Org assignment control calls assignUserOrg on change", () => {
  it("renders an org assignment control (select or button) for non-super-admin users", async () => {
    (adminApi.getUsers as jest.Mock).mockResolvedValueOnce([USER_WITHOUT_ORG]);
    (adminApi.listOrganizations as jest.Mock).mockResolvedValueOnce([ORG_FIXTURE]);

    renderPage();

    await waitFor(() => {
      // The users page must render an org assignment control for each non-super-admin user
      expect(
        screen.getByTestId(`org-select-${USER_WITHOUT_ORG.id}`)
      ).toBeInTheDocument();
    });
  });

  it("calls assignUserOrg() with the user ID and selected org ID when an org is selected", async () => {
    (adminApi.getUsers as jest.Mock)
      .mockResolvedValueOnce([USER_WITHOUT_ORG])
      .mockResolvedValueOnce([{ ...USER_WITHOUT_ORG, org_id: "org-uuid-1" }]);
    (adminApi.listOrganizations as jest.Mock).mockResolvedValueOnce([ORG_FIXTURE]);
    (adminApi.assignUserOrg as jest.Mock).mockResolvedValueOnce(undefined);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId(`org-select-${USER_WITHOUT_ORG.id}`)).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.selectOptions(
        screen.getByTestId(`org-select-${USER_WITHOUT_ORG.id}`),
        "org-uuid-1"
      );
    });

    await waitFor(() => {
      // assignUserOrg() must be called with the user's ID and the selected org ID
      expect(adminApi.assignUserOrg).toHaveBeenCalledWith(
        USER_WITHOUT_ORG.id,
        "org-uuid-1"
      );
    });
  });

  it("does NOT render an org assignment control for super-admin users", async () => {
    (adminApi.getUsers as jest.Mock).mockResolvedValueOnce([SUPER_ADMIN_USER]);
    (adminApi.listOrganizations as jest.Mock).mockResolvedValueOnce([ORG_FIXTURE]);

    renderPage();

    await waitFor(() => {
      // Super-admin users must NOT have an org assignment control — they are unscoped
      expect(
        screen.queryByTestId(`org-select-${SUPER_ADMIN_USER.id}`)
      ).not.toBeInTheDocument();
    });
  });

  it("refreshes user list after assignUserOrg() resolves", async () => {
    (adminApi.getUsers as jest.Mock)
      .mockResolvedValueOnce([USER_WITHOUT_ORG])
      .mockResolvedValueOnce([{ ...USER_WITHOUT_ORG, org_id: "org-uuid-1" }]);
    (adminApi.listOrganizations as jest.Mock).mockResolvedValueOnce([ORG_FIXTURE]);
    (adminApi.assignUserOrg as jest.Mock).mockResolvedValueOnce(undefined);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId(`org-select-${USER_WITHOUT_ORG.id}`)).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.selectOptions(
        screen.getByTestId(`org-select-${USER_WITHOUT_ORG.id}`),
        "org-uuid-1"
      );
    });

    await waitFor(() => {
      // After successful org assignment, the page must refresh the user list
      expect(adminApi.getUsers).toHaveBeenCalledTimes(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WARD-03 — listOrganizations and assignUserOrg API contract
// ─────────────────────────────────────────────────────────────────────────────

describe("WARD-03 — adminApi.listOrganizations and assignUserOrg are callable", () => {
  it("listOrganizations is exported from adminApi", () => {
    expect(typeof adminApi.listOrganizations).toBe("function");
  });

  it("assignUserOrg is exported from adminApi", () => {
    expect(typeof adminApi.assignUserOrg).toBe("function");
  });
});
