import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    hostel_id: v.optional(v.id("hostels")),
    student_id: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { hostel_id, student_id } = args;
    let complaints;
    
    if (hostel_id) {
      complaints = await ctx.db.query("complaints")
        .withIndex("by_hostel", (q) => q.eq("hostel_id", hostel_id))
        .collect();
    } else if (student_id) {
      complaints = await ctx.db.query("complaints")
        .withIndex("by_student", (q) => q.eq("student_id", student_id))
        .collect();
    } else {
      complaints = await ctx.db.query("complaints").collect();
    }
    
    if (args.hostel_id && args.student_id) {
      complaints = complaints.filter(c => c.student_id === args.student_id);
    }
    
    return Promise.all(
      complaints.map(async (complaint) => {
        const user = await ctx.db.get(complaint.student_id);
        const hostel = await ctx.db.get(complaint.hostel_id);
        
        return {
          ...complaint,
          USERS: user ? { email: user.email, profile_complete: user.profile_complete } : null,
          HOSTEL: hostel ? { hostel_name: hostel.hostel_name } : null
        };
      })
    );
  }
});

export const getById = query({
  args: { id: v.id("complaints") },
  handler: async (ctx, args) => {
    const complaint = await ctx.db.get(args.id);
    if (!complaint) return null;
    
    const user = await ctx.db.get(complaint.student_id);
    return {
      ...complaint,
      USERS: user ? { email: user.email, profile_complete: user.profile_complete } : null
    };
  }
});

export const create = mutation({
  args: {
    content: v.string(),
    student_id: v.id("users"),
    hostel_id: v.id("hostels"),
  },
  handler: async (ctx, args) => {
    const payload = {
      ...args,
      status: "OPEN" as const,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const id = await ctx.db.insert("complaints", payload);
    return await ctx.db.get(id);
  }
});

export const updateStatus = mutation({
  args: {
    id: v.id("complaints"),
    status: v.union(v.literal("OPEN"), v.literal("IN_PROGRESS"), v.literal("RESOLVED"))
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updated_at: Date.now()
    });
    return await ctx.db.get(args.id);
  }
});
