// server/convex/reviews.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

export const listByHostel = secureQuery({ hostelId: v.optional(v.string()) }, async (ctx, { hostelId }) => {
  let rows;
  if (hostelId !== undefined) {
    const id = ctx.db.normalizeId("hostels", hostelId);
    if (!id) return [];
    rows = await ctx.db
      .query("reviews")
      .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
      .collect();
  } else {
    rows = await ctx.db.query("reviews").collect();
  }

  return await Promise.all(
    rows.map(async (review: any) => {
      const row = toApiRow(review);
      row.USERS = null;
      if (review.student_id) {
        const student = await ctx.db.get(review.student_id);
        if (student) row.USERS = { email: student.email };
      }
      return row;
    })
  );
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  // Postgres had CHECK(rating >= 1 AND rating <= 5); Convex has no CHECK
  // constraint, so the bound is enforced here.
  if (typeof data.rating !== "number" || data.rating < 1 || data.rating > 5) {
    throw new Error("rating must be between 1 and 5");
  }

  const hostelId = ctx.db.normalizeId("hostels", data.hostel_id);
  if (!hostelId) throw new Error("Hostel not found");
  const studentId = data.student_id ? ctx.db.normalizeId("users", data.student_id) : null;
  if (data.student_id && !studentId) throw new Error("Student not found");

  const now = Date.now();
  const reviewId = await ctx.db.insert("reviews", {
    rating: data.rating,
    comment: data.comment ?? undefined,
    student_id: studentId ?? undefined,
    hostel_id: hostelId,
    created_at: now,
    updated_at: now,
  });
  return toApiRow((await ctx.db.get(reviewId))!);
});
