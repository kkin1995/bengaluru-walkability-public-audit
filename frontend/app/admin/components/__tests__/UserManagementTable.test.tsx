/**
 * Tests for frontend/app/admin/components/UserManagementTable.tsx
 *
 * Requirements covered (from admin-users-frontend-ac.md):
 *   R-UP-2      — Users page must render UserManagementTable showing: email, role badge,
 *                 is_active, last_login_at, and a deactivate button.
 *   R-COMP-9    — Deactivate button must be visually disabled and non-interactive for the
 *                 row corresponding to the currently authenticated user.
 *   R-COMP-10   — Role badge: blue for admin, gray for reviewer.
 *
 * AC-UP-2-S1   — Table renders all required columns; self-row deactivate button is disabled.
 * AC-UP-2-S2   — Role badges carry correct colour classes.
 *
 * Additional requirements from task specification:
 *   - Renders one row per user
 *   - Shows role badge text ("admin" / "reviewer")
 *   - Deactivate button disabled for currentUserId row; enabled for other rows
 *   - Clicking deactivate button calls onDeactivate(id) for non-self users
 *   - Inactive user (is_active=false) shows "Inactive" indicator or button in
 *     deactivated state
 *
 * Props interface (contract for the implementation agent):
 *   interface AdminUser {
 *     id: string;
 *     email: string;
 *     role: string;
 *     is_active: boolean;
 *     last_login_at?: string;
 *   }
 *   interface UserManagementTableProps {
 *     users: AdminUser[];
 *     currentUserId: string;
 *     onDeactivate: (id: string) => void;
 *   }
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserManagementTable from "../UserManagementTable";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CURRENT_USER_ID = "current-user-uuid-001";

const SELF_USER = {
  id: CURRENT_USER_ID,
  email: "current-admin@example.com",
  role: "admin",
  is_active: true,
  last_login_at: "2026-03-05T09:00:00Z",
};

const OTHER_ADMIN = {
  id: "other-admin-uuid-002",
  email: "other-admin@example.com",
  role: "admin",
  is_active: true,
  last_login_at: "2026-03-04T14:30:00Z",
};

const REVIEWER_USER = {
  id: "reviewer-uuid-003",
  email: "reviewer@example.com",
  role: "reviewer",
  is_active: true,
  last_login_at: "2026-03-01T08:00:00Z",
};

const INACTIVE_USER = {
  id: "inactive-uuid-004",
  email: "inactive@example.com",
  role: "reviewer",
  is_active: false,
  last_login_at: "2026-01-10T12:00:00Z",
};

const ALL_USERS = [SELF_USER, OTHER_ADMIN, REVIEWER_USER, INACTIVE_USER];

// ---------------------------------------------------------------------------
// Row rendering — one row per user
// ---------------------------------------------------------------------------

describe("R-UP-2 / AC-UP-2-S1 — UserManagementTable: row rendering", () => {
  it("renders one row for each user (4 users → 4 rows of content)", () => {
    render(
      <UserManagementTable
        users={ALL_USERS}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    // Each user has a distinct email — use those as row proxies.
    expect(screen.getByText("current-admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("other-admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("reviewer@example.com")).toBeInTheDocument();
    expect(screen.getByText("inactive@example.com")).toBeInTheDocument();
  });

  it("renders the email address for each user", () => {
    render(
      <UserManagementTable
        users={[OTHER_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    expect(screen.getByText("other-admin@example.com")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// R-UP-2 / R-COMP-10 — Role badge text
// ---------------------------------------------------------------------------

describe("R-UP-2 / R-COMP-10 — UserManagementTable: role badge text", () => {
  it('renders role badge with text "admin" for admin users', () => {
    render(
      <UserManagementTable
        users={[OTHER_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    expect(screen.getByText(/^admin$/i)).toBeInTheDocument();
  });

  it('renders role badge with text "reviewer" for reviewer users', () => {
    render(
      <UserManagementTable
        users={[REVIEWER_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    expect(screen.getByText(/^reviewer$/i)).toBeInTheDocument();
  });

  it("renders both role badges simultaneously when both roles are in the list", () => {
    render(
      <UserManagementTable
        users={[OTHER_ADMIN, REVIEWER_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    expect(screen.getAllByText(/^admin$/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^reviewer$/i).length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// R-COMP-10 — Role badge colour classes
// ---------------------------------------------------------------------------

describe("R-COMP-10 / AC-UP-2-S2 — UserManagementTable: role badge colour classes", () => {
  it('admin role badge carries a blue colour class (bg-blue-* or text-blue-*)', () => {
    render(
      <UserManagementTable
        users={[OTHER_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    const adminBadge = screen.getByText(/^admin$/i);
    const blueClasses = adminBadge.className
      .split(/\s+/)
      .filter((c) => c.includes("blue"));
    expect(blueClasses.length).toBeGreaterThan(0);
  });

  it('reviewer role badge carries a gray colour class (bg-gray-* or text-gray-*)', () => {
    render(
      <UserManagementTable
        users={[REVIEWER_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    const reviewerBadge = screen.getByText(/^reviewer$/i);
    const grayClasses = reviewerBadge.className
      .split(/\s+/)
      .filter((c) => c.includes("gray"));
    expect(grayClasses.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// R-COMP-9 / AC-UP-2-S1 — Self-deactivation guard
// ---------------------------------------------------------------------------

describe("R-COMP-9 / AC-UP-2-S1 — UserManagementTable: self-deactivation guard", () => {
  it("deactivate button is disabled (HTML disabled attribute) for the current user's row", () => {
    render(
      <UserManagementTable
        users={ALL_USERS}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    // Locate the row for the current user by finding the element containing their email,
    // then finding the deactivate button within that row.
    const selfEmailEl = screen.getByText("current-admin@example.com");
    // Walk up to the row container (tr or a wrapping div).
    const selfRow = selfEmailEl.closest("tr, [role='row'], li, [data-testid]");
    expect(selfRow).not.toBeNull();
    const deactivateBtn = within(selfRow as HTMLElement).getByRole("button", {
      name: /deactivate/i,
    });
    expect(deactivateBtn).toBeDisabled();
  });

  it("deactivate button for the current user has the HTML `disabled` attribute", () => {
    render(
      <UserManagementTable
        users={[SELF_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /deactivate/i });
    // The AC specifies "visually disabled and non-interactive" — the HTML disabled
    // attribute satisfies both: it prevents click events and conveys state to AT.
    expect(btn).toHaveAttribute("disabled");
  });

  it("deactivate button is enabled (not disabled) for a different user's row", () => {
    render(
      <UserManagementTable
        users={[OTHER_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /deactivate/i });
    expect(btn).not.toBeDisabled();
  });

  it("clicking the disabled self-deactivate button does NOT call onDeactivate", async () => {
    const onDeactivate = jest.fn();
    render(
      <UserManagementTable
        users={[SELF_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={onDeactivate}
      />
    );
    const btn = screen.getByRole("button", { name: /deactivate/i });
    // userEvent respects the disabled attribute and does not fire click handlers.
    await userEvent.click(btn);
    expect(onDeactivate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onDeactivate callback
// ---------------------------------------------------------------------------

describe("UserManagementTable: onDeactivate callback", () => {
  it("calls onDeactivate with the correct user id when deactivate button is clicked for a non-self user", async () => {
    const onDeactivate = jest.fn();
    render(
      <UserManagementTable
        users={[OTHER_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={onDeactivate}
      />
    );
    const btn = screen.getByRole("button", { name: /deactivate/i });
    await userEvent.click(btn);

    expect(onDeactivate).toHaveBeenCalledTimes(1);
    expect(onDeactivate).toHaveBeenCalledWith(OTHER_ADMIN.id);
  });

  it("calls onDeactivate with the reviewer user's id (not the current user's id)", async () => {
    const onDeactivate = jest.fn();
    render(
      <UserManagementTable
        users={[SELF_USER, REVIEWER_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={onDeactivate}
      />
    );
    // Find the reviewer's row and click its deactivate button.
    const reviewerEmailEl = screen.getByText("reviewer@example.com");
    const reviewerRow = reviewerEmailEl.closest(
      "tr, [role='row'], li, [data-testid]"
    );
    const btn = within(reviewerRow as HTMLElement).getByRole("button", {
      name: /deactivate/i,
    });
    await userEvent.click(btn);

    expect(onDeactivate).toHaveBeenCalledWith(REVIEWER_USER.id);
    expect(onDeactivate).not.toHaveBeenCalledWith(CURRENT_USER_ID);
  });

  it("onDeactivate is NOT called on initial render", () => {
    const onDeactivate = jest.fn();
    render(
      <UserManagementTable
        users={ALL_USERS}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={onDeactivate}
      />
    );
    expect(onDeactivate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Inactive user display
// ---------------------------------------------------------------------------

describe("UserManagementTable: inactive user display", () => {
  it('inactive user (is_active=false) shows an "Inactive" indicator or the deactivate button is in a deactivated state', () => {
    render(
      <UserManagementTable
        users={[INACTIVE_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    // Accept either: explicit "Inactive" text visible in the row, OR the deactivate
    // button is already disabled (the account is already deactivated so the action
    // is already complete).
    const inactiveText = screen.queryByText(/inactive/i);
    const deactivateBtn = screen.queryByRole("button", { name: /deactivate/i });
    const isButtonDisabled = deactivateBtn
      ? deactivateBtn.hasAttribute("disabled")
      : false;

    const hasInactiveIndicator = inactiveText !== null || isButtonDisabled;
    expect(hasInactiveIndicator).toBe(true);
  });

  it("inactive user row still renders the email address", () => {
    render(
      <UserManagementTable
        users={[INACTIVE_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    expect(screen.getByText("inactive@example.com")).toBeInTheDocument();
  });

  it("inactive user row still renders the role badge", () => {
    render(
      <UserManagementTable
        users={[INACTIVE_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    expect(screen.getByText(/^reviewer$/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge: empty users array
// ---------------------------------------------------------------------------

describe("UserManagementTable: empty users array", () => {
  it("renders without crashing when users array is empty", () => {
    expect(() =>
      render(
        <UserManagementTable
          users={[]}
          currentUserId={CURRENT_USER_ID}
          onDeactivate={jest.fn()}
        />
      )
    ).not.toThrow();
  });

  it("renders no deactivate buttons when users array is empty", () => {
    render(
      <UserManagementTable
        users={[]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );
    expect(
      screen.queryAllByRole("button", { name: /deactivate/i })
    ).toHaveLength(0);
  });
});
