import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    hostel_id: v.optional(v.id("hostels")),
    min_price: v.optional(v.number()),
    max_price: v.optional(v.number()),
    room_type: v.optional(v.union(v.literal("SINGLE"), v.literal("DOUBLE"), v.literal("TRIPLE"), v.literal("QUAD"))),
    is_available: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const hostel_id = args.hostel_id;
    let rooms;
    
    if (hostel_id) {
      rooms = await ctx.db.query("rooms")
        .withIndex("by_hostel", (q) => q.eq("hostel_id", hostel_id))
        .collect();
    } else {
      rooms = await ctx.db.query("rooms").collect();
    }
    
    if (args.min_price !== undefined) {
      rooms = rooms.filter(r => r.price_per_bed >= args.min_price!);
    }
    if (args.max_price !== undefined) {
      rooms = rooms.filter(r => r.price_per_bed <= args.max_price!);
    }
    if (args.room_type) {
      rooms = rooms.filter(r => r.room_type === args.room_type);
    }
    if (args.is_available !== undefined) {
      rooms = rooms.filter(r => r.is_available === args.is_available);
    }
    
    return Promise.all(
      rooms.map(async (room) => {
        const hostel = await ctx.db.get(room.hostel_id);
        return {
          ...room,
          HOSTEL: hostel ? { hostel_name: hostel.hostel_name } : null
        };
      })
    );
  }
});

export const getById = query({
  args: { id: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id);
    if (!room) return null;
    
    const hostel = await ctx.db.get(room.hostel_id);
    
    return {
      ...room,
      HOSTEL: hostel ? { hostel_name: hostel.hostel_name, location: hostel.location } : null,
      ROOM_IMAGE_URLS: room.image_urls.map(url => ({ image_url: url })),
      ROOM_TOUR_SCENES: room.room_tour_scenes,
      ROOM_AMENITY: room.amenities.map(name => ({ name }))
    };
  }
});

export const create = mutation({
  args: {
    room_number: v.string(),
    room_type: v.union(v.literal("SINGLE"), v.literal("DOUBLE"), v.literal("TRIPLE"), v.literal("QUAD")),
    price_per_bed: v.number(),
    capacity: v.number(),
    hostel_id: v.id("hostels"),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const payload = {
      ...args,
      current_occupancy: 0,
      is_available: true,
      image_urls: [],
      amenities: [],
      room_tour_scenes: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const id = await ctx.db.insert("rooms", payload);
    return await ctx.db.get(id);
  }
});

export const update = mutation({
  args: {
    id: v.id("rooms"),
    updates: v.object({
      room_number: v.optional(v.string()),
      room_type: v.optional(v.union(v.literal("SINGLE"), v.literal("DOUBLE"), v.literal("TRIPLE"), v.literal("QUAD"))),
      price_per_bed: v.optional(v.number()),
      capacity: v.optional(v.number()),
      current_occupancy: v.optional(v.number()),
    })
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      ...args.updates,
      updated_at: Date.now()
    });
    
    // Sync availability logic
    const room = await ctx.db.get(args.id);
    if (room) {
      const is_available = room.current_occupancy < room.capacity;
      if (room.is_available !== is_available) {
        await ctx.db.patch(args.id, { is_available });
      }
    }
    
    return await ctx.db.get(args.id);
  }
});

export const syncAvailability = mutation({
  args: { id: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id);
    if (!room) return;
    
    const is_available = room.current_occupancy < room.capacity;
    await ctx.db.patch(args.id, { is_available });
  }
});

// Amenities
export const updateAmenities = mutation({
  args: { id: v.id("rooms"), amenities: v.array(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { amenities: args.amenities, updated_at: Date.now() });
    return await ctx.db.get(args.id);
  }
});

// Add single or multiple
export const addAmenities = mutation({
  args: { id: v.id("rooms"), amenities: v.array(v.string()) },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id);
    if (!room) throw new Error("Room not found");
    
    const newAmenities = Array.from(new Set([...room.amenities, ...args.amenities]));
    await ctx.db.patch(args.id, { amenities: newAmenities, updated_at: Date.now() });
    return await ctx.db.get(args.id);
  }
});

export const removeAmenity = mutation({
  args: { id: v.id("rooms"), amenity: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id);
    if (!room) throw new Error("Room not found");
    
    const newAmenities = room.amenities.filter(a => a !== args.amenity);
    await ctx.db.patch(args.id, { amenities: newAmenities, updated_at: Date.now() });
    return await ctx.db.get(args.id);
  }
});

export const addImages = mutation({
  args: { id: v.id("rooms"), storageIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id);
    if (!room) throw new Error("Room not found");
    
    const newUrls = [...room.image_urls, ...args.storageIds];
    await ctx.db.patch(args.id, { image_urls: newUrls, updated_at: Date.now() });
    return await ctx.db.get(args.id);
  }
});

export const createTourScene = mutation({
  args: { 
    id: v.id("rooms"), 
    scene_name: v.string(), 
    scene_config_url: v.string() 
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id);
    if (!room) throw new Error("Room not found");
    
    const newScenes = [...room.room_tour_scenes, { 
      scene_name: args.scene_name, 
      scene_config_url: args.scene_config_url 
    }];
    
    await ctx.db.patch(args.id, { room_tour_scenes: newScenes, updated_at: Date.now() });
    return await ctx.db.get(args.id);
  }
});

// Since scenes are embedded, removing by name/index
export const deleteTourScene = mutation({
  args: { id: v.id("rooms"), scene_name: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id);
    if (!room) throw new Error("Room not found");
    
    const newScenes = room.room_tour_scenes.filter(s => s.scene_name !== args.scene_name);
    await ctx.db.patch(args.id, { room_tour_scenes: newScenes, updated_at: Date.now() });
    return await ctx.db.get(args.id);
  }
});
