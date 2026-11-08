import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { convexAdapter } from "./auth-convex-adapter.js";
import { cq } from "./src/config/convexClient.js";
import { api } from "./convex/_generated/api.js";
import { passwordResetEmail, sendMail } from "./src/utils/mailer.js";
import { canResetByEmail } from "./src/utils/passwordReset.js";

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
    autoSignIn: false,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60, // the emailed link works for one hour, once
    // A reset signs the account out everywhere: whoever held the old password loses access.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      if (!canResetByEmail(user)) {
        console.warn("[Auth] Password reset requested for an account that can't reset by email; no email sent");
        return;
      }
      // Deliberately not awaited: a fast response for unknown emails and a slow
      // one for real accounts would reveal which emails are registered.
      const { subject, text, html } = passwordResetEmail({ name: user.name, url });
      sendMail({ to: user.email, subject, text, html, devNote: `Reset link: ${url}` })
        .catch((e) => console.error("[Auth] Could not send the password reset email:", e.message));
    },
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
      },
      // Set by an admin (see users.setSuspended). Never writable by the user.
      suspended_at: {
        type: "number",
        required: false,
        input: false,
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
    // A suspended account can't open a new session, so it can't sign in. (Open
    // sessions are deleted at suspension time and requireAuth re-checks every request.)
    session: {
      create: {
        before: async (session) => {
          const s = await cq(api.users.getSuspension, { id: session.userId });
          if (s?.suspended) {
            throw new APIError("FORBIDDEN", {
              message: "This account has been suspended. Please contact support.",
              code: "ACCOUNT_SUSPENDED",
            });
          }
          return { data: session };
        },
      },
    },
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
