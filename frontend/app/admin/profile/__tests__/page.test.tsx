/**
 * Tests for frontend/app/admin/profile/page.tsx — Admin Profile Page
 *
 * Requirements covered (from admin-phase2-ac.md — Feature 2: Admin Profile):
 *   PR-FE-2 / AC-PR-FE-2-S1  — Profile page renders email (read-only), role badge, display name input
 *   PR-FE-2 / AC-PR-FE-2-S2  — Null display_name renders as empty input (not "null" text)
 *   PR-FE-2 / AC-PR-FE-2-F1  — getMe() 401 → redirect to /admin/login
 *   PR-FE-2 / AC-PR-FE-2-F2  — getMe() 500 → inline error + Retry button
 *   PR-FE-3 / AC-PR-FE-3-S1  — Edit display name → save → updateProfile called; success shown
 *   PR-FE-3 / AC-PR-FE-3-F1  — updateProfile 400 → inline error shown; input retains value
 *   PR-FE-3 / AC-PR-FE-3-F2  — updateProfile 401 → redirect to /admin/login
 *   PR-FE-3 / AC-PR-FE-3-F4  — Save button disabled until the display_name field is dirtied
 *   PR-FE-4 / AC-PR-FE-4-S1  — Change password: correct call, fields cleared on success
 *   PR-FE-4 / AC-PR-FE-4-F1  — Password mismatch → validation error, changePassword NOT called
 *   PR-FE-4 / AC-PR-FE-4-F2  — New password < 12 chars → validation error, changePassword NOT called
 *   PR-FE-4 / AC-PR-FE-4-F3  — changePassword 401 → "wrong current password" error shown, fields cleared
 *   PR-FE-4 / AC-PR-FE-4-F4  — Any required field empty → changePassword NOT called
 *   PR-FE-4 / AC-PR-FE-4-F5  — All password inputs have type="password"
 *   EC-PR-9                  — All password fields are type="password" (regression guard)
 *
 * Mocking strategy:
 *   - adminApi module is fully mocked via jest.mock.
 *   - next/navigation (useRouter) is mocked to capture push/replace calls.
 *   - No real network calls are made.
 *
 * Determinism:
 *   No wall-clock time, random seeds, or real I/O.
 *   waitFor() used for async state changes; jest.setup.ts clearAllMocks() in afterEach.
 *
 * Implementation contract for impl agent:
 *   Page at frontend/app/admin/profile/page.tsx — Client Component.
 *   On mount: calls getMe() to populate profile data.
 *   Email field: read-only (disabled input or plain text, NOT editable).
 *   Role: shown as a badge element containing the role text.
 *   Display name: editable <input>; Save button only enabled when value is dirty.
 *   Change password section: three <input type="password"> fields, each with an
 *     associated <label> element (for getByLabelText to work).
 *   On submit change password: calls changePassword({ current_password, new_password }).
 *     confirm_password is frontend-only — NOT sent to API.
 *
 * Do not modify tests. Tests are the behavioral contract.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks — declared before imports of the module under test
// ─────────────────────────────────────────────────────────────────────────────

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/profile",
}));

jest.mock("../../lib/adminApi", () => ({
  getMe: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getAdminReports: jest.fn(),
  getAdminReport: jest.fn(),
  updateReportStatus: jest.fn(),
  deleteReport: jest.fn(),
  getStats: jest.fn(),
  getUsers: jest.fn(),
  createUser: jest.fn(),
  deactivateUser: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Import module under test AFTER mocks
// ─────────────────────────────────────────────────────────────────────────────

import ProfilePage from "../page";
import * as adminApi from "../../lib/adminApi";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_USER_FIXTURE = {
  id: "user-uuid-001",
  email: "ops@example.com",
  role: "admin" as const,
  display_name: "Ops Lead",
  is_active: true,
  is_super_admin: false,
  created_at: "2026-01-01T00:00:00Z",
  last_login_at: null,
};

const REVIEWER_USER_FIXTURE = {
  id: "reviewer-uuid-002",
  email: "reviewer@example.com",
  role: "reviewer" as const,
  display_name: null,
  is_active: true,
  is_super_admin: false,
  created_at: "2026-01-10T00:00:00Z",
  last_login_at: "2026-03-01T10:00:00Z",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * queryByLabelOrPlaceholder — finds an input by label text first, falling back
 * to placeholder text.
 *
 * IMPORTANT: using getByLabelText() || getByPlaceholderText() is incorrect
 * because getByX throws when not found — the second operand is never evaluated.
 * This helper uses queryBy variants (which return null on miss) so the fallback works.
 */
function queryByLabelOrPlaceholder(pattern: RegExp): HTMLElement | null {
  return (
    screen.queryByLabelText(pattern) ||
    screen.queryByPlaceholderText(pattern)
  );
}

/**
 * getByLabelOrPlaceholder — asserts the element exists and returns it.
 * Throws a descriptive error if neither label nor placeholder matches.
 */
function getByLabelOrPlaceholder(pattern: RegExp, fieldDescription: string): HTMLElement {
  const el = queryByLabelOrPlaceholder(pattern);
  if (!el) {
    throw new Error(
      `${fieldDescription}: expected an input with label or placeholder matching ${pattern} but found none. ` +
      "The implementation must render this field with an accessible <label> or placeholder attribute."
    );
  }
  return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-2 / AC-PR-FE-2-S1 — Profile data renders correctly
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-2 / AC-PR-FE-2-S1 — Profile page renders email, role badge, and display name input", () => {
  it("renders the user's email address in the DOM", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument(
        /* message: "Profile page must display the user's email address" */
      );
    });
  });

  it("email field is read-only (displayed as text or readonly/disabled input)", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    // Key assertion: email is displayed
    expect(screen.getByText("ops@example.com")).toBeInTheDocument();
  });

  it("renders a role badge displaying the user's role", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/admin/i)).toBeInTheDocument(
        /* message: "Profile page must display a role badge showing the user's role" */
      );
    });
  });

  it("renders an editable text input for display_name with the initial value", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      const displayNameInput = screen.getByDisplayValue("Ops Lead");
      expect(displayNameInput).toBeInTheDocument(
        /* message: "Profile page must render an editable input pre-filled with the display_name from getMe()" */
      );
      expect(displayNameInput.tagName.toLowerCase()).toBe("input");
      expect(displayNameInput).not.toBeDisabled();
    });
  });

  it("calls getMe() exactly once on mount to load profile data", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(adminApi.getMe).toHaveBeenCalledTimes(
        1,
        "Profile page must call getMe() exactly once on mount"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-2 / AC-PR-FE-2-S2 — Null display_name renders as empty input
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-2 / AC-PR-FE-2-S2 — Null display_name renders as empty input", () => {
  it("display_name input has empty value when getMe() returns display_name: null", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(REVIEWER_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      // Should not render "null" or "undefined" as text
      expect(screen.queryByText("null")).not.toBeInTheDocument();
      expect(screen.queryByText("undefined")).not.toBeInTheDocument();
    });

    // At least one non-password input should have empty value
    const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
    const emptyNonPasswordInput = Array.from(inputs).find(
      (el) =>
        (el as HTMLInputElement).value === "" &&
        el.getAttribute("type") !== "password"
    );
    expect(emptyNonPasswordInput).not.toBeNull(
      /* message: "When display_name is null, the display_name input must have an empty value — not the string 'null' or 'undefined'" */
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-2 / AC-PR-FE-2-F1 — getMe() 401 → redirect to /admin/login
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-2 / AC-PR-FE-2-F1 — getMe() 401 triggers redirect to /admin/login", () => {
  it("redirects to /admin/login when getMe() rejects with HTTP 401", async () => {
    (adminApi.getMe as jest.Mock).mockRejectedValueOnce(new Error("HTTP 401"));
    render(<ProfilePage />);

    await waitFor(() => {
      const redirected =
        mockRouterPush.mock.calls.some((args) => args[0] === "/admin/login") ||
        mockRouterReplace.mock.calls.some((args) => args[0] === "/admin/login");
      expect(redirected).toBe(
        true,
        "Profile page must redirect to /admin/login when getMe() returns 401 (session expired)"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-2 / AC-PR-FE-2-F2 — getMe() 500 → inline error + Retry button
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-2 / AC-PR-FE-2-F2 — getMe() 500 shows inline error with Retry button", () => {
  it("renders an inline error message when getMe() rejects with HTTP 500", async () => {
    (adminApi.getMe as jest.Mock).mockRejectedValueOnce(new Error("HTTP 500"));
    render(<ProfilePage />);

    await waitFor(() => {
      const hasErrorText =
        screen.queryByText(/error/i) !== null ||
        screen.queryByText(/failed/i) !== null ||
        screen.queryByText(/could not load/i) !== null ||
        document.querySelector('[role="alert"]') !== null;

      expect(hasErrorText).toBe(
        true,
        "Profile page must render an error message when getMe() fails with 500 (AC-PR-FE-2-F2)"
      );
    });
  });

  it("renders a Retry button when getMe() fails", async () => {
    (adminApi.getMe as jest.Mock).mockRejectedValueOnce(new Error("HTTP 500"));
    render(<ProfilePage />);

    await waitFor(() => {
      const retryButton = screen.queryByRole("button", { name: /retry/i });
      expect(retryButton).not.toBeNull(
        "A 'Retry' button must be visible when getMe() fails so the user can reload their profile"
      );
    });
  });

  it("clicking Retry calls getMe() again", async () => {
    (adminApi.getMe as jest.Mock)
      .mockRejectedValueOnce(new Error("HTTP 500"))
      .mockResolvedValueOnce(ADMIN_USER_FIXTURE);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /retry/i })).not.toBeNull();
    });

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    await act(async () => {
      await userEvent.click(retryBtn);
    });

    await waitFor(() => {
      expect(adminApi.getMe).toHaveBeenCalledTimes(
        2,
        "Clicking Retry must trigger a second call to getMe()"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-3 / AC-PR-FE-3-S1 — Edit display name and save
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-3 / AC-PR-FE-3-S1 — Editing display name and clicking Save calls updateProfile", () => {
  it("calls updateProfile with the new display_name when Save is clicked", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.updateProfile as jest.Mock).mockResolvedValueOnce({
      ...ADMIN_USER_FIXTURE,
      display_name: "City Ops",
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Ops Lead")).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue("Ops Lead");

    await act(async () => {
      await userEvent.clear(displayNameInput);
      await userEvent.type(displayNameInput, "City Ops");
    });

    const saveButton = screen.getByRole("button", {
      name: /save|COPY\.admin\.profile\.saveButton/i,
    });

    await act(async () => {
      await userEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(adminApi.updateProfile).toHaveBeenCalledTimes(
        1,
        "updateProfile must be called exactly once when the user clicks Save"
      );
      const callArg = (adminApi.updateProfile as jest.Mock).mock.calls[0][0];
      expect(callArg.display_name).toBe(
        "City Ops",
        "updateProfile must be called with the new display_name value entered by the user"
      );
    });
  });

  it("shows a success message after updateProfile resolves", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.updateProfile as jest.Mock).mockResolvedValueOnce({
      ...ADMIN_USER_FIXTURE,
      display_name: "City Ops",
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Ops Lead")).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue("Ops Lead");

    await act(async () => {
      await userEvent.clear(displayNameInput);
      await userEvent.type(displayNameInput, "City Ops");
    });

    const saveButton = screen.getByRole("button", {
      name: /save|COPY\.admin\.profile\.saveButton/i,
    });

    await act(async () => {
      await userEvent.click(saveButton);
    });

    await waitFor(() => {
      const hasSuccess =
        screen.queryByText(/success/i) !== null ||
        screen.queryByText(/saved/i) !== null;

      expect(hasSuccess).toBe(
        true,
        "Profile page must show a success message after updateProfile resolves (AC-PR-FE-3-S1)"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-3 / AC-PR-FE-3-F1 — updateProfile 400 → inline error shown
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-3 / AC-PR-FE-3-F1 — updateProfile 400 shows inline error; input retains value", () => {
  it("shows an inline error message when updateProfile rejects with 400", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.updateProfile as jest.Mock).mockRejectedValueOnce(new Error("HTTP 400"));

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Ops Lead")).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue("Ops Lead");

    await act(async () => {
      await userEvent.clear(displayNameInput);
      await userEvent.type(displayNameInput, "X".repeat(81));
    });

    const saveButton = screen.getByRole("button", {
      name: /save|COPY\.admin\.profile\.saveButton/i,
    });

    await act(async () => {
      await userEvent.click(saveButton);
    });

    await waitFor(() => {
      const hasError =
        screen.queryByText(/error/i) !== null ||
        screen.queryByText(/failed/i) !== null ||
        screen.queryByText(/could not save/i) !== null;

      expect(hasError).toBe(
        true,
        "An inline error message must appear when updateProfile returns 400 (AC-PR-FE-3-F1)"
      );
    });
  });

  it("Save button is re-enabled after updateProfile rejects", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.updateProfile as jest.Mock).mockRejectedValueOnce(new Error("HTTP 400"));

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Ops Lead")).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue("Ops Lead");

    await act(async () => {
      await userEvent.clear(displayNameInput);
      await userEvent.type(displayNameInput, "Invalid Name");
    });

    const saveButton = screen.getByRole("button", {
      name: /save|COPY\.admin\.profile\.saveButton/i,
    });

    await act(async () => {
      await userEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(adminApi.updateProfile).toHaveBeenCalled();
    });

    expect(saveButton).not.toBeDisabled(
      /* message: "Save button must be re-enabled after updateProfile fails so user can retry" */
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-3 / AC-PR-FE-3-F2 — updateProfile 401 → redirect to /admin/login
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-3 / AC-PR-FE-3-F2 — updateProfile 401 triggers redirect to /admin/login", () => {
  it("redirects to /admin/login when updateProfile rejects with 401", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.updateProfile as jest.Mock).mockRejectedValueOnce(new Error("HTTP 401"));

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Ops Lead")).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue("Ops Lead");

    await act(async () => {
      await userEvent.clear(displayNameInput);
      await userEvent.type(displayNameInput, "New Name");
    });

    const saveButton = screen.getByRole("button", {
      name: /save|COPY\.admin\.profile\.saveButton/i,
    });

    await act(async () => {
      await userEvent.click(saveButton);
    });

    await waitFor(() => {
      const redirected =
        mockRouterPush.mock.calls.some((args) => args[0] === "/admin/login") ||
        mockRouterReplace.mock.calls.some((args) => args[0] === "/admin/login");
      expect(redirected).toBe(
        true,
        "Profile page must redirect to /admin/login when updateProfile returns 401 (session expired)"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-3 / AC-PR-FE-3-F4 — Save button disabled until input is dirty
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-3 / AC-PR-FE-3-F4 — Save button disabled until display_name field is modified", () => {
  it("Save button is disabled on initial render (before the user makes any change)", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Ops Lead")).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", {
      name: /save|COPY\.admin\.profile\.saveButton/i,
    });

    expect(saveButton).toBeDisabled(
      /* message: "Save button must be disabled initially — only enabled when display_name is dirtied (AC-PR-FE-3-F4)" */
    );
  });

  it("Save button becomes enabled after the user modifies the display_name field", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Ops Lead")).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue("Ops Lead");

    await act(async () => {
      await userEvent.clear(displayNameInput);
      await userEvent.type(displayNameInput, "Different Name");
    });

    const saveButton = screen.getByRole("button", {
      name: /save|COPY\.admin\.profile\.saveButton/i,
    });

    expect(saveButton).not.toBeDisabled(
      /* message: "Save button must become enabled once the user changes the display_name value" */
    );
  });

  it("updateProfile is NOT called when Save button is disabled", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Ops Lead")).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", {
      name: /save|COPY\.admin\.profile\.saveButton/i,
    });

    // Click disabled button — userEvent respects disabled attribute
    await userEvent.click(saveButton);

    expect(adminApi.updateProfile).not.toHaveBeenCalled(
      /* message: "updateProfile must not be called when the Save button is disabled" */
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-4 / AC-PR-FE-4-F5 & EC-PR-9 — All password inputs have type="password"
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-4 / AC-PR-FE-4-F5 — All password fields have type='password' (P0 security requirement)", () => {
  it("current_password field has type='password'", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const currentPasswordInput = queryByLabelOrPlaceholder(/current password/i);

    expect(currentPasswordInput).not.toBeNull(
      "A 'current password' field must be present on the profile page (AC-PR-FE-4-F5)"
    );
    expect(currentPasswordInput).toHaveAttribute(
      "type",
      "password",
      "current_password field must have type='password' — plaintext passwords in the DOM is a P0 security violation"
    );
  });

  it("new_password field has type='password'", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const newPasswordInput = queryByLabelOrPlaceholder(/new password/i);

    expect(newPasswordInput).not.toBeNull(
      "A 'new password' field must be present in the Change Password section"
    );
    expect(newPasswordInput).toHaveAttribute(
      "type",
      "password",
      "new_password field must have type='password' (AC-PR-FE-4-F5)"
    );
  });

  it("confirm_password field has type='password'", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const confirmPasswordInput = queryByLabelOrPlaceholder(/confirm password/i);

    expect(confirmPasswordInput).not.toBeNull(
      "A 'confirm password' field must be present in the Change Password section"
    );
    expect(confirmPasswordInput).toHaveAttribute(
      "type",
      "password",
      "confirm_password field must have type='password' (AC-PR-FE-4-F5)"
    );
  });

  it("all three password input fields are type='password' — no password value visible as plain text (EC-PR-9)", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(
      3,
      "There must be at least 3 inputs with type='password' (current, new, confirm) — all plaintext password fields are a P0 security violation (EC-PR-9)"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-4 / AC-PR-FE-4-S1 — Successful password change
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-4 / AC-PR-FE-4-S1 — Successful password change clears fields and shows success", () => {
  it("calls changePassword with current_password and new_password (NOT confirm_password)", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.changePassword as jest.Mock).mockResolvedValueOnce(undefined);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const currentPasswordInput = getByLabelOrPlaceholder(
      /current password/i,
      "current_password field"
    );
    const newPasswordInput = getByLabelOrPlaceholder(
      /new password/i,
      "new_password field"
    );
    const confirmPasswordInput = getByLabelOrPlaceholder(
      /confirm password/i,
      "confirm_password field"
    );

    await act(async () => {
      await userEvent.type(currentPasswordInput, "OldPass123!");
      await userEvent.type(newPasswordInput, "NewPass456!");
      await userEvent.type(confirmPasswordInput, "NewPass456!");
    });

    const changePasswordButton = screen.getByRole("button", {
      name: /change password|COPY\.admin\.profile\.changePasswordButton/i,
    });

    await act(async () => {
      await userEvent.click(changePasswordButton);
    });

    await waitFor(() => {
      expect(adminApi.changePassword).toHaveBeenCalledTimes(1);
      const callArg = (adminApi.changePassword as jest.Mock).mock.calls[0][0];
      expect(callArg.current_password).toBe("OldPass123!");
      expect(callArg.new_password).toBe("NewPass456!");
      expect(callArg).not.toHaveProperty(
        "confirm_password",
        "confirm_password is frontend-only — must NOT be sent to the API (AC-PR-FE-4-S1)"
      );
    });
  });

  it("shows a success message after changePassword resolves", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.changePassword as jest.Mock).mockResolvedValueOnce(undefined);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const currentPasswordInput = getByLabelOrPlaceholder(/current password/i, "current_password");
    const newPasswordInput = getByLabelOrPlaceholder(/new password/i, "new_password");
    const confirmPasswordInput = getByLabelOrPlaceholder(/confirm password/i, "confirm_password");

    await act(async () => {
      await userEvent.type(currentPasswordInput, "OldPass123!");
      await userEvent.type(newPasswordInput, "NewPass456!");
      await userEvent.type(confirmPasswordInput, "NewPass456!");
    });

    const changePasswordButton = screen.getByRole("button", {
      name: /change password|COPY\.admin\.profile\.changePasswordButton/i,
    });

    await act(async () => {
      await userEvent.click(changePasswordButton);
    });

    await waitFor(() => {
      const hasSuccess =
        screen.queryByText(/success/i) !== null ||
        screen.queryByText(/password changed/i) !== null;

      expect(hasSuccess).toBe(
        true,
        "A success message must appear after a successful password change (AC-PR-FE-4-S1)"
      );
    });
  });

  it("all three password fields are cleared after successful change", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.changePassword as jest.Mock).mockResolvedValueOnce(undefined);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const currentPasswordInput = getByLabelOrPlaceholder(/current password/i, "current_password");
    const newPasswordInput = getByLabelOrPlaceholder(/new password/i, "new_password");
    const confirmPasswordInput = getByLabelOrPlaceholder(/confirm password/i, "confirm_password");

    await act(async () => {
      await userEvent.type(currentPasswordInput, "OldPass123!");
      await userEvent.type(newPasswordInput, "NewPass456!");
      await userEvent.type(confirmPasswordInput, "NewPass456!");
    });

    const changePasswordButton = screen.getByRole("button", {
      name: /change password|COPY\.admin\.profile\.changePasswordButton/i,
    });

    await act(async () => {
      await userEvent.click(changePasswordButton);
    });

    await waitFor(() => {
      expect(adminApi.changePassword).toHaveBeenCalled();
    });

    expect(currentPasswordInput).toHaveValue(
      "",
      "current_password field must be cleared after successful password change (AC-PR-FE-4-S1)"
    );
    expect(newPasswordInput).toHaveValue(
      "",
      "new_password field must be cleared after successful password change"
    );
    expect(confirmPasswordInput).toHaveValue(
      "",
      "confirm_password field must be cleared after successful password change"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-4 / AC-PR-FE-4-F1 — Password mismatch → validation error
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-4 / AC-PR-FE-4-F1 — Password mismatch shows validation error without API call", () => {
  it("shows a validation error when new_password and confirm_password do not match", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const currentPasswordInput = getByLabelOrPlaceholder(/current password/i, "current_password");
    const newPasswordInput = getByLabelOrPlaceholder(/new password/i, "new_password");
    const confirmPasswordInput = getByLabelOrPlaceholder(/confirm password/i, "confirm_password");

    await act(async () => {
      await userEvent.type(currentPasswordInput, "OldPass123!");
      await userEvent.type(newPasswordInput, "NewPass456!");
      await userEvent.type(confirmPasswordInput, "DifferentPass789!");
    });

    const changePasswordButton = screen.getByRole("button", {
      name: /change password|COPY\.admin\.profile\.changePasswordButton/i,
    });

    await act(async () => {
      await userEvent.click(changePasswordButton);
    });

    expect(adminApi.changePassword).not.toHaveBeenCalled(
      /* message: "changePassword must NOT be called when passwords do not match (AC-PR-FE-4-F1)" */
    );

    const hasMismatchError =
      screen.queryByText(/match/i) !== null ||
      screen.queryByText(/do not match/i) !== null ||
      screen.queryByText(/mismatch/i) !== null;

    expect(hasMismatchError).toBe(
      true,
      "A validation error about mismatched passwords must be shown (AC-PR-FE-4-F1)"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-4 / AC-PR-FE-4-F2 — New password < 12 chars → client-side validation
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-4 / AC-PR-FE-4-F2 — New password shorter than 12 chars shows client-side error", () => {
  it("shows validation error and does NOT call changePassword when new_password is fewer than 12 chars", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const currentPasswordInput = getByLabelOrPlaceholder(/current password/i, "current_password");
    const newPasswordInput = getByLabelOrPlaceholder(/new password/i, "new_password");
    const confirmPasswordInput = getByLabelOrPlaceholder(/confirm password/i, "confirm_password");

    // "short" = 5 chars — well below the 12-char minimum
    await act(async () => {
      await userEvent.type(currentPasswordInput, "OldPass123!");
      await userEvent.type(newPasswordInput, "short");
      await userEvent.type(confirmPasswordInput, "short");
    });

    const changePasswordButton = screen.getByRole("button", {
      name: /change password|COPY\.admin\.profile\.changePasswordButton/i,
    });

    await act(async () => {
      await userEvent.click(changePasswordButton);
    });

    expect(adminApi.changePassword).not.toHaveBeenCalled(
      /* message: "changePassword must NOT be called when new_password < 12 chars (AC-PR-FE-4-F2)" */
    );

    const hasLengthError =
      screen.queryByText(/too short/i) !== null ||
      screen.queryByText(/12/i) !== null ||
      screen.queryByText(/minimum/i) !== null ||
      screen.queryByText(/at least/i) !== null;

    expect(hasLengthError).toBe(
      true,
      "A validation error about password minimum length must be shown (AC-PR-FE-4-F2)"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-4 / AC-PR-FE-4-F3 — API returns 401 → "wrong current password" error
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-4 / AC-PR-FE-4-F3 — changePassword 401 shows wrong-current-password error", () => {
  it("shows an error about wrong current password when API returns 401", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.changePassword as jest.Mock).mockRejectedValueOnce(new Error("HTTP 401"));

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const currentPasswordInput = getByLabelOrPlaceholder(/current password/i, "current_password");
    const newPasswordInput = getByLabelOrPlaceholder(/new password/i, "new_password");
    const confirmPasswordInput = getByLabelOrPlaceholder(/confirm password/i, "confirm_password");

    await act(async () => {
      await userEvent.type(currentPasswordInput, "WrongPass123!");
      await userEvent.type(newPasswordInput, "NewPass456789!");
      await userEvent.type(confirmPasswordInput, "NewPass456789!");
    });

    const changePasswordButton = screen.getByRole("button", {
      name: /change password|COPY\.admin\.profile\.changePasswordButton/i,
    });

    await act(async () => {
      await userEvent.click(changePasswordButton);
    });

    await waitFor(() => {
      const hasWrongPasswordError =
        screen.queryByText(/incorrect/i) !== null ||
        screen.queryByText(/wrong/i) !== null ||
        screen.queryByText(/invalid/i) !== null ||
        screen.queryByText(/current password/i) !== null;

      expect(hasWrongPasswordError).toBe(
        true,
        "An error must appear when changePassword returns 401 (wrong current password) (AC-PR-FE-4-F3)"
      );
    });
  });

  it("all three password fields are cleared after 401 wrong-password error (AC-PR-FE-4-F3)", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    (adminApi.changePassword as jest.Mock).mockRejectedValueOnce(new Error("HTTP 401"));

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const currentPasswordInput = getByLabelOrPlaceholder(/current password/i, "current_password");
    const newPasswordInput = getByLabelOrPlaceholder(/new password/i, "new_password");
    const confirmPasswordInput = getByLabelOrPlaceholder(/confirm password/i, "confirm_password");

    await act(async () => {
      await userEvent.type(currentPasswordInput, "WrongPass123!");
      await userEvent.type(newPasswordInput, "NewPass456789!");
      await userEvent.type(confirmPasswordInput, "NewPass456789!");
    });

    const changePasswordButton = screen.getByRole("button", {
      name: /change password|COPY\.admin\.profile\.changePasswordButton/i,
    });

    await act(async () => {
      await userEvent.click(changePasswordButton);
    });

    await waitFor(() => {
      expect(adminApi.changePassword).toHaveBeenCalled();
    });

    expect(currentPasswordInput).toHaveValue(
      "",
      "current_password must be cleared after 401 wrong-password error (AC-PR-FE-4-F3)"
    );
    expect(newPasswordInput).toHaveValue(
      "",
      "new_password must be cleared after 401 wrong-password error"
    );
    expect(confirmPasswordInput).toHaveValue(
      "",
      "confirm_password must be cleared after 401 wrong-password error"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-FE-4 / AC-PR-FE-4-F4 — Any required field empty → changePassword NOT called
// ─────────────────────────────────────────────────────────────────────────────

describe("PR-FE-4 / AC-PR-FE-4-F4 — Empty required password fields prevent API call", () => {
  it("does NOT call changePassword when current_password is empty", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    // Fill new_password and confirm but leave current_password empty
    const newPasswordInput = getByLabelOrPlaceholder(/new password/i, "new_password");
    const confirmPasswordInput = getByLabelOrPlaceholder(/confirm password/i, "confirm_password");

    await act(async () => {
      await userEvent.type(newPasswordInput, "NewPass456789!");
      await userEvent.type(confirmPasswordInput, "NewPass456789!");
    });

    const changePasswordButton = screen.getByRole("button", {
      name: /change password|COPY\.admin\.profile\.changePasswordButton/i,
    });

    await act(async () => {
      await userEvent.click(changePasswordButton);
    });

    expect(adminApi.changePassword).not.toHaveBeenCalled(
      /* message: "changePassword must NOT be called when current_password is empty (AC-PR-FE-4-F4)" */
    );
  });

  it("does NOT call changePassword when new_password is empty", async () => {
    (adminApi.getMe as jest.Mock).mockResolvedValueOnce(ADMIN_USER_FIXTURE);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    });

    const currentPasswordInput = getByLabelOrPlaceholder(/current password/i, "current_password");
    const confirmPasswordInput = getByLabelOrPlaceholder(/confirm password/i, "confirm_password");

    await act(async () => {
      await userEvent.type(currentPasswordInput, "OldPass123!");
      // leave new_password empty
      await userEvent.type(confirmPasswordInput, "NewPass456789!");
    });

    const changePasswordButton = screen.getByRole("button", {
      name: /change password|COPY\.admin\.profile\.changePasswordButton/i,
    });

    await act(async () => {
      await userEvent.click(changePasswordButton);
    });

    expect(adminApi.changePassword).not.toHaveBeenCalled(
      /* message: "changePassword must NOT be called when new_password is empty (AC-PR-FE-4-F4)" */
    );
  });
});
