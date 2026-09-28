# Frontend↔Backend Integration — Stage 1: Auth

## Context

CampusNest's frontend (`client/`) is a fully-built React mockup running entirely on
localStorage (`userAvatar`, `userRole`) and in-memory context state (`BookingContext`).
The backend (`server/`) is a real Express + Supabase/Postgres API with working
auth (better-auth, cookie-based sessions), role-based authorization, and CRUD for
hostels/rooms/bookings/reviews/complaints/users — audited and hardened earlier
this session (rate limiting, ownership checks, hostel-approval gate, etc.).

Connecting them is too large for one spec. It decomposes into five independently
useful, independently testable stages:

1. **Auth** (this spec) — real sign-up/sign-in/sign-out/session, replacing the
   localStorage-only pseudo-auth and `RoleProtectedRoute`'s client-only guard
   with server-verified sessions.
2. **Hostels/Rooms (browse)** — Explore/Saved/hostel-detail pages read real data.
3. **Bookings** — the Booking→PaymentDetails→ManageBookings flow against real
   `BOOKING` rows (also requires the profile-completion step deferred out of
   Stage 1 — students need `course`/`student_id`, managers need
   `payment_details`, before `requireCompleteProfile` lets a booking through).
4. **Manager** — hostel/room CRUD, booking approval, from the manager pages.
5. **Admin** — user management, hostel approval queue.

Each stage gets committed file-by-file as it lands, and is manually verified by
the user against their real Supabase project (this sandbox has no network path
to it — confirmed repeatedly via `ENOTFOUND`/`fetch failed` — so end-to-end
verification happens in the user's own environment, not here).

This document specs **Stage 1 only**. Stages 2-5 each get their own
spec→plan→implementation cycle when reached.

## Goals (Stage 1)

- Sign up as a student, sign in/out, session persists across reloads.
- Sign up / sign in as a manager (separate endpoint for manager creation,
  same sign-in endpoint thereafter).
- `RoleProtectedRoute` enforces role based on the real server session, not a
  client-settable localStorage value — closing the "anyone can set
  `localStorage.userRole` in devtools" gap for good (server already
  independently enforces role on every real endpoint; this stage makes the
  *frontend's own* gate trustworthy too, not just cosmetic).
- Real error messages surface on failed sign-in/sign-up (wrong password,
  duplicate email) instead of the form always succeeding.

## Non-goals (Stage 1)

- Profile completion (`course`/`student_id`/`payment_details`) — needed before
  Stage 3 (Bookings), not before Stage 1 lands.
- Persisting the avatar picker's chosen color to the backend — `user.image`
  expects a real URL; the mock avatar-color concept has no backend
  equivalent yet. Avatar picker stays frontend-only cosmetic for now.
- The institution picker — backend has no "institution" concept; role comes
  from how the account was created (generic sign-up vs `/register`), not
  from which school the student picked. Stays frontend-only cosmetic.
- Hostels/Rooms/Bookings/Manager/Admin data wiring — later stages.

## Architecture

### `client/src/lib/apiClient.ts` (new)

A minimal fetch wrapper, no new dependency:

```ts
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // send/receive the better-auth session cookie
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.message || `Request failed (${res.status})`);
  return body.data ?? body;
}
```

Every backend response is `{ success, data }` or `{ success, message }` — this
unwraps `data` on success and throws a typed `ApiError` (carrying the real
status + backend message) on failure, so callers can `catch (e) { if (e instanceof ApiError) ... }`.

### `client/src/lib/auth.ts` (new)

Thin, named functions over `apiFetch`, one per backend auth endpoint:

```ts
export const signUpStudent = (email: string, password: string, name?: string) =>
  apiFetch("/auth/sign-up/email", { method: "POST", body: JSON.stringify({ email, password, name }) });

export const signInEmail = (email: string, password: string) =>
  apiFetch("/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) });

export const registerManager = (email: string, password: string, name?: string) =>
  apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name, user_type: "HOSTEL_MANAGER" }) });

export const signOutApi = () => apiFetch("/auth/sign-out", { method: "POST" });

export const getMe = () => apiFetch<{ id: string; user_type: "STUDENT" | "HOSTEL_MANAGER" | "ADMIN"; profile_complete: boolean; email: string; name: string }>("/users/me");
```

### `client/src/contexts/AuthContext.tsx` (new)

Same provider pattern as the existing `BookingContext`. Optimistic-cache
approach (per user's choice):

- On mount, reads `localStorage.getItem("cached_user_type")` for instant
  first paint (`user: { user_type: cached } | null`, `isLoading: false`
  immediately if a cache exists — no spinner on repeat visits).
- In the background, always calls `getMe()`:
  - Success → sets real `user` from the response, writes the fresh
    `user_type` back to the cache.
  - 401 → clears `user` to `null` and removes the cache key (session
    expired/logged out elsewhere).
- If there's no cache at all (first-ever visit), `isLoading: true` until
  `getMe()` resolves — no cached value to optimistically show.
- Exposes `useAuth()` → `{ user, isLoading, signOut, refetch }`.
  `signOut` calls `signOutApi()`, clears the cache key, sets `user: null`.

### `client/src/components/RoleProtectedRoute.tsx` (rewrite)

Replaces its current `getCurrentRole()` (reads `localStorage.userRole`
directly) with `useAuth()`. Logic otherwise unchanged: no user → `/login`;
wrong role → that role's own home; render children if allowed. Shows a
lightweight loading state (matches `ScreenLoader` in `App.tsx`) while
`isLoading` is true and there's no cached value to show yet.

### `client/src/App.tsx` (edit)

Wrap the existing provider tree in the new `AuthProvider`, outermost (next to
`ThemeProvider`/`BookingProvider`).

### `client/src/pages/Login.tsx` (edit)

- Student form submit: `authMode === 'signup' ? signUpStudent(...) : signInEmail(...)`.
  On success, `refetch()` from `useAuth()` then `navigate('/')`. The avatar
  step's "Continue" no longer needs to call anything backend-related — it's
  purely cosmetic now, just navigates home after the account already exists.
- Manager form submit: `authMode === 'signup' ? registerManager(...) : signInEmail(...)`.
  On success, `refetch()` then `navigate('/manager')`.
- Catch `ApiError` from either path, display `error.message` inline above the
  submit button (new local `useState<string | null>` for the error text).
- Remove the `localStorage.setItem("userAvatar"/"userRole", ...)` calls —
  role now comes from the server session via `AuthContext`, not something
  the client sets.

### Logout call sites (edit)

`DesktopSidebar.tsx`, `ManagerSidebar.tsx`, `Profile.tsx`, `AdminLayout.tsx` —
each currently does `localStorage.removeItem("userAvatar"/"userRole")` then
navigates to `/login`. Replace with `useAuth().signOut()` (which itself
clears the cache + calls the real sign-out endpoint) before navigating.

## Data flow

**Sign up (student):** form submit → `signUpStudent()` → backend's
`databaseHooks.user.create.before` sets `user_type: "STUDENT"` → 200 with
session cookie set → frontend calls `refetch()` → `AuthContext.user` populated
→ `navigate('/')`.

**Sign in:** form submit → `signInEmail()` → session cookie set on success,
`ApiError(401, "Invalid credentials")` on failure → error displayed inline,
no navigation.

**Session check on reload:** `AuthProvider` mounts → shows cached user
immediately (if any) → `getMe()` resolves in background → confirms or
corrects.

**Logout:** `signOut()` → `POST /auth/sign-out` clears the server-side
session/cookie → local cache cleared → `AuthContext.user = null` →
`RoleProtectedRoute` on the next protected route redirects to `/login`.

## Error handling

- Network failure (backend unreachable) → `apiFetch` lets the raw `fetch`
  rejection propagate (not wrapped in `ApiError`, since there's no HTTP
  response to read a status/message from) — callers should catch generically
  and show "Couldn't reach the server, try again" for anything that isn't an
  `ApiError`.
- 4xx from the backend → `ApiError` with the backend's own message, shown
  directly (the backend's zod validation errors and auth errors are already
  human-readable).
- 5xx → `ApiError` with whatever message the backend sent (in dev mode this
  includes detail per `errorHandler.js`; in prod it's a generic "Internal
  Server Error") — shown as-is, no special-casing needed for Stage 1.

## Testing

No automated tests added in this stage (the existing Playwright smoke-testing
approach used throughout this session doesn't apply here since it requires a
live backend + real Supabase network access, which this sandbox doesn't have).
Verification is manual, by the user, after each file/commit lands:

1. `apiClient.ts` + `auth.ts` — no user-visible behavior yet, verified by
   `tsc --noEmit` only.
2. `AuthContext.tsx` + `RoleProtectedRoute.tsx` + `App.tsx` — run both dev
   servers, confirm the app still loads (no session yet → redirects to
   `/login`, matching today's behavior for a logged-out user).
3. `Login.tsx` — sign up a new student, confirm redirect to `/`, confirm
   reload keeps the session, confirm sign-in with a wrong password shows an
   error, confirm manager registration + sign-in works.
4. Logout call sites — confirm signing out actually invalidates the session
   (reloading a protected route redirects to `/login`, not just visually
   logs out client-side).

## Commit plan (file-by-file, per the user's request)

1. `client/src/lib/apiClient.ts`
2. `client/src/lib/auth.ts`
3. `client/src/contexts/AuthContext.tsx`
4. `client/src/components/RoleProtectedRoute.tsx`
5. `client/src/App.tsx`
6. `client/src/pages/Login.tsx`
7. Logout call sites (`DesktopSidebar.tsx`, `ManagerSidebar.tsx`,
   `Profile.tsx`, `AdminLayout.tsx`) — one commit covering all four, since
   it's the same one-line change repeated, not four independent decisions.

Each commit is `tsc --noEmit`-clean before being made. Pushing is separate
from committing per this session's established pattern (credential
constraints in this sandbox) — commits land locally, user pushes or provides
credentials.
