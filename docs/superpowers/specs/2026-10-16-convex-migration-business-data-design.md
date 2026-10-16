# Backend Migration: Supabase → Convex — Sub-projects 2-4: Business Data, Storage, and Supabase Removal

## Context

Sub-project 1 (`docs/superpowers/specs/2026-10-15-convex-migration-foundation-design.md`, branch `convex-migration`) moved better-auth's four tables (`users`, `sessions`, `accounts`, `verifications`) to Convex behind a custom better-auth adapter. Sign-up, sign-in, session checks, and sign-out work end-to-end against Convex. Everything else in `server/` still talks to Supabase Postgres.

That leaves the branch in a half-migrated state its own "Known Limitations" section documents: better-auth's users live in Convex, but every business module still reads the Supabase `user` table, so `GET /api/users/me`, profile completion, bookings, manager registration, complaints, reviews, and hostel manager joins are all broken for any account created after the migration.

This spec closes that gap by finishing the migration: all 11 business tables move to Convex, image uploads move to Convex storage, and `@supabase/supabase-js` is removed from `server/` entirely.

**Measured surface being replaced:** ~71 Supabase call sites across 12 files, using 11 PostgREST operators (`eq` ×61, `select` ×58, `single` ×38, `update` ×18, `insert` ×13, `delete` ×10, `limit` ×3, `in` ×3, `or`/`ilike` ×2, `lte` ×2, `gte` ×1), one `{count: "exact", head: true}`, and two Postgres error codes (`PGRST116` for no-rows, `23505` for unique violation). No `order`, `upsert`, `rpc`, `range`, or `maybeSingle` anywhere.

**Deadline:** a demo on Sunday 2026-10-18. The approach below was chosen with that in mind and the sequencing section names the cut line if time runs short.

**How exposed the response shapes actually are (checked, 2026-10-16):** only `client/src/contexts/AuthContext.tsx`, `client/src/pages/Login.tsx`, and `client/src/lib/apiClient.ts` call the backend. Every other page — Explore, Home, Booking, the manager pages, AdminHostels — still renders local mock arrays whose fields (`h.rating: 'Pending review'`, `h.school`, `h.beds`) never existed in the API. So no live page breaks if a business-endpoint shape shifts. The shape contract below is therefore about not forcing the frontend work still to come to learn a second shape, and about keeping manual/Postman testing valid — not about protecting a working screen. Confirmed decision: keep the PostgREST shapes exactly, rather than taking the opportunity to rename keys.

## Goals

- All 11 business tables defined in `server/convex/schema.ts` with indexes on every foreign key and every currently-filtered field.
- Purpose-built Convex query/mutation functions per module, returning response shapes byte-identical to what PostgREST returned, so `client/` needs zero changes.
- All 12 Supabase-touching server files rewritten to call Convex.
- Hostel and room image uploads stored in Convex storage, still returning a public URL string.
- `@supabase/supabase-js` uninstalled; no `SUPABASE_*` env var read anywhere in `server/`.
- A seed script that populates a fresh Convex deployment with demo-ready data.
- Real `convex-test` coverage per module, since the existing Express tests cannot detect regressions (they assert `expect([200, 404, 500]).toContain(res.statusCode)`).

## Non-goals

- `temp-pano-api` (the Python 360° tour service) keeps using Supabase Storage. It is a separate service with its own client; `server/` going supabase-free does not require touching it. `ROOM_TOUR_SCENES.scene_config_url` therefore keeps pointing at Supabase Storage URLs, deliberately.
- No data migration from Supabase. Fresh start, seeded (confirmed: nothing in the current Supabase database needs carrying over).
- No frontend changes. If a response shape has to change, that is a bug in this work, not a frontend task.
- `src/utils/supabase_schema.sql` stays in the repo as the historical reference `temp-pano-api` and this spec both cite. It is documentation, not live code.
- No `DELETE /api/hostels/:id` endpoint exists today, so hostel-level cascade deletion is not implemented. Only the cascades reachable from existing endpoints are built (see Cascade Deletes).
- `BANK_ACCOUNT` has no server call sites today. The table is defined for schema parity; no functions are written for it until something needs them.

## Architecture

### Approach

Full idiomatic rewrite: purpose-built Convex functions per module, assembling each endpoint's nested shape explicitly, with all 71 call sites rewritten. The alternative considered and rejected was a narrow Supabase-shaped shim over Convex (keeping call sites untouched); it would have been faster but enshrines a fake-PostgREST abstraction and does its filtering in JS. The shim remains the documented fallback if the schedule slips (see Sequencing).

### Naming: Convex tables vs response keys

Convex tables use Convex convention (lowercase plural). Response keys keep the PostgREST names the frontend already reads. These differ, deliberately:

| Postgres table | Convex table | Nested response key |
|---|---|---|
| `HOSTEL` | `hostels` | `HOSTEL` |
| `HOSTEL_IMAGE_URLS` | `hostelImages` | `HOSTEL_IMAGE_URLS` |
| `HOSTEL_AMENITY` | `hostelAmenities` | `HOSTEL_AMENITY` |
| `BANK_ACCOUNT` | `bankAccounts` | (none) |
| `ROOM` | `rooms` | `ROOM` |
| `ROOM_IMAGE_URLS` | `roomImages` | `ROOM_IMAGE_URLS` |
| `ROOM_TOUR_SCENES` | `roomTourScenes` | `ROOM_TOUR_SCENES` |
| `ROOM_AMENITY` | `roomAmenities` | `ROOM_AMENITY` |
| `REVIEW` | `reviews` | (none) |
| `BOOKING` | `bookings` | (none) |
| `COMPLAINT` | `complaints` | (none) |
| `user` | `users` | `USERS` / `manager` / `ROOM` (aliased joins) |

Business field names stay snake_case exactly as Postgres had them (`hostel_name`, `price_per_bed`, `current_occupancy`), because the frontend reads them. better-auth's own fields on `users` stay camelCase (`emailVerified`, `createdAt`) as Sub-project 1 left them.

### Schema

Added to `server/convex/schema.ts`. The existing `rooms: defineTable({})` stub (forward-declared in Sub-project 1 for `users.current_room_id`) gets its real fields here.

```typescript
const amenityName = v.union(
  v.literal("WIFI"), v.literal("AIR_CONDITIONING"), v.literal("RUNNING_WATER"),
  v.literal("KITCHEN_ACCESS"), v.literal("PARKING"), v.literal("GYM"),
  v.literal("LAUNDRY"), v.literal("STUDY_ROOM"),
  v.literal("RESERVED_1"), v.literal("RESERVED_2"), v.literal("RESERVED_3")
);

hostels: defineTable({
  hostel_name: v.string(),
  location: v.string(),
  description: v.optional(v.string()),
  total_rooms: v.number(),
  available_rooms: v.number(),
  distance_from_campus: v.optional(v.number()),
  manager_id: v.optional(v.id("users")),          // ON DELETE SET NULL → optional
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
  rating: v.number(),                              // 1-5, enforced in the mutation
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
```

Deliberate tightening versus the SQL schema: `rooms.hostel_id`, `complaints.hostel_id`, `bookings.room_id`, and `bookings.student_id` are required rather than nullable. Postgres allowed null; every code path already supplies them, and the cascade rules below mean an orphaned row is deleted rather than nulled. `hostels.manager_id`, `reviews.student_id`, and `complaints.hostel_manager_id` stay optional, matching their `ON DELETE SET NULL` behavior.

Postgres `CHECK(rating >= 1 AND rating <= 5)` has no Convex equivalent — `reviews.create` validates it and throws.

### Serialization rules

A shared `server/convex/lib/toApiRow.ts` (sibling to the existing `toApiDoc.ts`, which stays for the auth tables) applies three transforms on every business row leaving Convex:

1. `_id` → `id`; `_creationTime` dropped (same as `toApiDoc`).
2. Any field named `created_at`, `updated_at`, `check_in_date`, or `check_out_date` is stored as epoch-ms `v.number()` and **returned as an ISO 8601 string**, because that is what PostgREST sent and what the frontend parses. This is the single most easily-lost detail in this migration.
3. `DECIMAL` columns are plain JS numbers (float64). `price_per_bed` is money in a float — acceptable at this app's scale, and unchanged in behavior from what `supabase-js` already returned.

Convex ids are opaque strings, not UUIDs. The frontend makes no UUID-format assumptions (verified: no `uuid` references in `client/src/`), and only ever echoes back ids it received.

### Function layer

One Convex file per module, every function wrapped in the existing `secureQuery`/`secureMutation` shared-secret wrappers from `server/convex/lib/secureFunction.ts`. No new security model; the same `CONVEX_ADAPTER_SECRET` gate that protects the auth functions protects these.

**`convex/hostels.ts`**
- `listApproved({ search?, maxDistance? })` — `by_status` index on `APPROVED`, then case-insensitive substring filter on `hostel_name`/`location` and `distance_from_campus <= maxDistance`. Each row gets `manager: { id, email }` resolved from `users`.
- `getByIdWithRelations({ id })` — hostel + `ROOM: [...]` + `HOSTEL_IMAGE_URLS: [...]` + `HOSTEL_AMENITY: [...]`; returns `null` when absent.
- `countByManager({ managerId })` — replaces `{count: "exact", head: true}`.
- `listByManager({ managerId })`, `getManagerId({ id })` (lightweight ownership check), `create({ data })`, `update({ id, patch })`, `addImages({ hostelId, urls })`.

**`convex/rooms.ts`**
- `list({ hostelId?, minPrice?, maxPrice?, roomType?, isAvailable? })` — each row gets `HOSTEL: { hostel_name }`. Preserves `HOSTEL!inner` semantics: a room whose hostel is missing is **excluded**, not returned with a null join.
- `getByIdWithRelations({ id })` — room + `ROOM_IMAGE_URLS` + `ROOM_TOUR_SCENES` + `ROOM_AMENITY` + `HOSTEL: { hostel_name, location }`.
- `create({ data })` — inserts the room **and** increments `hostels.total_rooms`/`available_rooms` in the same mutation.
- `update({ id, patch })` — patches, then recomputes `is_available = current_occupancy < capacity` and adjusts the hostel's `available_rooms` if it flipped, in one mutation.
- `remove({ id })` — cascade (below) plus count adjustment, in one mutation.
- `getBasics({ id })` — returns only `{ hostel_id, is_available, capacity, current_occupancy }` (or `null`), for the callers that need a cheap ownership or availability check rather than the full relation payload: `verifyRoomOwnership` and `createBooking`.
- `listIdsByHostel({ hostelId })`, `addImages({ roomId, urls })`, `addTourScene({ roomId, scene_name, scene_config_url })`, `removeTourScene({ id })`.

**`convex/bookings.ts`**
- `list({ studentId? })` and `getByIdWithRelations({ id })` — nested `ROOM` (with `HOSTEL`) and `USERS` per the shape contract.
- `create({ data })`.
- `updateStatus({ id, status })` — performs the whole status transition atomically: writes the booking, applies the occupancy delta, recomputes room availability and the hostel's `available_rooms`, and sets or clears `users.current_room_id`. Rejects confirming into a full room with a named error the controller maps to 409.
- `existsForStudentInRooms({ studentId, roomIds, statuses? })` — backs both the "you can only complain about a hostel you've booked" and "you can only review a hostel you've stayed at" checks.

**`convex/reviews.ts`** — `listByHostel({ hostelId? })` with `USERS: { email }`; `create({ data })` with the 1-5 rating check.

**`convex/complaints.ts`** — `list({ studentId?, hostelId?, hostelManagerId? })` with `USERS: { email, profile_complete }` and `HOSTEL: { hostel_name }`; `getByIdWithUser({ id })`; `create({ data })`; `updateStatus({ id, status })`.

**`convex/amenities.ts`** — `replaceForHostel`, `addForHostel`, `removeHostelAmenity`, `replaceForRoom`, `addForRoom`, `removeRoomAmenity`. Each insert path checks the composite index and throws `"One or more of these amenities is already added"` on a duplicate, replacing Postgres code `23505`.

**`convex/users.ts`** (extends the existing file) — `getMeWithRoom({ id })` returning the user plus `ROOM: { room_number, HOSTEL: { hostel_name } }` resolved from `current_room_id`; `updateProfile({ id, patch })`; `listAll()`; `getProfileComplete({ id })` for the middleware; `setCurrentRoom({ userId, roomId })`.

**`convex/files.ts`** — `storeImage` action taking `v.bytes()` plus `contentType`, calling `ctx.storage.store()` and returning `ctx.storage.getUrl()`. Storage needs an **action**, not a query or mutation, so `secureFunction.ts` gains a third wrapper, `secureAction`, applying the identical secret check (the existing `secureQuery`/`secureMutation` wrap Convex's `query`/`mutation` builders specifically and cannot wrap an action). Size: `upload.middleware.js` caps files at 10MB and Convex caps function arguments at 16MB, so the existing multer limit already fits with headroom and does not change.

**Correctness improvement worth noting:** today's room-count adjustment, availability sync, and booking-status occupancy transition are multi-step read-then-write sequences across separate HTTP calls (the current code even admits this in a comment: "not atomic under heavy concurrency"). Folding each into one Convex mutation makes them transactional. This migration is not pure parity; these paths get strictly safer.

### Express rewrite

A new `server/src/config/convexClient.js` exports two helpers that inject `CONVEX_ADAPTER_SECRET` so no controller repeats it:

```javascript
export const cq = (fn, args) => convex.query(fn, { ...args, secret: ADAPTER_SECRET });
export const cm = (fn, args) => convex.mutation(fn, { ...args, secret: ADAPTER_SECRET });
```

Files rewritten, with what changes in each:

| File | Change |
|---|---|
| `src/modules/hostels/hostels.controller.js` | 7 call sites → `cq`/`cm` on `api.hostels.*`; `PGRST116` branches become `if (!data) return 404` |
| `src/modules/rooms/rooms.controller.js` | 15 call sites; `adjustHostelRoomCounts`/`syncRoomAvailability` collapse into the Convex mutations that now own them |
| `src/modules/bookings/bookings.controller.js` | 9 call sites; the occupancy block collapses into `api.bookings.updateStatus` |
| `src/modules/complaints/complaints.controller.js` | 8 call sites; the rooms-then-bookings lookup becomes `existsForStudentInRooms` |
| `src/modules/reviews/reviews.controller.js` | 4 call sites; same for the stayed-at check |
| `src/modules/users/users.service.js` | 12 call sites; `UserServiceError` semantics preserved |
| `src/modules/auth/auth.controller.js` | 1 call site (`registerManager`'s stale `user` write — the known-broken one) |
| `src/modules/amenities/Amenities.service.js` | 8 call sites; `23505` mapping becomes a thrown-message match → 409 |
| `src/middlewares/auth.middleware.js` | `requireCompleteProfile` → `api.users.getProfileComplete` |
| `src/middlewares/verifyOwnership.js` | 3 call sites → `api.hostels.getManagerId` and `api.rooms.getBasics` |
| `src/utils/supabaseStorage.js` | deleted, replaced by `src/utils/convexStorage.js` wrapping `api.files.storeImage` |
| `src/middlewares/upload.middleware.js` | no logic change; its comment naming Supabase as the upload target is corrected |
| `src/server.js` | Supabase health check removed; the Convex check added on 2026-10-15 stays |

Error-handling change, applied consistently: controllers stop branching on PostgREST error codes. `PGRST116` (no rows from `.single()`) becomes an explicit `null` check, since the Convex functions return `null` rather than an error for a miss. `23505` becomes a match on the uniqueness error the mutation throws.

### Cascade deletes

Postgres `ON DELETE CASCADE` has no Convex equivalent, so the reachable cascades are explicit:

- `rooms.remove({ id })` → deletes the room's `roomImages`, `roomTourScenes`, `roomAmenities`, and `bookings`; clears `users.current_room_id` for any user pointing at it; decrements the hostel's `total_rooms` and (if the room was available) `available_rooms`.
  Confirmed decision: this reproduces `ON DELETE CASCADE` exactly, including that deleting a room destroys its `PENDING`/`CONFIRMED` bookings without warning. Refusing deletion when active bookings exist was considered and explicitly declined, to keep behavior identical to today.
- `amenities.removeHostelAmenity` / `removeRoomAmenity` → single-row deletes, no dependents.

No hostel delete cascade is implemented because no endpoint deletes a hostel (see Non-goals).

### Supabase removal checklist

1. Delete `src/config/db.js` and `src/utils/supabaseStorage.js`.
2. `npm uninstall @supabase/supabase-js`.
3. Remove `SUPABASE_URL`/`SUPABASE_KEY` (and any `SUPABASE_*`) from `server/.env` and `server/.env.example`.
4. Remove the Supabase health check from `src/server.js`.
5. `grep -ri supabase server/src server/*.js` returns only comments referencing `supabase_schema.sql` as history.

## Data flow

**Room detail (read with four joins):** `GET /api/rooms/:id` → controller calls `cq(api.rooms.getByIdWithRelations, { id })` → one Convex query does `db.get(roomId)`, then three `by_room_id` index scans and one `db.get(hostelId)`, assembles `{...room, ROOM_IMAGE_URLS, ROOM_TOUR_SCENES, ROOM_AMENITY, HOSTEL}`, serializes timestamps to ISO → controller returns `{success: true, data}`. One round trip from Express, same JSON as PostgREST produced.

**Booking confirmation (write with side effects):** `PATCH /api/bookings/:id` with `status: "CONFIRMED"` → controller calls `cq(api.bookings.getByIdWithRelations)` for the authorization check (student owns it / manager manages that hostel), then `cm(api.bookings.updateStatus, { id, status })` → one mutation sets the status, bumps `rooms.current_occupancy`, recomputes `is_available`, adjusts `hostels.available_rooms`, and sets `users.current_room_id` — all transactionally, or rejects with a capacity error the controller maps to 409.

## Error handling

- A Convex function that finds nothing returns `null` (queries) or throws a named error (mutations that require a target). Controllers map `null` → the same 404 they returned for `PGRST116`.
- Uniqueness violations throw `"One or more of these amenities is already added"`; `Amenities.service.js` maps that to its existing 409.
- Capacity rejection throws from `bookings.updateStatus`; the controller maps it to the existing 409.
- Transport and deployment errors surface as whatever `ConvexHttpClient` throws, handled by the existing Express error middleware exactly as `supabase-js` errors were.
- `CONVEX_URL` or `CONVEX_ADAPTER_SECRET` missing → throws at import, as Sub-project 1 established.

## Testing

The existing Express tests (`server/tests/*.test.js`) assert only that a status code falls in a permissive set, so they cannot detect a regression in this work. They stay (harmless, and they do catch import-time crashes) but are not the safety net.

New `convex-test` suites, one per module file, using the harness already proven by Sub-project 1's 75 passing tests. Required coverage:

1. **Nested shape assembly** — every response key in the contract table above, asserted by key name, including that `ROOM`/`HOSTEL`/`USERS`/`manager` appear with exactly the documented subfields.
2. **ISO timestamp serialization** — `created_at` comes back as a string parseable by `Date`, not a number.
3. **Inner-join exclusion** — a room whose hostel is missing does not appear in `rooms.list`.
4. **Cascade** — deleting a room removes its images, tour scenes, amenities, and bookings, and clears a pointing user's `current_room_id`.
5. **Composite uniqueness** — adding a duplicate `(hostel_id, name)` or `(room_id, name)` amenity throws.
6. **Occupancy transitions** — PENDING→CONFIRMED increments and sets `current_room_id`; CONFIRMED→CANCELLED decrements and clears it; confirming into a full room throws.
7. **Booking predicates** — `existsForStudentInRooms` is false for a student with no booking, true with a `CONFIRMED` one, and false with only a `PENDING` one when `statuses` is restricted.
8. **Rating bounds** — `reviews.create` rejects 0 and 6.

Plus `server/scripts/seed.mjs`: creates a manager and a student through better-auth (so password hashing is real), two hostels (one `APPROVED`, one `PENDING`), several rooms with amenities and image URLs, and one `CONFIRMED` booking — enough for the demo to show browse, detail, booking, and manager views on an empty deployment.

Final verification is a manual smoke pass over every endpoint in the shape-contract table, against the live deployment, before Sunday.

## Sequencing and risk

Dependency order, because later modules consume earlier ones' ids and helpers:

1. **Schema + `toApiRow`** — blocks everything.
2. **`users` extensions + middlewares** — unblocks every authenticated endpoint; also fixes the currently-broken `GET /api/users/me` and `registerManager`.
3. **`hostels` + `rooms`** — the demo's core browse path.
4. **`bookings`** — the demo's core action, and the most logic-dense mutation.
5. **`complaints` + `reviews` + `amenities`.**
6. **Storage swap, seed script, Supabase removal.**

Honest risk statement: 11 tables, ~71 rewritten call sites, explicit cascade semantics, and a storage swap in roughly two days is aggressive, and the existing test suite provides no regression net — which is why per-module `convex-test` coverage is a requirement here rather than a nicety. If the schedule slips, the cut line is step 5 (complaints/reviews/amenities have the least demo value and can stay on the half-broken status quo for one more day); and the narrow Supabase-shaped shim rejected above remains available as a fallback over the same schema, so steps 1-2 are not wasted work in any scenario.
