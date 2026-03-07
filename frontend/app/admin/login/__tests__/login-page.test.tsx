/**
 * Tests for frontend/app/admin/login/page.tsx — Admin login form
 *
 * Requirements covered:
 *   R-LGN-1 (AC-LGN-1-S1) — Form renders email input, password input, submit button
 *   R-LGN-1 (AC-LGN-1-S1) — POST /api/admin/auth/login with credentials:'include' and JSON body
 *   R-LGN-1 (AC-LGN-1-S1) — On 200: redirect to /admin via router.push
 *   R-LGN-2 (AC-LGN-2-F1) — On 401: inline error "Invalid email or password";
 *                             no alert(); password field cleared; email field retained
 *   R-LGN-2 (AC-LGN-2-F2) — On 429: inline rate-limit message; button disabled for 60s
 *                             with visible "Try again in Xs" countdown
 *   R-LGN-2 (AC-LGN-2-F3) — On 5xx: status-interpolated error; network error: specific copy; button re-enabled; form not reset
 *   R-LGN-3 (AC-LGN-3-S1) — Loading state: submit button disabled + loading indicator;
 *                             email and password inputs disabled while request is in-flight
 *   Guard    — No fetch call when email field is empty
 *   Guard    — No fetch call when password field is empty
 *   AC task  — On 400: inline error showing server-returned message
 *
 * Ambiguity resolutions (documented here so impl agent can read the contract):
 *   - 401 copy: "Invalid email or password" (AC-LGN-2-F1, COPY.admin.login.invalidCredentials)
 *   - 429 copy: "Too many attempts. Please wait before trying again." (AC-LGN-2-F2)
 *   - 5xx copy: "Server error (HTTP {status}). Please try again later or contact support." (AC-LGN-2-F3)
 *   - Network error copy: "Cannot reach the server. Check your internet connection and try again."
 *   - 400: fixed copy "Invalid request. Please check your inputs and try again." — body.message NOT surfaced
 *   - Other 4xx: body.error ?? body.message ?? "Unexpected error. Please try again." (body.error takes priority; empty string is "present")
 *   - Loading indicator: button accessible name matches /signing in/i AND button is disabled
 *   - 429 countdown: client-side 60-second lockout; button area shows "Try again in Xs"
 *   - Password cleared on 401: password input value becomes "" after 401 response
 *   - Email retained on 401: email input retains the value that was submitted
 *   - Inputs (email + password) are disabled while the request is in-flight
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

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  // Additional exports that might be consumed by sub-components
  usePathname: () => "/admin/login",
  useSearchParams: () => new URLSearchParams(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Fill in the email and password fields and click the submit button. */
async function submitForm(email: string, password: string) {
  const emailInput = screen.getByRole("textbox", { name: /email/i });
  const passwordInput = screen.getByLabelText(/password/i);
  const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });

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

    // The button name may vary (Sign in / Log in / Submit) — match broadly
    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });
    // Submit button must be present in the DOM
    expect(submitButton).toBeInTheDocument();
  });

  it("submit button is NOT disabled on initial render (before any interaction)", () => {
    render(<LoginPage />);

    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });
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

    const submitButton = screen.getByRole("button", { name: /signing in|loading|sign in|log in|submit/i });
    // Submit button must be disabled while fetch is pending to prevent double submission
    expect(submitButton).toBeDisabled();
  });

  it("submit button shows a loading indicator while the fetch is pending", async () => {
    jest.spyOn(global, "fetch").mockReturnValueOnce(new Promise(() => {}));

    render(<LoginPage />);

    await act(async () => {
      await submitForm("admin@example.com", "securepassword123");
    });

    // The button must show a loading indicator — either its accessible name changes
    // to something like "Signing in..." or it contains a spinner element.
    // We assert the accessible name matches the loading copy from the AC.
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
// T4 — On 200 success: redirects to /admin via router.push
// Requirement: R-LGN-1 (AC-LGN-1-S1)
// ─────────────────────────────────────────────────────────────────────────────

describe("T4: 200 success — redirect to /admin", () => {
  it("calls router.push('/admin') after a successful login response", async () => {
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
      // router.push must be called with '/admin' after successful login
      expect(mockPush).toHaveBeenCalledWith("/admin");
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
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });

    // No error message should appear in the DOM after a success
    // No error alert element must be present after a successful login
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T5 — On 401: inline error, no alert(), password cleared, email retained
// Requirement: R-LGN-2 (AC-LGN-2-F1)
// ─────────────────────────────────────────────────────────────────────────────

describe("T5: 401 response — inline error, password cleared, email retained", () => {
  it("shows the 'Invalid email or password' error message inline in the DOM", async () => {
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
      // Inline error message 'Invalid email or password' must appear in the DOM on 401
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
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
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
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
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
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
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    // Email field must retain its value after a 401 response so the user can correct only the password
    expect(emailInput).toHaveValue("ops@example.com");
  });

  it("user remains on /admin/login (router.push is NOT called) after a 401 response", async () => {
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
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });

    // router.push must NOT be called when login fails with 401
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T6 — On 400: fixed copy shown; server body.message NOT surfaced
// Requirement: R-LGN-2 (task spec)
// Updated: body.message must NOT appear; fixed string "Invalid request. Please
//   check your inputs and try again." must appear regardless of body content.
// ─────────────────────────────────────────────────────────────────────────────

describe("T6: 400 response — inline error showing server message", () => {
  it("shows an inline error message when the server returns 400", async () => {
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
      // The page must show the fixed 400 copy — NOT the server's body.message
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid request. Please check your inputs and try again."
      );
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

    // router.push must NOT be called when the server returns 400
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T7 — On 429: rate-limit message + 60-second button lockout with countdown
// Requirement: R-LGN-2 (AC-LGN-2-F2)
// Note: This test uses Jest fake timers for deterministic countdown behavior.
//
// Why we do NOT use the shared submitForm() helper here:
//   submitForm() uses the module-level userEvent import directly. In
//   @testing-library/user-event v14+, userEvent.type() schedules internal
//   setTimeout / Promise microtasks. With fake timers active those delays never
//   advance, causing userEvent.type() to hang and the test to timeout at 5000ms.
//   The fix is to create a userEvent instance via userEvent.setup() with the
//   advanceTimers option AFTER fake timers are installed (i.e., inside each test
//   body, after beforeEach has already called jest.useFakeTimers()), then use
//   that instance's .type() / .click() methods instead of the bare userEvent.*
//   functions. Because submitForm() is shared and must remain compatible with
//   T1-T6 and T8-T10 (which run without fake timers), each T7 test inlines its
//   own interaction sequence using the configured user instance.
// ─────────────────────────────────────────────────────────────────────────────

describe("T7: 429 response — rate-limit message and countdown lockout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("shows the rate-limit error message when the server returns 429", async () => {
    // Create userEvent instance AFTER fake timers are installed (beforeEach already ran).
    // advanceTimers delegates timer advancement to jest so internal delays resolve.
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
    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });

    await user.type(emailInput, "ops@example.com");
    await user.type(passwordInput, "somePassword123!");
    await user.click(submitButton);

    await waitFor(() => {
      // Rate-limit error message 'Too many attempts. Please wait before trying again.' must appear in the DOM on 429
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });
  });

  it("disables the submit button immediately after a 429 response", async () => {
    // Create userEvent instance AFTER fake timers are installed (beforeEach already ran).
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "WB-ADMIN-AUTH-005", message: "Too many attempts. Please wait before trying again." }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });

    await user.type(emailInput, "ops@example.com");
    await user.type(passwordInput, "somePassword123!");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });

    // The submit button must be disabled during the lockout window
    const buttons = screen.getAllByRole("button");
    const lockedButton = buttons.find(
      (b) => /try again|sign in|log in|submit/i.test(b.textContent ?? "")
    );
    // Submit button must be present and disabled during the 429 lockout period
    expect(lockedButton).toBeDefined();
    // Submit button must be disabled immediately after a 429 response
    expect(lockedButton).toBeDisabled();
  });

  it("shows a 'Try again in 60s' countdown in the button area immediately after 429", async () => {
    // Create userEvent instance AFTER fake timers are installed (beforeEach already ran).
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "WB-ADMIN-AUTH-005", message: "Too many attempts. Please wait before trying again." }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });

    await user.type(emailInput, "ops@example.com");
    await user.type(passwordInput, "somePassword123!");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });

    // Immediately after 429, the countdown should start at 60
    // A 'Try again in 60s' countdown must appear in the button area immediately after a 429 response
    expect(screen.getByText(/try again in 60s/i)).toBeInTheDocument();
  });

  it("decrements the countdown after 1 second", async () => {
    // Create userEvent instance AFTER fake timers are installed (beforeEach already ran).
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "WB-ADMIN-AUTH-005", message: "Too many attempts. Please wait before trying again." }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });

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
    // Create userEvent instance AFTER fake timers are installed (beforeEach already ran).
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "WB-ADMIN-AUTH-005", message: "Too many attempts. Please wait before trying again." }),
    } as Response);

    render(<LoginPage />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });

    await user.type(emailInput, "ops@example.com");
    await user.type(passwordInput, "somePassword123!");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/try again in 60s/i)).toBeInTheDocument();
    });

    // Advance all the way past the 60-second lockout.
    // Each 1-second tick triggers a React setState; wrapping each advance in its
    // own `await act(async () => {...})` flushes the re-render before the next
    // setTimeout is scheduled by the component, preventing the timer chain from
    // stalling. A single advanceTimersByTime(60000) does NOT work here because
    // React batches the intermediate state updates and the component never
    // schedules the subsequent timeouts before Jest's timer queue is drained.
    for (let i = 0; i < 60; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }

    // The countdown text must be gone and the button must be re-enabled
    // Countdown text must disappear after the 60-second lockout expires
    expect(screen.queryByText(/try again in/i)).not.toBeInTheDocument();

    const reenabledButton = screen.getByRole("button", { name: /sign in|log in|submit/i });
    // Submit button must be re-enabled after the 60-second lockout expires
    expect(reenabledButton).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T8 — On 5xx: status-interpolated error; network error: specific copy;
//      button re-enabled; form not reset
// Requirement: R-LGN-2 (AC-LGN-2-F3)
// Updated: 5xx copy now interpolates the status code; network error copy is distinct.
// ─────────────────────────────────────────────────────────────────────────────

describe("T8: 5xx and network errors — generic error message, form preserved", () => {
  it("shows 'Server error (HTTP 500). Please try again later or contact support.' on a 500 response", async () => {
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
      // Status-interpolated error message must appear on 500
      expect(
        screen.getByText(/server error \(http 500\)\. please try again later or contact support\./i)
      ).toBeInTheDocument();
    });
  });

  it("shows network error message when fetch throws", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      // Specific network-error copy must appear when fetch rejects (network failure)
      expect(
        screen.getByText(/cannot reach the server\. check your internet connection and try again\./i)
      ).toBeInTheDocument();
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
      // Wait for the 500 error copy to appear before asserting button state
      expect(
        screen.getByText(/server error \(http 500\)\. please try again later or contact support\./i)
      ).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });
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
      // Wait for the 500 error copy to appear before asserting field value
      expect(
        screen.getByText(/server error \(http 500\)\. please try again later or contact support\./i)
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    // Email field must NOT be cleared after a 5xx response (form not reset per AC-LGN-2-F3)
    expect(emailInput).toHaveValue("ops@example.com");
  });

  it("does NOT call router.push after a 5xx response", async () => {
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
      // Wait for the 500 error copy to appear before asserting navigation
      expect(
        screen.getByText(/server error \(http 500\)\. please try again later or contact support\./i)
      ).toBeInTheDocument();
    });

    // router.push must NOT be called when the server returns 5xx
    expect(mockPush).not.toHaveBeenCalled();
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

    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });
    await userEvent.click(submitButton);

    // Allow any async state updates to flush
    await act(async () => {});

    // fetch must NOT be called when the email field is empty — form guard must prevent submission
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

    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });
    await userEvent.click(submitButton);

    // Allow any async state updates to flush
    await act(async () => {});

    // fetch must NOT be called when the password field is empty — form guard must prevent submission
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T11 — 5xx responses — status code interpolated into error message
// Requirement: R-LGN-2 (AC-LGN-2-F3)
// New: 5xx copy uses "Server error (HTTP {status}). Please try again later or
//      contact support." — the status code is interpolated into the message.
//      Body content must NOT leak into the 5xx error banner.
// ─────────────────────────────────────────────────────────────────────────────

describe("T11: 5xx responses — status code interpolated into error message", () => {
  it("shows 'Server error (HTTP 502)...' on a 502 response", async () => {
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
      // Error message must interpolate the exact status code 502
      expect(
        screen.getByText(/server error \(http 502\)\. please try again later or contact support\./i)
      ).toBeInTheDocument();
    });
  });

  it("shows 'Server error (HTTP 503)...' on a 503 response", async () => {
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
      // Error message must interpolate the exact status code 503
      expect(
        screen.getByText(/server error \(http 503\)\. please try again later or contact support\./i)
      ).toBeInTheDocument();
    });
  });

  it("shows 5xx copy even when the response body is not parseable JSON", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      // json() rejects — simulates non-JSON body (e.g. nginx error page)
      json: async () => { throw new SyntaxError("Unexpected token < in JSON"); },
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      // 5xx copy must appear even when the body cannot be parsed as JSON
      expect(
        screen.getByText(/server error \(http 500\)\. please try again later or contact support\./i)
      ).toBeInTheDocument();
    });
  });

  it("does NOT surface body.message in the error banner for a 5xx response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        error: "INTERNAL",
        // body.message must not appear in the UI — only the fixed template copy
        message: "Detailed internal server diagnostics that must be hidden",
      }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      // 5xx banner must show the fixed template copy
      expect(
        screen.getByText(/server error \(http 500\)\. please try again later or contact support\./i)
      ).toBeInTheDocument();
    });

    // The server's body.message must NOT be rendered anywhere in the DOM on 5xx
    expect(
      screen.queryByText(/detailed internal server diagnostics/i)
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T12 — Other 4xx responses — body field priority and fallback
// Requirement: R-LGN-2 (task spec)
// New: Any 4xx that is not 400, 401, or 429 surfaces:
//      body.error ?? body.message ?? "Unexpected error. Please try again."
//      Empty string in body.error is treated as present (uses ?? not ||).
// ─────────────────────────────────────────────────────────────────────────────

describe("T12: Other 4xx responses — error or message from body, fallback if absent", () => {
  it("shows body.error when the server returns 403 with body.error present", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        // body.error takes priority over body.message
        error: "You do not have permission to access this resource.",
        message: "Forbidden",
      }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      // body.error must be displayed, not body.message
      expect(
        screen.getByText(/you do not have permission to access this resource\./i)
      ).toBeInTheDocument();
    });
  });

  it("shows body.message when the server returns 403 with body.error absent", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        // body.error is absent — fall through to body.message
        message: "Account is suspended.",
      }),
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      // body.message must be displayed when body.error is absent
      expect(screen.getByText(/account is suspended\./i)).toBeInTheDocument();
    });
  });

  it("shows fallback copy 'Unexpected error. Please try again.' when body has neither error nor message", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({}), // body has no error or message fields
    } as Response);

    render(<LoginPage />);

    await act(async () => {
      await submitForm("ops@example.com", "somePassword123!");
    });

    await waitFor(() => {
      // Fallback copy must appear when the response body provides no error or message
      expect(
        screen.getByText(/unexpected error\. please try again\./i)
      ).toBeInTheDocument();
    });
  });

  it("re-enables the submit button after any other 4xx response", async () => {
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
      // Wait for the error banner to appear before checking button state
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: /sign in|log in|submit/i });
    // Submit button must be re-enabled after any other 4xx so the user can retry
    expect(submitButton).not.toBeDisabled();
  });

  it("does NOT call router.push after any other 4xx response", async () => {
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
      // Wait for the error banner to appear before checking navigation
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // router.push must NOT be called when the server returns any other 4xx
    expect(mockPush).not.toHaveBeenCalled();
  });
});
