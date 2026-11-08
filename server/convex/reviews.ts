// server/convex/reviews.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";
import { notify } from "./lib/notify";
import { audit } from "./lib/audit";

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
      const hostel = await ctx.db.get(review.hostel_id);
      row.HOSTEL = hostel ? { hostel_name: hostel.hostel_name } : null;
      if (review.student_id) {
        const student = await ctx.db.get(review.student_id);
        if (student) row.USERS = { email: student.email, name: student.name };
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

  // A student's second review of the same hostel edits their latest one.
  if (data.replace_existing && studentId) {
    const mine = await ctx.db
      .query("reviews")
      .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", hostelId))
      .order("desc")
      .filter((q: any) => q.eq(q.field("student_id"), studentId))
      .first();
    if (mine) {
      await ctx.db.patch(mine._id, { rating: data.rating, comment: data.comment ?? undefined, updated_at: now });
      return toApiRow((await ctx.db.get(mine._id))!);
    }
  }

  const reviewId = await ctx.db.insert("reviews", {
    rating: data.rating,
    comment: data.comment ?? undefined,
    student_id: studentId ?? undefined,
    hostel_id: hostelId,
    created_at: now,
    updated_at: now,
  });
  const hostel = await ctx.db.get(hostelId);
  if (hostel?.manager_id) {
    await notify(ctx, hostel.manager_id, {
      type: "new_review",
      title: "New review",
      message: `${hostel.hostel_name} received a ${data.rating}-star review.`,
    });
  }
  return toApiRow((await ctx.db.get(reviewId))!);
});

// Removes a review (moderation). The action is logged with the reviewer and rating.
export const remove = secureMutation(
  { id: v.string(), actorId: v.optional(v.string()), reason: v.optional(v.string()) },
  async (ctx, { id, actorId, reason }) => {
    const reviewId = ctx.db.normalizeId("reviews", id);
    if (!reviewId) return false;
    const review = await ctx.db.get(reviewId);
    if (!review) return false;
    const hostel = await ctx.db.get(review.hostel_id);
    const student = review.student_id ? await ctx.db.get(review.student_id) : null;
    await ctx.db.delete(reviewId);
    await audit(ctx, {
      actorId: actorId ? ctx.db.normalizeId("users", actorId) : null,
      action: "review.removed", targetType: "review", targetId: id,
      summary: `Removed a ${review.rating}-star review of ${hostel?.hostel_name ?? "a hostel"} by ${student?.name || student?.email || "a student"}${reason ? `: ${reason.trim()}` : ""}`,
    });
    return true;
  }
);
