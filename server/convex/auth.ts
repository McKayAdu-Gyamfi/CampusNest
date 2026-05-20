import { betterAuth } from "better-auth";
import { createClient } from "@convex-dev/better-auth";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

// Initialize the Convex integration client for Better Auth
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: any) => {
  return betterAuth({
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
    },
    user: {
      additionalFields: {
        user_type: { type: "string" },
        profile_complete: { type: "boolean" },
        payment_details: { type: "string" },
      }
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || "@ashesi.edu.gh";
            if (user.email && user.email.toLowerCase().endsWith(allowedDomain.toLowerCase())) {
              user.user_type = "STUDENT";
              user.profile_complete = false;
            } else {
              user.user_type = "HOSTEL_MANAGER";
              user.profile_complete = false;
            }
            return { data: user };
          }
        }
      }
    }
  });
};
