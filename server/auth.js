import { betterAuth } from "better-auth";
import pg from "pg";

export const auth = betterAuth({

  // ── Tell BetterAuth to use your Supabase DB ──────────────
  database: new pg.Pool({
    connectionString: process.env.DATABASE_URL
  }),

  // ── Email/Password Authentication ─────────────
  emailAndPassword: {
    enabled: true,
    autoSignIn: false
  },

  // ── Expose Custom Fields in Response ────────
  user: {
    additionalFields: {
      user_type: {
        type: "string",
      },
      profile_complete: {
        type: "boolean",
      },
      payment_details: {
        type: "string",
      }
    }
  },

  // ── Assign Default Role On Signup ─────
  // Every generic sign-up (the public /sign-up/email path) starts as an
  // unverified STUDENT regardless of email domain. HOSTEL_MANAGER is never
  // auto-granted here: it is only ever set by the dedicated, explicit
  // /api/auth/register (registerManager) flow, which issues its own
  // follow-up UPDATE after this hook runs. Previously any signup with an
  // email outside ALLOWED_EMAIL_DOMAIN was auto-assigned HOSTEL_MANAGER,
  // letting anyone self-escalate to a privileged role with zero
  // verification — that fallback has been removed.
  databaseHooks: {
    user: {
      create: {
        before: (user) => {
          user.user_type = "STUDENT";
          // The student will need to call /api/users/me/profile-complete to update their details
          user.profile_complete = false;
          return { data: user };
        }
      }
    }
  }
});
