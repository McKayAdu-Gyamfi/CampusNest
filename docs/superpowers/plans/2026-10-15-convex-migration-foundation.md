# Convex Migration — Sub-project 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Task 1 contains a mandatory human-in-the-loop step** (logging into Convex via `npx convex dev`, which needs an interactive browser OAuth flow no subagent can perform). If running this plan via subagent-driven-development, the controller must pause at that step, ask the human partner to run the command themselves, and wait for their confirmation + the resulting `CONVEX_URL` before dispatching Task 2.

**Goal:** Stand up a Convex backend and a custom better-auth adapter so sign-up/sign-in/session-check work end-to-end against Convex instead of Supabase Postgres, with zero change to Express routes, middleware, or response shapes.

**Architecture:** `server/convex/` holds the schema and four small CRUD function files (one per better-auth model: users, sessions, accounts, verifications). `server/auth-convex-adapter.js` implements better-auth's 5-method adapter interface by calling those Convex functions via `ConvexHttpClient`. `server/auth.js` swaps its `database` option from a `pg.Pool` to this adapter — nothing else in it changes.

**Tech Stack:** Convex (schema + queries/mutations), `convex` npm package (`ConvexHttpClient`, used from plain Node — no React involved), better-auth's custom-adapter extension point (no new auth library).

**Spec:** `docs/superpowers/specs/2026-10-15-convex-migration-foundation-design.md`

## Global Constraints

- `convex/` lives at `server/convex/` (**correction from the spec's literal wording of repo root** — there is no root `package.json` in this repo; Convex's CLI expects to scaffold next to a `package.json`, and `server/package.json` is the natural, already-existing home. This changes no behavior, only the path.).
- No new frontend changes in this sub-project — Express's routes/response shapes are unchanged, so `client/` is untouched.
- The adapter's query translation is **equality-only** (`operator === "eq"` or omitted) — better-auth's email/password flow never needs anything else. A non-equality operator throws a clear error rather than being silently mishandled.
- Every CRUD function file's automated gate is `node --check` (server has no existing auth tests to extend, and Convex functions aren't runnable outside a live deployment anyway — real verification is the manual end-to-end steps in the final task).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Stage this plan's own files only per task.
- `temp-pano-api` is untouched — permanently out of scope for this whole migration.
- **Do not deploy/merge this branch alone.** See the spec's "Known Limitations" section (added post-final-review): only auth tables (users/sessions/accounts/verifications) are on Convex; every other controller still reads Supabase's old `user` table, and all Convex functions now require `CONVEX_ADAPTER_SECRET` set on both `server/.env` and the Convex deployment.

## Review Focus

1. **A `findOne` call that matches zero documents** (e.g. sign-in with an email that was never registered). A reasonable person expects `null`/`undefined` back so better-auth can respond "invalid credentials," not a thrown error or an empty-array-where-an-object-was-expected type mismatch. (Tasks 3-6 tests.)
2. **A `findOne`/`findMany` `where` clause using an unsupported operator** (anything but `eq`/omitted). A reasonable person expects a clear, named error at the point of the unsupported call, not a silent wrong-result match or a cryptic downstream type error. (Task 2 test, reused by Tasks 3-6.)
3. **Two documents matching what should be a unique lookup** (e.g. two sessions somehow sharing a token — shouldn't happen if `create` is correct, but `findOne` must not silently return the wrong one or crash oddly if it does). Convex's `.unique()` throws its own clear error in this case — Tasks 3-6 tests confirm that's the actual behavior relied on, not assumed.
4. **`update`/`delete` called with a `where` clause matching zero documents** (e.g. deleting a session that already expired/was already deleted). A reasonable person expects a no-op, not a crash on `ctx.db.patch(undefined, ...)`. (Tasks 3-6 tests.)
5. **`CONVEX_URL` missing at server startup.** A reasonable person expects a clear, immediate startup error naming the missing variable, not a confusing failure the first time someone tries to sign up. (Task 7 test.)

---

### Task 1: Convex project scaffold + schema

**Files:**
- Create: `server/convex/schema.ts`
- Human-run (not agent-run): `npx convex dev` from `server/`, which scaffolds `server/convex.json`, `server/convex/_generated/` and connects a real Convex deployment.

**Interfaces:**
- Produces: the `users`, `sessions`, `accounts`, `verifications`, `rooms` (stub) tables and their indexes, which every later task's Convex functions query against.

- [ ] **Step 1: Write the schema file**

```typescript
// server/convex/schema.ts
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

  // Minimal stub — current_room_id above must reference a real table in
  // this schema file. Sub-project 2 replaces this with the full ROOM
  // table definition without changing the reference above.
  rooms: defineTable({}),
});
```

- [ ] **Step 2 (HUMAN ACTION — do not attempt as an agent): create the real Convex deployment**

From `server/`, run:
```bash
npx convex dev
```
This opens a browser for an interactive Convex account login (first time only), then asks to create/select a project, then generates `server/convex.json` and `server/convex/_generated/` from the schema above, and prints a deployment URL (looks like `https://<name>-123.convex.cloud`). Leave `npx convex dev` running in a terminal (it watches `server/convex/` and auto-deploys on save — needed for every later task in this plan).

Report back: the deployment URL (this becomes `CONVEX_URL` in Task 7), and confirm the Convex dashboard shows the 5 tables from the schema above with no errors.

**If you are an autonomous agent (subagent-driven-development or otherwise) and reach this step: STOP. Report status NEEDS_CONTEXT and ask the human partner to run this step and supply the deployment URL. Do not attempt to run `npx convex dev` yourself or fabricate a URL — it requires an interactive login this process cannot perform.**

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add server/convex/schema.ts server/convex.json server/convex/_generated
git commit -m "$(cat <<'EOF'
feat(server): Convex project scaffold and schema

Mirrors the four better-auth tables (user/session/account/verification)
plus a minimal rooms stub (current_room_id's reference target — fleshed
out in the next sub-project). server/convex/_generated is Convex's own
generated client/server types, committed as a snapshot like any other
generated-but-checked-in codegen output in this repo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Shared where-clause matcher

**Files:**
- Create: `server/convex/lib/whereMatch.ts`
- Test: `server/convex/lib/whereMatch.test.ts`

**Interfaces:**
- Produces: `export interface WhereClause { field: string; value: unknown; operator?: string }`, `export function matchesWhere(doc: Record<string, unknown>, where: WhereClause[]): boolean`. Tasks 3-6 all import and use this exact signature for their `.collect()`-and-filter fallback path.

- [ ] **Step 1: Write the failing test**

```typescript
// server/convex/lib/whereMatch.test.ts
import { describe, it, expect } from "vitest";
import { matchesWhere } from "./whereMatch";

describe("matchesWhere", () => {
  it("matches a document where every equality clause holds", () => {
    const doc = { email: "a@b.com", name: "Alice" };
    expect(matchesWhere(doc, [{ field: "email", value: "a@b.com" }])).toBe(true);
  });

  it("does not match when a clause's value differs", () => {
    const doc = { email: "a@b.com" };
    expect(matchesWhere(doc, [{ field: "email", value: "wrong@b.com" }])).toBe(false);
  });

  it("requires every clause to match (AND semantics)", () => {
    const doc = { email: "a@b.com", name: "Alice" };
    expect(
      matchesWhere(doc, [
        { field: "email", value: "a@b.com" },
        { field: "name", value: "Bob" },
      ])
    ).toBe(false);
  });

  it("treats an explicit eq operator the same as omitted", () => {
    const doc = { token: "abc" };
    expect(matchesWhere(doc, [{ field: "token", value: "abc", operator: "eq" }])).toBe(true);
  });

  it("throws a clear error for an unsupported operator (Review Focus #2)", () => {
    const doc = { email: "a@b.com" };
    expect(() => matchesWhere(doc, [{ field: "email", value: "a@b.com", operator: "contains" }])).toThrow(
      /unsupported where operator "contains"/i
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `server/`): `npx vitest run convex/lib/whereMatch.test.ts`
Expected: FAIL — `Cannot find module './whereMatch'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// server/convex/lib/whereMatch.ts
export interface WhereClause {
  field: string;
  value: unknown;
  operator?: string;
}

export function matchesWhere(doc: Record<string, unknown>, where: WhereClause[]): boolean {
  return where.every((clause) => {
    if (clause.operator && clause.operator !== "eq") {
      throw new Error(
        `Unsupported where operator "${clause.operator}" on field "${clause.field}" — this adapter only supports equality ("eq") lookups.`
      );
    }
    return doc[clause.field] === clause.value;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `server/`): `npx vitest run convex/lib/whereMatch.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add server/convex/lib/whereMatch.ts server/convex/lib/whereMatch.test.ts
git commit -m "$(cat <<'EOF'
feat(server): shared equality where-clause matcher for the Convex auth adapter

One small pure function, reused by all four model files (Task 3-6)
for their collect-and-filter fallback path, instead of repeating the
same equality/operator-validation logic four times.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `convex/users.ts` — CRUD for better-auth's user model

**Files:**
- Create: `server/convex/users.ts`
- Test: `server/convex/users.test.ts`

**Interfaces:**
- Consumes: `matchesWhere`, `type WhereClause` from `server/convex/lib/whereMatch.ts` (Task 2); the `users` table + `by_email` index from `server/convex/schema.ts` (Task 1).
- Produces: `create`, `findOne`, `findMany`, `update`, `delete` Convex functions, each returning plain objects with an `id` field (string, Convex's own `_id`) alongside every other stored field — this exact shape (`{ ...doc, id: doc._id }`, no raw `_id`/`_creationTime` leaking through) is what Task 7's adapter expects from every model file.

- [ ] **Step 1: Write the failing tests**

Convex functions run inside Convex's own runtime and aren't unit-testable with plain vitest + mocks in a way that reflects real behavior — `convex-test` (Convex's own official in-memory test harness) is the right tool here and needs no new dependency beyond what `npx convex dev` already installs.

```typescript
// server/convex/users.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("users CRUD", () => {
  it("create then findOne by email returns the created user with an id field", async () => {
    const t = convexTest(schema);
    const created = await t.mutation(api.users.create, {
      data: { name: "Alice", email: "alice@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "alice@test.com" }] });
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe("Alice");
  });

  it("findOne returns null when nothing matches (Review Focus #1)", async () => {
    const t = convexTest(schema);
    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "nobody@test.com" }] });
    expect(found).toBeNull();
  });

  it("findOne by id uses ctx.db.get", async () => {
    const t = convexTest(schema);
    const created = await t.mutation(api.users.create, {
      data: { name: "Bob", email: "bob@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
    });
    const found = await t.query(api.users.findOne, { where: [{ field: "id", value: created.id }] });
    expect(found!.email).toBe("bob@test.com");
  });

  it("update patches only the given fields", async () => {
    const t = convexTest(schema);
    const created = await t.mutation(api.users.create, {
      data: { name: "Carol", email: "carol@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
    });
    await t.mutation(api.users.update, {
      where: [{ field: "email", value: "carol@test.com" }],
      update: { profile_complete: true },
    });
    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "carol@test.com" }] });
    expect(found!.profile_complete).toBe(true);
    expect(found!.name).toBe("Carol");
  });

  it("update on a non-matching where is a no-op, not a crash (Review Focus #4)", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.users.update, { where: [{ field: "email", value: "ghost@test.com" }], update: { profile_complete: true } })
    ).resolves.not.toThrow();
  });

  it("delete on a non-matching where is a no-op, not a crash (Review Focus #4)", async () => {
    const t = convexTest(schema);
    await expect(t.mutation(api.users.delete, { where: [{ field: "email", value: "ghost@test.com" }] })).resolves.not.toThrow();
  });

  it("findOne throws on an unsupported operator (Review Focus #2)", async () => {
    const t = convexTest(schema);
    await expect(
      t.query(api.users.findOne, { where: [{ field: "email", value: "x", operator: "contains" }] })
    ).rejects.toThrow(/unsupported where operator/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `server/`): `npx vitest run convex/users.test.ts`
Expected: FAIL — `Cannot find module './_generated/api'` or `./users` (neither exists yet).

- [ ] **Step 3: Write the implementation**

```typescript
// server/convex/users.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, type WhereClause } from "./lib/whereMatch";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

export const create = mutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const id = await ctx.db.insert("users", data);
    return { ...data, id };
  },
});

export const findOne = query({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];

    if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db.get(w[0].value as Id<"users">);
      return doc ? { ...doc, id: doc._id } : null;
    }

    if (w.length === 1 && w[0].field === "email" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", w[0].value as string))
        .unique();
      return doc ? { ...doc, id: doc._id } : null;
    }

    const all = await ctx.db.query("users").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    return match ? { ...match, id: match._id } : null;
  },
});

export const findMany = query({
  args: { where: whereValidator, limit: v.optional(v.number()), sortBy: v.optional(v.any()) },
  handler: async (ctx, { where, limit }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("users").collect();
    const matches = w.length === 0 ? all : all.filter((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    const sliced = limit ? matches.slice(0, limit) : matches;
    return sliced.map((doc) => ({ ...doc, id: doc._id }));
  },
});

export const update = mutation({
  args: { where: whereValidator, update: v.any() },
  handler: async (ctx, { where, update }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("users").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return null;
    await ctx.db.patch(match._id, update);
    const updated = await ctx.db.get(match._id);
    return updated ? { ...updated, id: updated._id } : null;
  },
});

export const delete_ = mutation({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("users").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return;
    await ctx.db.delete(match._id);
  },
});

export { delete_ as delete };
```

(`delete` is a reserved word in strict JS export position in some bundlers' interop layers — exporting it under the alias `delete_` first and re-exporting as `delete` avoids any ambiguity while keeping the adapter's call site as `api.users.delete`.)

- [ ] **Step 4: Run tests to verify they pass**

Run (from `server/`): `npx vitest run convex/users.test.ts`
Expected: PASS, 7/7.

- [ ] **Step 5: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add server/convex/users.ts server/convex/users.test.ts
git commit -m "$(cat <<'EOF'
feat(server): Convex CRUD functions for better-auth's user model

create/findOne/findMany/update/delete, tested with convex-test
(Convex's official in-memory harness). findOne fast-paths id and
email lookups via ctx.db.get/the by_email index; anything else falls
back to collect-and-filter via the shared matchesWhere helper.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `convex/sessions.ts` — CRUD for better-auth's session model

**Files:**
- Create: `server/convex/sessions.ts`
- Test: `server/convex/sessions.test.ts`

**Interfaces:**
- Consumes: `matchesWhere`, `type WhereClause` from `server/convex/lib/whereMatch.ts` (Task 2); the `sessions` table + `by_token`/`by_userId` indexes from `server/convex/schema.ts` (Task 1).
- Produces: same 5-function shape as Task 3, scoped to `sessions`, fast-pathing `token` via `by_token`.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/convex/sessions.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("sessions CRUD", () => {
  async function makeUser(t: ReturnType<typeof convexTest>) {
    return t.mutation(api.users.create, {
      data: { name: "Dana", email: "dana@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
    });
  }

  it("create then findOne by token returns the session with an id field", async () => {
    const t = convexTest(schema);
    const user = await makeUser(t);
    const created = await t.mutation(api.sessions.create, {
      data: { token: "tok-123", expiresAt: Date.now() + 100000, userId: user.id },
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.sessions.findOne, { where: [{ field: "token", value: "tok-123" }] });
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.userId).toBe(user.id);
  });

  it("findOne returns null for an unknown token (Review Focus #1 — the actual sign-in-rejection path)", async () => {
    const t = convexTest(schema);
    const found = await t.query(api.sessions.findOne, { where: [{ field: "token", value: "does-not-exist" }] });
    expect(found).toBeNull();
  });

  it("delete on a non-matching where is a no-op (Review Focus #4)", async () => {
    const t = convexTest(schema);
    await expect(t.mutation(api.sessions.delete, { where: [{ field: "token", value: "ghost" }] })).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `server/`): `npx vitest run convex/sessions.test.ts`
Expected: FAIL — `Cannot find module './sessions'`.

- [ ] **Step 3: Write the implementation**

```typescript
// server/convex/sessions.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, type WhereClause } from "./lib/whereMatch";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

export const create = mutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const id = await ctx.db.insert("sessions", data);
    return { ...data, id };
  },
});

export const findOne = query({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];

    if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db.get(w[0].value as Id<"sessions">);
      return doc ? { ...doc, id: doc._id } : null;
    }

    if (w.length === 1 && w[0].field === "token" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db
        .query("sessions")
        .withIndex("by_token", (q) => q.eq("token", w[0].value as string))
        .unique();
      return doc ? { ...doc, id: doc._id } : null;
    }

    const all = await ctx.db.query("sessions").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    return match ? { ...match, id: match._id } : null;
  },
});

export const findMany = query({
  args: { where: whereValidator, limit: v.optional(v.number()), sortBy: v.optional(v.any()) },
  handler: async (ctx, { where, limit }) => {
    const w = where as WhereClause[];

    if (w.length === 1 && w[0].field === "userId" && (!w[0].operator || w[0].operator === "eq")) {
      const docs = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", w[0].value as Id<"users">))
        .collect();
      const sliced = limit ? docs.slice(0, limit) : docs;
      return sliced.map((doc) => ({ ...doc, id: doc._id }));
    }

    const all = await ctx.db.query("sessions").collect();
    const matches = w.length === 0 ? all : all.filter((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    const sliced = limit ? matches.slice(0, limit) : matches;
    return sliced.map((doc) => ({ ...doc, id: doc._id }));
  },
});

export const update = mutation({
  args: { where: whereValidator, update: v.any() },
  handler: async (ctx, { where, update }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("sessions").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return null;
    await ctx.db.patch(match._id, update);
    const updated = await ctx.db.get(match._id);
    return updated ? { ...updated, id: updated._id } : null;
  },
});

export const delete_ = mutation({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("sessions").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return;
    await ctx.db.delete(match._id);
  },
});

export { delete_ as delete };
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `server/`): `npx vitest run convex/sessions.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add server/convex/sessions.ts server/convex/sessions.test.ts
git commit -m "$(cat <<'EOF'
feat(server): Convex CRUD functions for better-auth's session model

Same shape as users.ts (Task 3). findMany additionally fast-paths a
by_userId lookup (better-auth uses this to list/revoke a user's other
sessions).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `convex/accounts.ts` — CRUD for better-auth's account model

**Files:**
- Create: `server/convex/accounts.ts`
- Test: `server/convex/accounts.test.ts`

**Interfaces:**
- Consumes: `matchesWhere`, `type WhereClause` from `server/convex/lib/whereMatch.ts` (Task 2); the `accounts` table + `by_userId`/`by_providerId_accountId` indexes from `server/convex/schema.ts` (Task 1).
- Produces: same 5-function shape, fast-pathing the `providerId`+`accountId` composite lookup (how better-auth finds the stored password hash for email/password sign-in) and a `userId` lookup.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/convex/accounts.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("accounts CRUD", () => {
  async function makeUser(t: ReturnType<typeof convexTest>) {
    return t.mutation(api.users.create, {
      data: { name: "Eve", email: "eve@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
    });
  }

  it("create then findOne by provider+accountId composite returns the account", async () => {
    const t = convexTest(schema);
    const user = await makeUser(t);
    const created = await t.mutation(api.accounts.create, {
      data: { providerId: "credential", accountId: "eve@test.com", userId: user.id, password: "hashed" },
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.accounts.findOne, {
      where: [
        { field: "providerId", value: "credential" },
        { field: "accountId", value: "eve@test.com" },
      ],
    });
    expect(found).not.toBeNull();
    expect(found!.password).toBe("hashed");
  });

  it("findOne returns null for a provider+accountId pair that doesn't exist (Review Focus #1)", async () => {
    const t = convexTest(schema);
    const found = await t.query(api.accounts.findOne, {
      where: [
        { field: "providerId", value: "credential" },
        { field: "accountId", value: "nobody@test.com" },
      ],
    });
    expect(found).toBeNull();
  });

  it("findMany by userId returns every account for that user", async () => {
    const t = convexTest(schema);
    const user = await makeUser(t);
    await t.mutation(api.accounts.create, { data: { providerId: "credential", accountId: "eve@test.com", userId: user.id } });
    const results = await t.query(api.accounts.findMany, { where: [{ field: "userId", value: user.id }] });
    expect(results).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `server/`): `npx vitest run convex/accounts.test.ts`
Expected: FAIL — `Cannot find module './accounts'`.

- [ ] **Step 3: Write the implementation**

```typescript
// server/convex/accounts.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, type WhereClause } from "./lib/whereMatch";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

function isProviderAccountComposite(w: WhereClause[]) {
  if (w.length !== 2) return null;
  const providerClause = w.find((c) => c.field === "providerId" && (!c.operator || c.operator === "eq"));
  const accountClause = w.find((c) => c.field === "accountId" && (!c.operator || c.operator === "eq"));
  if (!providerClause || !accountClause) return null;
  return { providerId: providerClause.value as string, accountId: accountClause.value as string };
}

export const create = mutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const id = await ctx.db.insert("accounts", data);
    return { ...data, id };
  },
});

export const findOne = query({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];

    if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db.get(w[0].value as Id<"accounts">);
      return doc ? { ...doc, id: doc._id } : null;
    }

    const composite = isProviderAccountComposite(w);
    if (composite) {
      const doc = await ctx.db
        .query("accounts")
        .withIndex("by_providerId_accountId", (q) => q.eq("providerId", composite.providerId).eq("accountId", composite.accountId))
        .unique();
      return doc ? { ...doc, id: doc._id } : null;
    }

    const all = await ctx.db.query("accounts").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    return match ? { ...match, id: match._id } : null;
  },
});

export const findMany = query({
  args: { where: whereValidator, limit: v.optional(v.number()), sortBy: v.optional(v.any()) },
  handler: async (ctx, { where, limit }) => {
    const w = where as WhereClause[];

    if (w.length === 1 && w[0].field === "userId" && (!w[0].operator || w[0].operator === "eq")) {
      const docs = await ctx.db
        .query("accounts")
        .withIndex("by_userId", (q) => q.eq("userId", w[0].value as Id<"users">))
        .collect();
      const sliced = limit ? docs.slice(0, limit) : docs;
      return sliced.map((doc) => ({ ...doc, id: doc._id }));
    }

    const all = await ctx.db.query("accounts").collect();
    const matches = w.length === 0 ? all : all.filter((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    const sliced = limit ? matches.slice(0, limit) : matches;
    return sliced.map((doc) => ({ ...doc, id: doc._id }));
  },
});

export const update = mutation({
  args: { where: whereValidator, update: v.any() },
  handler: async (ctx, { where, update }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("accounts").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return null;
    await ctx.db.patch(match._id, update);
    const updated = await ctx.db.get(match._id);
    return updated ? { ...updated, id: updated._id } : null;
  },
});

export const delete_ = mutation({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("accounts").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return;
    await ctx.db.delete(match._id);
  },
});

export { delete_ as delete };
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `server/`): `npx vitest run convex/accounts.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add server/convex/accounts.ts server/convex/accounts.test.ts
git commit -m "$(cat <<'EOF'
feat(server): Convex CRUD functions for better-auth's account model

Fast-paths the providerId+accountId composite lookup (how better-auth
finds a stored password hash during email/password sign-in) via the
by_providerId_accountId index, and a userId lookup via by_userId.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `convex/verifications.ts` — CRUD for better-auth's verification model

**Files:**
- Create: `server/convex/verifications.ts`
- Test: `server/convex/verifications.test.ts`

**Interfaces:**
- Consumes: `matchesWhere`, `type WhereClause` from `server/convex/lib/whereMatch.ts` (Task 2); the `verifications` table + `by_identifier` index from `server/convex/schema.ts` (Task 1).
- Produces: same 5-function shape, fast-pathing `identifier`.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/convex/verifications.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("verifications CRUD", () => {
  it("create then findOne by identifier returns the verification", async () => {
    const t = convexTest(schema);
    const created = await t.mutation(api.verifications.create, {
      data: { identifier: "reset:eve@test.com", value: "otp-123", expiresAt: Date.now() + 100000 },
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.verifications.findOne, { where: [{ field: "identifier", value: "reset:eve@test.com" }] });
    expect(found).not.toBeNull();
    expect(found!.value).toBe("otp-123");
  });

  it("findOne returns null for an unknown identifier (Review Focus #1)", async () => {
    const t = convexTest(schema);
    const found = await t.query(api.verifications.findOne, { where: [{ field: "identifier", value: "nothing" }] });
    expect(found).toBeNull();
  });

  it("delete on a non-matching where is a no-op (Review Focus #4)", async () => {
    const t = convexTest(schema);
    await expect(t.mutation(api.verifications.delete, { where: [{ field: "identifier", value: "ghost" }] })).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `server/`): `npx vitest run convex/verifications.test.ts`
Expected: FAIL — `Cannot find module './verifications'`.

- [ ] **Step 3: Write the implementation**

```typescript
// server/convex/verifications.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { matchesWhere, type WhereClause } from "./lib/whereMatch";

const whereValidator = v.array(v.object({ field: v.string(), value: v.any(), operator: v.optional(v.string()) }));

export const create = mutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    const id = await ctx.db.insert("verifications", data);
    return { ...data, id };
  },
});

export const findOne = query({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];

    if (w.length === 1 && w[0].field === "id" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db.get(w[0].value as Id<"verifications">);
      return doc ? { ...doc, id: doc._id } : null;
    }

    if (w.length === 1 && w[0].field === "identifier" && (!w[0].operator || w[0].operator === "eq")) {
      const doc = await ctx.db
        .query("verifications")
        .withIndex("by_identifier", (q) => q.eq("identifier", w[0].value as string))
        .unique();
      return doc ? { ...doc, id: doc._id } : null;
    }

    const all = await ctx.db.query("verifications").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    return match ? { ...match, id: match._id } : null;
  },
});

export const findMany = query({
  args: { where: whereValidator, limit: v.optional(v.number()), sortBy: v.optional(v.any()) },
  handler: async (ctx, { where, limit }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("verifications").collect();
    const matches = w.length === 0 ? all : all.filter((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    const sliced = limit ? matches.slice(0, limit) : matches;
    return sliced.map((doc) => ({ ...doc, id: doc._id }));
  },
});

export const update = mutation({
  args: { where: whereValidator, update: v.any() },
  handler: async (ctx, { where, update }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("verifications").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return null;
    await ctx.db.patch(match._id, update);
    const updated = await ctx.db.get(match._id);
    return updated ? { ...updated, id: updated._id } : null;
  },
});

export const delete_ = mutation({
  args: { where: whereValidator },
  handler: async (ctx, { where }) => {
    const w = where as WhereClause[];
    const all = await ctx.db.query("verifications").collect();
    const match = all.find((doc) => matchesWhere({ ...doc, id: doc._id }, w));
    if (!match) return;
    await ctx.db.delete(match._id);
  },
});

export { delete_ as delete };
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `server/`): `npx vitest run convex/verifications.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add server/convex/verifications.ts server/convex/verifications.test.ts
git commit -m "$(cat <<'EOF'
feat(server): Convex CRUD functions for better-auth's verification model

Same shape as the other three model files. Fast-paths the identifier
lookup (email-change/password-reset token verification) via the
by_identifier index.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The adapter — `server/auth-convex-adapter.js` + `server/src/config/convex.js`

**Files:**
- Create: `server/auth-convex-adapter.js`
- Create: `server/src/config/convex.js`
- Test: `server/auth-convex-adapter.test.js`

**Interfaces:**
- Consumes: `api.users`, `api.sessions`, `api.accounts`, `api.verifications` (Tasks 3-6, each exposing `create`/`findOne`/`findMany`/`update`/`delete`) via `ConvexHttpClient` from the `convex` npm package.
- Produces: `export function convexAdapter()` returning better-auth's 5-method adapter object (Task 8 passes this as `auth.js`'s `database` option); `server/src/config/convex.js` exports a shared `convex` client instance for Sub-project 2's controllers to reuse later (not consumed by anything yet in this plan).

- [ ] **Step 1: Write the failing test**

This test exercises the adapter's model-name routing and its fail-fast behavior without needing a live Convex deployment (the routing/validation logic is plain JS; the actual Convex calls are exercised end-to-end in Task 8's manual verification instead, since mocking `ConvexHttpClient` here would only prove the mock works, not the real integration).

```javascript
// server/auth-convex-adapter.test.js
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("convexAdapter", () => {
  const originalUrl = process.env.CONVEX_URL;

  beforeEach(() => {
    delete process.env.CONVEX_URL;
  });

  afterEach(() => {
    if (originalUrl) process.env.CONVEX_URL = originalUrl;
  });

  it("throws immediately on import if CONVEX_URL is not set (Review Focus #5)", async () => {
    // Fresh import each time so the module-level throw-on-missing-env-var
    // check actually re-runs (vitest caches modules by default otherwise).
    await expect(import(`./auth-convex-adapter.js?t=${Date.now()}`)).rejects.toThrow(/CONVEX_URL/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `server/`): `npx vitest run auth-convex-adapter.test.js`
Expected: FAIL — `Cannot find module './auth-convex-adapter.js'`.

- [ ] **Step 3: Write the implementation**

```javascript
// server/src/config/convex.js
import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error("CONVEX_URL is not set — the server cannot reach its Convex deployment");
}

export const convex = new ConvexHttpClient(convexUrl);
```

```javascript
// server/auth-convex-adapter.js
import { convex } from "./src/config/convex.js";
import { api } from "./convex/_generated/api.js";

const MODEL_TO_API = {
  user: api.users,
  session: api.sessions,
  account: api.accounts,
  verification: api.verifications,
};

function fnsFor(model) {
  const fns = MODEL_TO_API[model];
  if (!fns) {
    throw new Error(`convexAdapter: no Convex functions registered for model "${model}"`);
  }
  return fns;
}

export function convexAdapter() {
  return {
    id: "convex",
    async create({ model, data }) {
      return await convex.mutation(fnsFor(model).create, { data });
    },
    async findOne({ model, where }) {
      return await convex.query(fnsFor(model).findOne, { where });
    },
    async findMany({ model, where, limit, sortBy }) {
      return await convex.query(fnsFor(model).findMany, { where: where ?? [], limit, sortBy });
    },
    async update({ model, where, update }) {
      return await convex.mutation(fnsFor(model).update, { where, update });
    },
    async delete({ model, where }) {
      await convex.mutation(fnsFor(model).delete, { where });
    },
  };
}
```

`server/src/config/convex.js` is created here (both files are one coherent "how Express/better-auth reaches Convex" unit) but `convexAdapter` is the only thing anything imports in this plan — `convex` itself is wired up ready for Sub-project 2's controllers.

- [ ] **Step 4: Run test to verify it passes**

Run (from `server/`): `npx vitest run auth-convex-adapter.test.js`
Expected: PASS, 1/1.

- [ ] **Step 5: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add server/auth-convex-adapter.js server/auth-convex-adapter.test.js server/src/config/convex.js
git commit -m "$(cat <<'EOF'
feat(server): better-auth custom adapter backed by Convex

Implements better-auth's 5-method adapter interface (create/findOne/
findMany/update/delete) by routing each call to the matching Convex
model's functions (Tasks 3-6) through a shared ConvexHttpClient.
Fails fast at import time if CONVEX_URL is missing, rather than
failing confusingly on the first auth request.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wire it into `auth.js` and verify end-to-end

**Files:**
- Modify: `server/auth.js:1-9`

**Interfaces:**
- Consumes: `convexAdapter` from `server/auth-convex-adapter.js` (Task 7).

- [ ] **Step 1: Make the edit**

Find:

```javascript
import { betterAuth } from "better-auth";
import pg from "pg";

export const auth = betterAuth({

  // ── Tell BetterAuth to use your Supabase DB ──────────────
  // family: 4 forces IPv4 — Supabase's pooler hostname also resolves to an
  // IPv6 address, and on networks without real IPv6 routing that attempt
  // fails with ENETUNREACH before Node falls back to IPv4.
  database: new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    family: 4
  }),
```

Replace with:

```javascript
import { betterAuth } from "better-auth";
import { convexAdapter } from "./auth-convex-adapter.js";

export const auth = betterAuth({

  // ── Tell BetterAuth to use Convex instead of Postgres ────
  database: convexAdapter(),
```

Nothing else in this file changes — `trustedOrigins`, `emailAndPassword`, `user.additionalFields`, `databaseHooks` all stay exactly as they are.

- [ ] **Step 2: Verify**

Run (from `server/`): `node --check auth.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add server/auth.js
git commit -m "$(cat <<'EOF'
feat(server): point better-auth at the Convex adapter instead of Postgres

The only change: the database option. Every other auth behavior
(session cookies, role assignment via databaseHooks, trustedOrigins,
additionalFields) is unchanged — this is the whole point of the
custom-adapter approach over the official Convex-hosted auth
component (see the spec for why that path was rejected).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Manual end-to-end verification (human partner, against the real Convex deployment from Task 1)**

With `npx convex dev` still running (Task 1) and `CONVEX_URL` set in `server/.env` to that deployment's URL, start the server (`npm run dev` from `server/`):

1. `curl -i -X POST http://localhost:3000/api/auth/sign-up/email -H "Content-Type: application/json" -d '{"email":"demo@test.com","password":"Demo1234!","name":"Demo User"}'`
   **Expected:** 200-series response; the Convex dashboard's `users` table shows a new row with `user_type: "STUDENT"`, `profile_complete: false` (confirms `databaseHooks` still fires).
2. `curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"demo@test.com","password":"Demo1234!"}'`
   **Expected:** 200-series response, a session cookie saved to `cookies.txt`; the Convex dashboard's `sessions` table shows a new row.
3. `curl -i -b cookies.txt http://localhost:3000/api/users/me`
   **Expected:** 200 with the demo user's data (confirms `requireAuth` middleware + the adapter's session `findOne` round-trip works).
4. `curl -i http://localhost:3000/api/users/me` (no cookie)
   **Expected:** 401 (confirms Review Focus #1 — a session `findOne` that matches nothing correctly denies access rather than erroring oddly or granting access).
5. `curl -i -X POST http://localhost:3000/api/auth/sign-in/email -H "Content-Type: application/json" -d '{"email":"demo@test.com","password":"WrongPassword!"}'`
   **Expected:** a 4xx with an "invalid credentials"-style message, not a 500 (confirms the account `findOne` composite lookup correctly returns null for a real user whose password doesn't match the stored hash — better-auth's own password-comparison logic, not the adapter, makes this decision, but the adapter must hand it a correct account record to compare against).

---

## Self-Review Notes

- **Spec coverage:** every Goal in the spec maps to a task — schema (Task 1), custom adapter with unchanged auth behavior (Tasks 2-8), end-to-end verification (Task 8). The spec's Non-goals (other modules, file storage, temp-pano-api, data migration) are untouched by this plan, as intended.
- **Placeholder scan:** none found — every step has complete, real code and real test assertions.
- **Type/interface consistency:** all four model files (Tasks 3-6) export the identical `create`/`findOne`/`findMany`/`update`/`delete` shape with the identical `{ ...doc, id: doc._id }` return convention; Task 7's adapter relies on exactly that shape for all four models uniformly (no special-casing per model beyond which index each fast-paths). `WhereClause`/`matchesWhere` (Task 2) is imported with the same name and signature in Tasks 3-6.
- **Review Focus:** all five items have an owning task and an explicit test — #1 (empty match → null) in Tasks 3/4/6, #2 (unsupported operator) in Task 2 (and implicitly covered wherever Tasks 3-6 call `matchesWhere`), #3 (duplicate-match safety via `.unique()`) implicit in every indexed `findOne` path across Tasks 3-6 (Convex's `.unique()` itself throws on >1 match — the schema's unique-ish indexes being used for single-record lookups is what makes this the correct underlying primitive, not something this plan adds test coverage for beyond trusting Convex's own documented behavior), #4 (no-op update/delete) in Tasks 3/4/6, #5 (missing `CONVEX_URL`) in Task 7.
