# KayaCampus — Architecture & Developer Guide

Student hostel discovery and booking for university campuses. Students browse
and book rooms, hostel managers list and manage properties, administrators
approve listings and oversee the platform.

> **Naming**: the product is **KayaCampus** (what users see in the UI). The
> repository, package names, and most code comments say **CampusNest** — an
> earlier name. They refer to the same system. The rebrand was never carried
> through the codebase, so expect both.

This document explains how the system is put together and *why* it is put
together that way. For the request-by-request API surface see
[`server/API_ENDPOINTS.md`](server/API_ENDPOINTS.md); for how to run the test
suite see [`server/TEST.md`](server/TEST.md).

---

## 1. The shape of the system

Three deployable pieces plus a managed backend:

```
┌──────────────────┐        ┌─────────────────────┐        ┌──────────────────┐
│  client/         │  HTTP  │  server/            │        │  Convex          │
│  React 19 SPA    │───────▶│  Express 5 API      │───────▶│  (managed)       │
│  Vite, Tailwind  │ cookie │  better-auth        │ secret │  DB + functions  │
└──────────────────┘  auth  └─────────────────────┘        │  + file storage  │
                                      │                    └──────────────────┘
                                      │ internal key               ▲
                                      ▼                            │
                             ┌─────────────────────┐               │
                             │  temp-pano-api      │───────────────┘
                             │  FastAPI + Pannellum│  pano secret
                             │  360° tile renderer │
                             └─────────────────────┘
```

| Piece | Stack | Role |
|---|---|---|
| `client/` | React 19, React Router 7, Tailwind 4, shadcn/ui + Radix, lucide, Vite, TypeScript | Single-page app. Student, manager and admin surfaces. |
| `server/` | Node, Express 5, better-auth 1.5, Zod 4, helmet, multer 2 | The only thing the browser talks to. Owns auth, authorization, validation. |
| `server/convex/` | Convex 1.46 (TypeScript) | Database schema, every data function, file storage, one public HTTP route. |
| `temp-pano-api` | Python, FastAPI, Pannellum, Pillow, pyshtools | Turns one equirectangular photo into a multiresolution 360° tour. **Separate git repository.** |

### Why Convex, and what that costs

The platform originally ran on Supabase (Postgres + Storage). It was migrated
to Convex because the free tier paused the project after inactivity, which
caused repeated outages — and eventually the Supabase project was deleted
outright, taking the database with it. Convex is now the **only** datastore.

Convex is not a drop-in Postgres replacement, and three of its properties
shape most of the design decisions in this codebase:

1. **No SQL, no joins.** Every read is a function that walks indexes and
   assembles its own result. Nested payloads are hand-built.
2. **No `ON DELETE CASCADE`, no `CHECK`, no `UNIQUE`.** All three are
   reimplemented in mutation code.
3. **No paths in file storage.** Every stored file gets an opaque id and an
   unrelated URL.

Each of those has a dedicated section below.

---

## 2. Request lifecycle

A typical authenticated write, end to end:

```
browser
  │  fetch("/api/rooms/:id", { credentials: "include" })   ← session cookie
  ▼
helmet ─▶ cors ─▶ express.json
  │
  ▼
requireAuth            auth.api.getSession(headers) → better-auth → Convex
  │                    sets req.user
  ▼
requireRole("…")       role gate, from req.user.user_type
  │
  ▼
verifyRoomOwnership    does this manager own the room's hostel?
  │
  ▼
validateRequest(zodSchema)   replaces req.body with the PARSED result
  │
  ▼
controller             business rules, HTTP status codes, response envelope
  │  cq()/cm()/ca()    injects CONVEX_ADAPTER_SECRET
  ▼
Convex function        secureQuery/secureMutation → checks the secret
  │                    normalizeId → index reads → toApiRow
  ▼
errorHandler           anything thrown lands here
```

Three details in that chain matter more than they look:

**`express.json()` is mounted *after* the auth router, on purpose.** better-auth's
`toNodeHandler` reads the raw request stream, so a body parser running first
would consume it and break every auth route. If you add global middleware,
mind which side of `app.use("/api/auth", authRouter)` it lands on.

**Rate limiting is per-route, not global.** `signInLimiter` and
`registrationLimiter` from `middlewares/rateLimit.middleware.js` are applied
only to sign-in and registration in `auth.routes.js`. Nothing else is rate
limited.

**`validateRequest` replaces the body.** It assigns Zod's *parsed* output back
onto `req.body`. Because `z.object` strips unknown keys, the HTTP layer is a
closed allow-list: a field absent from a schema cannot reach a controller.
Several defences downstream rely on this.

**Response envelope is uniform.** Every endpoint returns
`{ success: true, data }` or `{ success: false, message }`. The client's
`apiClient.ts` unwraps it and throws `ApiError` on non-2xx.

---

## 3. Authentication

better-auth handles sessions, password hashing and cookies. It normally ships
with Postgres/MySQL adapters; this app uses a **custom adapter** that
implements better-auth's storage interface against Convex
(`server/auth-convex-adapter.js`).

```
better-auth  ──▶  createAdapterFactory({ config, adapter })
                        │
                        ├─ create / findOne / findMany / update / delete
                        ├─ updateMany / deleteMany / count
                        ▼
                  convex/users.ts, sessions.ts, accounts.ts, verifications.ts
```

Writing that adapter surfaced several non-obvious requirements, all of which
are load-bearing:

- **It must be wrapped in `createAdapterFactory`.** A plain object with the
  five documented methods is rejected at init with
  `BetterAuthError: Failed to initialize database adapter`.
- **`disableIdGeneration: true`.** better-auth otherwise generates its own
  32-char ids, which are not valid Convex `Id<>` values and break every
  foreign key.
- **`customTransformInput`/`customTransformOutput`** convert `Date` ⇄ epoch
  milliseconds, and drop `null` (Convex's `v.optional()` accepts an absent
  key, not a null one).
- **`connector` must be stripped** from where-clauses. better-auth adds it to
  every clause; Convex's validators reject unknown fields.
- **Where-clauses are equality-only.** Anything else throws a named error.
  better-auth's email/password flow only ever sends equality, but features
  like multi-session revoke would send `gt`/`in` and need work first.

### Roles

`user_type` is one of `STUDENT`, `HOSTEL_MANAGER`, `ADMIN`.

Role assignment is deliberately locked down in layers:

| Path | Effect |
|---|---|
| better-auth signup | `databaseHooks` forces `STUDENT` |
| better-auth's `/update-user` | `additionalFields` mark `user_type` and `profile_complete` as `input: false`, so a signed-in user cannot set them |
| `POST /api/auth/register` | Zod pins `user_type` to the literal `HOSTEL_MANAGER` |
| `POST /api/users` (create admin) | itself `requireRole("ADMIN")` |

**Consequence worth knowing:** a fresh deployment has *no* admin, and there is
no in-app way to create the first one. Since hostel approval is admin-only and
new hostels start `PENDING`, nothing can go live until an admin exists. The
seed script creates one (§8); otherwise promote a user from the Convex
dashboard.

---

## 4. Data layer

### Tables

16 tables in `server/convex/schema.ts`. Four belong to better-auth; the rest
are the domain.

```
auth        users · sessions · accounts · verifications
hostels     hostels · hostelImages · hostelAmenities · bankAccounts
rooms       rooms · roomImages · roomAmenities · roomTourScenes
activity    bookings · reviews · complaints
tours       tourFiles
```

Enums are `v.union(v.literal(...))`: `user_type`, `room_type`
(SINGLE/DOUBLE/TRIPLE/QUAD), `booking_status`
(PENDING/CONFIRMED/CANCELLED/CHECKED_OUT), `complaint_status`
(OPEN/IN_PROGRESS/RESOLVED), `hostel_status` (PENDING/APPROVED/REJECTED), and
an 11-value `amenity_name`.

`bankAccounts` exists for schema parity with the old Postgres schema; no
server code touches it yet.

### Conventions every Convex function follows

These are invariants, not style preferences. Breaking one tends to produce a
500, a silent data leak, or counter drift.

**1. Normalize every client-supplied id.**

```ts
const roomId = ctx.db.normalizeId("rooms", id);
if (!roomId) return null;          // queries return null, mutations throw
const room = await ctx.db.get(roomId);
```

Passing a raw string to `ctx.db.get` throws, which surfaces as a 500. This is
what keeps `GET /api/rooms/123` a clean 404.

**2. Never export a bare `query`/`mutation`/`action`.** Everything is wrapped:

```ts
export const findOne = secureQuery({ where: whereValidator }, handler);
```

`convex/lib/secureFunction.ts` requires a shared secret on every call. Without
it, Convex functions are *publicly callable by anyone with the deployment
URL* — an early review found all 20 functions exposed that way, readable
straight from the browser bundle.

**3. Two serializers, never mixed.**

| Helper | Used by | Behaviour |
|---|---|---|
| `toApiDoc` | the four auth tables | renames `_id`→`id`, drops `_creationTime`, leaves dates as numbers |
| `toApiRow` | every business table | same, **plus** converts date fields to ISO 8601 strings |

better-auth does its own date conversion and expects raw numbers; the frontend
expects ISO strings. Swapping them breaks sign-in or every date display
respectively.

**4. Response keys reproduce the old PostgREST shapes.** Convex tables are
lowercase plural; the JSON keys are not:

```
booking.ROOM.HOSTEL.hostel_name      hostel.HOSTEL_IMAGE_URLS[]
booking.USERS.email                  room.ROOM_TOUR_SCENES[]
hostel.manager.email                 hostel.HOSTEL_AMENITY[]
```

This mismatch is deliberate: it kept the frontend contract stable through the
migration. Business field names stay `snake_case` (`hostel_name`,
`price_per_bed`), while better-auth's own fields stay camelCase
(`emailVerified`, `createdAt`).

**5. Errors Express must distinguish carry a structured code.**

```ts
throw new ConvexError({ code: "ROOM_AT_CAPACITY" });   // Convex side
if (err.data?.code === "ROOM_AT_CAPACITY") return res.status(409)…   // Express
```

Convex **redacts a plain `Error`'s message in production deployments**. Code
that matched on message text passed every test in development and would have
silently degraded a deliberate 409 into a generic error in production. Four
codes are in use: `ROOM_AT_CAPACITY`, `DUPLICATE_AMENITY`, `HOSTEL_NOT_FOUND`,
`ROOM_NOT_FOUND`. Everything else is a plain `Error` that becomes a 500, as
intended.

**6. A service must never copy a Convex error's message into an error that
carries a `statusCode`.** `errorHandler` treats any `statusCode`-bearing error
as deliberate and returns its message to the client. A Convex argument error
echoes the whole args object — *including the adapter secret*. One such site
existed and was fixed; don't reintroduce the pattern.

### Replacing what Postgres gave for free

| Postgres feature | How it works now |
|---|---|
| `ON DELETE CASCADE` | Explicit. `rooms.remove` deletes the room's images, tour scenes, amenities and bookings, and clears `users.current_room_id` — all in one mutation. |
| `UNIQUE(email)`, `UNIQUE(hostel_id, name)` | An indexed `.unique()` lookup inside the same mutation as the insert. Convex mutations are serializable, so the read establishes a conflict dependency and a racing insert retries. |
| `CHECK(rating BETWEEN 1 AND 5)` | Validated in `reviews.create`, behind Zod's `.int().min(1).max(5)` at the HTTP boundary. |
| `count(*)` | `countByManager` collects an index range and takes `.length`. |
| `ORDER BY` | `lib/applySort.ts`, applied before any limit. |
| `ILIKE '%term%'` | Case-insensitive JS filter after an indexed narrow. |

### Derived counters

`hostels.total_rooms`/`available_rooms`, `rooms.current_occupancy` and
`users.current_room_id` are **derived state**, maintained transactionally by
the mutations that own them — `rooms.create`, `rooms.update`, `rooms.remove`,
`bookings.updateStatus`. Nothing else may write them, and the HTTP schemas
deliberately refuse those fields.

The occupancy rule is symmetric: **+1 on entering `CONFIRMED`, −1 on leaving
it for any other status.** An earlier version enumerated only CANCELLED and
CHECKED_OUT as exits, so `CONFIRMED → PENDING` silently kept the bed occupied
and re-confirming counted the same student twice.

`bookings.updateStatus` is the densest mutation in the codebase. One
transaction writes the status, applies the occupancy delta, recomputes
`is_available`, adjusts the hostel's `available_rooms` *only if that flag
actually flipped*, and sets or clears the student's `current_room_id`. Under
Supabase this was five separate round trips that could disagree with each
other on a partial failure.

---

## 5. Authorization model

Three layers, each doing a different job:

1. **`requireAuth`** — resolves the better-auth session, sets `req.user`.
2. **`requireRole(role)`** — strict equality on `user_type`.
3. **`verifyHostelOwnership` / `verifyRoomOwnership`** — does this user
   actually own the resource named in the URL? ADMIN bypasses.

On top of that, controllers scope *reads* so one tenant cannot see another's:

- A STUDENT's `student_id` is forced to `req.user.id`, overriding any query
  string they send.
- A HOSTEL_MANAGER listing bookings or complaints is scoped to their own
  hostels (for bookings, by resolving manager → hostels → rooms → bookings).
- `getBookingById` / `getComplaintById` 403 a student who doesn't own the row
  and a manager who doesn't manage its hostel.

### The child-id trap

Routes gate on a **parent** id in the URL (`/hostels/:id/amenities/:amenityId`),
but the mutation receives the **child** id. Without an explicit check, a
manager who owns hostel A can delete hostel B's amenity by passing its id.

Every mutation taking a child-row id therefore takes its parent id too and
verifies the relationship, returning an indistinguishable no-op on mismatch so
the endpoint leaks nothing about other tenants' rows. This applies to
`removeHostelAmenity`, `removeRoomAmenity` and `removeTourScene`. **If you add
another child-id mutation, it needs the same treatment.**

---

## 6. File storage

Convex storage is flat: you hand it bytes, you get an opaque id and a URL like
`https://<deployment>.convex.cloud/api/storage/<uuid>`. There are no folders
and no way to choose a filename.

Two upload paths, because Convex caps a function's **arguments** at 16MB:

| Path | Used for | Mechanism |
|---|---|---|
| `uploadImageToConvex` | hostel/room photos (≤10MB) | bytes as a `v.bytes()` argument to the `files.storeImage` action |
| `uploadLargeFileToConvex` | panoramas (≤20MB) | asks for an upload URL, POSTs the bytes directly, resolves the returned id |

Two implementation notes that are easy to get wrong:

- **Buffer slicing.** multer's `Buffer` is a view into Node's shared pool, so
  `file.buffer.buffer` would ship unrelated neighbouring bytes. The code slices
  at `byteOffset`/`byteLength`.
- **Mimetypes come from the validated `mimetype`, never `originalname`.** That
  field is attacker-controlled, and the old Supabase helper used it to build a
  storage path.

### 360° tours — and why they needed a custom route

Pannellum renders a multiresolution tour as a *tree* of tiles plus a
`config.json` whose `multiRes.path` is a **wildcard template**:

```json
{ "type": "multires",
  "multiRes": { "path": "/%l/%s%y_%x", "extension": "jpg", "maxLevel": 3 } }
```

The viewer interpolates level/x/y into that template and resolves it against a
`basePath`. On Supabase Storage this worked because folders existed. On Convex
there is **no path to interpolate into** — so tiled tours need a resolver:

```
tourFiles table          (tour_id, path) ──▶ storage_id

convex/http.ts           GET /tour/<tourId>/<path>
                           ├─ internalQuery lookup → storage_id
                           └─ stream the blob, long cache, CORS open
```

`temp-pano-api` uploads each tile, registers the relative path Pannellum will
later request, then rewrites `config.json` with an **absolute**
`multiRes.basePath` pointing at `https://<deployment>.convex.site/tour/<id>`.

The absolute form is required, not cosmetic: the frontend hands Pannellum a
config *object* over `postMessage`, so there is no document location for a
relative path to resolve against.

Reads on `/tour/` are public and unauthenticated — the browser's viewer fetches
tiles directly, exactly as it did from a public Supabase bucket. *Writing*
requires a secret. Re-registering a path replaces the row and deletes the file
it displaced, so regenerating a tour cannot accumulate unreachable tiles.

---

## 7. Secrets and trust boundaries

| Secret | Held by | Grants |
|---|---|---|
| `CONVEX_ADAPTER_SECRET` | `server/` only | every Convex function — effectively the whole database |
| `PANO_CONVEX_SECRET` | `temp-pano-api` | only the two tour-upload functions |
| `INTERNAL_API_KEY` / `PANO_API_KEY` | both, as a pair | the pano service's own endpoint |
| `BETTER_AUTH_SECRET` | `server/` only | session signing |

The pano service gets its **own** Convex secret on purpose. Sharing the adapter
secret would mean a compromise of the Python service yielded session tokens,
password hashes and the ability to self-promote to ADMIN. With a scoped
secret, the worst case is writing files nothing references.

Error handling enforces the same boundary. `errorHandler` returns a message to
the client **only** for errors carrying their own `statusCode` (deliberate
application errors like `UserServiceError`). Everything else gets a generic
`"Internal Server Error"` with no stack, because Convex argument errors echo
their args — secret included — into the message. Both `message` and `stack`
are gated on that same condition; gating only `message` leaks it via the stack,
since a JS stack string begins with the message.

---

## 8. Running it

### Prerequisites

Node 22 (what this is developed against — no `engines` field is declared),
npm, and a Convex account. Python 3.11+ only if you need tour generation.

### Backend

```bash
cd server
npm install
npx convex dev                 # provisions a deployment, writes .env.local
cp .env.example .env           # then fill it in
npx convex env set CONVEX_ADAPTER_SECRET "$(openssl rand -hex 32)"
npx convex env set PANO_CONVEX_SECRET   "$(openssl rand -hex 32)"
# put those same two values in server/.env
npm run dev                    # :3000
```

Startup prints a Convex connectivity check. If it fails, the secret or URL is
wrong — the server will start but every data call will fail.

### Seed data

A fresh deployment is empty, so every listing renders blank. The seed creates
a manager, a student and an **admin** (without which no hostel can be
approved), two hostels, three rooms with amenities and images, and a confirmed
booking:

```bash
cd server && node scripts/seed.mjs
```

It refuses to run against a non-`dev:` deployment, and refuses to touch a
deployment that already holds seed data, reporting whether that data is
complete or partial. `SEED_ALLOW_NON_DEV=1` overrides the first check
deliberately. Credentials are printed on success and are intentionally
well-known — **never run this against anything public.**

### Frontend

```bash
cd client && npm install && npm run dev    # :5173
```

Set `CORS_ORIGIN` on the server to match if you change the port.

### Tour service

```bash
cd temp-pano-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # CONVEX_URL, CONVEX_SITE_URL, PANO_CONVEX_SECRET, INTERNAL_API_KEY
uvicorn main:app --reload --port 8000
```

### Tests

```bash
cd server && npm run test:run
```

Roughly 200 tests. The meaningful coverage is the Convex function tests
(`convex/*.test.ts`), which run against `convex-test`'s in-memory backend, plus
Express unit tests that mock `src/config/convexClient.js`.

Be aware that the oldest Express tests assert only
`expect([200, 404, 500]).toContain(res.statusCode)` — they pass almost
regardless of behaviour and are not a safety net. They are retained because
they do catch import-time crashes.

Two things `convex-test` cannot exercise, and which are therefore verified
against a real deployment instead: `storage.generateUploadUrl` (so the whole
large-file upload path) and production error redaction.

---

## 9. Repository layout

```
client/
  src/
    pages/          Explore, Home, Booking, Profile, LivePreview, Login…
      manager/      ManagerDashboard, ManagerBookings, ManagerPayouts…
      admin/        AdminDashboard, AdminHostels, AdminUsers, AdminSchools…
    components/     shadcn/ui primitives + app components
    contexts/       AuthContext (real session), BookingContext (mock)
    lib/            apiClient.ts (fetch + envelope), auth.ts (auth calls)
    data/           static/mock fixtures

server/
  auth.js                     better-auth configuration
  auth-convex-adapter.js      better-auth → Convex storage adapter
  convex/
    schema.ts                 16 tables, indexes, enums
    users|sessions|accounts|verifications.ts   auth tables (adapter-facing)
    hostels|rooms|bookings|reviews|complaints|amenities.ts   domain functions
    files.ts                  storage: store, upload URL, list, delete
    tours.ts                  tiled-tour upload + registration
    http.ts                   public GET /tour/<id>/<path>
    lib/                      secureFunction, toApiRow, toApiDoc, applySort…
  src/
    app.js, server.js         Express wiring, startup checks
    config/                   convex client, cq/cm/ca secret-injecting helpers
    middlewares/              auth, ownership, validate, upload, rateLimit, errors
    modules/<domain>/         controller + routes + Zod schema per domain
    utils/convexStorage.js    both upload paths
  scripts/seed.mjs            demo data, with dev-only guards
  tests/                      Express-side tests

temp-pano-api/                SEPARATE GIT REPO
  main.py                     FastAPI endpoint, internal-key gated
  processor.py                drives Pannellum generate.py
  convex_uploader.py          uploads tiles + rewrites config basePath
  scripts/generate.py         vendored Pannellum tiler
```

---

## 10. Known gaps

Honest list, so nobody rediscovers these the hard way.

**Frontend is mostly not wired.** Only authentication and the user profile
talk to the backend. Explore, Home, bookings, and the manager/admin pages
render local fixtures from `src/data/` and component state. The backend is
complete and tested; connecting the UI is outstanding work. A
`demo-dummy-data` branch exists for demoing the UI with no backend at all.

**List endpoints are unpaginated.** They `.collect()` whole index ranges and
resolve nested rows per row (an N+1). Fine at demo scale; `bookings.list` for
an ADMIN and `rooms.list` with no hostel filter are the first that will hit
Convex's read limits.

**Equality-only where-clauses in the auth adapter.** Enabling better-auth
features that query with `gt`/`lt`/`in` (multi-session revoke, verification
cleanup) requires extending `lib/whereMatch.ts` first.

**`bankAccounts` is unused**, and there is no `DELETE /api/hostels/:id`, so
hostel-level cascade deletion is unimplemented.

**Dead Supabase references remain in prose.** `src/utils/*.sql` are kept as
historical reference (the schema file carries a banner saying so); the root
`README.md` still documents a Supabase setup step. The old Supabase credentials
are in `temp-pano-api`'s git history and should be considered exposed — that
project is deleted, so they are moot.

**`temp-pano-api` is a separate repository.** Commits there do not belong to
this repo; this repo only tracks a pointer to it. It is also currently not
called by the server — Express stores single-image tours itself — so tiled
tours need that integration re-enabled to be reachable.
