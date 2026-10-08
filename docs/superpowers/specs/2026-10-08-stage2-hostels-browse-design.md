# Frontend↔Backend Integration — Stage 2: Hostels/Rooms Browse

## Context

Stage 1 (Auth) is live: real sign-up/sign-in/sign-out, server-verified `RoleProtectedRoute`. This spec covers Stage 2 of the five-stage roadmap from `docs/superpowers/specs/2026-09-28-frontend-backend-auth-integration-design.md`: wiring the browse/discovery surface (Home, Explore, Saved, hostel detail) to real `HOSTEL`/`ROOM`/`REVIEW` data instead of the static mock module `client/src/data/hostels.ts`.

The 360° room tour viewer (`LivePreview.tsx`) is explicitly **out of scope** for this stage — it was investigated during brainstorming and found to need its own design (the real backend data model is one independent single-panorama config per generated scene, not the mock's interconnected multi-scene tour; presenting multiple independent scenes per room needs its own UX decision). It stays on its current hardcoded demo data until a follow-up stage.

## Goals

- Home, Explore, Saved, and the hostel-detail overlay (`HostelDetailsOverlay.tsx`) read real `HOSTEL` rows (approved-only, matching the existing admin-approval gate) instead of the mock data module.
- The detail overlay shows a hostel's real rooms (`ROOM` rows: type, price, capacity, availability) instead of two hardcoded fake room types.
- Ratings are computed from real `REVIEW` rows; hostels with zero reviews show "No ratings yet" rather than a fabricated number.
- "Saved" (favorites) keeps its current localStorage-based mechanism, now filtering against the real hostel list.
- One real backend addition: `GET /api/hostels` (list) gains the same `HOSTEL_IMAGE_URLS`/`HOSTEL_AMENITY` joins `GET /api/hostels/:id` already has, plus a minimal `ROOM(price_per_bed, is_available)` join so cards can show a starting price — all additive, no schema/migration change.

## Non-goals

- `LivePreview.tsx` (360° tour viewer) — deferred, see Context.
- Booking creation/submission — Stage 3.
- Writing reviews — gated behind a completed stay, which needs Stage 3's booking flow to be meaningful; this stage only *reads* existing reviews.
- Server-side search/filtering — `GET /api/hostels` already supports `?search=`/`?max_distance=`, but Explore's existing client-side filter logic (over the full fetched list) is kept as-is; wiring those query params is future optimization, not needed at current expected data volumes.
- Manager-side hostel/room management (create/edit/delete, image upload) — Stage 4.

## Architecture

### `client/src/lib/hostels.ts` (new)

Thin named functions over `apiFetch`, mirroring Stage 1's `auth.ts`:

```ts
export const getHostels = () => apiFetch<BackendHostel[]>("/hostels");
export const getHostelById = (id: string) => apiFetch<BackendHostelDetail>(`/hostels/${id}`);
export const getReviews = (hostelId?: string) =>
  apiFetch<BackendReview[]>(hostelId ? `/reviews?hostel_id=${hostelId}` : "/reviews");
```

`BackendHostel`/`BackendHostelDetail`/`BackendReview` are typed to match the backend's actual response shape (snake_case fields, nested arrays from the joins).

### `client/src/lib/hostelMappers.ts` (new)

Pure normalization functions, no React — converts backend rows into the display shape the existing components already expect (keeps `HostelCard.tsx`, `FilterModal.tsx`, etc. untouched). One function per concern:

- `toDisplayHostel(backendHostel, reviewsForThisHostel): DisplayHostel` — applies every mapping from the Context section above (distance string, starting price from room min, availability bucket, amenity enum → label/icon, rating from reviews avg, image/gallery with placeholder fallback).
- `toDisplayRoom(backendRoom): DisplayRoom` — room_type enum → label, capacity → "X person(s)" subtitle, price_per_bed, is_available.
- `AMENITY_DISPLAY: Record<BackendAmenityName, { label: string; icon: LucideIcon }>` — the enum→{label,icon} map (replaces/extends the existing `AMENITY_ICONS` object in `HostelDetailsOverlay.tsx`, moved here so both list cards and detail view share one source of truth). Covers all 11 enum values, not just the 8 the current mock-era map has:

  | Backend value | Display label | Icon |
  |---|---|---|
  | `WIFI` | "WiFi" | `Wifi` |
  | `AIR_CONDITIONING` | "AC" | `AirVent` |
  | `RUNNING_WATER` | "Running Water" | `Droplets` |
  | `KITCHEN_ACCESS` | "Kitchen Access" | `ChefHat` |
  | `PARKING` | "Parking" | `Car` (new import, lucide-react already a dependency) |
  | `GYM` | "Gym" | `Dumbbell` |
  | `LAUNDRY` | "Laundry" | `WashingMachine` |
  | `STUDY_ROOM` | "Study Room" | `BookOpen` (new import) |
  | `RESERVED_1`/`RESERVED_2`/`RESERVED_3` | not rendered | — these are placeholder enum slots for amenities not yet named (still assignable via the API/`ValidAmenities`, just with no real-world meaning yet); the map defines no entry for them, and the display component filters out any amenity name with no entry rather than crashing on a missing key |

- `HOSTEL_IMAGE_PLACEHOLDER = "/images/CampusNest.webp"` — used for `image`/`gallery` whenever a hostel or room has zero real `*_IMAGE_URLS` rows (the brand logo image already exists in `client/public/images/`; no new asset needed).

### `client/src/contexts/HostelsContext.tsx` (new)

Same fetch-once-on-mount pattern as `BookingContext`/`AuthContext`:

```ts
interface HostelsContextValue {
  hostels: DisplayHostel[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

- On mount: `Promise.all([getHostels(), getReviews()])`, group reviews by `hostel_id`, map each backend hostel through `toDisplayHostel` with its reviews. On failure, set `error` to a user-facing message (distinguish `ApiError` vs network failure, same pattern as Stage 1's `AuthContext`) and leave `hostels: []`.
- `refetch()` re-runs the same fetch (exposed for a future pull-to-refresh or post-mutation refresh; Explore/Home don't need to call it yet, but the shape matches `AuthContext`'s `refetch` convention).

### `client/src/App.tsx` (edit)

Wrap the tree in `HostelsProvider`, alongside `AuthProvider`/`BookingProvider`.

### `client/src/pages/Home.tsx`, `Explore.tsx`, `Saved.tsx` (edit)

Replace `import { MOST_POPULAR, NEARBY_PLACES, ALL_HOSTELS } from "../data/hostels"` with `useHostels()`. Derive the two mock-only groupings from the real list:
- "Most popular" → `hostels` sorted by rating descending (hostels with no rating sort last), top N.
- "Closer to campus" ("Nearby") → `hostels` sorted by `distance_from_campus` ascending.

Existing filter/search predicates in `Explore.tsx` (search text, distance slider, price range, amenities) stay exactly as written — they already operate on an in-memory array via `.filter()`; only the array's source changes.

`selectedHostel` state changes from holding a full mock object to holding just a hostel **id** (`string | null`) — the detail overlay now owns its own fetch (see below), since list-level data (even after the backend join addition) still lacks the full `ROOM_IMAGE_URLS`/`ROOM_TOUR_SCENES`/`ROOM_AMENITY` nesting that only `GET /api/hostels/:id` provides.

Each page shows a loading state (reuse the existing `ScreenLoader` pattern from `App.tsx`) while `isLoading` is true, and an inline retry-able error message when `error` is set.

### `client/src/components/HostelDetailsOverlay.tsx` (edit)

Prop changes: `selectedHostel: any` → `selectedHostelId: string | null`. On a non-null id, fetch `getHostelById(id)` itself (own `isLoading`/`error` state inside the component), replacing the current `useEffect` that just copies the passed-in object. Replace the hardcoded `roomTypes` array with the real `ROOM[]` from the fetched detail, mapped through `toDisplayRoom`. Room selection (`selectedRoom` state) keys off real room `id`s instead of the hardcoded `1`/`2`.

### `client/src/data/hostels.ts` (delete)

No longer imported anywhere once the four consumers above are migrated — confirmed via `grep` before deletion in the plan's verification step.

### `server/src/modules/hostels/hostels.controller.js` (edit)

`getHostels`'s `.select()` gains the three joins described in Architecture's backend section above. Nothing else in this file changes — `getHostelById`, `createHostel`, etc. are untouched.

## Data flow

**App load:** `HostelsProvider` mounts → fetches hostel list (with joins) + all reviews in parallel → normalizes → `hostels` available to every consumer. Home/Explore/Saved render from it immediately once loaded; each derives its own sort/filter view without a separate fetch.

**Opening detail:** card click → page sets `selectedHostelId` → `HostelDetailsOverlay` sees a non-null id → fetches full detail → shows a spinner in the overlay while loading → renders real images/amenities/rooms once resolved. If the fetch 404s (hostel got un-approved or deleted between list load and click) or errors, the overlay shows an inline error with a close button instead of crashing or rendering stale/undefined data.

**Saving/favoriting:** unchanged mechanism — array of hostel-id strings in `localStorage["saved_hostels"]`; `Saved.tsx` filters the real `hostels` array by that id list instead of filtering mock `ALL_HOSTELS`.

## Error handling

- Initial list/reviews fetch failure: `HostelsContext.error` is set (message distinguishes `ApiError` — backend responded with an error — from a network failure, matching Stage 1's `apiClient.ts` contract). Consuming pages show a retry button that calls `refetch()`.
- Per-hostel detail fetch failure (inside the overlay): local error state, inline message, close button — does not affect the rest of the app or the shared context.
- Zero approved hostels in the database: distinct empty state ("No hostels available yet") vs. the existing "no search results for your filters" state in `Explore.tsx` (already present, just needs to trigger correctly off an empty real array instead of an empty filtered mock array).

## Testing

Same approach as Stage 1 — this stage has no test framework; the real verification gate is `npm run build` (`tsc -b && vite build`) run from `client/`, **not** `tsc --noEmit -p .` (that project's `tsconfig.json` has `"files": []` and silently compiles nothing — this is the exact gap that let a build-breaking bug ship undetected through all of Stage 1; the plan for this stage states the correct command explicitly in its Global Constraints). Each task also lists manual verification steps for the human partner to run against the real Supabase project once real hostel/room/review rows exist there (this sandbox has no network path to it).

## Commit plan (file-by-file)

1. `server/src/modules/hostels/hostels.controller.js` (the join addition)
2. `client/src/lib/hostels.ts`
3. `client/src/lib/hostelMappers.ts`
4. `client/src/contexts/HostelsContext.tsx`
5. `client/src/App.tsx` (mount `HostelsProvider`)
6. `client/src/pages/Home.tsx`
7. `client/src/pages/Explore.tsx`
8. `client/src/pages/Saved.tsx`
9. `client/src/components/HostelDetailsOverlay.tsx`
10. Delete `client/src/data/hostels.ts` (only after confirming via grep that nothing still imports it)

Each commit's gate is `npm run build` clean from `client/` (and, for commit 1, the server's existing lint/test setup if any).
