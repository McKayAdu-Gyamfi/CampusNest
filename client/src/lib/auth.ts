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
