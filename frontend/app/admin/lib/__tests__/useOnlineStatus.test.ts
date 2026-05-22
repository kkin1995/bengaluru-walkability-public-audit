/**
 * Tests for frontend/app/admin/lib/useOnlineStatus.ts
 *
 * Requirements covered:
 *   ADMIN-UI-04 — Admin pages show offline state UI when navigator.onLine === false
 *   D-15 — useOnlineStatus() hook: navigator.onLine on mount + offline/online event listeners
 */

import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "../useOnlineStatus";

describe("useOnlineStatus", () => {
  beforeEach(() => {
    // Reset navigator.onLine to true before each test
    Object.defineProperty(navigator, "onLine", { writable: true, value: true });
  });

  it("returns true when navigator.onLine is true on mount", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("returns false after 'offline' event fires", () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
  });

  it("returns true after 'online' event fires following an 'offline' event", () => {
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
