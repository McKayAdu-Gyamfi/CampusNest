import type { FrontendRole } from "@/contexts/AuthContext";

/**
 * Every URL in the app lives here, so a path is renamed in one place and a
 * typo is a compile error instead of a dead link.
 *
 * Conventions: lowercase kebab-case nouns, one namespace per role
 * (`/manager/...`, `/admin/...`; the student area lives at the root),
 * resource ids in the path (`/bookings/:id`), sub-resources nested under
 * their parent, and each role has its own sign-in page.
 */
export const ROUTES = {
  student: {
    home: "/",
    explore: "/explore",
    saved: "/saved",
    profile: "/profile",
    settings: "/settings",
    notifications: "/notifications",
    bookings: "/bookings",
    booking: (id: string) => `/bookings/${id}`,
    hostel: (id: string) => `/hostels/${id}`,
    tour: "/tour",
    checkout: "/checkout",
    payment: "/checkout/payment",
    confirmation: "/checkout/confirmation",
    login: "/login",
    signup: "/signup",
  },
  manager: {
    login: "/manager/login",
    signup: "/manager/signup",
    dashboard: "/manager/dashboard",
    properties: "/manager/properties",
    property: (id: string) => `/manager/properties/${id}`,
    bookings: "/manager/bookings",
    cancelBooking: (id: string) => `/manager/bookings/${id}/cancel`,
    clients: "/manager/clients",
    messages: "/manager/messages",
    payouts: "/manager/payouts",
    profile: "/manager/profile",
  },
  admin: {
    login: "/admin/login",
    dashboard: "/admin/dashboard",
    users: "/admin/users",
    hostels: "/admin/hostels",
    schools: "/admin/schools",
    roomTours: "/admin/room-tours",
    settings: "/admin/settings",
  },
} as const;

export const ROLE_HOME: Record<FrontendRole, string> = {
  student: ROUTES.student.home,
  manager: ROUTES.manager.dashboard,
  admin: ROUTES.admin.dashboard,
};

export const ROLE_LOGIN: Record<FrontendRole, string> = {
  student: ROUTES.student.login,
  manager: ROUTES.manager.login,
  admin: ROUTES.admin.login,
};

/** Sign-in or sign-up page for a self-service role. Admins are created by other admins. */
export const authPath = (role: "student" | "manager", mode: "signin" | "signup") =>
  role === "manager"
    ? mode === "signup" ? ROUTES.manager.signup : ROUTES.manager.login
    : mode === "signup" ? ROUTES.student.signup : ROUTES.student.login;

/** Which area of the app a path belongs to. */
export function roleOfPath(path: string): FrontendRole {
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (path === "/manager" || path.startsWith("/manager/")) return "manager";
  return "student";
}

const AUTH_PATHS = new Set<string>([
  ROUTES.student.login, ROUTES.student.signup, ROUTES.manager.login, ROUTES.manager.signup, ROUTES.admin.login,
]);

/**
 * Where to send someone after signing in: the page they were trying to reach
 * when it belongs to their own area, otherwise their home. Never an
 * auth page, never another role's area, never an external URL.
 */
export function landingFor(role: FrontendRole, from?: unknown): string {
  if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) {
    const pathOnly = from.split(/[?#]/)[0];
    if (!AUTH_PATHS.has(pathOnly) && roleOfPath(pathOnly) === role) return from;
  }
  return ROLE_HOME[role];
}

/** Old URLs that still work: they redirect to the canonical one. (`/manager` and `/admin` redirect via their index routes.) */
export const LEGACY_REDIRECTS: { from: string; to: string }[] = [
  { from: "/manage-bookings", to: ROUTES.student.bookings },
  { from: "/manage-bookings/:id", to: "/bookings/:id" },
  { from: "/live-preview", to: ROUTES.student.tour },
  { from: "/booking", to: ROUTES.student.checkout },
  { from: "/payment", to: ROUTES.student.payment },
  { from: "/booking-confirmed", to: ROUTES.student.confirmation },
  { from: "/edit-profile", to: ROUTES.student.settings },
  { from: "/manager/cancel-refund/:id", to: "/manager/bookings/:id/cancel" },
];
