// Auth is bypassed — the app runs entirely client-side (demo mode) against
// localStorage-backed data. useAuth returns a stub guest user so the
// DashboardLayout renders and any user-dependent UI has something to read.
// No tRPC calls, no server round-trips.

import { useCallback, useMemo } from "react";

const GUEST_USER = {
  id: 0,
  email: "guest@local",
  name: "Guest",
  role: "user",
} as const;

export function useAuth() {
  const logout = useCallback(async () => {
    // No server session to clear — just a no-op.
  }, []);

  return useMemo(
    () => ({
      user: GUEST_USER,
      loading: false,
      error: null,
      isAuthenticated: true,
      refresh: () => Promise.resolve(),
      logout,
    }),
    [logout],
  );
}
