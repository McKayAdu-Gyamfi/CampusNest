export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

/** Why a new password isn't acceptable, or null when it is. (The server enforces the length too.) */
export function passwordProblem(pw: string, confirm?: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (pw.length > MAX_PASSWORD_LENGTH) return `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  if (pw.trim().length === 0) return "A password can't be only spaces.";
  if (confirm !== undefined && pw !== confirm) return "The two passwords don't match.";
  return null;
}

/** 0 (empty) to 4 (strong): a hint for the form, not a rule. */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= MIN_PASSWORD_LENGTH) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, score) as 1 | 2 | 3 | 4;
}
