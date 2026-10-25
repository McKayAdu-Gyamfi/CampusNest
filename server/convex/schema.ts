// server/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const amenityName = v.union(
  v.literal("WIFI"), v.literal("AIR_CONDITIONING"), v.literal("RUNNING_WATER"),
  v.literal("KITCHEN_ACCESS"), v.literal("PARKING"), v.literal("GYM"),
  v.literal("LAUNDRY"), v.literal("STUDY_ROOM"),
  v.literal("RESERVED_1"), v.literal("RESERVED_2"), v.literal("RESERVED_3")
);

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    user_type: v.union(v.literal("STUDENT"), v.literal("HOSTEL_MANAGER"), v.literal("ADMIN")),
    profile_complete: v.boolean(),
    student_id: v.optional(v.string()),
    course: v.optional(v.string()),
    current_room_id: v.optional(v.id("rooms")),
    payment_details: v.optional(v.string()),
    // better-auth always writes these on every model; stored as epoch ms
    // (Convex has no native Date type) via the adapter's date transform.
    // Optional in the schema (not required) so Tasks 3-6's own unit tests,
    // which construct records directly without going through better-auth,
    // don't need updating to supply them.
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_email", ["email"])
    .index("by_current_room_id", ["current_room_id"]),

  sessions: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userId: v.id("users"),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  accounts: defineTable({
    accountId: v.string(),
    providerId: v.string(),
    userId: v.id("users"),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_providerId_accountId", ["providerId", "accountId"]),

  verifications: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_identifier", ["identifier"]),

  hostels: defineTable({
    hostel_name: v.string(),
    location: v.string(),
    description: v.optional(v.string()),
    total_rooms: v.number(),
    available_rooms: v.number(),
    distance_from_campus: v.optional(v.number()),
    manager_id: v.optional(v.id("users")),
    status: v.union(v.literal("PENDING"), v.literal("APPROVED"), v.literal("REJECTED")),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_manager_id", ["manager_id"])
    .index("by_status", ["status"]),

  hostelImages: defineTable({
    hostel_id: v.id("hostels"),
    image_url: v.string(),
  }).index("by_hostel_id", ["hostel_id"]),

  hostelAmenities: defineTable({
    hostel_id: v.id("hostels"),
    name: amenityName,
  }).index("by_hostel_id", ["hostel_id"])
    .index("by_hostel_id_name", ["hostel_id", "name"]),

  bankAccounts: defineTable({
    account_number: v.string(),
    bank_name: v.string(),
    manager_id: v.optional(v.id("users")),
    hostel_id: v.optional(v.id("hostels")),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_manager_id", ["manager_id"])
    .index("by_hostel_id", ["hostel_id"]),

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
  }).index("by_hostel_id", ["hostel_id"]),

  roomImages: defineTable({
    room_id: v.id("rooms"),
    image_url: v.string(),
  }).index("by_room_id", ["room_id"]),

  roomTourScenes: defineTable({
    room_id: v.id("rooms"),
    scene_name: v.string(),
    scene_config_url: v.string(),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_room_id", ["room_id"]),

  roomAmenities: defineTable({
    room_id: v.id("rooms"),
    name: amenityName,
  }).index("by_room_id", ["room_id"])
    .index("by_room_id_name", ["room_id", "name"]),

  reviews: defineTable({
    rating: v.number(),
    comment: v.optional(v.string()),
    student_id: v.optional(v.id("users")),
    hostel_id: v.id("hostels"),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_hostel_id", ["hostel_id"])
    .index("by_student_id", ["student_id"]),

  bookings: defineTable({
    check_in_date: v.number(),
    check_out_date: v.number(),
    status: v.union(v.literal("PENDING"), v.literal("CONFIRMED"), v.literal("CANCELLED"), v.literal("CHECKED_OUT")),
    student_id: v.id("users"),
    room_id: v.id("rooms"),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_student_id", ["student_id"])
    .index("by_room_id", ["room_id"]),

  // Maps a tour's relative file path (as Pannellum's multiRes template
  // addresses it) to the opaque Convex storage id holding that file.
  // Convex storage has no paths, so this table plus the /tour/ HTTP route
  // in convex/http.ts is what lets a tiled panorama be served at all.
  tourFiles: defineTable({
    tour_id: v.string(),
    path: v.string(),
    storage_id: v.string(),
  })
    .index("by_tour_id", ["tour_id"])
    .index("by_tour_id_path", ["tour_id", "path"]),

  complaints: defineTable({
    content: v.string(),
    status: v.union(v.literal("OPEN"), v.literal("IN_PROGRESS"), v.literal("RESOLVED")),
    student_id: v.id("users"),
    hostel_manager_id: v.optional(v.id("users")),
    hostel_id: v.id("hostels"),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_student_id", ["student_id"])
    .index("by_hostel_id", ["hostel_id"])
    .index("by_hostel_manager_id", ["hostel_manager_id"]),
});
