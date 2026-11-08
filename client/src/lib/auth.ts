import { apiFetch } from "./apiClient";

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  user_type: "STUDENT" | "HOSTEL_MANAGER" | "ADMIN";
  profile_complete: boolean;
  student_id?: string;
  course?: string;
  emailVerified?: boolean;
  /** ISO timestamp the account was created. */
  createdAt?: string;
  phone?: string;
  institution?: string;
  level?: string;
  gender?: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  business_name?: string;
  ghana_card_number?: string;
  payout_method?: "momo" | "bank";
  momo_network?: string;
  momo_number?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
}

/** Editable profile fields. An empty string clears the value. */
export type ProfilePatch = Partial<Omit<BackendUser, "id" | "email" | "user_type" | "profile_complete" | "emailVerified">> & {
  payment_details?: string;
};

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

/** PATCH /users/me. The server derives profile_complete from the saved fields. */
export const updateMe = (patch: ProfilePatch) =>
  apiFetch("/users/me", { method: "PATCH", body: JSON.stringify(patch) });
