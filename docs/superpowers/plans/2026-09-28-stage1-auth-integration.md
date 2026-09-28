# Stage 1: Auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frontend's localStorage-only pseudo-auth with real sign-up/sign-in/sign-out against the Express/Supabase backend, using a server-verified session as the source of truth for `RoleProtectedRoute`.

**Architecture:** A tiny fetch wrapper (`apiClient.ts`) + named auth functions (`auth.ts`), both in a new `client/src/lib/` folder, feed a React Context (`AuthContext.tsx`) that caches the last-known role in localStorage for instant first paint and revalidates against the real session in the background. `RoleProtectedRoute` and every logout call site switch from reading localStorage directly to reading this context.

**Tech Stack:** React 18, TypeScript, react-router-dom. No new dependencies — plain `fetch`, no data-fetching library (explicitly decided during brainstorming).

**Spec:** `docs/superpowers/specs/2026-09-28-frontend-backend-auth-integration-design.md`

## Global Constraints

- No new npm dependencies in `client/` for this stage.
- Every backend response is `{ success: boolean, data?: T, message?: string }` — the API client unwraps `data` on success and throws on failure (see Task 1).
- Backend `user_type` values are `STUDENT` | `HOSTEL_MANAGER` | `ADMIN` (uppercase, backend vocabulary). The existing frontend role convention used everywhere downstream (`RoleProtectedRoute`'s `UserRole` type, every `allow={[...]}` prop in `App.tsx`) is lowercase `student` | `manager` | `admin`. **This plan normalizes backend roles to the existing lowercase convention inside `AuthContext` only** — `RoleProtectedRoute.tsx`'s public interface and every `allow={[...]}` call site in `App.tsx` are unchanged. (The approved spec's `getMe()` type sketch used the uppercase backend values directly without addressing this; this plan corrects that before it becomes a live casing bug — the exact class of mistake that already broke role checks twice earlier in this project's history.)
- Every task's automated check is `npx tsc --noEmit -p .` run from `client/` — this stage has no test framework wired up for the client and the approved spec explicitly scoped this stage to manual, human verification against the user's real Supabase project (this sandbox has no network path to it). Each task also lists exact manual verification steps; the human partner runs those, not the agent.
- Every commit message ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` per this session's established convention. Commit only the files that task names — no `git add -A`.

## Review Focus

1. **Wrong password on sign-in.** A reasonable person expects an inline error message, not a silent no-op or an unhandled exception in the console. (Task 6 test.)
2. **Backend unreachable (server not running).** `fetch` itself rejects (no HTTP response to read a status from) — this must not be mistaken for an `ApiError` and must not crash the app with an unhandled promise rejection. (Task 1 and Task 6 both touch this: `apiFetch` must let it propagate as a plain `Error`, and `Login.tsx` must catch the non-`ApiError` case too.)
3. **Session cookie present but expired/revoked server-side.** `getMe()` returns 401; the optimistic cache must be corrected (cleared) rather than left pointing at a stale logged-in state that then contradicts what every real backend endpoint enforces. (Task 3 test.)
4. **Manager registering with an email that already has an account.** Backend returns a 4xx with a message (`registerManager`'s zod/DB-level duplicate check) — this must surface as a visible error, not a silent redirect to `/manager` as if it succeeded. (Task 6 test.)
5. **Double-submitting the login form** (e.g. a slow network, user clicks Sign In twice). Without a submitting guard, this fires two concurrent requests; the second's response could race the first and briefly show a stale error or double-navigate. (Task 6 test — `isSubmitting` disables the submit button.)

---

## File Structure

```
client/src/lib/apiClient.ts        (new) — fetch wrapper, ApiError class
client/src/lib/auth.ts             (new) — signUpStudent, signInEmail, registerManager, signOutApi, getMe
client/src/contexts/AuthContext.tsx (new) — AuthProvider, useAuth()
client/src/components/RoleProtectedRoute.tsx (rewrite) — reads useAuth() instead of localStorage
client/src/App.tsx                 (modify) — wrap tree in AuthProvider
client/src/pages/Login.tsx         (modify) — real signup/signin calls, inline errors
client/src/components/DesktopSidebar.tsx  (modify) — real signOut()
client/src/components/ManagerSidebar.tsx  (modify) — real signOut()
client/src/pages/Profile.tsx              (modify) — real signOut()
client/src/components/AdminLayout.tsx     (modify) — real signOut()
```

---

### Task 1: API client foundation

**Files:**
- Create: `client/src/lib/apiClient.ts`

**Interfaces:**
- Produces: `export class ApiError extends Error { status: number }`, `export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>`

- [ ] **Step 1: Create the file**

```typescript
// client/src/lib/apiClient.ts

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Wraps fetch for the CampusNest backend. Always sends the better-auth
 * session cookie (`credentials: "include"`) and unwraps the backend's
 * `{ success, data }` / `{ success, message }` response envelope.
 *
 * Throws ApiError for any non-2xx HTTP response (status + the backend's own
 * message). A network-level failure (backend unreachable) is NOT wrapped —
 * it propagates as whatever error `fetch` itself throws, since there's no
 * HTTP response to read a status/message from. Callers should distinguish
 * the two: `catch (e) { if (e instanceof ApiError) ... else /* network *\/ }`.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body: ApiEnvelope<T> = await res.json().catch(() => ({ success: false }));

  if (!res.ok) {
    throw new ApiError(res.status, body.message || `Request failed (${res.status})`);
  }

  return (body.data as T) ?? (body as unknown as T);
}
```

- [ ] **Step 2: Type-check**

Run (from `client/`): `npx tsc --noEmit -p .`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/lib/apiClient.ts
git commit -m "$(cat <<'EOF'
feat(client): add API client foundation for backend integration

A minimal fetch wrapper, no new dependency: always sends the
better-auth session cookie, unwraps the backend's {success,data}
response envelope, and throws a typed ApiError (real HTTP status +
backend message) on failure. A network-level failure (backend
unreachable) propagates as a plain Error, not ApiError, so callers can
tell the two apart.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Manual verification:** None yet — this file has no caller until Task 2. The type-check in Step 2 is the only gate for this task.

---

### Task 2: Auth API functions

**Files:**
- Create: `client/src/lib/auth.ts`

**Interfaces:**
- Consumes: `apiFetch<T>(path, options)` and `ApiError` from `client/src/lib/apiClient.ts` (Task 1).
- Produces:
  - `export interface BackendUser { id: string; email: string; name: string; user_type: "STUDENT" | "HOSTEL_MANAGER" | "ADMIN"; profile_complete: boolean }`
  - `export function signUpStudent(email: string, password: string, name?: string): Promise<unknown>`
  - `export function signInEmail(email: string, password: string): Promise<unknown>`
  - `export function registerManager(email: string, password: string, name?: string): Promise<unknown>`
  - `export function signOutApi(): Promise<unknown>`
  - `export function getMe(): Promise<BackendUser>`

- [ ] **Step 1: Create the file**

```typescript
// client/src/lib/auth.ts
import { apiFetch } from "./apiClient";

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  user_type: "STUDENT" | "HOSTEL_MANAGER" | "ADMIN";
  profile_complete: boolean;
}

// Generic sign-up. The backend's databaseHooks always assigns STUDENT here
// regardless of email domain (see server/auth.js) — HOSTEL_MANAGER is only
// ever granted via registerManager below.
export const signUpStudent = (email: string, password: string, name?: string) =>
  apiFetch("/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });

export const signInEmail = (email: string, password: string) =>
  apiFetch("/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

// Explicit manager registration — the only path that grants HOSTEL_MANAGER.
export const registerManager = (email: string, password: string, name?: string) =>
  apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, user_type: "HOSTEL_MANAGER" }),
  });

export const signOutApi = () => apiFetch("/auth/sign-out", { method: "POST" });

export const getMe = () => apiFetch<BackendUser>("/users/me");
```

- [ ] **Step 2: Type-check**

Run (from `client/`): `npx tsc --noEmit -p .`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/lib/auth.ts
git commit -m "$(cat <<'EOF'
feat(client): add auth API functions

Named functions over apiFetch, one per backend auth endpoint:
signUpStudent, signInEmail, registerManager, signOutApi, getMe.
registerManager is the only one that ever results in HOSTEL_MANAGER —
the generic sign-up path always starts as STUDENT server-side.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Manual verification:** None yet — no caller until Task 3.

---

### Task 3: AuthContext with optimistic cache

**Files:**
- Create: `client/src/contexts/AuthContext.tsx`

**Interfaces:**
- Consumes: `getMe`, `signOutApi`, `BackendUser` from `client/src/lib/auth.ts` (Task 2).
- Produces:
  - `export type FrontendRole = "student" | "manager" | "admin"`
  - `export interface AuthUser { id: string; email: string; name: string; role: FrontendRole; profileComplete: boolean }`
  - `export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element`
  - `export function useAuth(): { user: AuthUser | null; isLoading: boolean; signOut: () => Promise<void>; refetch: () => Promise<void> }`

- [ ] **Step 1: Create the file**

```typescript
// client/src/contexts/AuthContext.tsx
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
```

- [ ] **Step 2: Type-check**

Run (from `client/`): `npx tsc --noEmit -p .`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/contexts/AuthContext.tsx
git commit -m "$(cat <<'EOF'
feat(client): add AuthContext with optimistic-cache session state

Same provider pattern as the existing BookingContext. Shows a cached
role instantly on repeat visits (no loading spinner), then revalidates
against GET /api/users/me in the background and corrects state if the
real session disagrees (expired/logged out elsewhere) or doesn't
exist yet (first-ever visit — no cache to show optimistically, so
isLoading starts true in that case).

Normalizes the backend's STUDENT/HOSTEL_MANAGER/ADMIN vocabulary to
the frontend's existing lowercase student/manager/admin convention
in one place, so RoleProtectedRoute and every allow={[...]} call site
in App.tsx need zero changes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Manual verification:** None yet — `AuthProvider` isn't mounted into the app until Task 5, and nothing reads `useAuth()` until Task 4.

---

### Task 4: RoleProtectedRoute reads real session

**Files:**
- Modify: `client/src/components/RoleProtectedRoute.tsx` (full rewrite — the file is 33 lines, replace entirely)

**Interfaces:**
- Consumes: `useAuth()`, `FrontendRole` from `client/src/contexts/AuthContext.tsx` (Task 3).
- Produces: `export type UserRole = FrontendRole` (kept as an alias so any external import of the old name still resolves), `export default function RoleProtectedRoute({ allow, children }: { allow: FrontendRole[]; children: React.ReactNode })` — same public signature as before.

- [ ] **Step 1: Replace the file's contents**

```typescript
// client/src/components/RoleProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth, type FrontendRole } from "@/contexts/AuthContext";

export type UserRole = FrontendRole;

const ROLE_HOME: Record<FrontendRole, string> = {
  student: "/",
  manager: "/manager",
  admin: "/admin",
};

export default function RoleProtectedRoute({ allow, children }: { allow: FrontendRole[]; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Type-check**

Run (from `client/`): `npx tsc --noEmit -p .`
Expected: no output. If this fails, check whether any other file still imports `getCurrentRole` from this module (the old function is removed) — none should, since it was only used internally by this file's own default export previously, but `grep -rn "getCurrentRole" client/src` from the repo root to be sure.

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/components/RoleProtectedRoute.tsx
git commit -m "$(cat <<'EOF'
feat(client): RoleProtectedRoute reads the real session, not localStorage

Previously read localStorage.userRole directly — trivially bypassable
via devtools, and not connected to any real backend verification.
Now reads useAuth() from AuthContext; shows a loading spinner while
the session check is in flight and there's no cached role to show yet.
Public interface (allow prop, ROLE_HOME redirect behavior) unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Manual verification:** None yet — `RoleProtectedRoute` will throw at runtime (`useAuth must be used within an AuthProvider`) until Task 5 mounts `AuthProvider`. This is expected; don't run the dev server to check this task in isolation.

---

### Task 5: Mount AuthProvider in App.tsx

**Files:**
- Modify: `client/src/App.tsx:6` (add import), `client/src/App.tsx:44-46` and `:90` (wrap provider tree)

**Interfaces:**
- Consumes: `AuthProvider` from `client/src/contexts/AuthContext.tsx` (Task 3).

- [ ] **Step 1: Add the import**

In `client/src/App.tsx`, after the existing `import { BookingProvider } from "./contexts/BookingContext";` line, add:

```typescript
import { AuthProvider } from "./contexts/AuthContext";
```

- [ ] **Step 2: Wrap the provider tree**

Change:

```typescript
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <ToastProvider>
        <BookingProvider>
        <Router>
```

to:

```typescript
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <ToastProvider>
        <AuthProvider>
        <BookingProvider>
        <Router>
```

And change the matching closing tags at the bottom from:

```typescript
      </Router>
        </BookingProvider>
      </ToastProvider>
    </ThemeProvider>
```

to:

```typescript
      </Router>
        </BookingProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
```

(`AuthProvider` wraps `BookingProvider`, not the other way around — nothing in this stage requires the ordering, but `Auth` conceptually gates everything else, so it sits outermost next to `ThemeProvider`.)

- [ ] **Step 3: Type-check**

Run (from `client/`): `npx tsc --noEmit -p .`
Expected: no output (clean).

- [ ] **Step 4: Manual verification**

Run the dev server: from `client/`, `npm run dev`. Open the app in a browser (with the backend NOT necessarily running — this step just confirms the app still loads without crashing).

Expected: the app redirects to `/login` (since there's no session and no cache yet, `isLoading` briefly shows the spinner, then `useAuth()` resolves `user: null`, `RoleProtectedRoute` redirects). If the backend isn't running, check the browser console — you should see the `[AuthProvider] Could not reach the backend:` log from Task 3's `refetch`, and the app should still land on `/login` (not hang, not crash). This confirms the Review Focus item 2 (backend unreachable) behaves correctly.

- [ ] **Step 5: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(client): mount AuthProvider

Wraps the route tree so useAuth() (and RoleProtectedRoute, which
depends on it as of the previous commit) works app-wide.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Login.tsx — real sign-up/sign-in

**Files:**
- Modify: `client/src/pages/Login.tsx` (imports, state, `handleLoginClick`/`handleComplete`, the two `Input` fields for email/password, the manager email field already present, error display, submit-button disabled state)

**Interfaces:**
- Consumes: `signUpStudent`, `signInEmail`, `registerManager` from `client/src/lib/auth.ts` (Task 2); `ApiError` from `client/src/lib/apiClient.ts` (Task 1); `useAuth` from `client/src/contexts/AuthContext.tsx` (Task 3).

- [ ] **Step 1: Add imports**

At the top of `client/src/pages/Login.tsx`, change:

```typescript
import { useState, useEffect } from "react";
import { Shield, Eye, EyeOff, CheckCircle, Monitor, BookOpen, Search, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { Input } from "@/components/ui/input";
```

to:

```typescript
import { useState, useEffect } from "react";
import { Shield, Eye, EyeOff, CheckCircle, Monitor, BookOpen, Search, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { signUpStudent, signInEmail, registerManager } from "@/lib/auth";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
```

- [ ] **Step 2: Add controlled form state and pull in `refetch`**

Change:

```typescript
export default function Login() {
  const [step, setStep] = useState<"institution" | "login" | "avatar">("institution");
  const [role, setRole] = useState<"student" | "manager">("student");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
```

to:

```typescript
export default function Login() {
  const [step, setStep] = useState<"institution" | "login" | "avatar">("institution");
  const [role, setRole] = useState<"student" | "manager">("student");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { refetch } = useAuth();
```

- [ ] **Step 3: Rewrite `handleLoginClick` to call the real backend**

Change:

```typescript
  const handleLoginClick = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (role === "student") {
      setStep("avatar");
      return;
    }
    localStorage.setItem("userRole", role);
    localStorage.setItem("userAvatar", "manager-admin");
    navigate("/manager");
  };

  const handleComplete = () => {
    if (selectedAvatar) {
      localStorage.setItem("userRole", "student");
      localStorage.setItem("userAvatar", selectedAvatar);
      navigate("/");
    }
  };
```

to:

```typescript
  const handleLoginClick = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // guard against double-submit (Review Focus #5)
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (role === "manager") {
        if (authMode === "signup") {
          await registerManager(email, password, fullName || undefined);
        } else {
          await signInEmail(email, password);
        }
        await refetch();
        navigate("/manager");
        return;
      }

      // Student path
      if (authMode === "signup") {
        await signUpStudent(email, password, fullName || undefined);
      } else {
        await signInEmail(email, password);
      }
      await refetch();

      if (authMode === "signup") {
        // New account — continue to the (cosmetic, frontend-only) avatar
        // picker before landing on the home page.
        setStep("avatar");
      } else {
        navigate("/");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Couldn't reach the server. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    // The avatar picker is cosmetic only — the account already exists by
    // this point (created during the signup call in handleLoginClick).
    navigate("/");
  };
```

- [ ] **Step 4: Wire the Full name, Email, and Password inputs to the new state**

Find (the signup-only full name field):

```typescript
            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[#463C38]">Full name</label>
                <Input 
                  type="text" 
                  placeholder="Sarah Adjei" 
                  className="h-11 rounded-lg bg-white border-[#E5E0D8] text-[#463C38] text-[14px] font-medium placeholder:text-[#A29A91] focus-visible:ring-2 focus-visible:ring-burnt-umber/30 focus-visible:border-burnt-umber"
                />
              </div>
            )}
```

Replace with:

```typescript
            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[#463C38]">Full name</label>
                <Input 
                  type="text" 
                  placeholder="Sarah Adjei" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-lg bg-white border-[#E5E0D8] text-[#463C38] text-[14px] font-medium placeholder:text-[#A29A91] focus-visible:ring-2 focus-visible:ring-burnt-umber/30 focus-visible:border-burnt-umber"
                />
              </div>
            )}
```

Find (the email field):

```typescript
              <Input
                type="email"
                required
                placeholder={role === "manager" ? "you@yourhostel.com" : "sarah.adjei@ashesi.edu.gh"}
                className="h-11 rounded-lg bg-white border-[#E5E0D8] text-[#463C38] text-[14px] font-medium placeholder:text-[#A29A91] focus-visible:ring-2 focus-visible:ring-burnt-umber/30 focus-visible:border-burnt-umber"
              />
```

Replace with:

```typescript
              <Input
                type="email"
                required
                placeholder={role === "manager" ? "you@yourhostel.com" : "sarah.adjei@ashesi.edu.gh"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-lg bg-white border-[#E5E0D8] text-[#463C38] text-[14px] font-medium placeholder:text-[#A29A91] focus-visible:ring-2 focus-visible:ring-burnt-umber/30 focus-visible:border-burnt-umber"
              />
```

Find (the password field):

```typescript
                <Input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  placeholder="••••••••" 
                  className="h-11 rounded-lg bg-white border-[#E5E0D8] text-[#463C38] text-[14px] font-medium placeholder:text-[#A29A91] pr-16 focus-visible:ring-2 focus-visible:ring-burnt-umber/30 focus-visible:border-burnt-umber"
                />
```

Replace with:

```typescript
                <Input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg bg-white border-[#E5E0D8] text-[#463C38] text-[14px] font-medium placeholder:text-[#A29A91] pr-16 focus-visible:ring-2 focus-visible:ring-burnt-umber/30 focus-visible:border-burnt-umber"
                />
```

- [ ] **Step 5: Display the error and disable the submit button while submitting**

Find:

```typescript
            {/* Create account button */}
            <button 
              type="submit" 
              className={`w-full h-11 ${authMode === 'signup' ? 'mt-1' : 'mt-2'} rounded-full font-bold text-[14px] shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2 transform hover:-translate-y-0.5 text-white bg-canyon`}
            >
              <span>{authMode === 'signup' ? 'Create account' : 'Sign in'}</span>
            </button>
          </form>
```

Replace with:

```typescript
            {formError && (
              <p className="text-[13px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            {/* Create account button */}
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full h-11 ${authMode === 'signup' ? 'mt-1' : 'mt-2'} rounded-full font-bold text-[14px] shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2 transform hover:-translate-y-0.5 text-white bg-canyon disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
            >
              <span>{isSubmitting ? "Please wait…" : authMode === 'signup' ? 'Create account' : 'Sign in'}</span>
            </button>
          </form>
```

- [ ] **Step 6: Type-check**

Run (from `client/`): `npx tsc --noEmit -p .`
Expected: no output (clean).

- [ ] **Step 7: Manual verification**

With both dev servers running (`npm run dev` in `server/`, `npm run dev` in `client/`):

1. Go to `/login`, pick Student, continue past the institution step, on the login form switch to "Create an account" (signup mode), fill in a real name/email/password, submit. **Expected:** lands on the avatar picker, then Continue lands on `/`. Reload the page — you should stay on `/` (not bounce to `/login`), confirming the session persisted (Review Focus #3, the non-expired case).
2. From `/`, log out (any sidebar/profile logout button). **Expected:** redirected to `/login`. Try navigating back to `/` directly via the URL bar. **Expected:** redirected to `/login` again (the session is actually gone server-side, not just hidden client-side) — this exercises Task 4's `RoleProtectedRoute` but is the real end-to-end proof this whole stage works.
3. Sign in again with the same email but a wrong password. **Expected:** an inline red error message appears (Review Focus #1), the page does not navigate away.
4. Pick Manager, "Create an account", fill in details, submit. **Expected:** lands on `/manager`. Try registering a second manager account with the exact same email. **Expected:** an inline error appears (Review Focus #4), not a silent success.
5. Stop the backend server (`Ctrl+C` in the `server/` terminal), try signing in again. **Expected:** inline error "Couldn't reach the server. Please try again." (Review Focus #2), not a hung UI or a crashed page.

- [ ] **Step 8: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/pages/Login.tsx
git commit -m "$(cat <<'EOF'
feat(client): Login.tsx calls the real backend

Student and manager sign-up/sign-in now call the real auth endpoints
instead of always silently succeeding and writing to localStorage
directly. Real backend error messages (wrong password, duplicate
email) now display inline. Submit button disables while a request is
in flight to prevent double-submission. The avatar picker step stays
cosmetic (frontend-only) — the account already exists by the time a
signing-up student reaches it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Real sign-out everywhere

**Files:**
- Modify: `client/src/components/DesktopSidebar.tsx:97`
- Modify: `client/src/components/ManagerSidebar.tsx:84`
- Modify: `client/src/pages/Profile.tsx:172-173`
- Modify: `client/src/components/AdminLayout.tsx:1,10-13`

**Interfaces:**
- Consumes: `useAuth` from `client/src/contexts/AuthContext.tsx` (Task 3).

- [ ] **Step 1: `DesktopSidebar.tsx`**

Add the import (after the existing `useTheme` import):

```typescript
import { useTheme } from "./theme-provider";
import { useAuth } from "@/contexts/AuthContext";
```

Inside `export default function DesktopSidebar() {`, add alongside the existing `const { theme, setTheme } = useTheme();` line:

```typescript
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
```

Change:

```typescript
            onClick={() => { localStorage.removeItem("userAvatar"); localStorage.removeItem("userRole"); }}
```

to:

```typescript
            onClick={() => { signOut(); }}
```

- [ ] **Step 2: `ManagerSidebar.tsx`**

Add the import:

```typescript
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Building2, CalendarDays, Users2, Receipt, LogOut } from "lucide-react";
import kaya from "../assets/Kaya.png";
import { MANAGER_BOOKINGS } from "@/data/managerBookings";
import { useAuth } from "@/contexts/AuthContext";
```

Inside `export default function ManagerSidebar() {`, add alongside the existing `const { pathname } = useLocation();` line:

```typescript
  const { pathname } = useLocation();
  const { signOut } = useAuth();
```

Change:

```typescript
            onClick={() => { localStorage.removeItem("userAvatar"); localStorage.removeItem("userRole"); }}
```

to:

```typescript
            onClick={() => { signOut(); }}
```

- [ ] **Step 3: `Profile.tsx`**

Add the import:

```typescript
import { useBookings } from "@/contexts/BookingContext";
import { useAuth } from "@/contexts/AuthContext";
```

Inside `export default function Profile() {`, add near the top (alongside the existing `localStorage.getItem` calls):

```typescript
  const { signOut } = useAuth();
```

Change:

```typescript
            onClick={() => { localStorage.removeItem("userAvatar"); localStorage.removeItem("userRole"); }}
```

to:

```typescript
            onClick={() => { signOut(); }}
```

- [ ] **Step 4: `AdminLayout.tsx`**

Add the import:

```typescript
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { LayoutGrid, Users, Building, GraduationCap, Box, Sun, ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import AdminBottomNav from "./AdminBottomNav";
import { useAuth } from "@/contexts/AuthContext";
```

Change:

```typescript
export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleExitAdmin = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("userAvatar");
    navigate("/login");
  };
```

to:

```typescript
export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleExitAdmin = async () => {
    await signOut();
    navigate("/login");
  };
```

- [ ] **Step 5: Type-check**

Run (from `client/`): `npx tsc --noEmit -p .`
Expected: no output (clean).

- [ ] **Step 6: Manual verification**

With both dev servers running and logged in as a student: click the sidebar logout link. **Expected:** redirected to `/login`. Try navigating directly to `/` via the URL bar. **Expected:** redirected back to `/login` (the server-side session is actually gone — this is the real proof, not just that localStorage got cleared). Repeat for the manager sidebar's logout, `Profile.tsx`'s logout row, and the admin layout's "Exit Admin" button (log in as each role via the appropriate Login.tsx path or by hitting `/api/auth/sign-in/email` directly for an already-existing account of that role, then test that role's own logout control).

- [ ] **Step 7: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/components/DesktopSidebar.tsx client/src/components/ManagerSidebar.tsx client/src/pages/Profile.tsx client/src/components/AdminLayout.tsx
git commit -m "$(cat <<'EOF'
feat(client): wire all four logout call sites to the real sign-out

DesktopSidebar, ManagerSidebar, Profile, and AdminLayout each just
deleted localStorage keys before navigating to /login — the server-
side session (and its cookie) was left intact, so a stale session
could still be replayed. All four now call AuthContext's signOut(),
which hits POST /api/auth/sign-out before clearing local state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** every item in the spec's "Architecture" section maps to a task (apiClient→Task 1, auth.ts→Task 2, AuthContext→Task 3, RoleProtectedRoute→Task 4, App.tsx→Task 5, Login.tsx→Task 6, logout sites→Task 7) — matches the spec's own commit plan 1:1.
- **Placeholder scan:** none found — every step has real, complete code, not a description of code.
- **Type consistency:** `BackendUser` (Task 2) → `AuthUser`/`FrontendRole` (Task 3) → `FrontendRole` used verbatim in `RoleProtectedRoute` (Task 4) and referenced (not re-declared) everywhere else. `useAuth()`'s return shape (`{ user, isLoading, signOut, refetch }`) is defined once in Task 3 and used with those exact names in Tasks 4, 5's verification, 6, and 7 — no renaming drift.
- **Review Focus:** all five items each have an owning task and an explicit test step (listed inline above) — Task 1 (network failure propagation), Task 3 (401/cache correction), Task 6 (wrong password, duplicate email, double-submit).
