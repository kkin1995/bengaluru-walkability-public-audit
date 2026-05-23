/**
 * Tests for frontend/app/admin/login/page.tsx — Admin login form
 *
 * Requirements covered:
 *   R-LGN-1 (AC-LGN-1-S1) — Form renders email input, password input, submit button
 *   R-LGN-1 (AC-LGN-1-S1) — POST /api/admin/auth/login with credentials:'include' and JSON body
 *   R-LGN-1 (AC-LGN-1-S1) — On 200: redirect to /admin via window.location.href (full nav, Safari cookie fix)
 *   R-LGN-2 (AC-LGN-2-F1) — On 401: SEC-06 generic error "Incorrect email or password.";
 *                             no alert(); password field cleared; email field retained
 *   R-LGN-2 (AC-LGN-2-F2) — On 429: SEC-06 generic error + 60s countdown; button disabled
 *   R-LGN-2 (AC-LGN-2-F3) — On 5xx/other/network: SEC-06 generic error "Something went wrong."
 *   R-LGN-3 (AC-LGN-3-S1) — Loading state: submit button disabled + loading indicator;
 *                             email and password inputs disabled while request is in-flight
 *   Guard    — No fetch call when email field is empty
 *   Guard    — No fetch call when password field is empty
 *   SEC-06   — All three locked generic error strings preserved exactly
 *
 * SEC-06 error string contract (locked):
 *   - 401: "Incorrect email or password."
 *   - 429: "Too many attempts. Please wait a few minutes before trying again."
 *   - 5xx / 400 / other 4xx / network error: "Something went wrong. Please try again."
 *
 * Mocking strategy:
 *   - fetch: jest.spyOn(global, 'fetch') — set up per-test; cleared in afterEach
 *   - next/navigation useRouter: mocked module-wide; push is a jest.fn()
 *   - No mocks needed for leaflet/react-leaflet (login page has no map)
 *   - 429 countdown test uses jest.useFakeTimers() / jest.runAllTimers()
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../page";

// ─────────────────────────────────────────────────────────────────────────────
// Mock next/navigation
// App Router pages use next/navigation (not next/router).
// ─────────────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: mockRefresh }),
  // Additional exports that might be consumed by sub-components
  usePathname: () => "/admin/login",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockRefresh.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Fill in the email and password fields and click the submit button. */
async function submitForm(email: string, password: string) {
  const emailInput = screen.getByRole("textbox", { name: /email/i });
  const passwordInput = screen.getByLabelText(/password/i);
  // Button text changed to AUTHENTICATE / Signing in...
  const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });

  // Clear first in case a previous test left values
  await userEvent.clear(emailInput);
  await userEvent.clear(passwordInput);

  if (email) {
    await userEvent.type(emailInput, email);
  }
  if (password) {
    await userEvent.type(passwordInput, password);
  }

  await userEvent.click(submitButton);
}

// ─────────────────────────────────────────────────────────────────────────────
// T1 — Renders email input, password input, and submit button
// Requirement: R-LGN-1 (structural)
// ─────────────────────────────────────────────────────────────────────────────

describe("T1: Initial render — form structure", () => {
  it("renders an email input", () => {
    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    // Email input must be present in the DOM
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("renders a password input", () => {
    render(<LoginPage />);

    // Password inputs are not role=textbox; query by label text
    const passwordInput = screen.getByLabelText(/password/i);
    // Password input must be present in the DOM
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("renders a submit button", () => {
    render(<LoginPage />);

    // The button name: AUTHENTICATE (or Signing in... during loading)
    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });
    // Submit button must be present in the DOM
    expect(submitButton).toBeInTheDocument();
  });

  it("submit button is NOT disabled on initial render (before any interaction)", () => {
    render(<LoginPage />);

    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });
    // Submit button must not be initially disabled
    expect(submitButton).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T2 — Loading state while request is in-flight
// Requirement: R-LGN-3 (AC-LGN-3-S1)
// ─────────────────────────────────────────────────────────────────────────────

describe("T2: Loading state while request is in-flight", () => {
  it("submit button is disabled while the fetch is pending", async () => {
    // fetch never resolves — simulates slow network
    jest.spyOn(global, "fetch").mockReturnValueOnce(new Promise(() => {}));

    render(<LoginPage />);

    await act(async () => {
      await submitForm("admin@example.com", "securepassword123");
    });

    const submitButton = screen.getByRole("button", { name: /signing in|loading|authenticate/i });
    // Submit button must be disabled while fetch is pending to prevent double submission
    expect(submitButton).toBeDisabled();
  });

  it("submit button shows a loading indicator while the fetch is pending", async () => {
    jest.spyOn(global, "fetch").mockReturnValueOnce(new Promise(() => {}));

    render(<LoginPage />);

    await act(async () => {
      await submitForm("admin@example.com", "securepassword123");
    });

    // The button must show "Signing in..." during loading
    const loadingButton = screen.getByRole("button", { name: /signing in/i });
    // Submit button must display 'Signing in...' text (or equivalent) while loading
    expect(loadingButton).toBeInTheDocument();
  });

  it("email input is disabled while the fetch is pending", async () => {
    jest.spyOn(global, "fetch").mockReturnValueOnce(new Promise(() => {}));

    render(<LoginPage />);

    await act(async () => {
      await submitForm("admin@example.com", "securepassword123");
    });

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    // Email input must be disabled during in-flight request to prevent modification
    expect(emailInput).toBeDisabled();
  });

  it("password input is disabled while the fetch is pending", async () => {
    jest.spyOn(global, "fetch").mockReturnValueOnce(new Promise(() => {}));

    render(<LoginPage />);

    await act(async () => {
      await submitForm("admin@example.com", "securepassword123");
    });

    const passwordInput = screen.getByLabelText(/password/i);
    // Password input must be disabled during in-flight request to prevent modification
    expect(passwordInput).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T3 — Calls fetch with correct URL, method, credentials, and body
// Requirement: R-LGN-1 (AC-LGN-1-S1) — fetch contract
// ─────────────────────────────────────────────────────────────────────────────

describe("T3: fetch call shape", () => {
  it("calls POST /api/admin/auth/login with credentials:'include' and the correct JSON body", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "hunter2isNotSecure!");
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    // fetch must target /api/admin/auth/login
    expect(url).toMatch(
      /\/api\/admin\/auth\/login$/
    );

    // fetch method must be POST
    expect(
      (options as RequestInit).method?.toUpperCase()
    ).toBe("POST");

    // fetch must include credentials:'include' so the HttpOnly cookie is sent
    expect(
      (options as RequestInit).credentials
    ).toBe("include");

    // Content-Type must be application/json
    const headers = (options as RequestInit).headers as Record<string, string>;
    // Content-Type header must be application/json
    expect(
      headers["Content-Type"] ?? headers["content-type"]
    ).toBe("application/json");

    // Body must be the correct JSON
    const body = JSON.parse((options as RequestInit).body as string);
    // Request body must contain the email that was entered
    expect(body).toMatchObject({
      email: "ops@example.com",
    });
    // Request body must contain the password that was entered
    expect(body).toMatchObject({
      password: "hunter2isNotSecure!",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T4 — On 200 success: navigates to /admin via window.location.href
// Requirement: R-LGN-1 (AC-LGN-1-S1)
// Safari on iOS processes Set-Cookie headers asynchronously; the RSC fetch
// triggered by router.replace fires before the cookie is committed, causing a
// 307 redirect loop. Full browser navigation (window.location.href) guarantees
// cookie storage completes before the new request fires.
// ─────────────────────────────────────────────────────────────────────────────

describe("T4: 200 success — redirect to /admin", () => {
  // jsdom does not implement navigation; replace window.location with a plain
  // writable stub so href assignments can be asserted without throwing.
  beforeAll(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "" },
    });
  });

  beforeEach(() => {
    (window.location as { href: string }).href = "";
  });

  it("sets window.location.href to '/admin' after a successful login response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "correctPassword1!");
    });

    await waitFor(() => {
      expect(window.location.href).toBe("/admin");
    });
  });

  it("does NOT show any error message after a successful login", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "correctPassword1!");
    });

    await waitFor(() => {
      expect(window.location.href).toBe("/admin");
    });

    // No error message should appear in the DOM after a success
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T5 — On 401: SEC-06 generic error, no alert(), password cleared, email retained
// Requirement: R-LGN-2 (AC-LGN-2-F1) — SEC-06 contract
// ─────────────────────────────────────────────────────────────────────────────

describe("T5: 401 response — SEC-06 generic error, password cleared, email retained", () => {
  it("shows the SEC-06 'Incorrect email or password.' error message inline in the DOM", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: "WB-ADMIN-AUTH-003",
        message: "Invalid email or password",
      }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "wrongPassword!");
    });

    await waitFor(() => {
      // SEC-06 locked string must appear — NOT the raw server message
      expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument();
    });
  });

  it("does NOT display the raw server error message on 401 (SEC-06 compliance)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: "WB-ADMIN-AUTH-003",
        message: "Invalid email or password",
      }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "wrongPassword!");
    });

    await waitFor(() => {
      expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument();
    });

    // Raw server message must NOT appear per SEC-06
    expect(screen.queryByText("WB-ADMIN-AUTH-003")).not.toBeInTheDocument();
  });

  it("does NOT call window.alert() on a 401 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "WB-ADMIN-AUTH-003", message: "Invalid email or password" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "wrongPassword!");
    });

    await waitFor(() => {
      expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument();
    });

    // jest.setup.ts installs window.alert as jest.fn()
    // window.alert must NOT be called on a 401 response — error must be inline
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("clears the password field after a 401 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "WB-ADMIN-AUTH-003", message: "Invalid email or password" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "wrongPassword!");
    });

    await waitFor(() => {
      expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/password/i);
    // Password field must be cleared after a 401 response (AC-LGN-2-F1)
    expect(passwordInput).toHaveValue("");
  });

  it("retains the email field value after a 401 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "WB-ADMIN-AUTH-003", message: "Invalid email or password" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "wrongPassword!");
    });

    await waitFor(() => {
      expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument();
    });

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    // Email field must retain its value after a 401 response
    expect(emailInput).toHaveValue("ops@example.com");
  });

  it("user remains on /admin/login (router.replace is NOT called) after a 401 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "WB-ADMIN-AUTH-003", message: "Invalid email or password" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "wrongPassword!");
    });

    await waitFor(() => {
      expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument();
    });

    // router.replace must NOT be called when login fails with 401
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T6 — On 400: SEC-06 generic error shown
// Requirement: SEC-06 — all non-401/429 errors map to generic "Something went wrong."
// ─────────────────────────────────────────────────────────────────────────────

describe("T6: 400 response — SEC-06 generic error shown", () => {
  it("shows the generic SEC-06 error message when the server returns 400", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: "WB-ADMIN-AUTH-001",
        message: "Missing required fields",
      }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      // The page must show the generic SEC-06 error copy
      expect(screen.getByRole("status")).toHaveTextContent("Something went wrong. Please try again.");
    });

    // The server's body.message must NOT be surfaced to the user on a 400 response
    expect(screen.queryByText(/missing required fields/i)).not.toBeInTheDocument();
  });

  it("does NOT redirect to /admin on a 400 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "WB-ADMIN-AUTH-001", message: "Missing required fields" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    // Wait long enough for async state updates to settle
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /signing in/i })).not.toBeInTheDocument();
    });

    // router.replace must NOT be called when the server returns 400
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T7 — On 429: rate-limit message + 60-second button lockout with countdown
// Requirement: R-LGN-2 (AC-LGN-2-F2) — SEC-06 contract preserved
// Note: This test uses Jest fake timers for deterministic countdown behavior.
// ─────────────────────────────────────────────────────────────────────────────

describe("T7: 429 response — rate-limit message and countdown lockout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("shows the SEC-06 rate-limit error message when the server returns 429", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: "WB-ADMIN-AUTH-005",
        message: "Too many attempts. Please wait before trying again.",
      }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });

    await user.type(emailInput, "ops@example.com");
    await user.type(passwordInput, "somePassword123!");
    await user.click(submitButton);

    await waitFor(() => {
      // SEC-06 rate-limit message must appear
      expect(screen.getByText("Too many attempts. Please wait a few minutes before trying again.")).toBeInTheDocument();
    });
  });

  it("disables the submit button immediately after a 429 response", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "WB-ADMIN-AUTH-005", message: "Too many attempts." }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });

    await user.type(emailInput, "ops@example.com");
    await user.type(passwordInput, "somePassword123!");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Too many attempts. Please wait a few minutes before trying again.")).toBeInTheDocument();
    });

    // The submit button must be disabled during the lockout window
    const buttons = screen.getAllByRole("button");
    const lockedButton = buttons.find(
      (b) => /try again|authenticate|sign in|log in|submit/i.test(b.textContent ?? "")
    );
    // Submit button must be present and disabled during the 429 lockout period
    expect(lockedButton).toBeDefined();
    // Submit button must be disabled immediately after a 429 response
    expect(lockedButton).toBeDisabled();
  });

  it("shows a 'Try again in 60s' countdown in the button area immediately after 429", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "WB-ADMIN-AUTH-005", message: "Too many attempts." }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });

    await user.type(emailInput, "ops@example.com");
    await user.type(passwordInput, "somePassword123!");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Too many attempts. Please wait a few minutes before trying again.")).toBeInTheDocument();
    });

    // Immediately after 429, the countdown should start at 60
    expect(screen.getByText(/try again in 60s/i)).toBeInTheDocument();
  });

  it("decrements the countdown after 1 second", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "WB-ADMIN-AUTH-005", message: "Too many attempts." }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });

    await user.type(emailInput, "ops@example.com");
    await user.type(passwordInput, "somePassword123!");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/try again in 60s/i)).toBeInTheDocument();
    });

    // Advance the fake timer by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Countdown must decrement to 59 after 1 second elapses
    expect(screen.getByText(/try again in 59s/i)).toBeInTheDocument();
  });

  it("re-enables the submit button after the 60-second lockout expires", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "WB-ADMIN-AUTH-005", message: "Too many attempts." }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });

    await user.type(emailInput, "ops@example.com");
    await user.type(passwordInput, "somePassword123!");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/try again in 60s/i)).toBeInTheDocument();
    });

    for (let i = 0; i < 60; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }

    // The countdown text must be gone and the button must be re-enabled
    expect(screen.queryByText(/try again in/i)).not.toBeInTheDocument();

    const reenabledButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });
    // Submit button must be re-enabled after the 60-second lockout expires
    expect(reenabledButton).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T8 — On 5xx: SEC-06 generic error; network error: same generic copy
// Requirement: R-LGN-2 (AC-LGN-2-F3) — SEC-06 contract: generic string only
// ─────────────────────────────────────────────────────────────────────────────

describe("T8: 5xx and network errors — SEC-06 generic error message, form preserved", () => {
  it("shows SEC-06 generic error 'Something went wrong. Please try again.' on a 500 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "INTERNAL", message: "Internal Server Error" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      // SEC-06 generic error must appear — NOT the raw server message
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows SEC-06 generic error when fetch throws (network error)", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      // Network errors also use the generic SEC-06 copy
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });
  });

  it("re-enables the submit button after a 500 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "INTERNAL", message: "Internal Server Error" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });
    // Submit button must be re-enabled after a 500 response so the user can retry
    expect(submitButton).not.toBeDisabled();
  });

  it("does NOT reset the email field value after a 5xx response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "INTERNAL", message: "Internal Server Error" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    // Email field must NOT be cleared after a 5xx response (form not reset)
    expect(emailInput).toHaveValue("ops@example.com");
  });

  it("does NOT call router.replace after a 5xx response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "INTERNAL", message: "Internal Server Error" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });

    // router.replace must NOT be called when the server returns 5xx
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does NOT expose raw server message on 5xx (SEC-06 compliance)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        error: "INTERNAL",
        message: "Detailed internal server diagnostics that must be hidden",
      }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });

    // The server's body.message must NOT be rendered anywhere in the DOM on 5xx
    expect(
      screen.queryByText(/detailed internal server diagnostics/i)
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T9 — No fetch call when email is empty
// Requirement: Guard (HTML5 required attribute or JS guard)
// ─────────────────────────────────────────────────────────────────────────────

describe("T9: Empty email field — fetch is not called", () => {
  it("does not call fetch when the email field is empty and the form is submitted", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    render(<LoginPage />);

    // Type only password, leave email blank
    const passwordInput = screen.getByLabelText(/password/i);
    await userEvent.type(passwordInput, "somePassword123!");

    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });
    await userEvent.click(submitButton);

    // Allow any async state updates to flush
    await act(async () => {});

    // fetch must NOT be called when the email field is empty
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T10 — No fetch call when password is empty
// Requirement: Guard (HTML5 required attribute or JS guard)
// ─────────────────────────────────────────────────────────────────────────────

describe("T10: Empty password field — fetch is not called", () => {
  it("does not call fetch when the password field is empty and the form is submitted", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    render(<LoginPage />);

    // Type only email, leave password blank
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    await userEvent.type(emailInput, "ops@example.com");

    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });
    await userEvent.click(submitButton);

    // Allow any async state updates to flush
    await act(async () => {});

    // fetch must NOT be called when the password field is empty
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T11 — Other 4xx and 5xx — all map to SEC-06 generic string
// Requirement: SEC-06 — generic strings only, no raw server data
// ─────────────────────────────────────────────────────────────────────────────

describe("T11: All non-401/429 error responses — SEC-06 generic string", () => {
  it("shows generic error 'Something went wrong. Please try again.' on a 502 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "BAD_GATEWAY", message: "Bad Gateway" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows generic error on a 503 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: "SERVICE_UNAVAILABLE", message: "Service Unavailable" }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows generic error even when the response body is not parseable JSON", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new SyntaxError("Unexpected token < in JSON"); },
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows generic error on 403 — does NOT expose body.error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: "You do not have permission to access this resource.",
        message: "Forbidden",
      }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });

    // Raw body.error must NOT be surfaced (SEC-06)
    expect(screen.queryByText(/you do not have permission/i)).not.toBeInTheDocument();
  });

  it("re-enables the submit button after any error response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden access." }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: /authenticate|sign in|log in|submit/i });
    // Submit button must be re-enabled after any error so the user can retry
    expect(submitButton).not.toBeDisabled();
  });

  it("does NOT call router.replace after any error response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden access." }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    // router.replace must NOT be called when the server returns any error
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
