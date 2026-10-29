import { z } from "zod";

const domain = z
  .string()
  .trim()
  .min(3)
  .regex(/^@?[a-z0-9.-]+\.[a-z]{2,}$/i, "Must be an email domain like ashesi.edu.gh");

export const createSchoolSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    location: z.string().trim().min(1).max(160),
    email_domain: domain,
  }),
});

export const updateSchoolSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    location: z.string().trim().min(1).max(160).optional(),
    email_domain: domain.optional(),
  }),
});

export const assignHostelSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({ hostel_id: z.string().min(1) }),
});
