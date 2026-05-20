import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ==========================================
  // USERS & AUTH
  // ==========================================
  users: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Custom fields
    user_type: v.union(v.literal("STUDENT"), v.literal("HOSTEL_MANAGER"), v.literal("ADMIN")),
    profile_complete: v.optional(v.boolean()),
    student_id: v.optional(v.string()),
    course: v.optional(v.string()),
    current_room_id: v.optional(v.id("rooms")),
    payment_details: v.optional(v.string()),
  }).index("by_email", ["email"]),

  // Optional: Better Auth compatibility tables if needed
  sessions: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userId: v.id("users"),
  }).index("by_token", ["token"]),

  // ==========================================
  // BUSINESS TABLES
  // ==========================================
  hostels: defineTable({
    hostel_name: v.string(),
    location: v.string(),
    description: v.optional(v.string()),
    total_rooms: v.number(),
    available_rooms: v.number(),
    distance_from_campus: v.optional(v.number()),
    manager_id: v.optional(v.id("users")), // User ID of the manager
    created_at: v.number(),
    updated_at: v.number(),
    // One-to-many relationships embedded for performance
    image_urls: v.array(v.string()),
    amenities: v.array(v.union(
      v.literal("WIFI"), 
      v.literal("AIR_CONDITIONING"), 
      v.literal("RUNNING_WATER"), 
      v.literal("KITCHEN_ACCESS"), 
      v.literal("PARKING"), 
      v.literal("GYM"), 
      v.literal("LAUNDRY"), 
      v.literal("STUDY_ROOM")
    )),
  }).index("by_manager", ["manager_id"]),

  bank_accounts: defineTable({
    account_number: v.string(),
    bank_name: v.string(),
    manager_id: v.id("users"),
    hostel_id: v.id("hostels"),
    created_at: v.number(),
    updated_at: v.number(),
  }),

  rooms: defineTable({
    room_number: v.string(),
    room_type: v.union(v.literal("SINGLE"), v.literal("DOUBLE"), v.literal("TRIPLE"), v.literal("QUAD")),
    price_per_bed: v.number(),
    capacity: v.number(),
    current_occupancy: v.number(),
    is_available: v.boolean(),
    hostel_id: v.id("hostels"),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
    image_urls: v.array(v.string()),
    amenities: v.array(v.string()),
    room_tour_scenes: v.array(v.object({
      scene_name: v.string(),
      scene_config_url: v.string()
    }))
  }).index("by_hostel", ["hostel_id"]),

  reviews: defineTable({
    rating: v.number(),
    comment: v.optional(v.string()),
    student_id: v.optional(v.id("users")),
    hostel_id: v.id("hostels"),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_hostel", ["hostel_id"]),

  bookings: defineTable({
    check_in_date: v.number(),
    check_out_date: v.number(),
    status: v.union(v.literal("PENDING"), v.literal("CONFIRMED"), v.literal("CANCELLED"), v.literal("CHECKED_OUT")),
    student_id: v.id("users"),
    room_id: v.id("rooms"),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_student", ["student_id"]).index("by_room", ["room_id"]),

  complaints: defineTable({
    content: v.string(),
    status: v.union(v.literal("OPEN"), v.literal("IN_PROGRESS"), v.literal("RESOLVED")),
    student_id: v.id("users"),
    hostel_manager_id: v.optional(v.id("users")),
    hostel_id: v.id("hostels"),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_hostel", ["hostel_id"]).index("by_student", ["student_id"]),
});
