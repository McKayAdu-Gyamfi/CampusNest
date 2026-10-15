import { betterAuth } from "better-auth";
import { convexAdapter } from "./auth-convex-adapter.js";

export const auth = betterAuth({

  // ── Tell BetterAuth to use Convex instead of Postgres ────
  database: convexAdapter(),

  // ── Origins allowed to complete auth flows / receive session cookies ──
  // better-auth recommends setting this explicitly rather than relying only
  // on the app-level CORS allowlist in app.js.
  trustedOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim()),

  // ── Email/Password Authentication ─────────────
  emailAndPassword: {
    enabled: true,
    autoSignIn: false
  },

  // ── Expose Custom Fields in Response ────────
  user: {
    additionalFields: {
      // input: false blocks these from better-auth's own generic
      // /api/auth/update-user endpoint — without it, any signed-in user
      // could POST {"user_type":"ADMIN"} there and grant themselves admin,
      // or flip profile_complete to bypass requireCompleteProfile. Only
      // databaseHooks (on create) and this app's own server-side logic
      // (registerManager, the profile-completion endpoints) may set these.
      user_type: {
        type: "string",
        input: false,
      },
      profile_complete: {
        type: "boolean",
        input: false,
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
