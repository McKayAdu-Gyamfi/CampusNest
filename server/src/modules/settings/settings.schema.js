import { z } from "zod";

export const updateSettingsSchema = z.object({
  body: z.object({
    platform_name: z.string().trim().min(1).max(80).optional(),
    support_email: z.string().trim().email().optional(),
    maintenance_mode: z.boolean().optional(),
  }),
});
