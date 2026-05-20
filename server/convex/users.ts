import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  }
});

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) return null;
    
    // Fetch room if populated
    let roomInfo = null;
    if (user.current_room_id) {
      const room = await ctx.db.get(user.current_room_id);
      if (room) {
        const hostel = await ctx.db.get(room.hostel_id);
        roomInfo = {
          room_number: room.room_number,
          HOSTEL: hostel ? { hostel_name: hostel.hostel_name } : null
        };
      }
    }
    
    return {
      ...user,
      ROOM: roomInfo
    };
  }
});

export const getMyHostels = query({
  args: { manager_id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("hostels")
      .withIndex("by_manager", (q) => q.eq("manager_id", args.manager_id))
      .collect();
  }
});

export const updateMe = mutation({
  args: {
    id: v.id("users"),
    updates: v.object({
      user_type: v.optional(v.union(v.literal("STUDENT"), v.literal("HOSTEL_MANAGER"), v.literal("ADMIN"))),
      student_id: v.optional(v.string()),
      course: v.optional(v.string()),
      profile_complete: v.optional(v.boolean()),
      payment_details: v.optional(v.string()),
      name: v.optional(v.string()),
      image: v.optional(v.string())
    }),
    userType: v.string()
  },
  handler: async (ctx, args) => {
    const { updates, userType, id } = args;
    
    if (userType === "HOSTEL_MANAGER") {
      const { user_type, student_id, course, profile_complete, ...safeUpdates } = updates;
      await ctx.db.patch(id, { ...safeUpdates, updatedAt: Date.now() });
      return await ctx.db.get(id);
    }
    
    if (userType === "STUDENT") {
      const current = await ctx.db.get(id);
      if (!current) throw new Error("User not found");
      
      const merged = { ...current, ...updates };
      const profileComplete = !!(merged.student_id && merged.course);
      
      await ctx.db.patch(id, { ...updates, profile_complete: profileComplete, updatedAt: Date.now() });
      return await ctx.db.get(id);
    }
    
    // ADMIN fallback
    const { user_type, ...safeUpdates } = updates;
    await ctx.db.patch(id, { ...safeUpdates, updatedAt: Date.now() });
    return await ctx.db.get(id);
  }
});

export const completeProfile = mutation({
  args: {
    id: v.id("users"),
    student_id: v.string(),
    course: v.string()
  },
  handler: async (ctx, args) => {
    const profileComplete = !!(args.student_id && args.course);
    await ctx.db.patch(args.id, { 
      student_id: args.student_id, 
      course: args.course, 
      profile_complete: profileComplete,
      updatedAt: Date.now() 
    });
    return await ctx.db.get(args.id);
  }
});

export const completeManagerProfile = mutation({
  args: {
    id: v.id("users"),
    payment_details: v.string()
  },
  handler: async (ctx, args) => {
    const profileComplete = !!args.payment_details;
    await ctx.db.patch(args.id, { 
      payment_details: args.payment_details, 
      profile_complete: profileComplete,
      updatedAt: Date.now() 
    });
    return await ctx.db.get(args.id);
  }
});

export const adminUpdateUser = mutation({
  args: {
    id: v.id("users"),
    updates: v.any() // Simplify for admin
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { ...args.updates, updatedAt: Date.now() });
    return await ctx.db.get(args.id);
  }
});

export const updateAuthUserType = mutation({
  args: {
    id: v.id("users"),
    user_type: v.union(v.literal("STUDENT"), v.literal("HOSTEL_MANAGER"), v.literal("ADMIN")),
    profile_complete: v.boolean()
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { 
      user_type: args.user_type, 
      profile_complete: args.profile_complete,
      updatedAt: Date.now() 
    });
    return await ctx.db.get(args.id);
  }
});
