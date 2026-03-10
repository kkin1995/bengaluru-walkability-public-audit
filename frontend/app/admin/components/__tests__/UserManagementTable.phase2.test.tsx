/**
 * Phase 2 tests for frontend/app/admin/components/UserManagementTable.tsx
 *
 * Requirements covered (from admin-phase2-ac.md — Feature 1: Super-Admin Protection):
 *   SA-FE-2 / AC-SA-FE-2-S1 — Crown badge visible and deactivate button disabled for super-admin row
 *   SA-FE-2 / AC-SA-FE-2-S2 — Clicking the disabled deactivate button does NOT call onDeactivate
 *   SA-FE-2 / AC-SA-FE-2-F1 — Crown badge absent for non-super-admin user
 *   SA-FE-2 / AC-SA-FE-2-F2 — Disabled deactivate button has accessible description (tooltip)
 *   EC-SA-4                  — Multiple super-admins both show badge and have disabled buttons
 *
 * Mocking strategy:
 *   - Renders UserManagementTable directly (no adminApi calls needed for this component).
 *   - Users prop now includes `is_super_admin: boolean` field (SA-FE-1 contract).
 *
 * Determinism:
 *   No wall-clock time, network calls, or random seeds used.
 *   jest.setup.ts clearAllMocks() in afterEach covers call history.
 *
 * Implementation contract:
 *   UserManagementTable must accept users with `is_super_admin: boolean`.
 *   When `is_super_admin === true`:
 *     - Render an element with data-testid="super-admin-badge" OR aria-label="Super Admin"
 *     - The deactivate button for that row must have the HTML `disabled` attribute
 *     - The deactivate button must have aria-describedby or title attribute with tooltip copy
 *   When `is_super_admin === false`:
 *     - No super-admin badge element present in that row
 *     - Deactivate button not disabled (unless is_active=false or isSelf)
 *
 * Do not modify tests. Tests are the behavioral contract.
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserManagementTable from "../UserManagementTable";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_USER_ID = "phase2-current-uuid-001";

/** Super-admin user — is_super_admin: true */
const SUPER_ADMIN_USER = {
  id: "super-admin-uuid-100",
  email: "superadmin@example.com",
  role: "admin",
  is_active: true,
  is_super_admin: true,
  last_login_at: "2026-03-01T10:00:00Z",
};

/** Regular admin user — is_super_admin: false */
const REGULAR_ADMIN = {
  id: "regular-admin-uuid-200",
  email: "regular-admin@example.com",
  role: "admin",
  is_active: true,
  is_super_admin: false,
  last_login_at: "2026-03-02T09:00:00Z",
};

/** Regular reviewer — is_super_admin: false */
const REGULAR_REVIEWER = {
  id: CURRENT_USER_ID,
  email: "reviewer@example.com",
  role: "reviewer",
  is_active: true,
  is_super_admin: false,
  last_login_at: "2026-03-03T08:00:00Z",
};

/** Second super-admin — for EC-SA-4 multi-super-admin test */
const SECOND_SUPER_ADMIN = {
  id: "super-admin-uuid-101",
  email: "superadmin2@example.com",
  role: "admin",
  is_active: true,
  is_super_admin: true,
  last_login_at: "2026-03-04T07:00:00Z",
};

// ─────────────────────────────────────────────────────────────────────────────
// SA-FE-2 / AC-SA-FE-2-S1 — Crown badge and disabled button for super-admin
// ─────────────────────────────────────────────────────────────────────────────

describe("SA-FE-2 / AC-SA-FE-2-S1 — Super-admin row shows crown badge and disabled button", () => {
  it("super-admin row renders an element with data-testid='super-admin-badge' or aria-label='Super Admin'", () => {
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER, REGULAR_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    // The super-admin badge must be identifiable via testid or aria-label.
    // Accept either data-testid="super-admin-badge" or aria-label="Super Admin".
    const badgeByTestId = document.querySelector('[data-testid="super-admin-badge"]');
    const badgeByAriaLabel = document.querySelector('[aria-label="Super Admin"]');
    const hasBadge = badgeByTestId !== null || badgeByAriaLabel !== null;

    expect(hasBadge).toBe(
      true,
      'Super-admin row must contain an element with data-testid="super-admin-badge" or aria-label="Super Admin"'
    );
  });

  it("deactivate button for super-admin row has the HTML `disabled` attribute", () => {
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    const superAdminEmailEl = screen.getByText("superadmin@example.com");
    const superAdminRow = superAdminEmailEl.closest("tr, [role='row'], li, [data-testid]");
    expect(superAdminRow).not.toBeNull();
    const deactivateBtn = within(superAdminRow as HTMLElement).getByRole("button", {
      name: /deactivate/i,
    });

    expect(deactivateBtn).toBeDisabled(
      /* message: "Deactivate button for super-admin user must be disabled — super-admin accounts cannot be deactivated" */
    );
    expect(deactivateBtn).toHaveAttribute(
      "disabled",
      /* message: "Deactivate button must carry the HTML disabled attribute (not just aria-disabled)" */
    );
  });

  it("deactivate button for non-super-admin active user is NOT disabled", () => {
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER, REGULAR_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    const regularAdminEmailEl = screen.getByText("regular-admin@example.com");
    const regularAdminRow = regularAdminEmailEl.closest("tr, [role='row'], li, [data-testid]");
    expect(regularAdminRow).not.toBeNull();
    const deactivateBtn = within(regularAdminRow as HTMLElement).getByRole("button", {
      name: /deactivate/i,
    });

    expect(deactivateBtn).not.toBeDisabled(
      /* message: "Deactivate button for a regular (non-super-admin) active user must NOT be disabled" */
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-FE-2 / AC-SA-FE-2-S2 — Disabled super-admin deactivate button is not interactive
// ─────────────────────────────────────────────────────────────────────────────

describe("SA-FE-2 / AC-SA-FE-2-S2 — Clicking disabled super-admin deactivate button does NOT call onDeactivate", () => {
  it("clicking the disabled super-admin deactivate button does not invoke onDeactivate callback", async () => {
    const onDeactivate = jest.fn();
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={onDeactivate}
      />
    );

    const superAdminEmailEl = screen.getByText("superadmin@example.com");
    const superAdminRow = superAdminEmailEl.closest("tr, [role='row'], li, [data-testid]");
    const deactivateBtn = within(superAdminRow as HTMLElement).getByRole("button", {
      name: /deactivate/i,
    });

    // userEvent respects disabled attribute; click on disabled element should not invoke handler
    await userEvent.click(deactivateBtn);

    expect(onDeactivate).not.toHaveBeenCalled(
      /* message: "Clicking a disabled super-admin deactivate button must not invoke onDeactivate — super-admin is protected from deactivation" */
    );
  });

  it("no confirmation dialog or state change occurs when disabled super-admin button is clicked", async () => {
    const onDeactivate = jest.fn();
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={onDeactivate}
      />
    );

    const deactivateBtn = screen.getByRole("button", { name: /deactivate/i });
    await userEvent.click(deactivateBtn);

    // The callback must not have been called at all — no dialog, no API call
    expect(onDeactivate).toHaveBeenCalledTimes(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-FE-2 / AC-SA-FE-2-F1 — Badge absent for non-super-admin
// ─────────────────────────────────────────────────────────────────────────────

describe("SA-FE-2 / AC-SA-FE-2-F1 — Crown badge absent for non-super-admin users", () => {
  it("regular admin row does NOT contain super-admin badge element", () => {
    render(
      <UserManagementTable
        users={[REGULAR_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    const regularAdminEmailEl = screen.getByText("regular-admin@example.com");
    const regularAdminRow = regularAdminEmailEl.closest("tr, [role='row'], li, [data-testid]");
    expect(regularAdminRow).not.toBeNull();

    // Neither data-testid="super-admin-badge" nor aria-label="Super Admin" must appear
    const badgeByTestId = (regularAdminRow as HTMLElement).querySelector(
      '[data-testid="super-admin-badge"]'
    );
    const badgeByAriaLabel = (regularAdminRow as HTMLElement).querySelector(
      '[aria-label="Super Admin"]'
    );

    expect(badgeByTestId).toBeNull(
      /* message: "Regular admin row must NOT contain a super-admin badge element" */
    );
    expect(badgeByAriaLabel).toBeNull(
      /* message: "Regular admin row must NOT contain an element with aria-label='Super Admin'" */
    );
  });

  it("reviewer row does NOT contain super-admin badge element", () => {
    render(
      <UserManagementTable
        users={[REGULAR_REVIEWER]}
        currentUserId="other-uuid"
        onDeactivate={jest.fn()}
      />
    );

    const badgeByTestId = document.querySelector('[data-testid="super-admin-badge"]');
    const badgeByAriaLabel = document.querySelector('[aria-label="Super Admin"]');

    expect(badgeByTestId).toBeNull();
    expect(badgeByAriaLabel).toBeNull();
  });

  it("table with only non-super-admin users has no super-admin badge anywhere in the DOM", () => {
    render(
      <UserManagementTable
        users={[REGULAR_ADMIN, REGULAR_REVIEWER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    expect(document.querySelector('[data-testid="super-admin-badge"]')).toBeNull();
    expect(document.querySelector('[aria-label="Super Admin"]')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-FE-2 / AC-SA-FE-2-F2 — Disabled super-admin button has accessible description (tooltip)
// ─────────────────────────────────────────────────────────────────────────────

describe("SA-FE-2 / AC-SA-FE-2-F2 — Disabled super-admin deactivate button has accessible description", () => {
  it("disabled super-admin deactivate button has aria-describedby or title attribute explaining why it is disabled", () => {
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    const superAdminEmailEl = screen.getByText("superadmin@example.com");
    const superAdminRow = superAdminEmailEl.closest("tr, [role='row'], li, [data-testid]");
    const deactivateBtn = within(superAdminRow as HTMLElement).getByRole("button", {
      name: /deactivate/i,
    });

    // The button must explain (via aria-describedby or title) why it is disabled.
    // AC-SA-FE-2-F2 requires COPY.admin.superAdmin.deactivateTooltip as the value placeholder.
    const hasAriaDescribedBy = deactivateBtn.hasAttribute("aria-describedby");
    const hasTitle = deactivateBtn.hasAttribute("title");

    expect(hasAriaDescribedBy || hasTitle).toBe(
      true,
      "Disabled super-admin deactivate button must have aria-describedby or title attribute explaining why it is disabled (COPY.admin.superAdmin.deactivateTooltip)"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EC-SA-4 — Two super-admins in DB: both rows show badge, both buttons disabled
// ─────────────────────────────────────────────────────────────────────────────

describe("EC-SA-4 — Multiple super-admin rows all show badge and have disabled deactivate buttons", () => {
  it("both super-admin rows render a badge each", () => {
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER, SECOND_SUPER_ADMIN, REGULAR_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    const badgesByTestId = document.querySelectorAll('[data-testid="super-admin-badge"]');
    const badgesByAriaLabel = document.querySelectorAll('[aria-label="Super Admin"]');
    const totalBadges = badgesByTestId.length + badgesByAriaLabel.length;

    // There are 2 super-admins; at least 2 badge elements must be present
    expect(totalBadges).toBeGreaterThanOrEqual(
      2,
      "Each super-admin row must render its own badge — 2 super-admin users → at least 2 badge elements"
    );
  });

  it("both super-admin deactivate buttons are disabled", () => {
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER, SECOND_SUPER_ADMIN, REGULAR_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    // Check super-admin row 1
    const row1EmailEl = screen.getByText("superadmin@example.com");
    const row1 = row1EmailEl.closest("tr, [role='row'], li, [data-testid]");
    const btn1 = within(row1 as HTMLElement).getByRole("button", { name: /deactivate/i });
    expect(btn1).toBeDisabled();

    // Check super-admin row 2
    const row2EmailEl = screen.getByText("superadmin2@example.com");
    const row2 = row2EmailEl.closest("tr, [role='row'], li, [data-testid]");
    const btn2 = within(row2 as HTMLElement).getByRole("button", { name: /deactivate/i });
    expect(btn2).toBeDisabled();

    // Regular admin row button is NOT disabled
    const regularEmailEl = screen.getByText("regular-admin@example.com");
    const regularRow = regularEmailEl.closest("tr, [role='row'], li, [data-testid]");
    const regularBtn = within(regularRow as HTMLElement).getByRole("button", {
      name: /deactivate/i,
    });
    expect(regularBtn).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-FE-2 combined — badge and button state in a mixed-user list
// ─────────────────────────────────────────────────────────────────────────────

describe("SA-FE-2 — Mixed list: super-admin badge appears only on correct rows", () => {
  it("renders exactly one badge when exactly one user is super-admin in the list", () => {
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER, REGULAR_ADMIN, REGULAR_REVIEWER]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    const badgesByTestId = document.querySelectorAll('[data-testid="super-admin-badge"]');
    const badgesByAriaLabel = document.querySelectorAll('[aria-label="Super Admin"]');
    const totalBadges = badgesByTestId.length + badgesByAriaLabel.length;

    expect(totalBadges).toBe(
      1,
      "Exactly one super-admin badge must appear when exactly one user has is_super_admin=true"
    );
  });

  it("super-admin deactivate button disabled; regular-admin deactivate button enabled — simultaneously", () => {
    render(
      <UserManagementTable
        users={[SUPER_ADMIN_USER, REGULAR_ADMIN]}
        currentUserId={CURRENT_USER_ID}
        onDeactivate={jest.fn()}
      />
    );

    const superAdminRow = screen
      .getByText("superadmin@example.com")
      .closest("tr, [role='row'], li, [data-testid]");
    const regularAdminRow = screen
      .getByText("regular-admin@example.com")
      .closest("tr, [role='row'], li, [data-testid]");

    const superBtn = within(superAdminRow as HTMLElement).getByRole("button", {
      name: /deactivate/i,
    });
    const regularBtn = within(regularAdminRow as HTMLElement).getByRole("button", {
      name: /deactivate/i,
    });

    expect(superBtn).toBeDisabled();
    expect(regularBtn).not.toBeDisabled();
  });
});
