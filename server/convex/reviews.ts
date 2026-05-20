import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    hostel_id: v.optional(v.id("hostels")),
  },
  handler: async (ctx, args) => {
    const hostel_id = args.hostel_id;
    let reviews;
    if (hostel_id) {
      reviews = await ctx.db.query("reviews")
        .withIndex("by_hostel", (q) => q.eq("hostel_id", hostel_id))
        .collect();
    } else {
      reviews = await ctx.db.query("reviews").collect();
    }
    
    // Fetch user details for each review to mimic Supabase join
    return Promise.all(
      reviews.map(async (review) => {
        let user = null;
        if (review.student_id) {
          user = await ctx.db.get(review.student_id);
        }
        return {
          ...review,
          USERS: user ? { email: user.email } : null
        };
      })
    );
  }
});

export const create = mutation({
  args: {
    rating: v.number(),
    comment: v.optional(v.string()),
    student_id: v.optional(v.id("users")),
    hostel_id: v.id("hostels"),
  },
  handler: async (ctx, args) => {
    const payload = {
      ...args,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const id = await ctx.db.insert("reviews", payload);
    return await ctx.db.get(id);
  }
});
