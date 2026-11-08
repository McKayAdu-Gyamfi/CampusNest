import type { BackendUser } from "./auth";

export interface MissingField { key: string; label: string }

const has = (v: unknown) => (typeof v === "string" ? v.trim().length > 0 : !!v);

/** Mirrors server/src/modules/users/profileCompleteness.js: keep the two in sync. */
export function missingProfileFields(
  user: Partial<BackendUser> | undefined,
  userType: BackendUser["user_type"],
): MissingField[] {
  if (!user) return [];
  const missing: MissingField[] = [];
  const need = (key: keyof BackendUser, label: string) => { if (!has(user[key])) missing.push({ key, label }); };
  if (userType === "STUDENT") {
    need("student_id", "Student ID");
    need("course", "Programme");
    need("institution", "Institution");
    need("level", "Level");
    need("phone", "Phone number");
    need("emergency_contact_name", "Emergency contact name");
    need("emergency_contact_phone", "Emergency contact phone");
  } else if (userType === "HOSTEL_MANAGER") {
    need("phone", "Phone number");
    need("business_name", "Hostel / business name");
    const momo = has(user.momo_number) && has(user.momo_network);
    const bank = has(user.bank_name) && has(user.bank_account_number) && has(user.bank_account_name);
    if (!momo && !bank) missing.push({ key: "payout", label: "Payout account (MoMo or bank)" });
  }
  return missing;
}

export const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;
