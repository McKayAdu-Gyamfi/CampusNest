// What each role must provide before the account counts as complete.
// Mirrored on the client in client/src/lib/profile.ts (keep in sync).
const has = (v) => typeof v === "string" ? v.trim().length > 0 : !!v;

export const missingProfileFields = (user, userType) => {
  const missing = [];
  const need = (key, label) => { if (!has(user[key])) missing.push({ key, label }); };
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
};

export const isProfileComplete = (user, userType) => missingProfileFields(user, userType).length === 0;
