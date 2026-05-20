import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { search: v.optional(v.string()), max_distance: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let hostels = await ctx.db.query("hostels").collect();

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      hostels = hostels.filter(h => 
        h.hostel_name.toLowerCase().includes(searchLower) || 
        h.location.toLowerCase().includes(searchLower)
      );
    }

    if (args.max_distance !== undefined) {
      hostels = hostels.filter(h => 
        h.distance_from_campus !== undefined && h.distance_from_campus <= args.max_distance!
      );
    }

    return hostels;
  },
});

export const getById = query({
  args: { id: v.id("hostels") },
  handler: async (ctx, args) => {
    const hostel = await ctx.db.get(args.id);
    if (!hostel) return null;

    const rooms = await ctx.db.query("rooms")
      .withIndex("by_hostel", q => q.eq("hostel_id", args.id))
      .collect();

    return { ...hostel, rooms };
  },
});

export const create = mutation({
  args: {
    hostel_name: v.string(),
    location: v.string(),
    description: v.optional(v.string()),
    total_rooms: v.number(),
    available_rooms: v.optional(v.number()),
    distance_from_campus: v.optional(v.number()),
    manager_id: v.id("users"),
  },
  handler: async (ctx, args) => {
    const managerHostels = await ctx.db.query("hostels")
      .withIndex("by_manager", q => q.eq("manager_id", args.manager_id))
      .collect();
      
    if (managerHostels.length >= 2) {
      throw new Error("A manager can only create up to 2 hostels.");
    }

    const hostelId = await ctx.db.insert("hostels", {
      ...args,
      available_rooms: args.available_rooms ?? 0,
      image_urls: [],
      amenities: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    return await ctx.db.get(hostelId);
  },
});

export const updateAmenities = mutation({
  args: { id: v.id("hostels"), amenities: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Note: the schema defines amenities as union of literal strings, so we cast to any or define the array properly
    await ctx.db.patch(args.id, { amenities: args.amenities as any, updated_at: Date.now() });
    return await ctx.db.get(args.id);
  }
});

export const addAmenities = mutation({
  args: { id: v.id("hostels"), amenities: v.array(v.string()) },
  handler: async (ctx, args) => {
    const hostel = await ctx.db.get(args.id);
    if (!hostel) throw new Error("Hostel not found");
    
    const newAmenities = Array.from(new Set([...hostel.amenities, ...args.amenities]));
    await ctx.db.patch(args.id, { amenities: newAmenities as any, updated_at: Date.now() });
    return await ctx.db.get(args.id);
  }
});

export const removeAmenity = mutation({
  args: { id: v.id("hostels"), amenity: v.string() },
  handler: async (ctx, args) => {
    const hostel = await ctx.db.get(args.id);
    if (!hostel) throw new Error("Hostel not found");
    
    const newAmenities = hostel.amenities.filter(a => a !== args.amenity);
    await ctx.db.patch(args.id, { amenities: newAmenities as any, updated_at: Date.now() });
    return await ctx.db.get(args.id);
  }
});
