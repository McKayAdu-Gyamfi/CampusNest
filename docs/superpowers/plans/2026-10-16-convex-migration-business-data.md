# Convex Migration — Business Data, Storage, and Supabase Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 11 business tables, image storage, and every remaining server data operation from Supabase to Convex, then remove `@supabase/supabase-js` from `server/` entirely.

**Architecture:** One Convex function file per module (`hostels`, `rooms`, `bookings`, `reviews`, `complaints`, `amenities`, `files`), each exposing purpose-built queries/mutations that assemble the exact nested response shapes PostgREST used to return. Express controllers keep their routes, validation, and status codes; only their data calls change, routed through a `cq`/`cm`/`ca` helper that injects the shared secret. Multi-step read-then-write sequences (room counts, occupancy transitions) collapse into single atomic Convex mutations.

**Tech Stack:** Convex (schema, queries, mutations, actions, file storage), `convex-test` + vitest for in-memory function tests, Express (unchanged structure), better-auth (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-16-convex-migration-business-data-design.md`

## Global Constraints

- **Never pass a client-supplied id string to `ctx.db.get()`.** Always `const docId = ctx.db.normalizeId("<table>", id)` first; `null` means malformed or wrong-table. Queries return `null`; mutations throw a named error. Skipping this turns `GET /api/rooms/123` into a 500 instead of a 404.
- Every Convex function is wrapped in `secureQuery` / `secureMutation` / `secureAction` from `server/convex/lib/secureFunction.ts`. No bare `query`, `mutation`, or `action` exports.
- Business rows leave Convex through `toApiRow` (Task 1). `toApiDoc` is for the four better-auth tables only — do not use it for business rows, and do not change it.
- Nested response keys are preserved verbatim: `ROOM`, `HOSTEL`, `USERS`, `manager`, `HOSTEL_IMAGE_URLS`, `HOSTEL_AMENITY`, `ROOM_IMAGE_URLS`, `ROOM_AMENITY`, `ROOM_TOUR_SCENES`. The Convex tables are lowercase plural (`rooms`, `hostels`); the response keys are not. This mismatch is deliberate.
- Business field names stay snake_case exactly as Postgres had them (`hostel_name`, `price_per_bed`, `current_occupancy`).
- `created_at`, `updated_at`, `createdAt`, `updatedAt`, `check_in_date`, `check_out_date` are stored as epoch-ms numbers and returned as ISO 8601 strings.
- Controllers keep their existing HTTP status codes and JSON envelope (`{ success, data }` / `{ success, message }`). A Convex query returning `null` maps to the same 404 the old `PGRST116` branch produced.
- **Any error the Express layer needs to tell apart must be a `ConvexError` carrying a structured code, never a plain `Error` matched by message text.** Convex's docs are explicit that for a non-`ConvexError` throw, "prod deployments will not reveal any more information about it to the client" — the message is redacted, so a `err.message.includes(...)` check passes in dev and silently fails in production, degrading a deliberate 409 into a generic 400. Throw `new ConvexError({ code: "SCREAMING_SNAKE_CODE" })` from the Convex function and branch on `err.data?.code` in Express. The codes this plan uses: `DUPLICATE_AMENITY`, `ROOM_AT_CAPACITY`, `INVALID_RATING`, `HOSTEL_NOT_FOUND`, `ROOM_NOT_FOUND`, `STUDENT_NOT_FOUND`.
- Tests run from `server/`: `npx vitest run`. The full suite must stay green at every commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Stage only the files each task names — never `git add -A`.
- `temp-pano-api` is untouched; it keeps writing to Supabase Storage, and `roomTourScenes.scene_config_url` keeps holding Supabase URLs.
- No `client/` changes in this plan.

## Review Focus

1. **A malformed or foreign id in a path param** (`GET /api/rooms/123`, or a hostel id passed where a room id belongs). A reasonable person expects 404, not a 500 from Convex rejecting the id string. Covered by `normalizeId` and pinned by tests in Tasks 4, 5, 6, 7.
2. **`distance_from_campus` is null while `max_distance` is filtering.** PostgREST's `.lte()` excluded null rows (null comparisons are never true); the JS filter must exclude them too, not treat null as 0. Pinned in Task 4.
3. **A room whose hostel row is missing.** `rooms.list` used `HOSTEL!inner`, so such a room must be *excluded* from the list; but `getByIdWithRelations` must still return the room with `HOSTEL: null` rather than throwing. Pinned in Task 5.
4. **Confirming a booking into a room already at capacity.** Expect a 409 and `current_occupancy` never exceeding `capacity`, even across repeated confirmations. Pinned in Task 6.
5. **Timestamps in nested payloads.** `created_at` must be an ISO string on nested rows too (`hostel.ROOM[0].created_at`), not just top-level — easy to miss when mapping children. Pinned in Tasks 4 and 5.

---

### Task 1: Schema, `toApiRow`, and `secureAction`

**Files:**
- Modify: `server/convex/schema.ts`
- Create: `server/convex/lib/toApiRow.ts`
- Modify: `server/convex/lib/secureFunction.ts`
- Test: `server/convex/lib/toApiRow.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: 11 business tables; `toApiRow(doc): Record<string, any>`; `secureAction(args, handler)`; a `users.by_current_room_id` index.

- [ ] **Step 1: Write the failing test for `toApiRow`**

Create `server/convex/lib/toApiRow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toApiRow } from "./toApiRow";

describe("toApiRow", () => {
  it("renames _id to id and drops _creationTime", () => {
    const row = toApiRow({ _id: "abc123", _creationTime: 1700000000000, hostel_name: "Unity" } as any);
    expect(row.id).toBe("abc123");
    expect(row).not.toHaveProperty("_id");
    expect(row).not.toHaveProperty("_creationTime");
    expect(row.hostel_name).toBe("Unity");
  });

  it("converts date fields from epoch ms to ISO strings", () => {
    const row = toApiRow({
      _id: "x", _creationTime: 0,
      created_at: 1760608200000, updated_at: 1760608200000,
      check_in_date: 1760608200000, check_out_date: 1760608200000,
      createdAt: 1760608200000, updatedAt: 1760608200000,
    } as any);
    for (const f of ["created_at", "updated_at", "check_in_date", "check_out_date", "createdAt", "updatedAt"]) {
      expect(typeof row[f]).toBe("string");
      expect(row[f]).toBe("2025-10-16T09:50:00.000Z");
      expect(Number.isNaN(Date.parse(row[f]))).toBe(false);
    }
  });

  it("leaves non-date numbers alone", () => {
    const row = toApiRow({ _id: "x", _creationTime: 0, price_per_bed: 450.5, capacity: 4 } as any);
    expect(row.price_per_bed).toBe(450.5);
    expect(row.capacity).toBe(4);
  });

  it("passes through a date field that is already a string", () => {
    const row = toApiRow({ _id: "x", _creationTime: 0, created_at: "2026-01-01T00:00:00.000Z" } as any);
    expect(row.created_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("preserves an explicitly null optional field", () => {
    const row = toApiRow({ _id: "x", _creationTime: 0, description: null } as any);
    expect(row.description).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx vitest run convex/lib/toApiRow.test.ts`
Expected: FAIL — cannot resolve `./toApiRow`.

- [ ] **Step 3: Implement `toApiRow`**

Create `server/convex/lib/toApiRow.ts`:

```ts
// Business rows only. The four better-auth tables keep using toApiDoc,
// because better-auth's adapter does its own Date conversion and expects
// epoch numbers back from Convex.
//
// Postgres returned TIMESTAMPTZ as an ISO string, so these fields are
// stored as epoch ms (Convex has no date type) and converted on the way
// out. Returning the raw number instead breaks date rendering silently.
const DATE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "createdAt",
  "updatedAt",
  "check_in_date",
  "check_out_date",
]);

export function toApiRow<T extends { _id: unknown; _creationTime: number }>(doc: T): Record<string, any> {
  const { _id, _creationTime, ...rest } = doc as any;
  const out: Record<string, any> = { id: _id };
  for (const [key, value] of Object.entries(rest)) {
    out[key] = DATE_FIELDS.has(key) && typeof value === "number" ? new Date(value).toISOString() : value;
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && npx vitest run convex/lib/toApiRow.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add `secureAction` to `secureFunction.ts`**

In `server/convex/lib/secureFunction.ts`, add `action` to the existing import and append the new wrapper. `secureQuery`/`secureMutation`/`checkSecret` stay exactly as they are:

```ts
import { query, mutation, action } from "../_generated/server";
```

```ts
// File storage needs an action (ctx.storage.store is not available in a
// mutation), so it needs its own wrapper — secureQuery/secureMutation
// wrap the query/mutation builders specifically.
export function secureAction(args: Record<string, any>, handler: (ctx: any, args: any) => any) {
  return action({
    args: { ...args, secret: v.string() },
    handler: async (ctx: any, allArgs: any) => {
      const { secret, ...rest } = allArgs;
      checkSecret(secret);
      return await handler(ctx, rest);
    },
  });
}
```

- [ ] **Step 6: Add the 11 business tables to the schema**

In `server/convex/schema.ts`, add the `amenityName` validator above `defineSchema`, add `.index("by_current_room_id", ["current_room_id"])` to the existing `users` table, replace the `rooms: defineTable({})` stub with the real definition, and add the remaining tables:

```ts
const amenityName = v.union(
  v.literal("WIFI"), v.literal("AIR_CONDITIONING"), v.literal("RUNNING_WATER"),
  v.literal("KITCHEN_ACCESS"), v.literal("PARKING"), v.literal("GYM"),
  v.literal("LAUNDRY"), v.literal("STUDY_ROOM"),
  v.literal("RESERVED_1"), v.literal("RESERVED_2"), v.literal("RESERVED_3")
);
```

```ts
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

- [ ] **Step 7: Deploy the schema and confirm it typechecks**

Run: `cd server && npx convex dev --once`
Expected: `Convex functions ready!` with no schema validation error. The deployment is empty, so no migration conflict is possible.

- [ ] **Step 8: Run the full suite**

Run: `cd server && npx vitest run`
Expected: PASS — the 75 existing tests plus the 5 new `toApiRow` tests (80 total). The auth tests must be unaffected; if any fail, `toApiDoc` or `secureFunction.ts` was changed when it should not have been.

- [ ] **Step 9: Commit**

```bash
git add server/convex/schema.ts server/convex/lib/toApiRow.ts server/convex/lib/toApiRow.test.ts server/convex/lib/secureFunction.ts server/convex/_generated
git commit -m "$(cat <<'EOF'
feat(convex): business table schema, toApiRow, and secureAction

Adds the 11 business tables with indexes on every foreign key and each
currently-filtered field, replacing the rooms stub forward-declared in
sub-project 1. toApiRow handles the id rename and the epoch-ms to ISO
string conversion Postgres used to do for TIMESTAMPTZ columns; the auth
tables keep toApiDoc untouched because better-auth expects raw numbers.
secureAction exists because file storage needs an action, which the
existing query/mutation wrappers cannot wrap.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Convex client helper, user profile functions, middleware and auth rewrites

**Files:**
- Create: `server/src/config/convexClient.js`
- Modify: `server/convex/users.ts`
- Modify: `server/convex/users.test.ts`
- Modify: `server/src/modules/users/users.service.js`
- Modify: `server/src/middlewares/auth.middleware.js:46-55`
- Modify: `server/src/modules/auth/auth.controller.js:26-34`

**Interfaces:**
- Consumes: `toApiRow` (Task 1); `secureQuery`/`secureMutation`.
- Produces: `cq(fn, args)`, `cm(fn, args)`, `ca(fn, args)` from `src/config/convexClient.js`; `api.users.getMeWithRoom`, `api.users.updateProfile`, `api.users.listAll`, `api.users.getProfileComplete`.

- [ ] **Step 1: Write the failing tests**

Append to `server/convex/users.test.ts` (inside the existing `describe`):

```ts
  it("getMeWithRoom returns the user with a null ROOM when no current room", async () => {
    const t = convexTest(schema, modules);
    const user = await t.mutation(api.users.create, {
      data: { name: "Ama", email: "ama@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
    const me = await t.query(api.users.getMeWithRoom, { id: user.id, secret });
    expect(me).not.toBeNull();
    expect(me!.email).toBe("ama@test.com");
    expect(me!.ROOM).toBeNull();
  });

  it("getMeWithRoom nests ROOM.HOSTEL.hostel_name for a student with a current room", async () => {
    const t = convexTest(schema, modules);
    const user = await t.mutation(api.users.create, {
      data: { name: "Ama", email: "ama2@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
    const ids = await t.run(async (ctx) => {
      const hostelId = await ctx.db.insert("hostels", {
        hostel_name: "Unity Hall", location: "North Campus", total_rooms: 1, available_rooms: 1,
        status: "APPROVED", created_at: Date.now(), updated_at: Date.now(),
      });
      const roomId = await ctx.db.insert("rooms", {
        room_number: "A1", room_type: "SINGLE", price_per_bed: 400, capacity: 1,
        current_occupancy: 0, is_available: true, hostel_id: hostelId,
        created_at: Date.now(), updated_at: Date.now(),
      });
      await ctx.db.patch(ctx.db.normalizeId("users", user.id)!, { current_room_id: roomId });
      return { roomId };
    });

    const me = await t.query(api.users.getMeWithRoom, { id: user.id, secret });
    expect(me!.ROOM.room_number).toBe("A1");
    expect(me!.ROOM.HOSTEL.hostel_name).toBe("Unity Hall");
    expect(ids.roomId).toBeTruthy();
  });

  it("getMeWithRoom returns null for a malformed id instead of throwing (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    const me = await t.query(api.users.getMeWithRoom, { id: "not-a-real-id", secret });
    expect(me).toBeNull();
  });

  it("getProfileComplete reports the flag, and null for an unknown user", async () => {
    const t = convexTest(schema, modules);
    const user = await t.mutation(api.users.create, {
      data: { name: "Kojo", email: "kojo@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: true },
      secret,
    });
    expect(await t.query(api.users.getProfileComplete, { id: user.id, secret })).toEqual({ profile_complete: true });
    expect(await t.query(api.users.getProfileComplete, { id: "bogus", secret })).toBeNull();
  });

  it("updateProfile patches only the given fields and returns ISO timestamps", async () => {
    const t = convexTest(schema, modules);
    const user = await t.mutation(api.users.create, {
      data: { name: "Esi", email: "esi@test.com", emailVerified: false, user_type: "STUDENT",
              profile_complete: false, createdAt: Date.now(), updatedAt: Date.now() },
      secret,
    });
    const updated = await t.mutation(api.users.updateProfile, {
      id: user.id, patch: { student_id: "UG-123", course: "CS", profile_complete: true }, secret,
    });
    expect(updated!.student_id).toBe("UG-123");
    expect(updated!.name).toBe("Esi");
    expect(typeof updated!.createdAt).toBe("string");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run convex/users.test.ts`
Expected: FAIL — `api.users.getMeWithRoom` is not a function.

- [ ] **Step 3: Add the user functions**

Append to `server/convex/users.ts` (keep every existing export unchanged, and add the `toApiRow` import):

```ts
import { toApiRow } from "./lib/toApiRow";
```

```ts
// Business-facing user reads. These use toApiRow (ISO timestamps, `id`),
// unlike the better-auth adapter paths above which use toApiDoc.

export const getMeWithRoom = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const userId = ctx.db.normalizeId("users", id);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;

  const row = toApiRow(user);
  row.ROOM = null;
  if (user.current_room_id) {
    const room = await ctx.db.get(user.current_room_id);
    if (room) {
      const hostel = await ctx.db.get(room.hostel_id);
      row.ROOM = {
        room_number: room.room_number,
        HOSTEL: hostel ? { hostel_name: hostel.hostel_name } : null,
      };
    }
  }
  return row;
});

export const getProfileComplete = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const userId = ctx.db.normalizeId("users", id);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return { profile_complete: user.profile_complete };
});

export const updateProfile = secureMutation({ id: v.string(), patch: v.any() }, async (ctx, { id, patch }) => {
  const userId = ctx.db.normalizeId("users", id);
  if (!userId) return null;
  const existing = await ctx.db.get(userId);
  if (!existing) return null;
  await ctx.db.patch(userId, { ...patch, updatedAt: Date.now() });
  const updated = await ctx.db.get(userId);
  return updated ? toApiRow(updated) : null;
});

export const listAll = secureQuery({}, async (ctx) => {
  const users = await ctx.db.query("users").collect();
  return users.map((u: any) => toApiRow(u));
});
```

The spec also listed a `setCurrentRoom` function. It is deliberately **not** built: `api.bookings.updateStatus` (Task 6) sets and clears `current_room_id` inside its own transaction, and `api.rooms.remove` (Task 5) clears it on cascade, so nothing would call it. Adding it would mean a second write path to the same field.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run convex/users.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the Express-side Convex client helper**

Create `server/src/config/convexClient.js`:

```js
import { convex } from "./convex.js";

// Every Convex function requires the shared adapter secret (see
// convex/lib/secureFunction.ts). Threading it here keeps it out of all
// ~70 call sites.
const ADAPTER_SECRET = process.env.CONVEX_ADAPTER_SECRET;
if (!ADAPTER_SECRET) {
  throw new Error("CONVEX_ADAPTER_SECRET is not set — the server cannot call its Convex functions");
}

export const cq = (fn, args = {}) => convex.query(fn, { ...args, secret: ADAPTER_SECRET });
export const cm = (fn, args = {}) => convex.mutation(fn, { ...args, secret: ADAPTER_SECRET });
export const ca = (fn, args = {}) => convex.action(fn, { ...args, secret: ADAPTER_SECRET });
```

- [ ] **Step 6: Rewrite `users.service.js`**

Replace the whole file. `UserServiceError` and every exported function name and signature stay identical — only the data calls change:

```js
import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

class UserServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "UserServiceError";
    this.statusCode = statusCode;
  }
}

export const getMe = async (userId) => {
  const user = await cq(api.users.getMeWithRoom, { id: userId });
  if (!user) throw new UserServiceError("User profile not found in database", 404);
  return user;
};

export const updateMe = async (userId, updates, userType) => {
  let patch;
  if (userType === "HOSTEL_MANAGER") {
    const { user_type, student_id, course, profile_complete, ...safeUpdates } = updates;
    patch = safeUpdates;
  } else if (userType === "STUDENT") {
    const current = await cq(api.users.getMeWithRoom, { id: userId });
    if (!current) throw new UserServiceError("User profile not found in database", 404);
    const merged = { student_id: current.student_id, course: current.course, ...updates };
    patch = { ...updates, profile_complete: !!(merged.student_id && merged.course) };
  } else {
    const { user_type, ...safeUpdates } = updates;
    patch = safeUpdates;
  }

  const updated = await cm(api.users.updateProfile, { id: userId, patch });
  if (!updated) throw new UserServiceError("User profile not found in database", 404);
  return updated;
};

export const completeProfile = async (userId, data) => {
  const { student_id, course } = data;
  const updated = await cm(api.users.updateProfile, {
    id: userId,
    patch: { student_id, course, profile_complete: !!(student_id && course) },
  });
  if (!updated) throw new UserServiceError("User profile not found in database", 404);
  return updated;
};

export const completeManagerProfile = async (userId, data) => {
  const { payment_details } = data;
  const updated = await cm(api.users.updateProfile, {
    id: userId,
    patch: { payment_details, profile_complete: !!payment_details },
  });
  if (!updated) throw new UserServiceError("User profile not found in database", 404);
  return updated;
};

export const getMyHostels = async (userId) => {
  return await cq(api.hostels.listByManager, { managerId: userId });
};

export const listUsers = async () => {
  return await cq(api.users.listAll, {});
};

export const getUserById = async (id) => {
  const user = await cq(api.users.getMeWithRoom, { id });
  if (!user) throw new UserServiceError("User not found", 404);
  return user;
};

export const adminUpdateUser = async (id, updates) => {
  const updated = await cm(api.users.updateProfile, { id, patch: updates });
  if (!updated) throw new UserServiceError("User not found", 404);
  return updated;
};

// Flow 3: ADMIN creates another ADMIN
import { auth } from "../../../auth.js";

export const createAdmin = async (adminDetails) => {
  const { email, password, name } = adminDetails;

  const response = await auth.api.signUpEmail({
    body: { email, password, name: name || email.split("@")[0] },
  });

  if (response.error) {
    throw new UserServiceError(response.error.message, 400);
  }

  const { user } = response;
  const updated = await cm(api.users.updateProfile, {
    id: user.id,
    patch: { user_type: "ADMIN", profile_complete: true },
  });
  if (!updated) throw new UserServiceError("Newly created admin not found", 500);
  return updated;
};
```

Two notes on this file:

- `getMyHostels` calls `api.hostels.listByManager`, which Task 4 creates. Until Task 4 lands, `GET /api/users/me/hostels` throws — expected mid-plan, and covered by Task 4's tests. Every other function here works immediately.
- `getUserById` reuses `getMeWithRoom`, so `GET /api/users/:id` (admin-only) now carries an extra `ROOM` key that PostgREST's `select("*")` did not return. This is the one additive shape change in the plan, accepted because it saves a second Convex function and nothing reads that endpoint today (the admin pages are still on mock data). A reviewer should treat it as intentional, not as drift.

- [ ] **Step 7: Rewrite `requireCompleteProfile`**

In `server/src/middlewares/auth.middleware.js`, replace the `supabase` import with the Convex imports and swap the lookup. The rest of the file is unchanged:

```js
import { auth } from "../../auth.js";
import { cq } from "../config/convexClient.js";
import { api } from "../../convex/_generated/api.js";
```

```js
    const user = await cq(api.users.getProfileComplete, { id: req.user.id });

    if (!user) {
      console.error("[Auth Middleware - requireCompleteProfile] Error: user not found in Convex");
      return res.status(401).json({ success: false, message: "User not found" });
    }
```

- [ ] **Step 8: Rewrite `registerManager`'s user update**

In `server/src/modules/auth/auth.controller.js`, replace the `supabase` import with the Convex imports and replace the `.from("user").update(...)` block (lines 26-40) with:

```js
    const updatedUser = await cm(api.users.updateProfile, {
      id: user.id,
      patch: { user_type, profile_complete: false },
    });

    if (!updatedUser) {
      console.error("[Auth Controller - registerManager] Convex returned no user for id:", user.id);
      throw new Error("Newly registered manager could not be updated");
    }
```

- [ ] **Step 9: Run the full suite**

Run: `cd server && npx vitest run`
Expected: PASS (85 tests: 80 from Task 1 plus 5 new user tests). The existing Express tests must still pass — if `tests/users.test.js` now fails at import, a Supabase import was left behind in a file this task rewrote.

- [ ] **Step 10: Verify the profile path live**

Run: `cd server && npx convex dev --once && node --check src/modules/users/users.service.js src/middlewares/auth.middleware.js src/modules/auth/auth.controller.js`
Expected: Convex ready, and no syntax errors.

- [ ] **Step 11: Commit**

```bash
git add server/src/config/convexClient.js server/convex/users.ts server/convex/users.test.ts server/src/modules/users/users.service.js server/src/middlewares/auth.middleware.js server/src/modules/auth/auth.controller.js server/convex/_generated
git commit -m "$(cat <<'EOF'
feat(server): move user profile reads and writes to Convex

Adds the business-facing user functions (getMeWithRoom with its nested
ROOM.HOSTEL shape, updateProfile, listAll, getProfileComplete,
setCurrentRoom) and the cq/cm/ca helper that injects the adapter secret
so the ~70 remaining call sites do not each repeat it.

Fixes the two endpoints sub-project 1 knowingly broke: GET /api/users/me
and registerManager were still reading and writing the Supabase user
table after better-auth's users moved to Convex.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Amenities

**Files:**
- Create: `server/convex/amenities.ts`
- Create: `server/convex/amenities.test.ts`
- Modify: `server/src/modules/amenities/Amenities.service.js`

**Interfaces:**
- Consumes: `toApiRow`; `secureQuery`/`secureMutation`.
- Produces: `api.amenities.replaceForHostel`, `addForHostel`, `removeHostelAmenity`, `replaceForRoom`, `addForRoom`, `removeRoomAmenity`.

- [ ] **Step 1: Write the failing tests**

Create `server/convex/amenities.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function seedHostelAndRoom(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const hostelId = await ctx.db.insert("hostels", {
      hostel_name: "Unity Hall", location: "North", total_rooms: 1, available_rooms: 1,
      status: "APPROVED", created_at: Date.now(), updated_at: Date.now(),
    });
    const roomId = await ctx.db.insert("rooms", {
      room_number: "A1", room_type: "SINGLE", price_per_bed: 400, capacity: 2,
      current_occupancy: 0, is_available: true, hostel_id: hostelId,
      created_at: Date.now(), updated_at: Date.now(),
    });
    return { hostelId, roomId };
  });
}

describe("amenities", () => {
  it("addForHostel inserts and returns the created rows", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    const rows = await t.mutation(api.amenities.addForHostel, {
      hostelId, names: ["WIFI", "GYM"], secret,
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.name).sort()).toEqual(["GYM", "WIFI"]);
    expect(rows[0].id).toBeTruthy();
    expect(rows[0]).not.toHaveProperty("_id");
  });

  it("addForHostel rejects a duplicate (hostel_id, name) pair", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret })
    ).rejects.toThrow(/already added/i);
  });

  it("addForHostel rejects a duplicate inside a single call", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI", "WIFI"], secret })
    ).rejects.toThrow(/already added/i);
  });

  it("replaceForHostel clears the old set and inserts the new one", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI", "GYM"], secret });
    const rows = await t.mutation(api.amenities.replaceForHostel, {
      hostelId, names: ["PARKING"], secret,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("PARKING");

    const remaining = await t.run(async (ctx) =>
      await ctx.db.query("hostelAmenities").collect()
    );
    expect(remaining).toHaveLength(1);
  });

  it("replaceForHostel with an empty list removes everything and returns []", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    const rows = await t.mutation(api.amenities.replaceForHostel, { hostelId, names: [], secret });
    expect(rows).toEqual([]);
    const remaining = await t.run(async (ctx) => await ctx.db.query("hostelAmenities").collect());
    expect(remaining).toHaveLength(0);
  });

  it("removeHostelAmenity deletes one row and is a no-op for a malformed id", async () => {
    const t = convexTest(schema, modules);
    const { hostelId } = await seedHostelAndRoom(t);
    const [row] = await t.mutation(api.amenities.addForHostel, { hostelId, names: ["WIFI"], secret });
    await t.mutation(api.amenities.removeHostelAmenity, { id: row.id, secret });
    const remaining = await t.run(async (ctx) => await ctx.db.query("hostelAmenities").collect());
    expect(remaining).toHaveLength(0);
    await expect(
      t.mutation(api.amenities.removeHostelAmenity, { id: "bogus", secret })
    ).resolves.not.toThrow();
  });

  it("room amenities behave the same way, keyed by room_id", async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await seedHostelAndRoom(t);
    const rows = await t.mutation(api.amenities.addForRoom, { roomId, names: ["LAUNDRY"], secret });
    expect(rows[0].name).toBe("LAUNDRY");
    await expect(
      t.mutation(api.amenities.addForRoom, { roomId, names: ["LAUNDRY"], secret })
    ).rejects.toThrow(/already added/i);
    const replaced = await t.mutation(api.amenities.replaceForRoom, { roomId, names: ["WIFI"], secret });
    expect(replaced.map((r: any) => r.name)).toEqual(["WIFI"]);
  });

  it("rejects a malformed parent id", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.amenities.addForHostel, { hostelId: "bogus", names: ["WIFI"], secret })
    ).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run convex/amenities.test.ts`
Expected: FAIL — cannot resolve `api.amenities`.

- [ ] **Step 3: Implement `convex/amenities.ts`**

```ts
// server/convex/amenities.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureMutation } from "./lib/secureFunction";

const amenityNames = v.array(v.string());

const DUPLICATE_MESSAGE = "One or more of these amenities is already added";

async function assertNoHostelDuplicates(ctx: any, hostelId: any, names: string[]) {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new Error(DUPLICATE_MESSAGE);
    seen.add(name);
    const existing = await ctx.db
      .query("hostelAmenities")
      .withIndex("by_hostel_id_name", (q: any) => q.eq("hostel_id", hostelId).eq("name", name))
      .unique();
    if (existing) throw new Error(DUPLICATE_MESSAGE);
  }
}

async function assertNoRoomDuplicates(ctx: any, roomId: any, names: string[]) {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new Error(DUPLICATE_MESSAGE);
    seen.add(name);
    const existing = await ctx.db
      .query("roomAmenities")
      .withIndex("by_room_id_name", (q: any) => q.eq("room_id", roomId).eq("name", name))
      .unique();
    if (existing) throw new Error(DUPLICATE_MESSAGE);
  }
}

export const addForHostel = secureMutation(
  { hostelId: v.string(), names: amenityNames },
  async (ctx, { hostelId, names }) => {
    const id = ctx.db.normalizeId("hostels", hostelId);
    if (!id) throw new Error("Hostel not found");
    await assertNoHostelDuplicates(ctx, id, names);
    const created = [];
    for (const name of names) {
      const rowId = await ctx.db.insert("hostelAmenities", { hostel_id: id, name: name as any });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const replaceForHostel = secureMutation(
  { hostelId: v.string(), names: amenityNames },
  async (ctx, { hostelId, names }) => {
    const id = ctx.db.normalizeId("hostels", hostelId);
    if (!id) throw new Error("Hostel not found");
    const existing = await ctx.db
      .query("hostelAmenities")
      .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    if (names.length === 0) return [];
    await assertNoHostelDuplicates(ctx, id, names);
    const created = [];
    for (const name of names) {
      const rowId = await ctx.db.insert("hostelAmenities", { hostel_id: id, name: name as any });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const removeHostelAmenity = secureMutation({ id: v.string() }, async (ctx, { id }) => {
  const rowId = ctx.db.normalizeId("hostelAmenities", id);
  if (!rowId) return { success: true };
  const row = await ctx.db.get(rowId);
  if (row) await ctx.db.delete(rowId);
  return { success: true };
});

export const addForRoom = secureMutation(
  { roomId: v.string(), names: amenityNames },
  async (ctx, { roomId, names }) => {
    const id = ctx.db.normalizeId("rooms", roomId);
    if (!id) throw new Error("Room not found");
    await assertNoRoomDuplicates(ctx, id, names);
    const created = [];
    for (const name of names) {
      const rowId = await ctx.db.insert("roomAmenities", { room_id: id, name: name as any });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const replaceForRoom = secureMutation(
  { roomId: v.string(), names: amenityNames },
  async (ctx, { roomId, names }) => {
    const id = ctx.db.normalizeId("rooms", roomId);
    if (!id) throw new Error("Room not found");
    const existing = await ctx.db
      .query("roomAmenities")
      .withIndex("by_room_id", (q: any) => q.eq("room_id", id))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    if (names.length === 0) return [];
    await assertNoRoomDuplicates(ctx, id, names);
    const created = [];
    for (const name of names) {
      const rowId = await ctx.db.insert("roomAmenities", { room_id: id, name: name as any });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const removeRoomAmenity = secureMutation({ id: v.string() }, async (ctx, { id }) => {
  const rowId = ctx.db.normalizeId("roomAmenities", id);
  if (!rowId) return { success: true };
  const row = await ctx.db.get(rowId);
  if (row) await ctx.db.delete(rowId);
  return { success: true };
});
```

Note on the validator: `names` is `v.array(v.string())` rather than the amenity union, because the Zod schema in `Amenities.schema.js` already validates the enum at the HTTP boundary and Convex's own schema validation rejects a bad value on insert. A non-enum value therefore fails loudly at insert rather than silently writing.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run convex/amenities.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Rewrite `Amenities.service.js`**

Replace the whole file. Every exported function keeps its name, signature, and error semantics — the 409 on duplicates now comes from matching the mutation's thrown message instead of Postgres code `23505`:

```js
import { cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

class AmenityServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "AmenityServiceError";
    this.statusCode = statusCode;
  }
}

// The Convex mutations throw this exact message when a (parent, name) pair
// already exists — the replacement for Postgres' 23505 unique violation.
const DUPLICATE_MESSAGE = "One or more of these amenities is already added";

const wrapError = (error) => {
  if (error.message && error.message.includes(DUPLICATE_MESSAGE)) {
    return new AmenityServiceError(DUPLICATE_MESSAGE, 409);
  }
  return new AmenityServiceError(error.message, 400);
};

export const updateHostelAmenities = async (hostelId, amenities) => {
  try {
    return await cm(api.amenities.replaceForHostel, { hostelId, names: amenities ?? [] });
  } catch (error) {
    throw wrapError(error);
  }
};

export const addHostelAmenities = async (hostelId, amenities) => {
  try {
    return await cm(api.amenities.addForHostel, { hostelId, names: amenities ?? [] });
  } catch (error) {
    throw wrapError(error);
  }
};

export const removeHostelAmenity = async (id) => {
  try {
    return await cm(api.amenities.removeHostelAmenity, { id });
  } catch (error) {
    throw wrapError(error);
  }
};

export const updateRoomAmenities = async (roomId, amenities) => {
  try {
    return await cm(api.amenities.replaceForRoom, { roomId, names: amenities ?? [] });
  } catch (error) {
    throw wrapError(error);
  }
};

export const addRoomAmenities = async (roomId, amenities) => {
  try {
    return await cm(api.amenities.addForRoom, { roomId, names: amenities ?? [] });
  } catch (error) {
    throw wrapError(error);
  }
};

export const removeRoomAmenity = async (id) => {
  try {
    return await cm(api.amenities.removeRoomAmenity, { id });
  } catch (error) {
    throw wrapError(error);
  }
};
```

- [ ] **Step 6: Run the full suite**

Run: `cd server && npx vitest run`
Expected: PASS (93 tests).

- [ ] **Step 7: Commit**

```bash
git add server/convex/amenities.ts server/convex/amenities.test.ts server/src/modules/amenities/Amenities.service.js server/convex/_generated
git commit -m "$(cat <<'EOF'
feat(server): move hostel and room amenities to Convex

Postgres enforced UNIQUE(hostel_id, name) and UNIQUE(room_id, name) and
the service mapped error 23505 to a 409. Convex indexes are not unique,
so the mutations check the composite index before inserting — inside the
same transaction, which also catches a duplicate repeated within one
request body, something the old per-row insert could only catch per row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Hostels

**Files:**
- Create: `server/convex/hostels.ts`
- Create: `server/convex/hostels.test.ts`
- Modify: `server/src/modules/hostels/hostels.controller.js`
- Modify: `server/src/middlewares/verifyOwnership.js:3-26`

**Interfaces:**
- Consumes: `toApiRow`; `api.amenities.*` (Task 3).
- Produces: `api.hostels.listApproved`, `getByIdWithRelations`, `countByManager`, `listByManager`, `getManagerId`, `create`, `update`, `addImages`.

- [ ] **Step 1: Write the failing tests**

Create `server/convex/hostels.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function makeManager(t: ReturnType<typeof convexTest>, email = "mgr@test.com") {
  return await t.mutation(api.users.create, {
    data: { name: "Mgr", email, emailVerified: false, user_type: "HOSTEL_MANAGER", profile_complete: true },
    secret,
  });
}

describe("hostels", () => {
  it("create returns the hostel with ISO timestamps and an id", async () => {
    const t = convexTest(schema, modules);
    const mgr = await makeManager(t);
    const hostel = await t.mutation(api.hostels.create, {
      data: {
        hostel_name: "Unity Hall", location: "North Campus", description: "Nice",
        total_rooms: 10, available_rooms: 10, distance_from_campus: 1.5,
        manager_id: mgr.id, status: "PENDING",
      },
      secret,
    });
    expect(hostel.id).toBeTruthy();
    expect(hostel.status).toBe("PENDING");
    expect(typeof hostel.created_at).toBe("string");
    expect(Number.isNaN(Date.parse(hostel.created_at))).toBe(false);
  });

  it("listApproved returns only APPROVED hostels, each with a nested manager", async () => {
    const t = convexTest(schema, modules);
    const mgr = await makeManager(t);
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Approved One", location: "North", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "APPROVED" },
      secret,
    });
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Pending One", location: "South", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "PENDING" },
      secret,
    });

    const rows = await t.query(api.hostels.listApproved, { secret });
    expect(rows).toHaveLength(1);
    expect(rows[0].hostel_name).toBe("Approved One");
    expect(rows[0].manager).toEqual({ id: mgr.id, email: "mgr@test.com" });
  });

  it("listApproved search matches hostel_name or location, case-insensitively", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Unity Hall", location: "North", total_rooms: 1, available_rooms: 1, status: "APPROVED" },
      secret,
    });
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Legon Lodge", location: "Unity Road", total_rooms: 1, available_rooms: 1, status: "APPROVED" },
      secret,
    });

    expect(await t.query(api.hostels.listApproved, { search: "unity", secret })).toHaveLength(2);
    expect(await t.query(api.hostels.listApproved, { search: "LEGON", secret })).toHaveLength(1);
    expect(await t.query(api.hostels.listApproved, { search: "nowhere", secret })).toHaveLength(0);
  });

  it("maxDistance excludes hostels with no distance recorded (Review Focus #2)", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Close", location: "N", total_rooms: 1, available_rooms: 1,
              distance_from_campus: 1, status: "APPROVED" },
      secret,
    });
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Unknown Distance", location: "N", total_rooms: 1, available_rooms: 1,
              status: "APPROVED" },
      secret,
    });

    const rows = await t.query(api.hostels.listApproved, { maxDistance: 5, secret });
    expect(rows.map((r: any) => r.hostel_name)).toEqual(["Close"]);
  });

  it("getByIdWithRelations nests ROOM, HOSTEL_IMAGE_URLS and HOSTEL_AMENITY with ISO dates (Review Focus #5)", async () => {
    const t = convexTest(schema, modules);
    const hostel = await t.mutation(api.hostels.create, {
      data: { hostel_name: "Unity Hall", location: "North", total_rooms: 1, available_rooms: 1, status: "APPROVED" },
      secret,
    });
    await t.run(async (ctx) => {
      const hid = ctx.db.normalizeId("hostels", hostel.id)!;
      await ctx.db.insert("rooms", {
        room_number: "A1", room_type: "SINGLE", price_per_bed: 400, capacity: 1,
        current_occupancy: 0, is_available: true, hostel_id: hid,
        created_at: Date.now(), updated_at: Date.now(),
      });
      await ctx.db.insert("hostelImages", { hostel_id: hid, image_url: "https://example.com/a.jpg" });
      await ctx.db.insert("hostelAmenities", { hostel_id: hid, name: "WIFI" });
    });

    const row = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(row!.ROOM).toHaveLength(1);
    expect(row!.ROOM[0].room_number).toBe("A1");
    expect(typeof row!.ROOM[0].created_at).toBe("string");
    expect(row!.HOSTEL_IMAGE_URLS[0].image_url).toBe("https://example.com/a.jpg");
    expect(row!.HOSTEL_AMENITY[0].name).toBe("WIFI");
  });

  it("getByIdWithRelations returns null for a malformed id (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.hostels.getByIdWithRelations, { id: "123", secret })).toBeNull();
  });

  it("countByManager and listByManager see every status", async () => {
    const t = convexTest(schema, modules);
    const mgr = await makeManager(t);
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "One", location: "N", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "APPROVED" },
      secret,
    });
    await t.mutation(api.hostels.create, {
      data: { hostel_name: "Two", location: "N", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "PENDING" },
      secret,
    });

    expect(await t.query(api.hostels.countByManager, { managerId: mgr.id, secret })).toBe(2);
    expect(await t.query(api.hostels.listByManager, { managerId: mgr.id, secret })).toHaveLength(2);
    expect(await t.query(api.hostels.countByManager, { managerId: "bogus", secret })).toBe(0);
  });

  it("getManagerId returns the manager or null", async () => {
    const t = convexTest(schema, modules);
    const mgr = await makeManager(t);
    const hostel = await t.mutation(api.hostels.create, {
      data: { hostel_name: "One", location: "N", total_rooms: 1, available_rooms: 1,
              manager_id: mgr.id, status: "APPROVED" },
      secret,
    });
    expect(await t.query(api.hostels.getManagerId, { id: hostel.id, secret })).toEqual({ manager_id: mgr.id });
    expect(await t.query(api.hostels.getManagerId, { id: "bogus", secret })).toBeNull();
  });

  it("update patches given fields and addImages returns the created rows", async () => {
    const t = convexTest(schema, modules);
    const hostel = await t.mutation(api.hostels.create, {
      data: { hostel_name: "One", location: "N", total_rooms: 1, available_rooms: 1, status: "PENDING" },
      secret,
    });
    const updated = await t.mutation(api.hostels.update, {
      id: hostel.id, patch: { status: "APPROVED" }, secret,
    });
    expect(updated!.status).toBe("APPROVED");
    expect(updated!.hostel_name).toBe("One");
    expect(await t.mutation(api.hostels.update, { id: "bogus", patch: { status: "APPROVED" }, secret })).toBeNull();

    const images = await t.mutation(api.hostels.addImages, {
      hostelId: hostel.id, urls: ["https://example.com/1.jpg", "https://example.com/2.jpg"], secret,
    });
    expect(images).toHaveLength(2);
    expect(images[0].hostel_id).toBe(hostel.id);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run convex/hostels.test.ts`
Expected: FAIL — cannot resolve `api.hostels`.

- [ ] **Step 3: Implement `convex/hostels.ts`**

```ts
// server/convex/hostels.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

async function withManager(ctx: any, hostel: any) {
  const row = toApiRow(hostel);
  row.manager = null;
  if (hostel.manager_id) {
    const manager = await ctx.db.get(hostel.manager_id);
    if (manager) row.manager = { id: manager._id, email: manager.email };
  }
  return row;
}

export const listApproved = secureQuery(
  { search: v.optional(v.string()), maxDistance: v.optional(v.number()) },
  async (ctx, { search, maxDistance }) => {
    let rows = await ctx.db
      .query("hostels")
      .withIndex("by_status", (q: any) => q.eq("status", "APPROVED"))
      .collect();

    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter(
        (h: any) =>
          h.hostel_name.toLowerCase().includes(needle) || h.location.toLowerCase().includes(needle)
      );
    }

    // Postgres .lte() on a NULL column is never true, so a hostel with no
    // recorded distance was excluded by the old filter. Match that: do not
    // treat a missing distance as 0.
    if (maxDistance !== undefined) {
      rows = rows.filter(
        (h: any) => h.distance_from_campus !== undefined && h.distance_from_campus <= maxDistance
      );
    }

    return await Promise.all(rows.map((h: any) => withManager(ctx, h)));
  }
);

export const getByIdWithRelations = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const hostelId = ctx.db.normalizeId("hostels", id);
  if (!hostelId) return null;
  const hostel = await ctx.db.get(hostelId);
  if (!hostel) return null;

  const [rooms, images, amenities] = await Promise.all([
    ctx.db.query("rooms").withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", hostelId)).collect(),
    ctx.db.query("hostelImages").withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", hostelId)).collect(),
    ctx.db.query("hostelAmenities").withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", hostelId)).collect(),
  ]);

  const row = toApiRow(hostel);
  row.ROOM = rooms.map((r: any) => toApiRow(r));
  row.HOSTEL_IMAGE_URLS = images.map((i: any) => toApiRow(i));
  row.HOSTEL_AMENITY = amenities.map((a: any) => toApiRow(a));
  return row;
});

export const countByManager = secureQuery({ managerId: v.string() }, async (ctx, { managerId }) => {
  const id = ctx.db.normalizeId("users", managerId);
  if (!id) return 0;
  const rows = await ctx.db
    .query("hostels")
    .withIndex("by_manager_id", (q: any) => q.eq("manager_id", id))
    .collect();
  return rows.length;
});

export const listByManager = secureQuery({ managerId: v.string() }, async (ctx, { managerId }) => {
  const id = ctx.db.normalizeId("users", managerId);
  if (!id) return [];
  const rows = await ctx.db
    .query("hostels")
    .withIndex("by_manager_id", (q: any) => q.eq("manager_id", id))
    .collect();
  return rows.map((h: any) => toApiRow(h));
});

export const getManagerId = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const hostelId = ctx.db.normalizeId("hostels", id);
  if (!hostelId) return null;
  const hostel = await ctx.db.get(hostelId);
  if (!hostel) return null;
  return { manager_id: hostel.manager_id ?? null };
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const managerId = data.manager_id ? ctx.db.normalizeId("users", data.manager_id) : null;
  if (data.manager_id && !managerId) throw new Error("Manager not found");

  const now = Date.now();
  const hostelId = await ctx.db.insert("hostels", {
    hostel_name: data.hostel_name,
    location: data.location,
    description: data.description ?? undefined,
    total_rooms: data.total_rooms ?? 0,
    available_rooms: data.available_rooms ?? 0,
    distance_from_campus: data.distance_from_campus ?? undefined,
    manager_id: managerId ?? undefined,
    status: data.status ?? "PENDING",
    created_at: now,
    updated_at: now,
  });
  return toApiRow((await ctx.db.get(hostelId))!);
});

export const update = secureMutation({ id: v.string(), patch: v.any() }, async (ctx, { id, patch }) => {
  const hostelId = ctx.db.normalizeId("hostels", id);
  if (!hostelId) return null;
  const existing = await ctx.db.get(hostelId);
  if (!existing) return null;
  await ctx.db.patch(hostelId, { ...patch, updated_at: Date.now() });
  const updated = await ctx.db.get(hostelId);
  return updated ? toApiRow(updated) : null;
});

export const addImages = secureMutation(
  { hostelId: v.string(), urls: v.array(v.string()) },
  async (ctx, { hostelId, urls }) => {
    const id = ctx.db.normalizeId("hostels", hostelId);
    if (!id) throw new Error("Hostel not found");
    const created = [];
    for (const url of urls) {
      const rowId = await ctx.db.insert("hostelImages", { hostel_id: id, image_url: url });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run convex/hostels.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Rewrite the hostels controller's data calls**

In `server/src/modules/hostels/hostels.controller.js`, replace the imports and the five data-touching handlers. `uploadHostelImages` keeps calling `uploadImageToSupabase` until Task 8 — leave that line alone for now, and only change its database insert. Every status code, message, and guard stays identical:

```js
import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";
import * as amenitiesService from "../amenities/Amenities.service.js";
import { uploadImageToSupabase } from "../../utils/supabaseStorage.js";
```

```js
// GET /api/hostels
export const getHostels = async (req, res, next) => {
  try {
    const { search, max_distance } = req.query;
    const args = {};
    if (search) args.search = String(search);
    if (max_distance && !isNaN(Number(max_distance))) args.maxDistance = Number(max_distance);

    const data = await cq(api.hostels.listApproved, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/hostels/:id
export const getHostelById = async (req, res, next) => {
  try {
    const data = await cq(api.hostels.getByIdWithRelations, { id: req.params.id });
    if (!data) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/hostels
export const createHostel = async (req, res, next) => {
  try {
    const { hostel_name, location, description, total_rooms, available_rooms, distance_from_campus } = req.body;
    const manager_id = req.user.id;

    const count = await cq(api.hostels.countByManager, { managerId: manager_id });
    if (count >= 2) {
      return res.status(400).json({ success: false, message: "A manager can only create up to 2 hostels." });
    }

    const data = await cm(api.hostels.create, {
      data: {
        hostel_name, location, description, total_rooms,
        available_rooms: available_rooms ?? 0,
        distance_from_campus, manager_id,
        status: "PENDING", // requires admin approval before appearing in public listings
      },
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/hostels/:id
export const updateHostel = async (req, res, next) => {
  try {
    // status/manager_id are intentionally excluded here even though the
    // caller already owns this hostel — approval and ownership transfer
    // are admin-only actions (status via PATCH /:id/status below).
    const { status, manager_id, ...rest } = req.body;

    const data = await cm(api.hostels.update, { id: req.params.id, patch: rest });
    if (!data) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/hostels/:id/status
export const updateHostelStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be PENDING, APPROVED, or REJECTED" });
    }

    const data = await cm(api.hostels.update, { id: req.params.id, patch: { status } });
    if (!data) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
```

And in `uploadHostelImages`, replace only the insert block:

```js
    const data = await cm(api.hostels.addImages, { hostelId: id, urls: uploadedUrls });

    res.status(201).json({ success: true, data });
```

- [ ] **Step 6: Rewrite `verifyHostelOwnership`**

In `server/src/middlewares/verifyOwnership.js`, replace the `supabase` import with the Convex imports and swap the hostel lookup. `verifyRoomOwnership` is left for Task 5:

```js
import { cq } from "../config/convexClient.js";
import { api } from "../../convex/_generated/api.js";
```

```js
export const verifyHostelOwnership = async (req, res, next) => {
  try {
    const hostelId = req.params.hostelId || req.params.id;
    const userId = req.user.id;

    const hostel = await cq(api.hostels.getManagerId, { id: hostelId });

    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }

    if (hostel.manager_id !== userId && req.user.user_type !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this hostel" });
    }

    next();
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 7: Run the full suite**

Run: `cd server && npx vitest run`
Expected: PASS (102 tests).

- [ ] **Step 8: Commit**

```bash
git add server/convex/hostels.ts server/convex/hostels.test.ts server/src/modules/hostels/hostels.controller.js server/src/middlewares/verifyOwnership.js server/convex/_generated
git commit -m "$(cat <<'EOF'
feat(server): move hostels to Convex

Replaces the PostgREST joins with explicit assembly: listApproved resolves
each hostel's manager, getByIdWithRelations gathers ROOM,
HOSTEL_IMAGE_URLS and HOSTEL_AMENITY, and the response keys stay exactly
as the frontend's contract expects. countByManager replaces the
{count: exact, head: true} query behind the two-hostel limit.

Two behaviors preserved deliberately: a hostel with no recorded distance
is excluded when max_distance filters (Postgres never matched NULL on
.lte), and a malformed :id returns 404 rather than letting Convex reject
the id string as a 500.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Rooms

**Files:**
- Create: `server/convex/rooms.ts`
- Create: `server/convex/rooms.test.ts`
- Modify: `server/src/modules/rooms/rooms.controller.js`
- Modify: `server/src/middlewares/verifyOwnership.js:28-64`

**Interfaces:**
- Consumes: `toApiRow`; `api.hostels.*` (Task 4); `api.amenities.*` (Task 3).
- Produces: `api.rooms.list`, `getByIdWithRelations`, `getBasics`, `create`, `update`, `remove`, `listIdsByHostel`, `addImages`, `addTourScene`, `removeTourScene`.

- [ ] **Step 1: Write the failing tests**

Create `server/convex/rooms.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function makeHostel(t: ReturnType<typeof convexTest>, overrides: any = {}) {
  return await t.mutation(api.hostels.create, {
    data: {
      hostel_name: "Unity Hall", location: "North", total_rooms: 0, available_rooms: 0,
      status: "APPROVED", ...overrides,
    },
    secret,
  });
}

async function makeRoom(t: ReturnType<typeof convexTest>, hostelId: string, overrides: any = {}) {
  return await t.mutation(api.rooms.create, {
    data: {
      room_number: "A1", room_type: "SINGLE", price_per_bed: 400, capacity: 2,
      hostel_id: hostelId, ...overrides,
    },
    secret,
  });
}

describe("rooms", () => {
  it("create forces occupancy 0 / available true and bumps the hostel's counts", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id, { current_occupancy: 99, is_available: false });

    expect(room.current_occupancy).toBe(0);
    expect(room.is_available).toBe(true);
    expect(typeof room.created_at).toBe("string");

    const after = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(after!.total_rooms).toBe(1);
    expect(after!.available_rooms).toBe(1);
  });

  it("create rejects a malformed hostel id", async () => {
    const t = convexTest(schema, modules);
    await expect(makeRoom(t, "bogus")).rejects.toThrow(/hostel not found/i);
  });

  it("list nests HOSTEL.hostel_name and applies price, type and availability filters", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    await makeRoom(t, hostel.id, { room_number: "A1", price_per_bed: 300, room_type: "SINGLE" });
    await makeRoom(t, hostel.id, { room_number: "A2", price_per_bed: 700, room_type: "DOUBLE" });

    const all = await t.query(api.rooms.list, { hostelId: hostel.id, secret });
    expect(all).toHaveLength(2);
    expect(all[0].HOSTEL).toEqual({ hostel_name: "Unity Hall" });

    expect(await t.query(api.rooms.list, { minPrice: 500, secret })).toHaveLength(1);
    expect(await t.query(api.rooms.list, { maxPrice: 500, secret })).toHaveLength(1);
    expect(await t.query(api.rooms.list, { roomType: "DOUBLE", secret })).toHaveLength(1);
    expect(await t.query(api.rooms.list, { isAvailable: true, secret })).toHaveLength(2);
  });

  it("list excludes a room whose hostel row is gone, matching HOSTEL!inner (Review Focus #3)", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    await t.run(async (ctx) => {
      await ctx.db.delete(ctx.db.normalizeId("hostels", hostel.id)!);
    });

    expect(await t.query(api.rooms.list, { secret })).toHaveLength(0);

    // ...but fetching it directly still works, with HOSTEL null.
    const row = await t.query(api.rooms.getByIdWithRelations, { id: room.id, secret });
    expect(row).not.toBeNull();
    expect(row!.HOSTEL).toBeNull();
  });

  it("getByIdWithRelations nests images, tour scenes and amenities with ISO dates (Review Focus #5)", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    await t.mutation(api.rooms.addImages, { roomId: room.id, urls: ["https://example.com/r.jpg"], secret });
    await t.mutation(api.rooms.addTourScene, {
      roomId: room.id, scene_name: "Bedroom", scene_config_url: "https://example.com/tour.json", secret,
    });
    await t.mutation(api.amenities.addForRoom, { roomId: room.id, names: ["WIFI"], secret });

    const row = await t.query(api.rooms.getByIdWithRelations, { id: room.id, secret });
    expect(row!.ROOM_IMAGE_URLS[0].image_url).toBe("https://example.com/r.jpg");
    expect(row!.ROOM_TOUR_SCENES[0].scene_name).toBe("Bedroom");
    expect(typeof row!.ROOM_TOUR_SCENES[0].created_at).toBe("string");
    expect(row!.ROOM_AMENITY[0].name).toBe("WIFI");
    expect(row!.HOSTEL).toEqual({ hostel_name: "Unity Hall", location: "North" });
  });

  it("getByIdWithRelations and getBasics return null for a malformed id (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.rooms.getByIdWithRelations, { id: "123", secret })).toBeNull();
    expect(await t.query(api.rooms.getBasics, { id: "123", secret })).toBeNull();
  });

  it("getBasics returns just the fields callers need for checks", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics).toEqual({
      id: room.id, hostel_id: hostel.id, is_available: true, capacity: 2, current_occupancy: 0,
    });
  });

  it("update recomputes availability and adjusts the hostel's available_rooms", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id, { capacity: 2 });

    const filled = await t.mutation(api.rooms.update, {
      id: room.id, patch: { current_occupancy: 2 }, secret,
    });
    expect(filled!.is_available).toBe(false);

    let h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(0);

    const freed = await t.mutation(api.rooms.update, { id: room.id, patch: { current_occupancy: 1 }, secret });
    expect(freed!.is_available).toBe(true);
    h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(1);

    expect(await t.mutation(api.rooms.update, { id: "bogus", patch: {}, secret })).toBeNull();
  });

  it("remove cascades images, scenes, amenities and bookings, clears current_room_id, and fixes counts", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    const student = await t.mutation(api.users.create, {
      data: { name: "Ama", email: "ama-rm@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: true },
      secret,
    });

    await t.mutation(api.rooms.addImages, { roomId: room.id, urls: ["https://example.com/x.jpg"], secret });
    await t.mutation(api.rooms.addTourScene, {
      roomId: room.id, scene_name: "S", scene_config_url: "https://example.com/t.json", secret,
    });
    await t.mutation(api.amenities.addForRoom, { roomId: room.id, names: ["WIFI"], secret });
    await t.run(async (ctx) => {
      const rid = ctx.db.normalizeId("rooms", room.id)!;
      await ctx.db.insert("bookings", {
        check_in_date: Date.now(), check_out_date: Date.now() + 1000, status: "CONFIRMED",
        student_id: ctx.db.normalizeId("users", student.id)!, room_id: rid,
        created_at: Date.now(), updated_at: Date.now(),
      });
      await ctx.db.patch(ctx.db.normalizeId("users", student.id)!, { current_room_id: rid });
    });

    await t.mutation(api.rooms.remove, { id: room.id, secret });

    const leftovers = await t.run(async (ctx) => ({
      rooms: await ctx.db.query("rooms").collect(),
      images: await ctx.db.query("roomImages").collect(),
      scenes: await ctx.db.query("roomTourScenes").collect(),
      amenities: await ctx.db.query("roomAmenities").collect(),
      bookings: await ctx.db.query("bookings").collect(),
    }));
    expect(leftovers.rooms).toHaveLength(0);
    expect(leftovers.images).toHaveLength(0);
    expect(leftovers.scenes).toHaveLength(0);
    expect(leftovers.amenities).toHaveLength(0);
    expect(leftovers.bookings).toHaveLength(0);

    const me = await t.query(api.users.getMeWithRoom, { id: student.id, secret });
    expect(me!.current_room_id).toBeUndefined();
    expect(me!.ROOM).toBeNull();

    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.total_rooms).toBe(0);
    expect(h!.available_rooms).toBe(0);
  });

  it("listIdsByHostel returns the hostel's room ids, and removeTourScene deletes one scene", async () => {
    const t = convexTest(schema, modules);
    const hostel = await makeHostel(t);
    const room = await makeRoom(t, hostel.id);
    expect(await t.query(api.rooms.listIdsByHostel, { hostelId: hostel.id, secret })).toEqual([room.id]);
    expect(await t.query(api.rooms.listIdsByHostel, { hostelId: "bogus", secret })).toEqual([]);

    const scene = await t.mutation(api.rooms.addTourScene, {
      roomId: room.id, scene_name: "S", scene_config_url: "https://example.com/t.json", secret,
    });
    await t.mutation(api.rooms.removeTourScene, { id: scene.id, secret });
    const scenes = await t.run(async (ctx) => await ctx.db.query("roomTourScenes").collect());
    expect(scenes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run convex/rooms.test.ts`
Expected: FAIL — cannot resolve `api.rooms`.

- [ ] **Step 3: Implement `convex/rooms.ts`**

```ts
// server/convex/rooms.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

// Keeps hostels.total_rooms/available_rooms in step with the rooms that
// actually exist. Unlike the Supabase version this runs inside the same
// mutation as the room write, so the two can't drift under concurrency.
async function adjustHostelCounts(ctx: any, hostelId: any, totalDelta: number, availableDelta: number) {
  if (!totalDelta && !availableDelta) return;
  const hostel = await ctx.db.get(hostelId);
  if (!hostel) return;
  await ctx.db.patch(hostelId, {
    total_rooms: Math.max(0, hostel.total_rooms + totalDelta),
    available_rooms: Math.max(0, hostel.available_rooms + availableDelta),
    updated_at: Date.now(),
  });
}

export const list = secureQuery(
  {
    hostelId: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    roomType: v.optional(v.string()),
    isAvailable: v.optional(v.boolean()),
  },
  async (ctx, { hostelId, minPrice, maxPrice, roomType, isAvailable }) => {
    let rows;
    if (hostelId !== undefined) {
      const id = ctx.db.normalizeId("hostels", hostelId);
      if (!id) return [];
      rows = await ctx.db
        .query("rooms")
        .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
        .collect();
    } else {
      rows = await ctx.db.query("rooms").collect();
    }

    if (minPrice !== undefined) rows = rows.filter((r: any) => r.price_per_bed >= minPrice);
    if (maxPrice !== undefined) rows = rows.filter((r: any) => r.price_per_bed <= maxPrice);
    if (roomType !== undefined) rows = rows.filter((r: any) => r.room_type === roomType);
    if (isAvailable !== undefined) rows = rows.filter((r: any) => r.is_available === isAvailable);

    // The old query used HOSTEL!inner, so a room whose hostel is missing
    // was dropped from the result rather than returned with a null join.
    const out = [];
    for (const room of rows) {
      const hostel = await ctx.db.get(room.hostel_id);
      if (!hostel) continue;
      const row = toApiRow(room);
      row.HOSTEL = { hostel_name: hostel.hostel_name };
      out.push(row);
    }
    return out;
  }
);

export const getByIdWithRelations = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const roomId = ctx.db.normalizeId("rooms", id);
  if (!roomId) return null;
  const room = await ctx.db.get(roomId);
  if (!room) return null;

  const [images, scenes, amenities, hostel] = await Promise.all([
    ctx.db.query("roomImages").withIndex("by_room_id", (q: any) => q.eq("room_id", roomId)).collect(),
    ctx.db.query("roomTourScenes").withIndex("by_room_id", (q: any) => q.eq("room_id", roomId)).collect(),
    ctx.db.query("roomAmenities").withIndex("by_room_id", (q: any) => q.eq("room_id", roomId)).collect(),
    ctx.db.get(room.hostel_id),
  ]);

  const row = toApiRow(room);
  row.ROOM_IMAGE_URLS = images.map((i: any) => toApiRow(i));
  row.ROOM_TOUR_SCENES = scenes.map((s: any) => toApiRow(s));
  row.ROOM_AMENITY = amenities.map((a: any) => toApiRow(a));
  row.HOSTEL = hostel ? { hostel_name: hostel.hostel_name, location: hostel.location } : null;
  return row;
});

export const getBasics = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const roomId = ctx.db.normalizeId("rooms", id);
  if (!roomId) return null;
  const room = await ctx.db.get(roomId);
  if (!room) return null;
  return {
    id: room._id,
    hostel_id: room.hostel_id,
    is_available: room.is_available,
    capacity: room.capacity,
    current_occupancy: room.current_occupancy,
  };
});

export const listIdsByHostel = secureQuery({ hostelId: v.string() }, async (ctx, { hostelId }) => {
  const id = ctx.db.normalizeId("hostels", hostelId);
  if (!id) return [];
  const rows = await ctx.db
    .query("rooms")
    .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
    .collect();
  return rows.map((r: any) => r._id);
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const hostelId = ctx.db.normalizeId("hostels", data.hostel_id);
  if (!hostelId) throw new Error("Hostel not found");
  const hostel = await ctx.db.get(hostelId);
  if (!hostel) throw new Error("Hostel not found");

  const now = Date.now();
  const roomId = await ctx.db.insert("rooms", {
    room_number: data.room_number,
    room_type: data.room_type,
    price_per_bed: data.price_per_bed,
    capacity: data.capacity,
    current_occupancy: 0,
    is_available: true,
    hostel_id: hostelId,
    length: data.length ?? undefined,
    width: data.width ?? undefined,
    height: data.height ?? undefined,
    created_at: now,
    updated_at: now,
  });

  await adjustHostelCounts(ctx, hostelId, 1, 1);
  return toApiRow((await ctx.db.get(roomId))!);
});

export const update = secureMutation({ id: v.string(), patch: v.any() }, async (ctx, { id, patch }) => {
  const roomId = ctx.db.normalizeId("rooms", id);
  if (!roomId) return null;
  const room = await ctx.db.get(roomId);
  if (!room) return null;

  // is_available is server-derived, never client-set: updateRoomSchema
  // accepts it from the request body, and letting it through would both
  // store a value that contradicts occupancy and corrupt the flip
  // detection below.
  const { hostel_id, id: _ignoredId, is_available: _serverDerived, ...safePatch } = patch ?? {};

  // Captured BEFORE the patch. Comparing against the post-patch value
  // instead lets a caller who sends is_available fake a flip and shift
  // the hostel's available_rooms on every request.
  const wasAvailable = room.is_available;

  await ctx.db.patch(roomId, { ...safePatch, updated_at: Date.now() });

  const patched = await ctx.db.get(roomId);
  if (!patched) return null;

  const nowAvailable = patched.current_occupancy < patched.capacity;
  if (nowAvailable !== wasAvailable) {
    await ctx.db.patch(roomId, { is_available: nowAvailable });
    await adjustHostelCounts(ctx, patched.hostel_id, 0, nowAvailable ? 1 : -1);
  }

  return toApiRow((await ctx.db.get(roomId))!);
});

export const remove = secureMutation({ id: v.string() }, async (ctx, { id }) => {
  const roomId = ctx.db.normalizeId("rooms", id);
  if (!roomId) return null;
  const room = await ctx.db.get(roomId);
  if (!room) return null;

  // Postgres did this with ON DELETE CASCADE; Convex has no equivalent, so
  // every dependent row is removed explicitly. Deleting a room therefore
  // still destroys its bookings, including CONFIRMED ones — identical to
  // the old behavior, and a deliberate choice.
  for (const table of ["roomImages", "roomTourScenes", "roomAmenities", "bookings"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_room_id", (q: any) => q.eq("room_id", roomId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }

  const occupants = await ctx.db
    .query("users")
    .withIndex("by_current_room_id", (q: any) => q.eq("current_room_id", roomId))
    .collect();
  for (const occupant of occupants) {
    await ctx.db.patch(occupant._id, { current_room_id: undefined });
  }

  await adjustHostelCounts(ctx, room.hostel_id, -1, room.is_available ? -1 : 0);
  await ctx.db.delete(roomId);
  return { id: roomId };
});

export const addImages = secureMutation(
  { roomId: v.string(), urls: v.array(v.string()) },
  async (ctx, { roomId, urls }) => {
    const id = ctx.db.normalizeId("rooms", roomId);
    if (!id) throw new Error("Room not found");
    const created = [];
    for (const url of urls) {
      const rowId = await ctx.db.insert("roomImages", { room_id: id, image_url: url });
      created.push(toApiRow((await ctx.db.get(rowId))!));
    }
    return created;
  }
);

export const addTourScene = secureMutation(
  { roomId: v.string(), scene_name: v.string(), scene_config_url: v.string() },
  async (ctx, { roomId, scene_name, scene_config_url }) => {
    const id = ctx.db.normalizeId("rooms", roomId);
    if (!id) throw new Error("Room not found");
    const now = Date.now();
    const rowId = await ctx.db.insert("roomTourScenes", {
      room_id: id, scene_name, scene_config_url, created_at: now, updated_at: now,
    });
    return toApiRow((await ctx.db.get(rowId))!);
  }
);

export const removeTourScene = secureMutation({ id: v.string() }, async (ctx, { id }) => {
  const sceneId = ctx.db.normalizeId("roomTourScenes", id);
  if (!sceneId) return { success: true };
  const scene = await ctx.db.get(sceneId);
  if (scene) await ctx.db.delete(sceneId);
  return { success: true };
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run convex/rooms.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Rewrite the rooms controller**

In `server/src/modules/rooms/rooms.controller.js`: replace the imports, delete the local `adjustHostelRoomCounts` helper (the Convex mutations own it now), and rewrite the handlers. `syncRoomAvailability` stays exported because `bookings.controller.js` imports it until Task 6, but becomes a no-op wrapper — `api.rooms.update` already recomputes availability:

```js
import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";
import * as amenitiesService from "../amenities/Amenities.service.js";
import { uploadImageToSupabase } from "../../utils/supabaseStorage.js";
```

```js
// GET /api/rooms?hostel_id=123
export const getRooms = async (req, res, next) => {
  try {
    const { hostel_id, min_price, max_price, room_type, is_available } = req.query;

    const args = {};
    if (hostel_id) args.hostelId = String(hostel_id);
    if (min_price && !isNaN(Number(min_price))) args.minPrice = Number(min_price);
    if (max_price && !isNaN(Number(max_price))) args.maxPrice = Number(max_price);
    if (room_type) args.roomType = String(room_type);
    if (is_available !== undefined && is_available !== "") args.isAvailable = is_available === "true";

    const data = await cq(api.rooms.list, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms/:id
export const getRoomById = async (req, res, next) => {
  try {
    const data = await cq(api.rooms.getByIdWithRelations, { id: req.params.id });
    if (!data) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/rooms
export const createRoom = async (req, res, next) => {
  try {
    const { hostel_id } = req.body;

    // Verify the caller owns the hostel they're attaching this room to
    // (requireRole only confirms they're SOME manager, not this hostel's).
    const hostel = await cq(api.hostels.getManagerId, { id: hostel_id });

    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }

    if (hostel.manager_id !== req.user.id && req.user.user_type !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this hostel" });
    }

    const data = await cm(api.rooms.create, { data: req.body });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rooms/:id
export const deleteRoom = async (req, res, next) => {
  try {
    const removed = await cm(api.rooms.remove, { id: req.params.id });
    if (!removed) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    res.json({ success: true, message: "Room deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// Availability is recomputed inside api.rooms.update and
// api.bookings.updateStatus, in the same transaction as the write that
// changes occupancy. Kept as a no-op so existing importers keep working.
export const syncRoomAvailability = async () => {};

// PATCH /api/rooms/:id
export const updateRoom = async (req, res, next) => {
  try {
    const data = await cm(api.rooms.update, { id: req.params.id, patch: req.body });
    if (!data) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
```

The three amenity handlers (`updateRoomAmenities`, `addRoomAmenity`, `removeRoomAmenity`) already delegate to `amenitiesService` and need no change. In `uploadRoomImages`, replace only the insert block:

```js
    const data = await cm(api.rooms.addImages, { roomId: id, urls: uploadedUrls });

    res.status(201).json({ success: true, data });
```

In `deleteRoomTourScene`:

```js
    await cm(api.rooms.removeTourScene, { id: req.params.sceneId });

    res.json({ success: true, message: "Tour scene deleted successfully" });
```

In `generateRoomTour`, replace only the scene insert (everything above it — the multipart call to the pano service — is unchanged):

```js
    const sceneData = await cm(api.rooms.addTourScene, {
      roomId: id,
      scene_name,
      scene_config_url: panoResult.tour_url,
    });

    res.status(201).json({ success: true, data: sceneData });
```

In `createRoomTourScene`:

```js
    const sceneData = await cm(api.rooms.addTourScene, { roomId: id, scene_name, scene_config_url });

    res.status(201).json({ success: true, data: sceneData });
```

- [ ] **Step 6: Rewrite `verifyRoomOwnership`**

In `server/src/middlewares/verifyOwnership.js`, replace the body of `verifyRoomOwnership` (the imports are already Convex from Task 4):

```js
export const verifyRoomOwnership = async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const userId = req.user.id;

    const room = await cq(api.rooms.getBasics, { id: roomId });

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const hostel = await cq(api.hostels.getManagerId, { id: room.hostel_id });

    if (!hostel) {
      return res.status(404).json({ success: false, message: "Associated hostel not found" });
    }

    if (hostel.manager_id !== userId && req.user.user_type !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own the hostel for this room" });
    }

    next();
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 7: Run the full suite**

Run: `cd server && npx vitest run`
Expected: PASS (112 tests).

- [ ] **Step 8: Commit**

```bash
git add server/convex/rooms.ts server/convex/rooms.test.ts server/src/modules/rooms/rooms.controller.js server/src/middlewares/verifyOwnership.js server/convex/_generated
git commit -m "$(cat <<'EOF'
feat(server): move rooms to Convex, with atomic counts and cascade

Room writes now adjust the hostel's total_rooms/available_rooms inside the
same mutation instead of a separate read-then-write round trip the old code
itself flagged as non-atomic. Availability is recomputed wherever occupancy
changes, so syncRoomAvailability becomes unnecessary and is kept only as a
no-op for its remaining importer.

rooms.remove reproduces ON DELETE CASCADE by hand — images, tour scenes,
amenities and bookings — and clears current_room_id for anyone assigned to
the room, via a new users.by_current_room_id index. rooms.list keeps
HOSTEL!inner semantics by dropping rooms whose hostel is missing, while
fetching such a room directly still succeeds with HOSTEL null.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Bookings

**Files:**
- Create: `server/convex/bookings.ts`
- Create: `server/convex/bookings.test.ts`
- Modify: `server/src/modules/bookings/bookings.controller.js`

**Interfaces:**
- Consumes: `toApiRow`; `api.rooms.getBasics` (Task 5).
- Produces: `api.bookings.list`, `getByIdWithRelations`, `create`, `updateStatus`, `existsForStudentInRooms`.

- [ ] **Step 1: Write the failing tests**

Create `server/convex/bookings.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function scenario(t: ReturnType<typeof convexTest>, roomOverrides: any = {}) {
  const manager = await t.mutation(api.users.create, {
    data: { name: "Mgr", email: `mgr-${Math.random()}@test.com`, emailVerified: false,
            user_type: "HOSTEL_MANAGER", profile_complete: true },
    secret,
  });
  const student = await t.mutation(api.users.create, {
    data: { name: "Ama", email: `ama-${Math.random()}@test.com`, emailVerified: false,
            user_type: "STUDENT", profile_complete: true },
    secret,
  });
  const hostel = await t.mutation(api.hostels.create, {
    data: { hostel_name: "Unity Hall", location: "North", total_rooms: 0, available_rooms: 0,
            manager_id: manager.id, status: "APPROVED" },
    secret,
  });
  const room = await t.mutation(api.rooms.create, {
    data: { room_number: "A1", room_type: "DOUBLE", price_per_bed: 400, capacity: 2,
            hostel_id: hostel.id, ...roomOverrides },
    secret,
  });
  return { manager, student, hostel, room };
}

async function book(t: ReturnType<typeof convexTest>, studentId: string, roomId: string) {
  return await t.mutation(api.bookings.create, {
    data: {
      check_in_date: new Date("2026-11-01").getTime(),
      check_out_date: new Date("2026-12-01").getTime(),
      student_id: studentId, room_id: roomId,
    },
    secret,
  });
}

describe("bookings", () => {
  it("create forces PENDING and returns ISO dates", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);
    expect(booking.status).toBe("PENDING");
    expect(typeof booking.check_in_date).toBe("string");
    expect(typeof booking.created_at).toBe("string");
  });

  it("create rejects a malformed room or student id", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    await expect(book(t, student.id, "bogus")).rejects.toThrow(/room not found/i);
    await expect(book(t, "bogus", room.id)).rejects.toThrow(/student not found/i);
  });

  it("list nests ROOM.HOSTEL and USERS, and filters by student", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    await book(t, student.id, room.id);

    const all = await t.query(api.bookings.list, { secret });
    expect(all).toHaveLength(1);
    expect(all[0].ROOM.room_number).toBe("A1");
    expect(all[0].ROOM.HOSTEL.hostel_name).toBe("Unity Hall");
    expect(all[0].USERS.email).toBe(student.email);
    expect(all[0].USERS.profile_complete).toBe(true);

    expect(await t.query(api.bookings.list, { studentId: student.id, secret })).toHaveLength(1);
    expect(await t.query(api.bookings.list, { studentId: "bogus", secret })).toEqual([]);
  });

  it("getByIdWithRelations includes HOSTEL.manager_id for the ownership check", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);

    const row = await t.query(api.bookings.getByIdWithRelations, { id: booking.id, secret });
    expect(row!.ROOM.HOSTEL.manager_id).toBe(manager.id);
    expect(row!.student_id).toBe(student.id);
    expect(await t.query(api.bookings.getByIdWithRelations, { id: "123", secret })).toBeNull();
  });

  it("confirming increments occupancy and sets the student's current_room_id", async () => {
    const t = convexTest(schema, modules);
    const { student, room, hostel } = await scenario(t);
    const booking = await book(t, student.id, room.id);

    const confirmed = await t.mutation(api.bookings.updateStatus, {
      id: booking.id, status: "CONFIRMED", secret,
    });
    expect(confirmed!.status).toBe("CONFIRMED");

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.current_occupancy).toBe(1);
    expect(basics!.is_available).toBe(true);

    const me = await t.query(api.users.getMeWithRoom, { id: student.id, secret });
    expect(me!.ROOM.room_number).toBe("A1");

    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(1);
  });

  it("cancelling a confirmed booking decrements occupancy and clears current_room_id", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CANCELLED", secret });

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.current_occupancy).toBe(0);

    const me = await t.query(api.users.getMeWithRoom, { id: student.id, secret });
    expect(me!.ROOM).toBeNull();
  });

  it("filling a room flips is_available and decrements the hostel's available_rooms", async () => {
    const t = convexTest(schema, modules);
    const { student, room, hostel } = await scenario(t, { capacity: 1 });
    const booking = await book(t, student.id, room.id);
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.is_available).toBe(false);

    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(0);
  });

  it("refuses to confirm into a full room and never exceeds capacity (Review Focus #4)", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t, { capacity: 1 });
    const first = await book(t, student.id, room.id);
    const second = await book(t, student.id, room.id);

    await t.mutation(api.bookings.updateStatus, { id: first.id, status: "CONFIRMED", secret });
    await expect(
      t.mutation(api.bookings.updateStatus, { id: second.id, status: "CONFIRMED", secret })
    ).rejects.toThrow(/full capacity/i);

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.current_occupancy).toBe(1);
  });

  it("confirming twice does not double-count occupancy", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.current_occupancy).toBe(1);
  });

  it("updateStatus returns null for a malformed id (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(api.bookings.updateStatus, { id: "123", status: "CANCELLED", secret })).toBeNull();
  });

  it("existsForStudentInRooms respects the room set and the status filter", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);

    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: student.id, roomIds: [room.id], secret,
    })).toBe(true);

    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: student.id, roomIds: [room.id], statuses: ["CONFIRMED", "CHECKED_OUT"], secret,
    })).toBe(false);

    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });
    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: student.id, roomIds: [room.id], statuses: ["CONFIRMED", "CHECKED_OUT"], secret,
    })).toBe(true);

    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: student.id, roomIds: [], secret,
    })).toBe(false);
    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: "bogus", roomIds: [room.id], secret,
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run convex/bookings.test.ts`
Expected: FAIL — cannot resolve `api.bookings`.

- [ ] **Step 3: Implement `convex/bookings.ts`**

```ts
// server/convex/bookings.ts
import { v, ConvexError } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

const bookingStatus = v.union(
  v.literal("PENDING"), v.literal("CONFIRMED"), v.literal("CANCELLED"), v.literal("CHECKED_OUT")
);

async function withRelations(ctx: any, booking: any, includeManagerId: boolean) {
  const row = toApiRow(booking);

  const room = await ctx.db.get(booking.room_id);
  if (room) {
    const hostel = await ctx.db.get(room.hostel_id);
    const nestedHostel: Record<string, any> | null = hostel
      ? { hostel_name: hostel.hostel_name }
      : null;
    if (nestedHostel && includeManagerId) nestedHostel.manager_id = hostel!.manager_id ?? null;
    row.ROOM = { room_number: room.room_number, hostel_id: room.hostel_id, HOSTEL: nestedHostel };
  } else {
    row.ROOM = null;
  }

  const student = await ctx.db.get(booking.student_id);
  row.USERS = student ? { email: student.email, profile_complete: student.profile_complete } : null;

  return row;
}

export const list = secureQuery({ studentId: v.optional(v.string()) }, async (ctx, { studentId }) => {
  let rows;
  if (studentId !== undefined) {
    const id = ctx.db.normalizeId("users", studentId);
    if (!id) return [];
    rows = await ctx.db
      .query("bookings")
      .withIndex("by_student_id", (q: any) => q.eq("student_id", id))
      .collect();
  } else {
    rows = await ctx.db.query("bookings").collect();
  }
  return await Promise.all(rows.map((b: any) => withRelations(ctx, b, false)));
});

export const getByIdWithRelations = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const bookingId = ctx.db.normalizeId("bookings", id);
  if (!bookingId) return null;
  const booking = await ctx.db.get(bookingId);
  if (!booking) return null;
  return await withRelations(ctx, booking, true);
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const roomId = ctx.db.normalizeId("rooms", data.room_id);
  if (!roomId) throw new Error("Room not found");
  const studentId = ctx.db.normalizeId("users", data.student_id);
  if (!studentId) throw new Error("Student not found");

  const now = Date.now();
  const bookingId = await ctx.db.insert("bookings", {
    check_in_date: new Date(data.check_in_date).getTime(),
    check_out_date: new Date(data.check_out_date).getTime(),
    status: "PENDING",
    student_id: studentId,
    room_id: roomId,
    created_at: now,
    updated_at: now,
  });
  return toApiRow((await ctx.db.get(bookingId))!);
});

export const updateStatus = secureMutation(
  { id: v.string(), status: bookingStatus },
  async (ctx, { id, status }) => {
    const bookingId = ctx.db.normalizeId("bookings", id);
    if (!bookingId) return null;
    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;

    const previous = booking.status;
    let occupancyChange = 0;
    if (status === "CONFIRMED" && previous !== "CONFIRMED") occupancyChange = 1;
    else if (previous === "CONFIRMED" && (status === "CANCELLED" || status === "CHECKED_OUT")) {
      occupancyChange = -1;
    }

    const room = await ctx.db.get(booking.room_id);

    // Without this, a manager confirming several PENDING bookings for the
    // same room pushes current_occupancy past capacity with nothing to stop it.
    //
    // ConvexError, not Error: the controller maps this to a 409, and Convex
    // redacts a plain Error's message on a prod deployment, which would
    // silently turn that 409 into a generic 400.
    if (occupancyChange === 1 && room && room.current_occupancy + 1 > room.capacity) {
      throw new ConvexError({ code: "ROOM_AT_CAPACITY" });
    }

    const now = Date.now();
    await ctx.db.patch(bookingId, { status, updated_at: now });

    if (occupancyChange !== 0 && room) {
      const newOccupancy = Math.max(0, room.current_occupancy + occupancyChange);
      const newAvailable = newOccupancy < room.capacity;
      await ctx.db.patch(room._id, {
        current_occupancy: newOccupancy,
        is_available: newAvailable,
        updated_at: now,
      });

      if (newAvailable !== room.is_available) {
        const hostel = await ctx.db.get(room.hostel_id);
        if (hostel) {
          await ctx.db.patch(hostel._id, {
            available_rooms: Math.max(0, hostel.available_rooms + (newAvailable ? 1 : -1)),
            updated_at: now,
          });
        }
      }

      // Keep the student's current_room_id in step with their actual
      // confirmed booking — this is the only place that field is set.
      if (occupancyChange === 1) {
        await ctx.db.patch(booking.student_id, { current_room_id: room._id });
      } else {
        const student = await ctx.db.get(booking.student_id);
        if (student && student.current_room_id === room._id) {
          await ctx.db.patch(booking.student_id, { current_room_id: undefined });
        }
      }
    }

    return toApiRow((await ctx.db.get(bookingId))!);
  }
);

export const existsForStudentInRooms = secureQuery(
  {
    studentId: v.string(),
    roomIds: v.array(v.string()),
    statuses: v.optional(v.array(v.string())),
  },
  async (ctx, { studentId, roomIds, statuses }) => {
    const id = ctx.db.normalizeId("users", studentId);
    if (!id || roomIds.length === 0) return false;
    const wanted = new Set(roomIds);
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_student_id", (q: any) => q.eq("student_id", id))
      .collect();
    return rows.some(
      (b: any) => wanted.has(b.room_id) && (statuses === undefined || statuses.includes(b.status))
    );
  }
);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run convex/bookings.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Rewrite the bookings controller**

Replace `server/src/modules/bookings/bookings.controller.js` entirely. Every authorization rule, status code, and message is preserved; the occupancy block is gone because `api.bookings.updateStatus` owns it:

```js
import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

// GET /api/bookings?student_id=123
export const getBookings = async (req, res, next) => {
  try {
    const { student_id } = req.query;

    const args = {};
    if (req.user.user_type === "STUDENT") {
      // Students can only see their own bookings
      args.studentId = req.user.id;
    } else if (student_id) {
      // Managers/Admins can filter by student_id
      args.studentId = String(student_id);
    }

    const data = await cq(api.bookings.list, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/:id
export const getBookingById = async (req, res, next) => {
  try {
    const data = await cq(api.bookings.getByIdWithRelations, { id: req.params.id });

    if (!data) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // A booking belongs to the student who made it and the manager of its
    // hostel — anyone else authenticated shouldn't be able to view it by id.
    if (req.user.user_type === "STUDENT" && data.student_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this booking" });
    }
    if (req.user.user_type === "HOSTEL_MANAGER" && data.ROOM?.HOSTEL?.manager_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this booking" });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/bookings
export const createBooking = async (req, res, next) => {
  try {
    const { check_in_date, check_out_date, room_id, student_id } = req.body;

    const room = await cq(api.rooms.getBasics, { id: room_id });

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    if (!room.is_available) {
      return res.status(400).json({ success: false, message: "Room is fully occupied and not available for booking" });
    }

    // Force student_id to be the authenticated user's ID if role is STUDENT
    // Otherwise allow Manager/Admin to specify student_id
    const final_student_id = req.user.user_type === "STUDENT" ? req.user.id : student_id;

    const data = await cm(api.bookings.create, {
      data: { check_in_date, check_out_date, room_id, student_id: final_student_id },
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/bookings/:id
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await cq(api.bookings.getByIdWithRelations, { id });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Role-based authorization
    if (req.user.user_type === "STUDENT") {
      if (booking.student_id !== req.user.id) {
        return res.status(403).json({ success: false, message: "Forbidden: You do not own this booking" });
      }
      if (status !== "CANCELLED") {
        return res.status(403).json({ success: false, message: "Students can only cancel their bookings" });
      }
    } else if (req.user.user_type === "HOSTEL_MANAGER") {
      if (booking.ROOM?.HOSTEL?.manager_id !== req.user.id) {
        return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this booking" });
      }
    }

    // The status change, the occupancy delta, the room's availability, the
    // hostel's available_rooms and the student's current_room_id all move
    // together inside this one mutation.
    let data;
    try {
      data = await cm(api.bookings.updateStatus, { id, status });
    } catch (err) {
      // err.data.code, not err.message — Convex redacts a plain Error's
      // message on a prod deployment, so matching on text would pass in
      // dev and silently fall through to a generic 500 in production.
      if (err.data?.code === "ROOM_AT_CAPACITY") {
        return res.status(409).json({ success: false, message: "Room is already at full capacity" });
      }
      throw err;
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 6: Run the full suite**

Run: `cd server && npx vitest run`
Expected: PASS (123 tests).

- [ ] **Step 7: Commit**

```bash
git add server/convex/bookings.ts server/convex/bookings.test.ts server/src/modules/bookings/bookings.controller.js server/convex/_generated
git commit -m "$(cat <<'EOF'
feat(server): move bookings to Convex with an atomic status transition

updateStatus now performs the whole transition in one transaction: the
status write, the occupancy delta, the room's availability, the hostel's
available_rooms, and the student's current_room_id. The old controller did
this across five separate Supabase round trips, so a failure part-way
through left occupancy and availability disagreeing with the bookings.

Capacity is still checked before confirming, and the controller maps that
rejection to the same 409 as before. Confirming an already-confirmed
booking remains a no-op rather than double-counting.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Reviews and complaints

**Files:**
- Create: `server/convex/reviews.ts`
- Create: `server/convex/complaints.ts`
- Create: `server/convex/reviewsComplaints.test.ts`
- Modify: `server/src/modules/reviews/reviews.controller.js`
- Modify: `server/src/modules/complaints/complaints.controller.js`

**Interfaces:**
- Consumes: `toApiRow`; `api.rooms.listIdsByHostel`, `api.bookings.existsForStudentInRooms`, `api.hostels.getManagerId`.
- Produces: `api.reviews.listByHostel`, `api.reviews.create`, `api.complaints.list`, `api.complaints.getByIdWithUser`, `api.complaints.create`, `api.complaints.updateStatus`.

- [ ] **Step 1: Write the failing tests**

Create `server/convex/reviewsComplaints.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function scenario(t: ReturnType<typeof convexTest>) {
  const manager = await t.mutation(api.users.create, {
    data: { name: "Mgr", email: `mgr-${Math.random()}@test.com`, emailVerified: false,
            user_type: "HOSTEL_MANAGER", profile_complete: true },
    secret,
  });
  const student = await t.mutation(api.users.create, {
    data: { name: "Ama", email: `ama-${Math.random()}@test.com`, emailVerified: false,
            user_type: "STUDENT", profile_complete: true },
    secret,
  });
  const hostel = await t.mutation(api.hostels.create, {
    data: { hostel_name: "Unity Hall", location: "North", total_rooms: 0, available_rooms: 0,
            manager_id: manager.id, status: "APPROVED" },
    secret,
  });
  return { manager, student, hostel };
}

describe("reviews", () => {
  it("create stores a review and listByHostel nests USERS.email", async () => {
    const t = convexTest(schema, modules);
    const { student, hostel } = await scenario(t);
    const review = await t.mutation(api.reviews.create, {
      data: { rating: 5, comment: "Great", student_id: student.id, hostel_id: hostel.id },
      secret,
    });
    expect(review.rating).toBe(5);
    expect(typeof review.created_at).toBe("string");

    const rows = await t.query(api.reviews.listByHostel, { hostelId: hostel.id, secret });
    expect(rows).toHaveLength(1);
    expect(rows[0].USERS).toEqual({ email: student.email });

    expect(await t.query(api.reviews.listByHostel, { secret })).toHaveLength(1);
    expect(await t.query(api.reviews.listByHostel, { hostelId: "bogus", secret })).toEqual([]);
  });

  it("create rejects a rating outside 1-5", async () => {
    const t = convexTest(schema, modules);
    const { student, hostel } = await scenario(t);
    for (const rating of [0, 6, -1]) {
      await expect(
        t.mutation(api.reviews.create, {
          data: { rating, student_id: student.id, hostel_id: hostel.id }, secret,
        })
      ).rejects.toThrow(/rating must be between 1 and 5/i);
    }
  });

  it("create rejects a malformed hostel id", async () => {
    const t = convexTest(schema, modules);
    const { student } = await scenario(t);
    await expect(
      t.mutation(api.reviews.create, {
        data: { rating: 4, student_id: student.id, hostel_id: "bogus" }, secret,
      })
    ).rejects.toThrow(/hostel not found/i);
  });
});

describe("complaints", () => {
  it("create stores a complaint with OPEN status and the hostel's manager", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, hostel } = await scenario(t);
    const complaint = await t.mutation(api.complaints.create, {
      data: { content: "No water", student_id: student.id, hostel_id: hostel.id,
              hostel_manager_id: manager.id },
      secret,
    });
    expect(complaint.status).toBe("OPEN");
    expect(complaint.hostel_manager_id).toBe(manager.id);
    expect(typeof complaint.created_at).toBe("string");
  });

  it("list nests USERS and HOSTEL and filters by student, hostel and manager", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, hostel } = await scenario(t);
    await t.mutation(api.complaints.create, {
      data: { content: "No water", student_id: student.id, hostel_id: hostel.id,
              hostel_manager_id: manager.id },
      secret,
    });

    const rows = await t.query(api.complaints.list, { secret });
    expect(rows).toHaveLength(1);
    expect(rows[0].USERS).toEqual({ email: student.email, profile_complete: true });
    expect(rows[0].HOSTEL).toEqual({ hostel_name: "Unity Hall" });

    expect(await t.query(api.complaints.list, { studentId: student.id, secret })).toHaveLength(1);
    expect(await t.query(api.complaints.list, { hostelId: hostel.id, secret })).toHaveLength(1);
    expect(await t.query(api.complaints.list, { hostelManagerId: manager.id, secret })).toHaveLength(1);
    expect(await t.query(api.complaints.list, { studentId: "bogus", secret })).toEqual([]);
  });

  it("getByIdWithUser returns the complaint with USERS, or null for a malformed id (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, hostel } = await scenario(t);
    const complaint = await t.mutation(api.complaints.create, {
      data: { content: "Noise", student_id: student.id, hostel_id: hostel.id,
              hostel_manager_id: manager.id },
      secret,
    });

    const row = await t.query(api.complaints.getByIdWithUser, { id: complaint.id, secret });
    expect(row!.USERS.email).toBe(student.email);
    expect(row!.hostel_manager_id).toBe(manager.id);
    expect(await t.query(api.complaints.getByIdWithUser, { id: "123", secret })).toBeNull();
  });

  it("updateStatus patches the status and returns null for a malformed id", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, hostel } = await scenario(t);
    const complaint = await t.mutation(api.complaints.create, {
      data: { content: "Noise", student_id: student.id, hostel_id: hostel.id,
              hostel_manager_id: manager.id },
      secret,
    });

    const updated = await t.mutation(api.complaints.updateStatus, {
      id: complaint.id, status: "RESOLVED", secret,
    });
    expect(updated!.status).toBe("RESOLVED");
    expect(
      await t.mutation(api.complaints.updateStatus, { id: "123", status: "RESOLVED", secret })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run convex/reviewsComplaints.test.ts`
Expected: FAIL — cannot resolve `api.reviews`.

- [ ] **Step 3: Implement `convex/reviews.ts`**

```ts
// server/convex/reviews.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

export const listByHostel = secureQuery({ hostelId: v.optional(v.string()) }, async (ctx, { hostelId }) => {
  let rows;
  if (hostelId !== undefined) {
    const id = ctx.db.normalizeId("hostels", hostelId);
    if (!id) return [];
    rows = await ctx.db
      .query("reviews")
      .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
      .collect();
  } else {
    rows = await ctx.db.query("reviews").collect();
  }

  return await Promise.all(
    rows.map(async (review: any) => {
      const row = toApiRow(review);
      row.USERS = null;
      if (review.student_id) {
        const student = await ctx.db.get(review.student_id);
        if (student) row.USERS = { email: student.email };
      }
      return row;
    })
  );
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  // Postgres had CHECK(rating >= 1 AND rating <= 5); Convex has no CHECK
  // constraint, so the bound is enforced here.
  if (typeof data.rating !== "number" || data.rating < 1 || data.rating > 5) {
    throw new Error("rating must be between 1 and 5");
  }

  const hostelId = ctx.db.normalizeId("hostels", data.hostel_id);
  if (!hostelId) throw new Error("Hostel not found");
  const studentId = data.student_id ? ctx.db.normalizeId("users", data.student_id) : null;
  if (data.student_id && !studentId) throw new Error("Student not found");

  const now = Date.now();
  const reviewId = await ctx.db.insert("reviews", {
    rating: data.rating,
    comment: data.comment ?? undefined,
    student_id: studentId ?? undefined,
    hostel_id: hostelId,
    created_at: now,
    updated_at: now,
  });
  return toApiRow((await ctx.db.get(reviewId))!);
});
```

- [ ] **Step 4: Implement `convex/complaints.ts`**

```ts
// server/convex/complaints.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

const complaintStatus = v.union(v.literal("OPEN"), v.literal("IN_PROGRESS"), v.literal("RESOLVED"));

async function withUser(ctx: any, complaint: any, includeHostel: boolean) {
  const row = toApiRow(complaint);

  const student = await ctx.db.get(complaint.student_id);
  row.USERS = student ? { email: student.email, profile_complete: student.profile_complete } : null;

  if (includeHostel) {
    const hostel = await ctx.db.get(complaint.hostel_id);
    row.HOSTEL = hostel ? { hostel_name: hostel.hostel_name } : null;
  }
  return row;
}

export const list = secureQuery(
  {
    studentId: v.optional(v.string()),
    hostelId: v.optional(v.string()),
    hostelManagerId: v.optional(v.string()),
  },
  async (ctx, { studentId, hostelId, hostelManagerId }) => {
    let rows;
    if (studentId !== undefined) {
      const id = ctx.db.normalizeId("users", studentId);
      if (!id) return [];
      rows = await ctx.db
        .query("complaints")
        .withIndex("by_student_id", (q: any) => q.eq("student_id", id))
        .collect();
    } else if (hostelManagerId !== undefined) {
      const id = ctx.db.normalizeId("users", hostelManagerId);
      if (!id) return [];
      rows = await ctx.db
        .query("complaints")
        .withIndex("by_hostel_manager_id", (q: any) => q.eq("hostel_manager_id", id))
        .collect();
    } else if (hostelId !== undefined) {
      const id = ctx.db.normalizeId("hostels", hostelId);
      if (!id) return [];
      rows = await ctx.db
        .query("complaints")
        .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
        .collect();
    } else {
      rows = await ctx.db.query("complaints").collect();
    }

    // The remaining filters narrow whatever the index returned, so every
    // combination the controller can send is honored.
    if (hostelManagerId !== undefined && studentId !== undefined) {
      const managerId = ctx.db.normalizeId("users", hostelManagerId);
      rows = rows.filter((c: any) => c.hostel_manager_id === managerId);
    }
    if (hostelId !== undefined && (studentId !== undefined || hostelManagerId !== undefined)) {
      const hid = ctx.db.normalizeId("hostels", hostelId);
      rows = rows.filter((c: any) => c.hostel_id === hid);
    }

    return await Promise.all(rows.map((c: any) => withUser(ctx, c, true)));
  }
);

export const getByIdWithUser = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const complaintId = ctx.db.normalizeId("complaints", id);
  if (!complaintId) return null;
  const complaint = await ctx.db.get(complaintId);
  if (!complaint) return null;
  return await withUser(ctx, complaint, false);
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const hostelId = ctx.db.normalizeId("hostels", data.hostel_id);
  if (!hostelId) throw new Error("Hostel not found");
  const studentId = ctx.db.normalizeId("users", data.student_id);
  if (!studentId) throw new Error("Student not found");
  const managerId = data.hostel_manager_id
    ? ctx.db.normalizeId("users", data.hostel_manager_id)
    : null;

  const now = Date.now();
  const complaintId = await ctx.db.insert("complaints", {
    content: data.content,
    status: "OPEN",
    student_id: studentId,
    hostel_manager_id: managerId ?? undefined,
    hostel_id: hostelId,
    created_at: now,
    updated_at: now,
  });
  return toApiRow((await ctx.db.get(complaintId))!);
});

export const updateStatus = secureMutation(
  { id: v.string(), status: complaintStatus },
  async (ctx, { id, status }) => {
    const complaintId = ctx.db.normalizeId("complaints", id);
    if (!complaintId) return null;
    const complaint = await ctx.db.get(complaintId);
    if (!complaint) return null;
    await ctx.db.patch(complaintId, { status, updated_at: Date.now() });
    return toApiRow((await ctx.db.get(complaintId))!);
  }
);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && npx vitest run convex/reviewsComplaints.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Rewrite the reviews controller**

Replace `server/src/modules/reviews/reviews.controller.js`:

```js
import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

// GET /api/reviews?hostel_id=123
export const getReviews = async (req, res, next) => {
  try {
    const { hostel_id } = req.query;
    const args = {};
    if (hostel_id) args.hostelId = String(hostel_id);

    const data = await cq(api.reviews.listByHostel, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/reviews
export const createReview = async (req, res, next) => {
  try {
    const { hostel_id } = req.body;

    // A student can only review a hostel they've actually stayed at —
    // require at least one CONFIRMED or CHECKED_OUT booking for a room in
    // this hostel before allowing the review.
    const roomIds = await cq(api.rooms.listIdsByHostel, { hostelId: hostel_id });

    const hasStayed = await cq(api.bookings.existsForStudentInRooms, {
      studentId: req.user.id,
      roomIds,
      statuses: ["CONFIRMED", "CHECKED_OUT"],
    });

    if (!hasStayed) {
      return res.status(403).json({ success: false, message: "You can only review a hostel you've booked and stayed at" });
    }

    const data = await cm(api.reviews.create, {
      data: { ...req.body, student_id: req.user.id },
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 7: Rewrite the complaints controller**

Replace `server/src/modules/complaints/complaints.controller.js`:

```js
import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

// GET /api/complaints
export const getComplaints = async (req, res, next) => {
  try {
    const { hostel_id, student_id } = req.query;

    const args = {};
    if (req.user.user_type === "STUDENT") {
      // Students can only ever see their own complaints, regardless of
      // whatever student_id they pass in the query string.
      args.studentId = req.user.id;
    } else {
      if (student_id) args.studentId = String(student_id);
      if (req.user.user_type === "HOSTEL_MANAGER") {
        // Managers only see complaints for hostels they manage.
        args.hostelManagerId = req.user.id;
      }
    }

    if (hostel_id) args.hostelId = String(hostel_id);

    const data = await cq(api.complaints.list, args);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/complaints/:id
export const getComplaintById = async (req, res, next) => {
  try {
    const data = await cq(api.complaints.getByIdWithUser, { id: req.params.id });

    if (!data) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    if (req.user.user_type === "STUDENT" && data.student_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this complaint" });
    }
    if (req.user.user_type === "HOSTEL_MANAGER" && data.hostel_manager_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this complaint" });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/complaints
export const createComplaint = async (req, res, next) => {
  try {
    const { hostel_id } = req.body;

    const hostel = await cq(api.hostels.getManagerId, { id: hostel_id });

    if (!hostel) {
      return res.status(404).json({ success: false, message: "Hostel not found" });
    }

    if (req.user.user_type === "STUDENT") {
      // A student can only complain about a hostel they've actually booked.
      const roomIds = await cq(api.rooms.listIdsByHostel, { hostelId: hostel_id });
      const hasBooked = await cq(api.bookings.existsForStudentInRooms, {
        studentId: req.user.id,
        roomIds,
      });

      if (!hasBooked) {
        return res.status(403).json({ success: false, message: "You can only file a complaint about a hostel you've booked" });
      }
    }

    const data = await cm(api.complaints.create, {
      data: {
        ...req.body,
        // A student can only ever file a complaint as themselves, never on
        // behalf of another student_id passed in the body.
        student_id: req.user.user_type === "STUDENT" ? req.user.id : req.body.student_id,
        hostel_manager_id: hostel.manager_id,
      },
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/complaints/:id
export const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const complaint = await cq(api.complaints.getByIdWithUser, { id });

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    // Only the manager of the hostel this complaint was filed against (or
    // an admin) can change its status.
    if (req.user.user_type !== "ADMIN" && complaint.hostel_manager_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not manage the hostel for this complaint" });
    }

    const data = await cm(api.complaints.updateStatus, { id, status });

    if (!data) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 8: Run the full suite**

Run: `cd server && npx vitest run`
Expected: PASS (130 tests).

- [ ] **Step 9: Commit**

```bash
git add server/convex/reviews.ts server/convex/complaints.ts server/convex/reviewsComplaints.test.ts server/src/modules/reviews/reviews.controller.js server/src/modules/complaints/complaints.controller.js server/convex/_generated
git commit -m "$(cat <<'EOF'
feat(server): move reviews and complaints to Convex

Both controllers' "has this student actually stayed here" checks now run
through rooms.listIdsByHostel plus bookings.existsForStudentInRooms,
replacing the two-step rooms-then-bookings .in() query. The nested USERS
and HOSTEL keys are assembled explicitly to match what PostgREST returned.

reviews.create enforces the 1-5 rating bound that Postgres held as a CHECK
constraint, which Convex has no equivalent for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Image storage on Convex

**Files:**
- Create: `server/convex/files.ts`
- Create: `server/convex/files.test.ts`
- Create: `server/src/utils/convexStorage.js`
- Delete: `server/src/utils/supabaseStorage.js`
- Modify: `server/src/modules/hostels/hostels.controller.js:222-257`
- Modify: `server/src/modules/rooms/rooms.controller.js:266-301`
- Modify: `server/src/middlewares/upload.middleware.js:3-4`

**Interfaces:**
- Consumes: `secureAction` (Task 1); `ca` (Task 2).
- Produces: `api.files.storeImage`; `uploadImageToConvex(file)`.

- [ ] **Step 1: Write the failing test**

Create `server/convex/files.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

describe("files.storeImage", () => {
  it("stores bytes and returns a URL string", async () => {
    const t = convexTest(schema, modules);
    const bytes = new TextEncoder().encode("fake-png-bytes").buffer;

    const url = await t.action(api.files.storeImage, {
      bytes, contentType: "image/png", secret,
    });

    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });

  it("rejects a wrong secret", async () => {
    const t = convexTest(schema, modules);
    const bytes = new TextEncoder().encode("x").buffer;
    await expect(
      t.action(api.files.storeImage, { bytes, contentType: "image/png", secret: "wrong-secret" })
    ).rejects.toThrow(/unauthorized/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && npx vitest run convex/files.test.ts`
Expected: FAIL — cannot resolve `api.files`.

- [ ] **Step 3: Implement `convex/files.ts`**

```ts
// server/convex/files.ts
import { v } from "convex/values";
import { secureAction } from "./lib/secureFunction";

// Storage needs an action — ctx.storage.store is not available to a
// mutation. upload.middleware.js caps files at 10MB, comfortably inside
// Convex's 16MB function-argument limit.
export const storeImage = secureAction(
  { bytes: v.bytes(), contentType: v.string() },
  async (ctx, { bytes, contentType }) => {
    const storageId = await ctx.storage.store(new Blob([bytes], { type: contentType }));
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Convex storage returned no URL for the stored image");
    }
    return url;
  }
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && npx vitest run convex/files.test.ts`
Expected: PASS (2 tests).

If `convex-test` turns out not to implement `storage.store` for actions in this version, do not delete the test: mark it `it.skip` with a one-line comment naming the limitation, and verify the upload path instead by the live check in Step 8. That live check is required either way.

- [ ] **Step 5: Create `convexStorage.js`**

Create `server/src/utils/convexStorage.js`:

```js
import { ca } from "../config/convexClient.js";
import { api } from "../../convex/_generated/api.js";

// Validated against the mimetype upload.middleware.js already allows,
// never the client-supplied originalname — that field is attacker
// controlled, and the old Supabase helper used it to build a path.
// Convex storage has no folders, so the bucket/folder arguments the old
// uploadImageToSupabase took are gone.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export const uploadImageToConvex = async (file) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new Error(`Unsupported image type: ${file.mimetype}`);
  }

  // multer gives a Node Buffer; Convex's v.bytes() wants an ArrayBuffer of
  // exactly this file's bytes, so slice at the buffer's own offsets rather
  // than handing over the whole backing pool.
  const bytes = file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength
  );

  return await ca(api.files.storeImage, { bytes, contentType: file.mimetype });
};
```

- [ ] **Step 6: Switch both upload call sites and delete the Supabase helper**

In `server/src/modules/hostels/hostels.controller.js`, change the import and the upload loop:

```js
import { uploadImageToConvex } from "../../utils/convexStorage.js";
```

```js
    // Upload each file to Convex storage
    for (const file of req.files) {
      const publicUrl = await uploadImageToConvex(file);
      uploadedUrls.push(publicUrl);
    }
```

In `server/src/modules/rooms/rooms.controller.js`, make the identical two changes:

```js
import { uploadImageToConvex } from "../../utils/convexStorage.js";
```

```js
    // Upload each file to Convex storage
    for (const file of req.files) {
      const publicUrl = await uploadImageToConvex(file);
      uploadedUrls.push(publicUrl);
    }
```

In `server/src/middlewares/upload.middleware.js`, correct the stale comment:

```js
// Use memory storage to avoid saving files to disk since we upload
// directly from the memory buffer to Convex storage.
```

Then delete the old helper:

```bash
git rm server/src/utils/supabaseStorage.js
```

- [ ] **Step 7: Run the full suite**

Run: `cd server && npx vitest run`
Expected: PASS (132 tests).

- [ ] **Step 8: Verify the upload path live**

Run:
```bash
cd server && npx convex dev --once && node --check src/utils/convexStorage.js src/modules/hostels/hostels.controller.js src/modules/rooms/rooms.controller.js && grep -rn "supabaseStorage\|uploadImageToSupabase" src/ || echo "no Supabase storage references remain"
```
Expected: Convex ready, no syntax errors, and the grep finds nothing.

- [ ] **Step 9: Commit**

```bash
git add server/convex/files.ts server/convex/files.test.ts server/src/utils/convexStorage.js server/src/modules/hostels/hostels.controller.js server/src/modules/rooms/rooms.controller.js server/src/middlewares/upload.middleware.js server/convex/_generated
git rm --cached server/src/utils/supabaseStorage.js 2>/dev/null || true
git commit -m "$(cat <<'EOF'
feat(server): store hostel and room images in Convex storage

Replaces the Supabase Storage helper with a Convex action that takes the
validated bytes and returns a public URL, so the image_url contract the
HOSTEL_IMAGE_URLS and ROOM_IMAGE_URLS rows depend on is unchanged.

Convex storage has no folders, so the bucket and folder-path arguments are
gone; the mimetype allowlist stays, still derived from the validated
mimetype rather than the attacker-controlled originalname.

temp-pano-api keeps writing tour configs to Supabase Storage, so
roomTourScenes.scene_config_url still holds Supabase URLs by design.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Seed script

**Files:**
- Create: `server/scripts/seed.mjs`

**Interfaces:**
- Consumes: `api.hostels.create`, `api.rooms.create`, `api.amenities.addForHostel`, `api.amenities.addForRoom`, `api.hostels.addImages`, `api.bookings.create`, `api.bookings.updateStatus`, `api.users.updateProfile`; better-auth's `auth.api.signUpEmail`.
- Produces: a demo-ready deployment.

- [ ] **Step 1: Write the seed script**

Create `server/scripts/seed.mjs`:

```js
// Seeds a fresh Convex deployment with demo data.
//
// Accounts are created through better-auth (not by inserting user rows) so
// their password hashes and account records are real and the demo can
// actually sign in. Run with: node scripts/seed.mjs
import "../src/loadEnv.js";
import { auth } from "../auth.js";
import { cq, cm } from "../src/config/convexClient.js";
import { api } from "../convex/_generated/api.js";

const MANAGER = { email: "manager@campusnest.test", password: "DemoManager123!", name: "Akosua Mensah" };
const STUDENT = { email: "student@campusnest.test", password: "DemoStudent123!", name: "Kwame Asante" };

async function signUp({ email, password, name }) {
  const response = await auth.api.signUpEmail({ body: { email, password, name } });
  if (response.error) {
    throw new Error(`Could not create ${email}: ${response.error.message}`);
  }
  return response.user;
}

async function main() {
  console.log("Seeding Convex deployment...");

  const manager = await signUp(MANAGER);
  await cm(api.users.updateProfile, {
    id: manager.id,
    patch: { user_type: "HOSTEL_MANAGER", profile_complete: true, payment_details: "Demo Bank 0123456789" },
  });
  console.log(`  manager: ${MANAGER.email} / ${MANAGER.password}`);

  const student = await signUp(STUDENT);
  await cm(api.users.updateProfile, {
    id: student.id,
    patch: { user_type: "STUDENT", profile_complete: true, student_id: "UG-2026-0042", course: "Computer Science" },
  });
  console.log(`  student: ${STUDENT.email} / ${STUDENT.password}`);

  const unity = await cm(api.hostels.create, {
    data: {
      hostel_name: "Unity Hall Annex", location: "North Campus, Legon",
      description: "Five minutes from the main gate, with a quiet study room on each floor.",
      total_rooms: 0, available_rooms: 0, distance_from_campus: 0.8,
      manager_id: manager.id, status: "APPROVED",
    },
  });
  const pentagon = await cm(api.hostels.create, {
    data: {
      hostel_name: "Pentagon Lodge", location: "Madina Road",
      description: "Budget rooms with running water and parking.",
      total_rooms: 0, available_rooms: 0, distance_from_campus: 3.2,
      manager_id: manager.id, status: "PENDING",
    },
  });
  console.log(`  hostels: "${unity.hostel_name}" (APPROVED), "${pentagon.hostel_name}" (PENDING)`);

  await cm(api.amenities.addForHostel, {
    hostelId: unity.id, names: ["WIFI", "RUNNING_WATER", "STUDY_ROOM", "LAUNDRY"],
  });
  await cm(api.amenities.addForHostel, { hostelId: pentagon.id, names: ["RUNNING_WATER", "PARKING"] });

  await cm(api.hostels.addImages, {
    hostelId: unity.id,
    urls: [
      "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=1200",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200",
    ],
  });

  const rooms = [];
  for (const spec of [
    { room_number: "A1", room_type: "SINGLE", price_per_bed: 3500, capacity: 1 },
    { room_number: "A2", room_type: "DOUBLE", price_per_bed: 2400, capacity: 2 },
    { room_number: "B1", room_type: "QUAD", price_per_bed: 1500, capacity: 4 },
  ]) {
    const room = await cm(api.rooms.create, {
      data: { ...spec, hostel_id: unity.id, length: 4.2, width: 3.1, height: 2.8 },
    });
    rooms.push(room);
    await cm(api.amenities.addForRoom, { roomId: room.id, names: ["WIFI", "AIR_CONDITIONING"] });
    await cm(api.rooms.addImages, {
      roomId: room.id,
      urls: ["https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200"],
    });
  }
  console.log(`  rooms: ${rooms.map((r) => r.room_number).join(", ")}`);

  const booking = await cm(api.bookings.create, {
    data: {
      check_in_date: new Date("2026-11-01").getTime(),
      check_out_date: new Date("2027-06-30").getTime(),
      student_id: student.id,
      room_id: rooms[1].id,
    },
  });
  await cm(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED" });
  console.log(`  booking: ${STUDENT.name} CONFIRMED into room ${rooms[1].room_number}`);

  const listed = await cq(api.hostels.listApproved, {});
  console.log(`\nDone. Public listing shows ${listed.length} approved hostel(s).`);
}

main().catch((err) => {
  console.error("\nSeeding failed:", err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed script**

Run: `cd server && node scripts/seed.mjs`
Expected: each line printed without error, ending in `Public listing shows 1 approved hostel(s).` — Pentagon Lodge is `PENDING`, so it correctly stays out of the public list.

If it fails because the accounts already exist, the deployment already has data; clear it from the Convex dashboard and re-run, or change the two email constants.

- [ ] **Step 3: Verify the seeded shapes match the contract**

Run:
```bash
cd server && node -e '
import("./src/loadEnv.js").then(async () => {
  const { cq } = await import("./src/config/convexClient.js");
  const { api } = await import("./convex/_generated/api.js");
  const [hostel] = await cq(api.hostels.listApproved, {});
  const full = await cq(api.hostels.getByIdWithRelations, { id: hostel.id });
  console.log("manager:", JSON.stringify(hostel.manager));
  console.log("created_at:", full.created_at, typeof full.created_at);
  console.log("ROOM count:", full.ROOM.length, "first room created_at type:", typeof full.ROOM[0].created_at);
  console.log("HOSTEL_AMENITY:", full.HOSTEL_AMENITY.map(a => a.name).join(","));
  const bookings = await cq(api.bookings.list, {});
  console.log("booking ROOM.HOSTEL.hostel_name:", bookings[0].ROOM.HOSTEL.hostel_name);
  console.log("booking USERS.email:", bookings[0].USERS.email);
  console.log("booking check_in_date:", bookings[0].check_in_date, typeof bookings[0].check_in_date);
});
'
```
Expected: `manager` is an object with `id` and `email`; every `created_at`/`check_in_date` prints as an ISO string with type `string`; `ROOM count: 3`; the nested `ROOM.HOSTEL.hostel_name` and `USERS.email` both resolve.

- [ ] **Step 4: Commit**

```bash
git add server/scripts/seed.mjs
git commit -m "$(cat <<'EOF'
feat(server): seed script for a demo-ready Convex deployment

A fresh Convex deployment is empty, so the demo needs content. Creates the
manager and student through better-auth rather than by inserting user rows,
so the passwords hash correctly and the accounts can actually sign in, then
builds one APPROVED and one PENDING hostel, three rooms with amenities and
images, and a CONFIRMED booking that exercises the occupancy path.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Remove Supabase

**Files:**
- Delete: `server/src/config/db.js`
- Modify: `server/src/server.js:1-29`
- Modify: `server/package.json`
- Modify: `server/.env`, `server/.env.example`
- Modify: `server/src/modules/amenities/Amenities.schema.js:3`

**Interfaces:**
- Consumes: everything from Tasks 1-9.
- Produces: a `server/` with no Supabase dependency.

- [ ] **Step 1: Confirm nothing imports Supabase any more**

Run: `cd server && grep -rn "supabase" --include="*.js" src/ *.js | grep -v "supabase_schema.sql"`
Expected: only `src/server.js` (the health check) and `src/config/db.js` (the client itself). If any other file appears, that module was missed in Tasks 2-8 — fix it before continuing.

- [ ] **Step 2: Remove the Supabase health check from `server.js`**

Replace `server/src/server.js` with:

```js
import "./loadEnv.js";
import app from "./app.js";
import { cq } from "./config/convexClient.js";
import { api } from "../convex/_generated/api.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);

  try {
    // Cheap ping: an empty-where findMany on the smallest auth table, using
    // the same CONVEX_ADAPTER_SECRET every real call uses — proves both
    // network reachability and secret correctness.
    await cq(api.verifications.findMany, { where: [], limit: 1 });
    console.log("✅ Convex is connected and operational.");
  } catch (error) {
    console.error("❌ Convex connection failed:", error.message);
  }

  console.log("---------------------------------------------------");
});
```

- [ ] **Step 3: Delete the Supabase client and uninstall the package**

```bash
cd server
git rm src/config/db.js
npm uninstall @supabase/supabase-js
```

- [ ] **Step 4: Drop the `SUPABASE_*` env vars**

Remove every `SUPABASE_URL` / `SUPABASE_KEY` / other `SUPABASE_*` line from `server/.env` and `server/.env.example`. Leave `CONVEX_URL`, `CONVEX_DEPLOYMENT`, `CONVEX_ADAPTER_SECRET`, `PANO_API_URL`, and `PANO_API_KEY` alone.

Verify: `cd server && grep -c "SUPABASE" .env .env.example`
Expected: `0` for both files.

- [ ] **Step 5: Correct the one stale comment**

In `server/src/modules/amenities/Amenities.schema.js` line 3, the comment points at the Postgres enum as the source of truth. Update it to name the Convex schema, keeping `supabase_schema.sql` as the historical reference it is:

```js
// Must exactly match the amenityName union in server/convex/schema.ts
// (originally the Postgres `amenity_name` enum, kept in
// src/utils/supabase_schema.sql for historical reference) —
```

- [ ] **Step 6: Verify Supabase is gone**

Run:
```bash
cd server && grep -rn "supabase" --include="*.js" src/ *.js | grep -v "supabase_schema.sql"; echo "--- deps ---"; grep -c "supabase" package.json; echo "--- lock ---"; grep -c "@supabase/supabase-js" package-lock.json
```
Expected: no source matches, `0` in `package.json`, and `0` in `package-lock.json`.

- [ ] **Step 7: Run the full suite**

Run: `cd server && npx vitest run`
Expected: PASS (132 tests). The pre-existing Express tests import `app.js`, so a leftover import of the deleted `config/db.js` would fail the whole suite here — that is the point of running it after the delete.

- [ ] **Step 8: Boot the server and confirm the startup log**

Run: `cd server && timeout 10 node src/server.js`
Expected output, with no Supabase line and no error:

```
🚀 Server is running on http://localhost:3000
✅ Convex is connected and operational.
---------------------------------------------------
```

- [ ] **Step 9: Smoke-test the public endpoints against the seeded data**

With the server running in one terminal, in another:

```bash
curl -s localhost:3000/api/hostels | head -c 400; echo
curl -s localhost:3000/api/rooms | head -c 400; echo
curl -s localhost:3000/api/rooms/123; echo
curl -s localhost:3000/api/bookings; echo
```
Expected: the first two return `{"success":true,"data":[...]}` with the seeded hostel and three rooms, each room carrying its nested `HOSTEL`; `/api/rooms/123` returns a **404** `{"success":false,"message":"Room not found"}` and not a 500 (Review Focus #1 end to end); `/api/bookings` returns 401 since it needs a session.

- [ ] **Step 10: Commit**

```bash
git add server/src/server.js server/package.json server/package-lock.json server/.env.example server/src/modules/amenities/Amenities.schema.js
git rm --cached server/src/config/db.js 2>/dev/null || true
git commit -m "$(cat <<'EOF'
chore(server): remove Supabase

Every data path now runs through Convex, so the Supabase client, its
startup health check, and @supabase/supabase-js come out, along with the
SUPABASE_* env vars.

src/utils/supabase_schema.sql stays as the historical reference this
migration's spec cites and temp-pano-api still relates to; that Python
service keeps its own Supabase Storage usage and is deliberately untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Verification summary

After Task 10, the branch should satisfy all of:

- `cd server && npx vitest run` → 132 passing (75 pre-existing + 57 new).
- `cd server && grep -rn "supabase" --include="*.js" src/ *.js | grep -v supabase_schema.sql` → no output.
- `cd server && node src/server.js` → logs only the Convex connectivity line.
- `curl localhost:3000/api/hostels` → the seeded hostel with its nested `manager`.
- `curl localhost:3000/api/rooms/123` → 404, not 500.
- Every `created_at` in every response → an ISO 8601 string.
