# Backend Migration: Supabase → Convex — Sub-project 1: Foundation

## Context

CampusNest's backend (`server/`) runs on Express + Supabase (Postgres via `supabase-js` for business tables, raw `pg`/Kysely for better-auth's session tables). Supabase's free tier pauses the project after 7 days of inactivity, which has already caused real outages during Stage 1 testing (`ENETUNREACH`/`EAI_AGAIN`/schema-not-found errors, all traced back to the paused/misconfigured Supabase project). The team wants to move the database layer to Convex, which has no such pause, ahead of a demo this **Sunday**.

Given the deadline, this migration is decomposed into independently shippable sub-projects, each with its own spec→plan→implementation cycle:

1. **Foundation** (this spec) — Convex project setup, schema, and a custom better-auth adapter so auth keeps working exactly as it does today.
2. **Core data modules** — hostels, rooms, bookings (the modules the frontend's Stage 1-2 work already touches).
3. **Remaining modules** — reviews, complaints, amenities, users/profile.
4. **File storage** — hostel/room photo uploads move to Convex storage.

`temp-pano-api` (the Python 360° tour-generation microservice) is explicitly **out of scope for this whole migration** — it keeps uploading to Supabase Storage. It isn't wired to the frontend yet (LivePreview is still a hardcoded demo per the Stage 2 frontend spec), so a Supabase pause there doesn't affect anything shown in the demo.

Express's routes, controllers, and middleware structure **do not change** — only what each controller calls to reach the database changes, from `supabase.from(...)` to a Convex function call. This keeps every existing API contract (request/response shapes) identical, so the frontend needs zero changes for Sub-projects 2-4.

## Goals (Sub-project 1)

- A new `convex/` directory at the repo root, deployed to a real Convex dev deployment, with a schema covering every table `server/src/utils/supabase_schema.sql` defines.
- `server/` can reach that Convex deployment from Node via `ConvexHttpClient`.
- better-auth (`server/auth.js`) keeps its current `pg.Pool`/Kysely-backed behavior *replaced* by a custom adapter that performs the same operations (find/create/update/delete on user/session/account/verification) against the new Convex tables instead of Postgres — same `databaseHooks`, same `additionalFields`, same `emailAndPassword` config, same session cookie behavior, same `requireAuth`/`requireRole` Express middleware, unchanged.
- A real signup → signin → `requireAuth`-protected request round-trip works end-to-end against Convex, verified manually against the dev deployment.

## Non-goals (Sub-project 1)

- Migrating HOSTEL/ROOM/BOOKING/REVIEW/COMPLAINT/amenity data or their controllers — Sub-projects 2-3.
- Migrating file storage — Sub-project 4.
- `temp-pano-api` — permanently out of scope for this migration (see Context).
- Data migration/backfill from the existing Supabase Postgres — this is effectively a fresh start (no production data exists yet to carry over); Sub-project 1 ships with an empty Convex database.
- Removing the `pg`/`@better-auth/...` Postgres-adapter dependencies from `package.json` — left in place until all sub-projects land, to keep the branch easy to compare against `client` throughout.

## Known Limitations — do not deploy this branch alone

Found during final review, not in original scope:

- **Only auth tables moved.** `users`/`sessions`/`accounts`/`verifications` live in Convex now; HOSTEL/ROOM/BOOKING/REVIEW/COMPLAINT/amenity/bank-account data is still Supabase Postgres. Any controller that joins across a Supabase table and Supabase's old `user` table (profile, bookings, manager registration, complaints, hostels, reviews, bank accounts) will break if this branch ships alone, because better-auth's users now live in Convex, not in the Supabase `user` table those controllers query against.
- **Convex functions require a shared secret.** Every `convex/*.ts` query/mutation is wrapped in `secureQuery`/`secureMutation` (`server/convex/lib/secureFunction.ts`), checked against `CONVEX_ADAPTER_SECRET`. This env var must be set both in `server/.env` (for `server/auth-convex-adapter.js`) and on the Convex deployment itself (`npx convex env set CONVEX_ADAPTER_SECRET <value>`) before anything works. Losing or rotating one side without the other breaks every auth call.
- **This branch is Sub-project 1 only.** It is not meant to merge to `main`/`client` standalone — it's a foundation for Sub-projects 2-4 (core data modules, remaining modules, file storage). Merging it alone would ship a server where sign-up/sign-in work but most of the app's data layer still points at Supabase against a stale/incompatible user reference.

## Architecture

### Branch

New branch `convex-migration`, forked from `client` (current branch, holds all Stage 1-2 frontend work and the full Express backend).

### `convex/` directory (new, repo root)

Standard Convex project layout:
- `convex/schema.ts` — `defineSchema` with one `defineTable` per table below.
- `convex/users.ts`, `convex/sessions.ts`, `convex/accounts.ts`, `convex/verifications.ts` — the four tables better-auth's adapter interface needs, each exposing the handful of internal queries/mutations the adapter calls (see Auth Adapter section).
- `convex/_generated/` — Convex's own generated types/API (not hand-written).

Table definitions (Sub-project 1 only defines the auth-relevant four; Sub-projects 2-3 add the rest to this same schema file):

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
  }).index("by_email", ["email"]),

  sessions: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userId: v.id("users"),
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
  })
    .index("by_userId", ["userId"])
    .index("by_providerId_accountId", ["providerId", "accountId"]),

  verifications: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
  }).index("by_identifier", ["identifier"]),

  // rooms/hostels/etc. are added to this schema in Sub-project 2 —
  // the `v.id("rooms")` reference above is forward-declared now so
  // Sub-project 1's schema is valid on its own (Convex requires every
  // v.id() target table to exist in the same schema file; "rooms" is
  // defined here as a minimal placeholder table and fleshed out in
  // Sub-project 2 without changing this field's type).
  rooms: defineTable({}),
});
```

(`current_room_id`'s placeholder `rooms` table is a deliberate minimal stub — Convex validates `v.id("rooms")` against a table that must exist in `schema.ts`, so Sub-project 1 can't reference it without at least declaring the table shape. Sub-project 2 adds its real fields without touching this reference.)

### Auth Adapter — `server/auth-convex-adapter.js` (new)

better-auth's adapter interface (documented, used by every official adapter — Drizzle, Prisma, Kysely, MongoDB) requires five operations per model: `create`, `findOne`, `findMany`, `update`, `delete`. This file implements exactly those, each calling a corresponding Convex function instead of a SQL query:

```javascript
// server/auth-convex-adapter.js
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error("CONVEX_URL is not set — the auth adapter cannot reach Convex");
}
const convex = new ConvexHttpClient(convexUrl);

const MODEL_TO_API = {
  user: api.users,
  session: api.sessions,
  account: api.accounts,
  verification: api.verifications,
};

export function convexAdapter() {
  return {
    id: "convex",
    async create({ model, data }) {
      const fns = MODEL_TO_API[model];
      const id = await convex.mutation(fns.create, { data });
      return { ...data, id };
    },
    async findOne({ model, where }) {
      const fns = MODEL_TO_API[model];
      return await convex.query(fns.findOne, { where });
    },
    async findMany({ model, where, limit, sortBy }) {
      const fns = MODEL_TO_API[model];
      return await convex.query(fns.findMany, { where: where ?? [], limit, sortBy });
    },
    async update({ model, where, update }) {
      const fns = MODEL_TO_API[model];
      return await convex.mutation(fns.update, { where, update });
    },
    async delete({ model, where }) {
      const fns = MODEL_TO_API[model];
      await convex.mutation(fns.delete, { where });
    },
  };
}
```

Each `convex/users.ts`/`sessions.ts`/`accounts.ts`/`verifications.ts` exposes `create`/`findOne`/`findMany`/`update`/`delete` as plain Convex `query`/`mutation` functions that translate better-auth's generic `where` clause shape (`[{ field, operator, value }]`) into Convex's `.filter()`/`.withIndex()` calls. `findOne`/`findMany` use the table's index when the `where` clause is a single equality match on an indexed field (`email` for users, `token` for sessions, etc.) and fall back to `.filter()` otherwise.

**Deliberate scope cut:** better-auth's adapter interface supports arbitrary operators (`eq`, `in`, `contains`, etc.) across arbitrary field combinations — a fully general implementation would need to translate all of them. The actual calls better-auth's email/password flow makes are a small, fixed set (find user by email; find session by token; find account by provider+accountId; find/update user by id) — all single-field equality lookups. The plan implements equality-only matching (`operator === "eq"` or omitted) and throws a clear "unsupported where clause" error for anything else, rather than building general-purpose query translation nothing in this app's auth flow needs yet.

`server/auth.js` changes from `database: new pg.Pool({...})` to `database: convexAdapter()` — every other option (`trustedOrigins`, `emailAndPassword`, `user.additionalFields`, `databaseHooks`) stays byte-identical.

### Express ↔ Convex for everything else

`server/src/config/convex.js` (new) exports a single shared `ConvexHttpClient` instance (same `CONVEX_URL` env var), for Sub-projects 2-3's controllers to import instead of the current `server/src/config/db.js`'s `supabase` client. Not used by any controller yet in Sub-project 1 — only the auth adapter uses Convex this round.

## Data flow

**Sign up:** `POST /api/auth/sign-up/email` (Express, unchanged route) → better-auth's internal logic (unchanged) → adapter's `create({model: "user", ...})` → `convex.mutation(api.users.create, ...)` → Convex inserts a row, returns its `_id` → better-auth stores that as the user's `id` exactly as it would have stored a Postgres-generated one.

**Session check:** `requireAuth` middleware (unchanged) → `auth.api.getSession({headers})` (unchanged, pure better-auth internal call) → adapter's `findOne({model: "session", where: [{field: "token", value: ...}]})` → `convex.query(api.sessions.findOne, ...)` using the `by_token` index.

## Error handling

- `CONVEX_URL` missing at startup → the adapter module throws immediately on import (fail fast, matches the existing pattern where `PANO_API_URL`/`PANO_API_KEY` missing throws inside `generateRoomTour` — here it's worse to let the server silently start with no working auth, so this one throws at import time instead of first use).
- A Convex function call failing (network, deployment down) surfaces as whatever error `ConvexHttpClient` throws — better-auth's own error handling wraps this the same way it already wraps Kysely/pg errors today (visible in logs, surfaces as a 500 to the client) — no new error-handling code needed, this is the adapter interface's existing contract.

## Testing

No automated test framework change — `server/` has vitest configured but no existing auth tests to extend here under this deadline. Verification is manual, by the human partner, against the real Convex dev deployment:
1. `npx convex dev` running, schema deployed.
2. `POST /api/auth/sign-up/email` with a test email/password → confirm a row appears in the Convex dashboard's `users` table with `user_type: "STUDENT"`, `profile_complete: false` (the `databaseHooks` still firing).
3. `POST /api/auth/sign-in/email` with the same credentials → confirm a `sessions` row appears, and the response sets a session cookie.
4. A `requireAuth`-protected route (e.g. `GET /api/users/me`) with that cookie → confirm it succeeds and returns the right user.
5. The same route with no cookie → confirm it still correctly 401s (middleware logic unchanged, but worth confirming the adapter's `findOne` correctly returns `null`/undefined for a nonexistent session token rather than throwing).

## Commit plan (file-by-file)

1. `convex/schema.ts` + Convex project scaffolding (`convex.json`, `_generated/` — generated by `npx convex dev`, committed as a snapshot)
2. `convex/users.ts`
3. `convex/sessions.ts`
4. `convex/accounts.ts`
5. `convex/verifications.ts`
6. `server/auth-convex-adapter.js`
7. `server/src/config/convex.js`
8. `server/auth.js` (swap the `database` option)
9. `server/.env.example`/docs update noting `CONVEX_URL` replaces/joins `DATABASE_URL`

Each commit's gate: `node --check` on the touched `.js` files (no existing test suite covers auth), plus the manual verification steps above run once the full chain (schema → adapter → auth.js) is in place.
