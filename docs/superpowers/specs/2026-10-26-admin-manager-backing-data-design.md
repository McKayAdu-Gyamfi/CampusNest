# Backing data for Settings, Schools, and the dashboards

## Intent

Several manager/admin screens show numbers and controls the backend cannot
supply: platform settings, a list of schools, and dashboard statistics.
This work gives those screens a real backend and wires them up, so they show
live data instead of hardcoded values.

Payouts is **explicitly out of scope** (decided by the owner): there is no
payment provider, no transaction record, and nothing resembling real money
movement. `ManagerPayouts.tsx` stays on its mock content.

## Goals

1. **Settings** (`AdminSettings.tsx`): platform name, support email and a
   maintenance-mode switch are stored on the server and editable by admins.
   Maintenance mode really blocks new bookings.
2. **Schools** (`AdminSchools.tsx`): admins can list, add and edit schools;
   see per-school hostel and student counts; see the hostels attached to a
   school and attach/detach one.
3. **Dashboard stats**, computed by queries over existing data:
   - Manager dashboard (`ManagerDashboard.tsx`): occupancy (beds filled of
     total), revenue, pending-booking count, recent bookings, per-hostel
     occupancy breakdown.
   - Admin dashboard (`AdminDashboard.tsx`): platform revenue, pending hostel
     approvals, top hostels.

## Non-goals

- Payouts, withdrawals, balances, any payment provider.
- Hostel/room create-edit screens and photo upload (a later stage; the
  manager screens for those do not exist yet).
- Wiring Home/Explore/booking flows (earlier stages in the 5-stage roadmap).
- Month-over-month trend badges ("+12%"), revenue charts by month history
  beyond what a single query over bookings gives for the chart months already
  shown, and school/hostel analytics.
- Fixing the unused `bankAccounts` table.

## Anti-goals

A dashboard number that looks real but is invented. Every figure shown must
be derived from stored rows; where no data supports a number, the UI shows an
honest empty state (0, "No data yet"), never a fabricated placeholder.

## Constraints (existing conventions, all binding)

- Convex functions are wrapped in `secureQuery`/`secureMutation`, every
  client-supplied id goes through `ctx.db.normalizeId`, business rows leave
  through `toApiRow`, dates stored as epoch-ms and returned as ISO strings.
- Express controllers use `cq`/`cm`, keep the `{success,data}` envelope, use
  Zod schemas with `validateRequest` (unknown keys stripped), and role gates
  via `requireAuth`/`requireRole`.
- Errors Express must distinguish are `ConvexError({code})`; others stay
  plain `Error`.
- Any mutation that takes a child-row id also takes and verifies its parent
  id (the repo's recurring authorization trap).
- No service copies a Convex error message into an error carrying a
  `statusCode`.
- Aggregation queries must not do unbounded work per request on the happy
  path where an index lets them avoid it, but demo-scale `.collect()` over
  an index range is acceptable (same stance as existing list endpoints).

## Design

### Data

New tables in `server/convex/schema.ts`:

- `settings`: a singleton row — `platform_name`, `support_email`,
  `maintenance_mode` (boolean), `updated_at`. Defaults if no row exists:
  `"KayaCampus"`, `"support@kayacampus.com"`, `false` (the values currently
  hardcoded in the UI). Read function returns defaults when the row is
  absent; the first admin save creates it.
- `schools`: `name`, `location`, `email_domain` (lowercase, e.g.
  `ashesi.edu.gh`), `created_at`, `updated_at`. Index by `email_domain`
  (unique-checked in the mutation, same pattern as users by email).

Changed table: `hostels` gains optional `school_id: v.id("schools")` with
index `by_school_id`. Optional so existing hostels remain valid.

### Backend surface

Convex (new files `settings.ts`, `schools.ts`, `stats.ts`):

- `settings.get` (query), `settings.update` (mutation; upserts the singleton).
- `schools.list` (each row includes `hostel_count` and `student_count`),
  `schools.create`, `schools.update`, `schools.assignHostel`
  (`{schoolId, hostelId}`) and `schools.unassignHostel` — the unassign takes
  the school id too and no-ops on mismatch (parent/child rule).
- `schools.listHostels({schoolId})` — hostels attached to the school, with
  distance and bed total.
- `stats.managerOverview({managerId})` and `stats.adminOverview()`.

Student count for a school = users with `user_type` STUDENT whose email's
domain equals the school's `email_domain` (derived at query time; no stored
counter, so it cannot drift).

Express (new modules `settings`, `schools`, `stats`), all under `/api`:

| Route | Who |
|---|---|
| `GET /api/settings/public` → `{platform_name, maintenance_mode}` | anyone |
| `GET /api/settings`, `PATCH /api/settings` | ADMIN |
| `GET/POST /api/schools`, `PATCH /api/schools/:id` | ADMIN |
| `GET /api/schools/:id/hostels`, `POST /api/schools/:id/hostels`, `DELETE /api/schools/:id/hostels/:hostelId` | ADMIN |
| `GET /api/stats/manager` | HOSTEL_MANAGER (scoped to `req.user.id`) |
| `GET /api/stats/admin` | ADMIN |

Zod: `settings` update accepts only the three fields, email format-checked;
`schools` create/update accepts name, location, email_domain.

### Stat definitions (the part a builder must not guess)

- **Beds**: a room's capacity is its bed count. Total beds = Σ capacity over
  the manager's rooms; filled beds = Σ `current_occupancy`. Occupancy % =
  filled/total, 0 when total is 0.
- **Revenue**: Σ `price_per_bed` of each CONFIRMED or CHECKED_OUT booking's
  room, over the booking's `created_at` month for the "this month" figure
  (the manager card says "Revenue · <month>"). `price_per_bed` is treated as
  the charge for one bed for one booking (the UI labels prices "per
  semester"; no finer unit exists). The admin figure is the same sum across
  all hostels, all time unless a month is requested.
- **Pending bookings**: count of PENDING bookings for the manager's hostels.
- **Recent bookings**: latest N (default 4) bookings for the manager, with
  student name/email and room number.
- **Per-hostel occupancy**: one row per manager hostel (name, filled/total
  beds). This replaces the mock "Block A/B/C" rows because rooms have no
  block concept.
- **Admin pending approvals**: hostels with status PENDING (name, manager,
  created date). **Top hostels**: ranked by count of CONFIRMED/CHECKED_OUT
  bookings, ties by name, top 5.

### Maintenance mode enforcement

`bookings.create` (Convex) reads settings and throws
`ConvexError({code: "MAINTENANCE_MODE"})` when enabled. The bookings
controller maps that code to HTTP 503 with a fixed message. Existing
bookings and all reads are unaffected. `GET /api/settings/public` lets the
client show a banner and disable the booking button.

### Client

New `client/src/lib/{settings,schools,stats}.ts` thin wrappers over
`apiFetch`, typed to the real response shapes. `AdminSettings`,
`AdminSchools`, `ManagerDashboard`, `AdminDashboard` fetch on mount with
loading and error states and replace their hardcoded arrays. Payouts and
every other page are untouched. A failed fetch shows an error message, never
stale mock numbers.

### Schools page actions

- "Add school": form (name, location, email domain) → `POST /api/schools`.
- "Add hostel" on a selected school: opens a picker of hostels not yet
  attached to any school and attaches the chosen one. It does **not** create
  a hostel (hostel creation belongs to the manager-side stage).

## Testing

- Convex tests (`convex-test`) for every new function: settings default and
  upsert, school CRUD with duplicate-domain rejection, student-count by email
  domain, attach/detach including the cross-school no-op, each stat with a
  fixture containing two managers (to prove scoping) and edge cases (no
  rooms → 0%, zero bookings → 0 revenue, tie in top hostels).
- Express controller unit tests (mocked `cq`/`cm`) for role gates, the 503
  mapping, and that settings/schools bodies are stripped to allowed fields.
- Maintenance-mode test: booking creation rejected when on, allowed when off.
- Manual check against the live seeded deployment: the dashboards' figures
  match numbers computed by hand from the seed (3 rooms, one confirmed
  booking in A2).

## Left to the builder

Chart month ranges for the admin revenue chart, exact response field names,
pagination of `schools.list`, file layout inside each new module.

## Calls made while writing (designer's calls, not the owner's)

Settled after an independent read of this document. Each can be reversed
cheaply.

- **Revenue basis.** Counted by the month a booking was *created*, for
  CONFIRMED and CHECKED_OUT bookings, using `price_per_bed` once per booking.
  It is "bookings taken this month", not "stays served". "This month" uses
  UTC, which equals Ghana time (GMT, no daylight saving).
- **Hostel status in stats.** A manager's overview covers all of *their own*
  hostels whatever the status. Admin revenue counts every booking. Admin
  "top hostels" ranks APPROVED hostels only.
- **Schools and hostels.** A school lists attached hostels of any status;
  its "N hostels" counts all attached. The page's Live/Pending/Off badge maps
  APPROVED / PENDING / REJECTED. Attaching a hostel that already has a school
  moves it (replaces); the picker offers unattached hostels by default.
- **Student count.** Exact email-domain match only, verified or not. Scans
  STUDENT users; fine at current scale.
- **Indexes.** No new `bookings` index. Hostel-level aggregation goes
  hostel → rooms (`by_hostel_id`) → bookings (`by_room_id`). The admin
  all-platform queries `.collect()`, as existing admin lists do.
- **Maintenance mode.** Blocks `bookings.create` for everyone, admins
  included. Status transitions on existing bookings are not blocked. The
  client only gets the public flag now; the banner lands when the booking
  flow is wired.
- **Missing manager.** A hostel with no `manager_id` shows "Unassigned" in
  the admin lists and is absent from every manager's stats.
