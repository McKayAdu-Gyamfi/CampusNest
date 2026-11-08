/** Self-service reset by email is for students and managers with an active account. */
export function canResetByEmail(user) {
  if (!user) return false;
  if (user.user_type === "ADMIN") return false; // admins change or reset passwords through another admin
  if (user.suspended_at) return false; // a suspended account can't regain access by email
  return true;
}
