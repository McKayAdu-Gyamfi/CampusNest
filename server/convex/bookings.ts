import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    student_id: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const student_id = args.student_id;
    let bookings;
    if (student_id) {
      bookings = await ctx.db.query("bookings")
        .withIndex("by_student", (q) => q.eq("student_id", student_id))
        .collect();
    } else {
      bookings = await ctx.db.query("bookings").collect();
    }
    
    return Promise.all(
      bookings.map(async (booking) => {
        const room = await ctx.db.get(booking.room_id);
        const user = await ctx.db.get(booking.student_id);
        
        let hostel = null;
        if (room) {
          hostel = await ctx.db.get(room.hostel_id);
        }
        
        return {
          ...booking,
          ROOM: room ? {
            room_number: room.room_number,
            hostel_id: room.hostel_id,
            HOSTEL: hostel ? { hostel_name: hostel.hostel_name } : null
          } : null,
          USERS: user ? { email: user.email, profile_complete: user.profile_complete } : null
        };
      })
    );
  }
});

export const getById = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id);
    if (!booking) return null;
    
    const room = await ctx.db.get(booking.room_id);
    const user = await ctx.db.get(booking.student_id);
    
    let hostel = null;
    if (room) {
      hostel = await ctx.db.get(room.hostel_id);
    }
    
    return {
      ...booking,
      ROOM: room ? {
        id: room._id,
        current_occupancy: room.current_occupancy,
        room_number: room.room_number,
        hostel_id: room.hostel_id,
        HOSTEL: hostel ? { hostel_name: hostel.hostel_name, manager_id: hostel.manager_id } : null
      } : null,
      USERS: user ? { email: user.email, profile_complete: user.profile_complete } : null
    };
  }
});

export const create = mutation({
  args: {
    check_in_date: v.number(), 
    check_out_date: v.number(),
    room_id: v.id("rooms"),
    student_id: v.id("users"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.room_id);
    if (!room || !room.is_available) {
      throw new Error("Room is fully occupied and not available for booking");
    }

    const payload = {
      ...args,
      status: "PENDING" as const,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const id = await ctx.db.insert("bookings", payload);
    return await ctx.db.get(id);
  }
});

export const updateStatus = mutation({
  args: {
    id: v.id("bookings"),
    status: v.union(v.literal("PENDING"), v.literal("CONFIRMED"), v.literal("CANCELLED"), v.literal("CHECKED_OUT"))
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.id);
    if (!booking) throw new Error("Booking not found");
    
    await ctx.db.patch(args.id, {
      status: args.status,
      updated_at: Date.now()
    });
    
    const updatedBooking = await ctx.db.get(args.id);
    
    // Handle Occupancy Changes inline 
    const previousStatus = booking.status;
    const newStatus = args.status;
    const roomId = booking.room_id;
    let occupancyChange = 0;

    if (newStatus === "CONFIRMED" && previousStatus !== "CONFIRMED") {
      occupancyChange = 1;
    } else if (previousStatus === "CONFIRMED" && (newStatus === "CANCELLED" || newStatus === "CHECKED_OUT")) {
      occupancyChange = -1;
    }

    if (occupancyChange !== 0) {
      const room = await ctx.db.get(roomId);
      if (room) {
        const newOccupancy = Math.max(0, room.current_occupancy + occupancyChange);
        await ctx.db.patch(roomId, { current_occupancy: newOccupancy });
        
        // Sync availability inline
        const is_available = newOccupancy < room.capacity;
        await ctx.db.patch(roomId, { is_available });
      }
    }
    
    return updatedBooking;
  }
});
