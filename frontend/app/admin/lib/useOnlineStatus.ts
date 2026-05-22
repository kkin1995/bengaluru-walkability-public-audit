"use client";

import { useState, useEffect } from "react";

/**
 * useOnlineStatus — detects network connectivity and responds to online/offline events.
 *
 * Returns true when the browser reports connectivity, false when offline.
 * Subscribes to window 'offline' and 'online' events to update reactively.
 * SSR-safe: defaults to true on the server (window not available).
 *
 * Per D-15: UI states only — no Service Worker or IndexedDB. Phase 02.5 scope.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Sync with actual browser state on mount
    setIsOnline(navigator.onLine);

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
