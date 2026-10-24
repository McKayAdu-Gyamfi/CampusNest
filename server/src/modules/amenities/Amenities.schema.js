import { z } from "zod";

// Must exactly match the amenityName union in server/convex/schema.ts
// (originally the Postgres `amenity_name` enum, kept in
// src/utils/supabase_schema.sql for historical reference) —
// anything else passes zod here but fails with a raw DB error at insert time.
export const ValidAmenities = [
  "WIFI",
  "AIR_CONDITIONING",
  "RUNNING_WATER",
  "KITCHEN_ACCESS",
  "PARKING",
  "GYM",
  "LAUNDRY",
  "STUDY_ROOM",
  "RESERVED_1",
  "RESERVED_2",
  "RESERVED_3",
];

export const updateAmenitiesSchema = z.object({
  body: z.object({
    amenities: z.array(z.enum(ValidAmenities)).min(0)
  })
});

export const addAmenitySchema = z.object({
  body: z.object({
    amenities: z.array(z.enum(ValidAmenities)).min(1)
  })
});
