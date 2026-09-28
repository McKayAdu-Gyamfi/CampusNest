import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getMe, signOutApi, type BackendUser } from "@/lib/auth";
import { ApiError } from "@/lib/apiClient";

export type FrontendRole = "student" | "manager" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: FrontendRole;
  profileComplete: boolean;
}

const ROLE_CACHE_KEY = "cached_user_type";

// Backend's user_type vocabulary (STUDENT/HOSTEL_MANAGER/ADMIN) is uppercase
// and backend-flavored; every existing consumer downstream (RoleProtectedRoute,
// every allow={[...]} in App.tsx) already uses the lowercase student/manager/
// admin convention. Normalize once, here, rather than touching every call site.
function toFrontendRole(userType: BackendUser["user_type"]): FrontendRole {
  if (userType === "HOSTEL_MANAGER") return "manager";
  if (userType === "ADMIN") return "admin";
  return "student";
}

function toAuthUser(backendUser: BackendUser): AuthUser {
  return {
    id: backendUser.id,
    email: backendUser.email,
    name: backendUser.name,
    role: toFrontendRole(backendUser.user_type),
    profileComplete: backendUser.profile_complete,
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedRole = localStorage.getItem(ROLE_CACHE_KEY) as FrontendRole | null;

  // Optimistic cache: if we have a cached role, show it immediately (no
  // spinner on repeat visits) and correct it in the background below. If
  // there's no cache at all (first-ever visit), there's nothing to show
  // optimistically, so isLoading starts true.
  const [user, setUser] = useState<AuthUser | null>(
    cachedRole ? { id: "", email: "", name: "", role: cachedRole, profileComplete: false } : null
  );
  const [isLoading, setIsLoading] = useState(!cachedRole);

  const refetch = useCallback(async () => {
    try {
      const backendUser = await getMe();
      const authUser = toAuthUser(backendUser);
      setUser(authUser);
      localStorage.setItem(ROLE_CACHE_KEY, authUser.role);
    } catch (err) {
      // 401 (no session / expired) or any other failure: there is no
      // confirmed session, so don't leave a stale cached role around —
      // every real backend endpoint would reject this session anyway.
      setUser(null);
      localStorage.removeItem(ROLE_CACHE_KEY);
      if (!(err instanceof ApiError)) {
        // Network-level failure (backend unreachable) — surface in the
        // console for debugging; the UI still degrades to "logged out"
        // rather than hanging or throwing.
        console.error("[AuthProvider] Could not reach the backend:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutApi();
    } catch (err) {
      // Even if the network call fails, still clear local state below —
      // the user clicked "log out" and expects to be logged out locally
      // regardless of whether the server round-trip succeeded.
      console.error("[AuthProvider] signOutApi failed:", err);
    }
    setUser(null);
    localStorage.removeItem(ROLE_CACHE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
