# Stage 2: Hostels/Rooms Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static mock hostel data (`client/src/data/hostels.ts`) with real `HOSTEL`/`ROOM`/`REVIEW` data from the backend, across Home, Explore, Saved, and the hostel-detail overlay.

**Architecture:** A shared `HostelsContext` (same fetch-once-on-mount pattern as `AuthContext`/`BookingContext`) feeds Home/Explore/Saved with a normalized hostel list; the detail overlay fetches its own full detail (including real rooms) per hostel on open. A pure mapper layer (`hostelMappers.ts`) translates backend snake_case/enum shapes into the display shape the existing UI components already expect, so components like `HostelCard.tsx` need only minimal null-safety edits.

**Tech Stack:** React 18, TypeScript, react-router-dom, plain `fetch` via the existing `apiClient.ts`/`auth.ts` pattern from Stage 1 — no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-stage2-hostels-browse-design.md`

## Global Constraints

- No new npm dependencies in `client/`.
- Every backend response is `{ success, data }` / `{ success, message }` — already unwrapped by the existing `apiFetch` from Stage 1 (`client/src/lib/apiClient.ts`); this plan's new `lib/hostels.ts` is a thin wrapper over it, exactly like Stage 1's `lib/auth.ts`.
- **The automated verification gate for every task is `npm run build` run from `client/`** (this runs `tsc -b && vite build`). Do **not** use `tsc --noEmit -p .` — that project's `tsconfig.json` has `"files": []` and silently compiles nothing; this exact gap let a build-breaking syntax error ship undetected through all of Stage 1.
- `HOSTEL_IMAGE_PLACEHOLDER = "/images/CampusNest.webp"` is the fallback image for any hostel/gallery with zero real uploaded images (file already exists in `client/public/images/`).
- Amenity enum→display mapping covers all 11 `amenity_name` values; `RESERVED_1`/`RESERVED_2`/`RESERVED_3` render nothing (filtered out, not a crash).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Stage this plan's own files only per task (`git add <exact files>`, never `-A`).
- This stage has no test framework (approved in Stage 1, carried forward) — `npm run build` clean is each task's gate, plus the manual verification steps listed per task for the human partner to run against the real Supabase project.

## Review Focus

1. **A hostel with zero rooms** (just created by a manager, no `ROOM` rows yet). A reasonable person expects "Price unavailable" on the card/detail, not a crash or `GHS NaN`. (Tasks 3, 11 tests — `toStartingPrice` returns `null` for an empty rooms array; `HostelCard`/`HostelDetailsOverlay` render a text fallback instead of calling `.toLocaleString()` on `null`.)
2. **A hostel with zero reviews** (the common case right now, since reviews require a completed stay). A reasonable person expects "New" instead of a fabricated rating or a crash on `null.toFixed(1)`. (Tasks 3, 6, 11 tests.)
3. **A hostel with zero uploaded images.** A reasonable person expects a placeholder image, not a broken `<img>` tag with an empty `src`. (Task 3 test — `toDisplayHostelBase` falls back to `HOSTEL_IMAGE_PLACEHOLDER`.)
4. **The initial hostels/reviews fetch fails** (backend down, network error). A reasonable person expects a visible, retry-able error message on Home/Explore, not a silently empty page that looks like "no hostels exist." (Tasks 8, 9 — `HostelsContext.error` surfaced with a retry button.)
5. **Opening a hostel's detail right as it stops being bookable** (an admin un-approves it, or it's deleted, between the list loading and the click — `GET /api/hostels/:id` 404s or errors). A reasonable person expects an inline error with a way to close the panel, not a frozen spinner or a crash reading `null.name`. (Task 11 test.)

---

### Task 1: Backend — expose images/amenities/room-prices on the hostel list endpoint

**Files:**
- Modify: `server/src/modules/hostels/hostels.controller.js:10-17`

**Interfaces:**
- Produces: `GET /api/hostels` response items now include `HOSTEL_IMAGE_URLS: {id,hostel_id,image_url}[]`, `HOSTEL_AMENITY: {id,hostel_id,name}[]`, `ROOM: {price_per_bed,is_available}[]` (in addition to the existing columns + `manager`). This is the exact join shape Task 2's `BackendHostel` type expects.

- [ ] **Step 1: Make the edit**

In `server/src/modules/hostels/hostels.controller.js`, find:

```js
export const getHostels = async (req, res, next) => {
  try {
    const { search, max_distance } = req.query;

    let query = supabase
      .from("HOSTEL")
      .select("*, manager:manager_id (id, email)")
      // Public listing only shows hostels an admin has approved — a
      // self-registered manager creating a hostel no longer makes it
      // instantly visible/bookable with zero review. Managers see their
      // own (any status) via GET /api/users/me/hostels instead.
      .eq("status", "APPROVED");
```

Replace with:

```js
export const getHostels = async (req, res, next) => {
  try {
    const { search, max_distance } = req.query;

    let query = supabase
      .from("HOSTEL")
      .select("*, manager:manager_id (id, email), HOSTEL_IMAGE_URLS(*), HOSTEL_AMENITY(*), ROOM(price_per_bed, is_available)")
      // Public listing only shows hostels an admin has approved — a
      // self-registered manager creating a hostel no longer makes it
      // instantly visible/bookable with zero review. Managers see their
      // own (any status) via GET /api/users/me/hostels instead.
      .eq("status", "APPROVED");
```

Nothing else in this function or file changes.

- [ ] **Step 2: Verify the server still starts cleanly**

Run (from `server/`): `node --check src/modules/hostels/hostels.controller.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add server/src/modules/hostels/hostels.controller.js
git commit -m "$(cat <<'EOF'
feat(hostels): include images, amenities, and room prices on the list endpoint

GET /api/hostels previously returned bare HOSTEL columns only — no
images, amenities, or room pricing — forcing any consumer that needs
a card thumbnail or starting price to do a second request per hostel.
Adds the same HOSTEL_IMAGE_URLS/HOSTEL_AMENITY joins GET /api/hostels/:id
already has, plus a minimal ROOM(price_per_bed, is_available) join for
starting-price calculation. No schema change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Manual verification:** The human partner runs `curl http://localhost:3000/api/hostels | json_pp` against their real Supabase project (once hostel/room/image rows exist there) and confirms each item has non-empty `HOSTEL_IMAGE_URLS`/`HOSTEL_AMENITY`/`ROOM` arrays matching that hostel's real data.

---

### Task 2: `client/src/lib/hostels.ts` — typed API functions

**Files:**
- Create: `client/src/lib/hostels.ts`

**Interfaces:**
- Consumes: `apiFetch<T>` from `client/src/lib/apiClient.ts` (Stage 1, already built).
- Produces: `BackendAmenityName`, `BackendHostelImage`, `BackendHostelAmenity`, `BackendRoomPriceInfo`, `BackendHostel`, `BackendRoom`, `BackendHostelDetail`, `BackendReview` types; `getHostels()`, `getHostelById(id)`, `getReviews(hostelId?)` functions.

- [ ] **Step 1: Create the file**

```typescript
// client/src/lib/hostels.ts
import { apiFetch } from "./apiClient";

export type BackendAmenityName =
  | "WIFI"
  | "AIR_CONDITIONING"
  | "RUNNING_WATER"
  | "KITCHEN_ACCESS"
  | "PARKING"
  | "GYM"
  | "LAUNDRY"
  | "STUDY_ROOM"
  | "RESERVED_1"
  | "RESERVED_2"
  | "RESERVED_3";

export interface BackendHostelImage {
  id: string;
  hostel_id: string;
  image_url: string;
}

export interface BackendHostelAmenity {
  id: string;
  hostel_id: string;
  name: BackendAmenityName;
}

export interface BackendRoomPriceInfo {
  price_per_bed: number;
  is_available: boolean;
}

export interface BackendHostel {
  id: string;
  hostel_name: string;
  location: string;
  description: string | null;
  total_rooms: number;
  available_rooms: number;
  distance_from_campus: number | null;
  manager_id: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  updated_at: string;
  HOSTEL_IMAGE_URLS: BackendHostelImage[];
  HOSTEL_AMENITY: BackendHostelAmenity[];
  ROOM: BackendRoomPriceInfo[];
}

export interface BackendRoom extends BackendRoomPriceInfo {
  id: string;
  room_number: string;
  room_type: "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD";
  capacity: number;
  current_occupancy: number;
  hostel_id: string;
  length: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
}

export interface BackendHostelDetail extends Omit<BackendHostel, "ROOM"> {
  ROOM: BackendRoom[];
}

export interface BackendReview {
  id: string;
  rating: number;
  comment: string | null;
  student_id: string | null;
  hostel_id: string;
  created_at: string;
  updated_at: string;
}

export const getHostels = () => apiFetch<BackendHostel[]>("/hostels");

export const getHostelById = (id: string) => apiFetch<BackendHostelDetail>(`/hostels/${id}`);

export const getReviews = (hostelId?: string) =>
  apiFetch<BackendReview[]>(hostelId ? `/reviews?hostel_id=${hostelId}` : "/reviews");
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npm run build`
Expected: clean build (this file has no callers yet, but must type-check standalone).

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/lib/hostels.ts
git commit -m "$(cat <<'EOF'
feat(client): typed API functions for hostels/rooms/reviews

Thin wrappers over apiFetch, mirroring Stage 1's lib/auth.ts:
getHostels, getHostelById, getReviews. Types match the backend's
actual response shape after Task 1's join addition.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `client/src/lib/hostelMappers.ts` — backend→display normalization

**Files:**
- Create: `client/src/lib/hostelMappers.ts`

**Interfaces:**
- Consumes: `BackendAmenityName`, `BackendHostel`, `BackendHostelDetail`, `BackendReview`, `BackendRoom`, `BackendRoomPriceInfo` from `client/src/lib/hostels.ts` (Task 2).
- Produces: `HOSTEL_IMAGE_PLACEHOLDER`, `AMENITY_DISPLAY`, `DisplayAmenity`, `DisplayHostel`, `DisplayRoom`, `DisplayHostelDetail` types; `computeRating(reviews)`, `toDisplayHostel(hostel, reviews)`, `toDisplayRoom(room)`, `toDisplayHostelDetail(detail)` functions. These exact names/shapes are load-bearing — Tasks 4, 6, 8, 9, 10, 11 all import from here.

- [ ] **Step 1: Create the file**

```typescript
// client/src/lib/hostelMappers.ts
import type { LucideIcon } from "lucide-react";
import { Wifi, AirVent, Droplets, ChefHat, Car, Dumbbell, WashingMachine, BookOpen } from "lucide-react";
import type {
  BackendAmenityName,
  BackendHostel,
  BackendHostelDetail,
  BackendReview,
  BackendRoom,
  BackendRoomPriceInfo,
} from "./hostels";

export const HOSTEL_IMAGE_PLACEHOLDER = "/images/CampusNest.webp";

export const AMENITY_DISPLAY: Partial<Record<BackendAmenityName, { label: string; Icon: LucideIcon }>> = {
  WIFI: { label: "WiFi", Icon: Wifi },
  AIR_CONDITIONING: { label: "AC", Icon: AirVent },
  RUNNING_WATER: { label: "Running Water", Icon: Droplets },
  KITCHEN_ACCESS: { label: "Kitchen Access", Icon: ChefHat },
  PARKING: { label: "Parking", Icon: Car },
  GYM: { label: "Gym", Icon: Dumbbell },
  LAUNDRY: { label: "Laundry", Icon: WashingMachine },
  STUDY_ROOM: { label: "Study Room", Icon: BookOpen },
  // RESERVED_1/2/3 intentionally have no entry — filtered out at render time.
};

const ROOM_TYPE_LABEL: Record<BackendRoom["room_type"], string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TRIPLE: "Triple",
  QUAD: "Quad",
};

export interface DisplayAmenity {
  label: string;
  Icon: LucideIcon;
}

export interface DisplayHostel {
  id: string;
  name: string;
  location: string;
  distance: string;
  distanceKm: number | null;
  startingPrice: number | null;
  priceFreq: string;
  rating: number | null;
  reviewCount: number;
  availability: "AVAILABLE" | "FEW ROOMS LEFT" | "FULL";
  amenities: DisplayAmenity[];
  image: string;
  gallery: string[];
  desc: string;
}

export interface DisplayRoom {
  id: string;
  label: string;
  subtitle: string;
  pricePerBed: number;
  isAvailable: boolean;
}

export interface DisplayHostelDetail extends DisplayHostel {
  rooms: DisplayRoom[];
}

export function computeRating(reviews: BackendReview[]): { rating: number | null; reviewCount: number } {
  if (reviews.length === 0) return { rating: null, reviewCount: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return { rating: sum / reviews.length, reviewCount: reviews.length };
}

function toAvailabilityBucket(availableRooms: number): DisplayHostel["availability"] {
  if (availableRooms === 0) return "FULL";
  if (availableRooms <= 2) return "FEW ROOMS LEFT";
  return "AVAILABLE";
}

function toAmenitiesList(amenities: { name: BackendAmenityName }[]): DisplayAmenity[] {
  return amenities
    .map((a) => AMENITY_DISPLAY[a.name])
    .filter((entry): entry is DisplayAmenity => Boolean(entry));
}

function toStartingPrice(rooms: BackendRoomPriceInfo[]): number | null {
  const prices = rooms.map((r) => Number(r.price_per_bed)).filter((p) => !Number.isNaN(p));
  return prices.length > 0 ? Math.min(...prices) : null;
}

interface HostelLike {
  id: string;
  hostel_name: string;
  location: string;
  description: string | null;
  available_rooms: number;
  distance_from_campus: number | null;
  HOSTEL_IMAGE_URLS: { image_url: string }[];
  HOSTEL_AMENITY: { name: BackendAmenityName }[];
  ROOM: BackendRoomPriceInfo[];
}

function toDisplayHostelBase(h: HostelLike, reviews: BackendReview[]): DisplayHostel {
  const { rating, reviewCount } = computeRating(reviews);
  const images = h.HOSTEL_IMAGE_URLS.map((i) => i.image_url);

  return {
    id: h.id,
    name: h.hostel_name,
    location: h.location,
    distanceKm: h.distance_from_campus != null ? Number(h.distance_from_campus) : null,
    distance: h.distance_from_campus != null ? `${Number(h.distance_from_campus).toFixed(1)} km` : "Distance unknown",
    startingPrice: toStartingPrice(h.ROOM),
    priceFreq: "per semester",
    rating,
    reviewCount,
    availability: toAvailabilityBucket(h.available_rooms),
    amenities: toAmenitiesList(h.HOSTEL_AMENITY),
    image: images[0] || HOSTEL_IMAGE_PLACEHOLDER,
    gallery: images.length > 0 ? images : [HOSTEL_IMAGE_PLACEHOLDER],
    desc: h.description || "",
  };
}

export function toDisplayHostel(h: BackendHostel, reviews: BackendReview[]): DisplayHostel {
  return toDisplayHostelBase(h, reviews);
}

export function toDisplayRoom(r: BackendRoom): DisplayRoom {
  return {
    id: r.id,
    label: ROOM_TYPE_LABEL[r.room_type] || r.room_type,
    subtitle: `${r.capacity} person${r.capacity === 1 ? "" : "s"} · ${r.is_available ? "Available" : "Full"}`,
    pricePerBed: Number(r.price_per_bed),
    isAvailable: r.is_available,
  };
}

// Rating/reviewCount here are always null/0 — the detail view overlays the
// real values from the already-loaded HostelsContext list instead of
// re-fetching reviews, since that list already computed them once.
export function toDisplayHostelDetail(h: BackendHostelDetail): DisplayHostelDetail {
  const base = toDisplayHostelBase(h, []);
  return {
    ...base,
    rooms: h.ROOM.map(toDisplayRoom),
  };
}
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/lib/hostelMappers.ts
git commit -m "$(cat <<'EOF'
feat(client): backend-to-display mappers for hostels/rooms

Pure normalization functions — no fabricated data. startingPrice is
null (not a guessed number) when a hostel has zero rooms; rating is
null (not a fake number) when a hostel has zero reviews; images fall
back to a shared placeholder when a hostel has zero uploads. Amenity
enum values map to display label+icon pairs; the 3 RESERVED_* slots
have no entry and are filtered out rather than crashing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `client/src/contexts/HostelsContext.tsx` — shared fetch-once hostel list

**Files:**
- Create: `client/src/contexts/HostelsContext.tsx`

**Interfaces:**
- Consumes: `getHostels`, `getReviews`, `type BackendReview` from `client/src/lib/hostels.ts` (Task 2); `toDisplayHostel`, `type DisplayHostel` from `client/src/lib/hostelMappers.ts` (Task 3); `ApiError` from `client/src/lib/apiClient.ts` (Stage 1).
- Produces: `export function HostelsProvider({ children })`, `export function useHostels(): { hostels: DisplayHostel[]; isLoading: boolean; error: string | null; refetch: () => Promise<void> }`.

- [ ] **Step 1: Create the file**

```typescript
// client/src/contexts/HostelsContext.tsx
import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { getHostels, getReviews, type BackendReview } from "@/lib/hostels";
import { toDisplayHostel, type DisplayHostel } from "@/lib/hostelMappers";
import { ApiError } from "@/lib/apiClient";

interface HostelsContextValue {
  hostels: DisplayHostel[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const HostelsContext = createContext<HostelsContextValue | undefined>(undefined);

export function HostelsProvider({ children }: { children: ReactNode }) {
  const [hostels, setHostels] = useState<DisplayHostel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [backendHostels, backendReviews] = await Promise.all([getHostels(), getReviews()]);

      const reviewsByHostel = new Map<string, BackendReview[]>();
      for (const review of backendReviews) {
        const list = reviewsByHostel.get(review.hostel_id) || [];
        list.push(review);
        reviewsByHostel.set(review.hostel_id, list);
      }

      setHostels(backendHostels.map((h) => toDisplayHostel(h, reviewsByHostel.get(h.id) || [])));
    } catch (err) {
      setHostels([]);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Couldn't reach the server. Please try again.");
        console.error("[HostelsProvider] Could not reach the backend:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HostelsContext.Provider value={{ hostels, isLoading, error, refetch }}>
      {children}
    </HostelsContext.Provider>
  );
}

export function useHostels(): HostelsContextValue {
  const context = useContext(HostelsContext);
  if (context === undefined) {
    throw new Error("useHostels must be used within a HostelsProvider");
  }
  return context;
}
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/contexts/HostelsContext.tsx
git commit -m "$(cat <<'EOF'
feat(client): add HostelsContext with fetch-once hostel list

Same provider pattern as AuthContext/BookingContext: fetches the
approved hostel list and all reviews once on mount, groups reviews
per hostel, and exposes the normalized list app-wide via useHostels().
refetch() is exposed for a future manual-refresh need; no consumer
calls it yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Mount `HostelsProvider` in App.tsx

**Files:**
- Modify: `client/src/App.tsx:8` (add import), `client/src/App.tsx:49-50` and `:96-97` (wrap provider tree)

**Interfaces:**
- Consumes: `HostelsProvider` from `client/src/contexts/HostelsContext.tsx` (Task 4).

- [ ] **Step 1: Add the import**

In `client/src/App.tsx`, change:

```typescript
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./components/ui/toaster";
```

to:

```typescript
import { AuthProvider } from "./contexts/AuthContext";
import { HostelsProvider } from "./contexts/HostelsContext";
import { ToastProvider } from "./components/ui/toaster";
```

- [ ] **Step 2: Wrap the provider tree**

Change:

```typescript
        <AuthProvider>
        <BookingProvider>
        <Router>
```

to:

```typescript
        <AuthProvider>
        <HostelsProvider>
        <BookingProvider>
        <Router>
```

And change the matching closing tags from:

```typescript
      </Router>
        </BookingProvider>
        </AuthProvider>
      </ToastProvider>
```

to:

```typescript
      </Router>
        </BookingProvider>
        </HostelsProvider>
        </AuthProvider>
      </ToastProvider>
```

- [ ] **Step 3: Verify**

Run (from `client/`): `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(client): mount HostelsProvider

Wraps the route tree so useHostels() works app-wide, nested inside
AuthProvider (no actual dependency between them yet, just grouped).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `HostelCard.tsx` — null-safe rating

**Files:**
- Modify: `client/src/components/HostelCard.tsx`

**Interfaces:**
- Consumes: nothing new — still takes `hostel: any` (the real `DisplayHostel` objects will be passed once Tasks 8/9 land, but this component's prop stays loosely typed to avoid a wider refactor it doesn't need).

- [ ] **Step 1: Make the edit**

Find:

```typescript
        {/* Rating Badge Top Left */}
        <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center space-x-1 shadow-sm">
          <Crown className="w-3.5 h-3.5 text-[#C56A30] fill-[#C56A30]" />
          <span className="text-xs font-extrabold text-white">{hostel.rating.toFixed(1)}</span>
        </div>
```

Replace with:

```typescript
        {/* Rating Badge Top Left */}
        <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center space-x-1 shadow-sm">
          <Crown className="w-3.5 h-3.5 text-[#C56A30] fill-[#C56A30]" />
          <span className="text-xs font-extrabold text-white">{hostel.rating != null ? hostel.rating.toFixed(1) : "New"}</span>
        </div>
```

Nothing else in this file changes (the price line already falls back safely: `hostel.startingPrice ? ... : (hostel.price ? ... : '6,000')` — a `null` `startingPrice` already falls through to the hardcoded `'6,000'` placeholder without crashing).

- [ ] **Step 2: Verify**

Run (from `client/`): `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/components/HostelCard.tsx
git commit -m "$(cat <<'EOF'
fix(client): HostelCard handles hostels with no ratings yet

hostel.rating.toFixed(1) crashed on null — real hostels with zero
reviews (the common case right now, since reviews require a completed
stay) have no rating. Shows "New" instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `FilterModal.tsx` — real amenity labels

**Files:**
- Modify: `client/src/components/FilterModal.tsx:31`

**Interfaces:**
- Produces: the `amenities` filter-chip options now match `AMENITY_DISPLAY`'s labels from `client/src/lib/hostelMappers.ts` (Task 3) exactly, so Explore/Saved's amenity filtering (Tasks 9, 10) actually matches real hostels instead of comparing against labels no real hostel can ever have.

- [ ] **Step 1: Make the edit**

Find:

```typescript
  const amenities = ["WiFi", "AC", "Gym", "Laundry", "Kitchen Shared", "Kitchen Personal"];
```

Replace with:

```typescript
  const amenities = ["WiFi", "AC", "Running Water", "Kitchen Access", "Parking", "Gym", "Laundry", "Study Room"];
```

(These are the 8 real, mappable `amenity_name` enum values' display labels from `hostelMappers.ts`'s `AMENITY_DISPLAY` — the mock's "Kitchen Shared"/"Kitchen Personal" split doesn't exist in the real schema, which has one `KITCHEN_ACCESS` value.)

- [ ] **Step 2: Verify**

Run (from `client/`): `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/components/FilterModal.tsx
git commit -m "$(cat <<'EOF'
fix(client): filter chips match real amenity labels

The amenity filter options were still the mock data's invented list
("Kitchen Shared"/"Kitchen Personal", no "Parking"/"Running Water"/
"Study Room") — selecting most of them would have silently matched
zero real hostels. Now matches hostelMappers.ts's AMENITY_DISPLAY
labels exactly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `Home.tsx` — real hostel data

**Files:**
- Modify: `client/src/pages/Home.tsx` (full-file replacement — the file is 226 lines; this task replaces its entire contents to keep every edit point consistent in one pass, since the changes touch the import, state, effect, two derived lists, three click handlers, two list sources, a loading/error guard, and the overlay props)

**Interfaces:**
- Consumes: `useHostels` from `client/src/contexts/HostelsContext.tsx` (Task 4); `DisplayHostel` shape implicitly via `useHostels()`'s return.
- Produces: no new exports — `Home` stays the page's default export.

- [ ] **Step 1: Replace the file's contents**

```typescript
// client/src/pages/Home.tsx
import { Star, Search } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Link, useLocation } from "react-router-dom";
import TopNav from "@/components/TopNav";
import FilterModal from "@/components/FilterModal";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import HostelCard from "@/components/HostelCard";
import HostelDetailsOverlay from "@/components/HostelDetailsOverlay";
import { useState, useEffect } from "react";
import { useHostels } from "@/contexts/HostelsContext";
import { useToast } from "@/components/ui/toaster";

const getBadgeStyle = (availability: string) => {
  switch (availability?.toUpperCase()) {
    case 'AVAILABLE': return { bg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500 animate-pulse' };
    case 'FULL': return { bg: 'bg-destructive/20 text-destructive dark:text-red-400', dot: 'bg-destructive' };
    default: return { bg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
  }
};

export default function Home() {
  const { toast } = useToast();
  const location = useLocation();
  const { hostels, isLoading, error } = useHostels();
  const firstName = (localStorage.getItem("userName") || "Sarah Adjei").split(" ")[0].toUpperCase();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(() => location.state?.restoreHostel || null);
  const [savedHostels, setSavedHostels] = useState<string[]>(() => {
    const saved = localStorage.getItem("saved_hostels");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (location.state?.restoreHostel) {
      setSelectedHostelId(location.state.restoreHostel);
    }
  }, [location.state]);

  const featuredHostels = [...hostels].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)).slice(0, 8);
  const nearbyHostels = [...hostels].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)).slice(0, 6);

  const handleSave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    let newSaved;
    if (savedHostels.includes(id)) {
      newSaved = savedHostels.filter(h => h !== id);
      toast("Removed from favorites", "info");
    } else {
      newSaved = [...savedHostels, id];
      toast("Added to favorites", "success");
    }
    setSavedHostels(newSaved);
    localStorage.setItem("saved_hostels", JSON.stringify(newSaved));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-6 transition-colors">
      {/* Mobile Top App Bar */}
      <div className="lg:hidden">
        <TopNav />
      </div>

      {/* Desktop Header */}
      <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-6 w-full">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search hostels near Berekuso..." 
            className="w-full h-[52px] pl-12 pr-4 bg-white/60 border border-border/50 rounded-full text-[15px] font-medium outline-none focus:ring-2 focus:ring-[#C56A30]/30 transition-all shadow-sm backdrop-blur-sm"
          />
        </div>
        <div className="flex items-center space-x-4">
          <NotificationsDropdown />
          <Link to="/profile" className="w-[52px] h-[52px] bg-[#E5D0BA] rounded-full flex items-center justify-center font-bold text-[#6c5e57] shadow-sm text-lg cursor-pointer hover:opacity-90">
            SA
          </Link>
        </div>
      </header>

      {/* Mobile Hero Section */}
      <section className="lg:hidden px-4 pt-20 pb-4 mb-2">
        <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#8C5B4F] to-[#5c3e35] p-6 text-white shadow-md">
          <div className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,1) 10px, rgba(255,255,255,1) 12px)',
            }}
          />
          <div className="relative z-10">
            <p className="text-[11px] font-extrabold tracking-[0.2em] text-[#C56A30] uppercase mb-2">
              WELCOME BACK
            </p>
            <h1 className="text-white text-[26px] font-extrabold leading-tight tracking-tight mb-5">
              Find your perfect room
            </h1>
            <Link to="/explore" className="inline-flex items-center justify-center h-11 px-7 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold rounded-full transition-colors shadow-sm text-sm cursor-pointer">
              Explore
            </Link>
          </div>
        </div>
      </section>

      {/* Desktop Hero Banner */}
      <section className="hidden lg:block px-8 mb-10">
        <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#6c5e57] to-[#4D4D4D] p-12 flex flex-col justify-center shadow-xl shadow-black/10" style={{ minHeight: '320px' }}>
          {/* Diagonal stripe pattern overlay */}
          <div className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,1) 10px, rgba(255,255,255,1) 12px)',
            }}
          />
          <div className="relative z-10 max-w-xl">
            <p className="text-[12px] font-bold tracking-[0.2em] text-[#C56A30] uppercase mb-3">
              WELCOME BACK, {firstName}
            </p>
            <h1 className="text-white text-[48px] font-extrabold leading-[1.1] tracking-tight mb-8">
              Find your perfect room
            </h1>
            <Link to="/explore" className="inline-flex items-center justify-center h-14 px-8 bg-[#C56A30] hover:bg-[#b05b26] text-white font-bold rounded-full transition-colors shadow-lg shadow-black/20 text-[16px] cursor-pointer">
              Explore hostels
            </Link>
          </div>
        </div>
      </section>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !isLoading && (
        <div className="mx-4 lg:mx-8 mb-6 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold flex items-center justify-between gap-3">
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Featured Hostels */}
          <section className="py-2 px-4 lg:px-4">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <h3 className="text-xl lg:text-[24px] font-extrabold tracking-tight text-foreground">Featured</h3>
              <Link to="/explore" className="text-sm font-bold text-[#C56A30] hover:underline cursor-pointer">View all</Link>
            </div>

            {/* Mobile Vertical Stack */}
            <div className="lg:hidden flex flex-col space-y-4">
              {featuredHostels.map((hostel) => (
                <HostelCard 
                  key={hostel.id}
                  hostel={hostel} 
                  onClick={() => setSelectedHostelId(hostel.id)} 
                  onSave={(e) => handleSave(e, hostel.id)}
                  isSaved={savedHostels.includes(hostel.id)}
                  showHeart={true}
                />
              ))}
            </div>

            {/* Desktop Horizontal Scroll */}
            <div className="hidden lg:block">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-4 pb-4 pt-1">
                  {featuredHostels.map((hostel) => (
                    <div key={hostel.id} className="w-[300px] shrink-0 block outline-none cursor-pointer">
                      <HostelCard 
                        hostel={hostel} 
                        onClick={() => setSelectedHostelId(hostel.id)} 
                        onSave={(e) => handleSave(e, hostel.id)}
                        isSaved={savedHostels.includes(hostel.id)}
                        showHeart={true}
                      />
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="hidden" />
              </ScrollArea>
            </div>
          </section>

          {/* Recommended for you */}
          <section className="px-4 py-2 mt-4 lg:px-8 lg:mt-6 mb-12">
            <h3 className="text-xl lg:text-[24px] font-extrabold tracking-tight text-foreground mb-4 lg:mb-6">Recommended for you</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6">

              {nearbyHostels.map((hostel) => (
                <div 
                  key={hostel.id} 
                  onClick={() => setSelectedHostelId(hostel.id)}
                  className="bg-card border border-border rounded-lg flex p-3 hover:shadow-md hover:bg-accent/50 transition-all cursor-pointer w-full"
                >
                  <div className="w-[88px] h-[88px] rounded-xl overflow-hidden shrink-0">
                    <img src={hostel.image} alt={hostel.name} loading="lazy" className="w-full h-full object-cover transition-transform hover:scale-110 duration-700" />
                  </div>
                  <div className="flex-1 ml-4 py-0.5 flex flex-col justify-between overflow-hidden">
                    <div>
                      <h4 className="font-bold text-foreground text-[16px] truncate">{hostel.name}</h4>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-wide truncate">{hostel.distance} away</p>
                    </div>
                    <div className="flex items-center justify-between">
                      {(() => {
                        const style = getBadgeStyle(hostel.availability);
                        return (
                          <div className={`font-bold text-[8px] px-1.5 py-0.5 rounded-md flex items-center ${style.bg}`}>
                            <span className={`w-1 h-1 rounded-full mr-1 ${style.dot}`} />
                            {hostel.availability}
                          </div>
                        );
                      })()}
                      <div className="flex items-center space-x-1 bg-yellow-400/20 px-2 flex-shrink-0 py-1 rounded-lg">
                        <Star className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600" />
                        <span className="text-sm font-bold text-yellow-700">{hostel.rating != null ? hostel.rating.toFixed(1) : "New"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            </div>
          </section>
        </>
      )}

      {/* Filter Options Modal */}
      <FilterModal 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        onApplyFilters={() => {}} 
        initialFilters={{ distance: 10, amenities: [], priceRange: [0, 10000] }}
      />

      <HostelDetailsOverlay 
        selectedHostelId={selectedHostelId} 
        setSelectedHostelId={setSelectedHostelId}
        savedHostels={savedHostels}
        onSave={handleSave}
      />

    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npm run build`
Expected: this will NOT be clean yet — `HostelDetailsOverlay` (Task 11) hasn't been updated to accept `selectedHostelId`/`setSelectedHostelId` props yet, so `tsc` will report a prop-mismatch error on this file's `<HostelDetailsOverlay ... />` call. **This is expected at this point in the plan** — Task 11 fixes it. Confirm the ONLY errors reported are about `HostelDetailsOverlayProps` / `selectedHostel` / `setSelectedHostel`, not anything else in this file (e.g. no errors about `useHostels`, `DisplayHostel` fields, or JSX syntax). If there are other errors, stop and report them — they mean this task's own code has a bug, not an expected cross-task gap.

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/pages/Home.tsx
git commit -m "$(cat <<'EOF'
feat(client): Home reads real hostel data

Featured = top-rated hostels (unrated ones sort last); Recommended =
closest to campus by real distance_from_campus, not the mock's
pre-sorted arrays. Shows a spinner while loading and a retry-visible
error banner if the initial fetch fails, instead of silently looking
like zero hostels exist.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Manual verification:** Once Task 11 also lands, the human partner loads `/` as a signed-in student against the real backend and confirms: Featured shows real hostel cards sorted by rating (unrated hostels last), Recommended shows real hostels sorted by distance, clicking a card opens the detail overlay.

---

### Task 9: `Explore.tsx` — real hostel data, search, and filters

**Files:**
- Modify: `client/src/pages/Explore.tsx` (full-file replacement — same reasoning as Task 8: the import, state, two filtered-list sources, the amenities-filter predicate shape, and the overlay props all change together)

**Interfaces:**
- Consumes: `useHostels` from `client/src/contexts/HostelsContext.tsx` (Task 4).

- [ ] **Step 1: Replace the file's contents**

```typescript
// client/src/pages/Explore.tsx
import { Search, SlidersHorizontal, Star } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import TopNav from "@/components/TopNav";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useState, useEffect } from "react";
import FilterModal from "@/components/FilterModal";
import HostelCard from "@/components/HostelCard";
import HostelDetailsOverlay from "@/components/HostelDetailsOverlay";
import { useHostels } from "@/contexts/HostelsContext";
import { useToast } from "@/components/ui/toaster";

export default function Explore() {
  const { toast } = useToast();
  const location = useLocation();
  const { hostels, isLoading, error } = useHostels();
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(() => location.state?.restoreHostel || null);
  const [savedHostels, setSavedHostels] = useState<string[]>(() => {
    const saved = localStorage.getItem("saved_hostels");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (location.state?.restoreHostel) {
      setSelectedHostelId(location.state.restoreHostel);
    }
  }, [location.state]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => location.state?.searchQuery || "");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    if (location.state?.searchQuery !== undefined) {
      setSearchQuery(location.state.searchQuery);
    }
  }, [location.state]);
  const [activeFilters, setActiveFilters] = useState<{ distance: number; amenities: string[], priceRange: [number, number] }>({ 
    distance: 10, 
    amenities: [], 
    priceRange: [0, 10000] 
  });

  const matchesFilters = (h: (typeof hostels)[number]) => {
    if (searchQuery && !h.name.toLowerCase().includes(searchQuery.toLowerCase()) && !h.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if ((h.distanceKm ?? Infinity) > activeFilters.distance) return false;
    if (h.startingPrice !== null && (h.startingPrice < activeFilters.priceRange[0] || h.startingPrice > activeFilters.priceRange[1])) return false;
    if (activeFilters.amenities.length > 0 && !activeFilters.amenities.every((a) => h.amenities.some((am) => am.label === a))) return false;
    return true;
  };

  const featuredHostels = [...hostels].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  const nearbyHostels = [...hostels].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  const filteredPopular = featuredHostels.filter(matchesFilters);
  const filteredNearby = nearbyHostels.filter(matchesFilters);

  const searchSuggestions = searchQuery.trim().length > 0
    ? hostels.filter(h =>
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.location.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : [];
  const showSearchDropdown = isSearchFocused && searchQuery.trim().length > 0;

  const handleSelectSuggestion = (hostel: (typeof hostels)[number]) => {
    setSelectedHostelId(hostel.id);
    setSearchQuery(hostel.name);
    setIsSearchFocused(false);
  };

  const handleSave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    let newSaved;
    if (savedHostels.includes(id)) {
      newSaved = savedHostels.filter(h => h !== id);
      toast("Removed from favorites", "info");
    } else {
      newSaved = [...savedHostels, id];
      toast("Added to favorites", "success");
    }
    setSavedHostels(newSaved);
    localStorage.setItem("saved_hostels", JSON.stringify(newSaved));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 relative">
      {/* Mobile Top App Bar */}
      <div className="lg:hidden">
        <TopNav />
      </div>

      {/* Desktop Header */}
      <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-6 w-full">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Explore</h1>
        <div className="flex items-center space-x-4">
          <NotificationsDropdown />
          <Link to="/profile" className="w-[52px] h-[52px] bg-[#E5D0BA] rounded-full flex items-center justify-center font-bold text-[#6c5e57] shadow-sm text-lg cursor-pointer hover:opacity-90">
            SA
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-5 lg:px-8 space-y-8 pt-24 lg:pt-0">
        
        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search address, or near you"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
              className="w-full h-14 bg-[#F4ECE3] dark:bg-card rounded-[16px] pl-12 pr-4 text-[15px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-none border border-transparent dark:border-border transition-all"
            />

            {showSearchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-lg z-30 overflow-hidden">
                {searchSuggestions.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No hostels match "{searchQuery}"</p>
                ) : (
                  searchSuggestions.map((hostel) => (
                    <div
                      key={hostel.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(hostel);
                      }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60 cursor-pointer transition-colors"
                    >
                      <img src={hostel.image} alt={hostel.name} loading="lazy" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{hostel.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{hostel.location}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setIsFilterOpen(true)}
            className="w-14 h-14 flex items-center justify-center bg-[#C56A30] hover:bg-[#b05b26] text-white rounded-[16px] shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center space-x-3 overflow-x-auto pb-2 hide-scrollbar">
          {["All", "Available", "Under GHS 6,500", "Air-conditioned", "Ensuite"].map((chip, idx) => (
            <button 
              key={idx} 
              className={`px-5 py-2 rounded-full font-extrabold text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                idx === 0 
                  ? "bg-[#C56A30] text-white shadow-sm" 
                  : "bg-[#F4ECE3] dark:bg-card text-[#C56A30] hover:bg-[#EBE2D8]"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Most Popular */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl lg:text-[22px] font-extrabold tracking-tight text-foreground">Most popular</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPopular.length === 0 && <p className="text-muted-foreground text-sm py-4">{hostels.length === 0 ? "No hostels available yet." : "No popular hostels match your search."}</p>}
                {filteredPopular.map((hostel) => (
                  <HostelCard 
                    key={hostel.id}
                    hostel={hostel} 
                    onClick={() => setSelectedHostelId(hostel.id)} 
                    onSave={(e) => handleSave(e, hostel.id)}
                    isSaved={savedHostels.includes(hostel.id)}
                    showHeart={true}
                  />
                ))}
              </div>
            </div>

            {/* Nearby Place */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl lg:text-[22px] font-extrabold tracking-tight text-foreground">Closer to campus</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredNearby.length === 0 && <p className="text-muted-foreground text-sm py-4">{hostels.length === 0 ? "No hostels available yet." : "No nearby hostels match your search."}</p>}
                {filteredNearby.map((hostel) => (
                  <div 
                    key={hostel.id} 
                    onClick={() => setSelectedHostelId(hostel.id)}
                    className="w-full bg-white dark:bg-card rounded-2xl p-4 flex items-center shadow-sm border border-border/40 cursor-pointer hover:shadow-md transition-all gap-4"
                  >
                    <img src={hostel.image} alt={hostel.name} loading="lazy" className="w-[110px] h-[110px] rounded-[18px] object-cover shrink-0" />
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-extrabold text-[18px] text-foreground truncate mb-0.5">{hostel.name}</h3>
                      <p className="text-muted-foreground text-[13px] font-medium mb-3 truncate">{hostel.location} · {hostel.distance}</p>
                      <div className="flex items-center space-x-3">
                        {(() => {
                          const isAvailable = hostel.availability?.toUpperCase() === 'AVAILABLE';
                          return (
                            <div className={`font-extrabold text-[11px] px-3 py-1 rounded-full flex items-center space-x-1.5 ${
                              isAvailable ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-[#FCE8E6] text-[#C5221F]'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-[#137333]' : 'bg-[#C5221F]'}`} />
                              <span>{hostel.availability}</span>
                            </div>
                          );
                        })()}
                        <div className="flex items-center space-x-1 shrink-0">
                          <Star className="w-4 h-4 text-[#E09F5E] fill-[#E09F5E]" />
                          <span className="text-[14px] font-bold text-foreground">{hostel.rating != null ? hostel.rating.toFixed(1) : "New"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </div>

      {/* Filter Modal */}
      <FilterModal 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        onApplyFilters={setActiveFilters}
        initialFilters={activeFilters}
      />

      <HostelDetailsOverlay 
        selectedHostelId={selectedHostelId} 
        setSelectedHostelId={setSelectedHostelId}
        savedHostels={savedHostels}
        onSave={handleSave}
      />

    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npm run build`
Expected: same caveat as Task 8 Step 2 — errors about `HostelDetailsOverlay`'s props are expected until Task 11 lands; no other errors should appear.

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/pages/Explore.tsx
git commit -m "$(cat <<'EOF'
feat(client): Explore reads real hostel data

Search/distance/price/amenity filtering logic is unchanged in shape —
it's the same .filter() predicates as before, just reading from the
real fetched list (via useHostels()) instead of the mock arrays, and
the amenity check now compares against DisplayAmenity.label instead
of a plain string array. Empty states distinguish "no hostels exist
yet" from "no hostels match your filters."

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Manual verification:** Once Task 11 also lands, the human partner loads `/explore`, confirms real hostels render in both sections, searches for a real hostel's name/location and confirms the dropdown + filtered results work, opens the filter modal and applies a distance/price/amenity filter and confirms results narrow correctly, and confirms a zero-hostels database shows "No hostels available yet" rather than a blank page.

---

### Task 10: `Saved.tsx` — real hostel data

**Files:**
- Modify: `client/src/pages/Saved.tsx` (full-file replacement — same reasoning as Tasks 8/9)

**Interfaces:**
- Consumes: `useHostels` from `client/src/contexts/HostelsContext.tsx` (Task 4).

- [ ] **Step 1: Replace the file's contents**

```typescript
// client/src/pages/Saved.tsx
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import TopNav from "@/components/TopNav";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useHostels } from "@/contexts/HostelsContext";
import { Search, SlidersHorizontal, Bookmark, MapPin, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import FilterModal from "@/components/FilterModal";
import HostelDetailsOverlay from "@/components/HostelDetailsOverlay";
import { useToast } from "@/components/ui/toaster";

export default function Saved() {
  const { toast } = useToast();
  const location = useLocation();
  const { hostels, isLoading, error } = useHostels();
  const [savedHostelIds, setSavedHostelIds] = useState<string[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(() => location.state?.restoreHostel || null);

  useEffect(() => {
    if (location.state?.restoreHostel) {
      setSelectedHostelId(location.state.restoreHostel);
    }
  }, [location.state]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<{ distance: number; amenities: string[], priceRange: [number, number] }>({ 
    distance: 10, 
    amenities: [], 
    priceRange: [0, 10000] 
  });
  
  useEffect(() => {
    const saved = localStorage.getItem("saved_hostels");
    if (saved) {
      setSavedHostelIds(JSON.parse(saved));
    }
  }, []);

  const handleUnsave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSaved = savedHostelIds.filter(hId => hId !== id);
    setSavedHostelIds(newSaved);
    localStorage.setItem("saved_hostels", JSON.stringify(newSaved));
    toast("Removed from saved", "info");
  };

  const savedHostels = hostels.filter(h => savedHostelIds.includes(h.id));

  // Apply filtering and search
  const filteredSaved = savedHostels.filter(h => {
    if (searchQuery && !h.name.toLowerCase().includes(searchQuery.toLowerCase()) && !h.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if ((h.distanceKm ?? Infinity) > activeFilters.distance) return false;
    if (h.startingPrice !== null && (h.startingPrice < activeFilters.priceRange[0] || h.startingPrice > activeFilters.priceRange[1])) return false;
    if (activeFilters.amenities.length > 0 && !activeFilters.amenities.every(a => h.amenities.some((am) => am.label === a))) return false;
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background transition-colors pb-20 relative">
      <div className="lg:hidden">
        <TopNav />
      </div>
      
      {/* Desktop Header */}
      <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-6 w-full border-b border-border/40">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Saved</h1>
        <NotificationsDropdown />
      </header>

      <div className="px-5 lg:px-8 space-y-6 pt-24 lg:pt-8">
        <div className="flex items-center justify-between lg:hidden">
          <h1 className="text-2xl font-bold text-foreground">Saved Hostels</h1>
          {savedHostelIds.length > 0 && (
            <span className="bg-[#C56A30]/10 text-[#C56A30] text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">{savedHostelIds.length} Saved</span>
          )}
        </div>

        {/* Search & Filter Bar */}
        {savedHostels.length > 0 && (
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search your saved list" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-14 bg-card rounded-2xl pl-12 pr-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-sm border border-border/50 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="w-14 h-14 flex items-center justify-center bg-card text-foreground rounded-2xl shadow-sm border border-border/50 transition-transform active:scale-95 hover:bg-accent"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">
            {error}
          </div>
        )}

        {!isLoading && !error && (filteredSaved.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 lg:mt-32">
            <div className={`w-24 h-24 rounded-full bg-[#FDFCFB] flex items-center justify-center mb-6 shadow-sm border border-border/40 ${searchQuery ? 'hidden' : 'flex'}`}>
              <Bookmark className="w-8 h-8 text-[#C56A30]" />
            </div>
            <Search className={`w-16 h-16 text-muted-foreground mb-4 opacity-50 ${searchQuery ? 'block' : 'hidden'}`} />
            
            <h2 className="text-[22px] font-extrabold text-foreground text-center mb-3">
              {searchQuery ? "No results found" : "No saved hostels yet"}
            </h2>
            <p className="text-[15px] font-medium text-muted-foreground text-center max-w-sm mb-8 leading-relaxed">
              {searchQuery ? "Try a different search term or clear filters." : "Tap the heart on any hostel to keep it here. Build your shortlist and compare rooms side by side."}
            </p>
            
            {!searchQuery && (
              <Link to="/explore" className="inline-flex items-center justify-center h-12 px-8 bg-[#C56A30] hover:bg-[#b05b26] text-white font-bold rounded-full transition-colors shadow-sm text-[15px]">
                <Search className="w-4 h-4 mr-2" />
                Explore hostels
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {filteredSaved.map((hostel) => (
              <div 
                key={hostel.id} 
                onClick={() => setSelectedHostelId(hostel.id)}
                className="w-full bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-center justify-between group animate-in fade-in slide-in-from-bottom-4 duration-300 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-center space-x-4">
                  <img src={hostel.image} alt={hostel.name} loading="lazy" className="w-20 h-20 rounded-[18px] object-cover shadow-sm" />
                  <div className="flex flex-col">
                    <h3 className="font-extrabold text-[16px] text-foreground mb-1">{hostel.name}</h3>
                    <div className="flex items-center text-muted-foreground text-[12px] font-medium mb-1.5">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-[#C56A30]" />
                      <span className="truncate max-w-[160px]">{hostel.location}</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-[#C56A30] font-extrabold text-sm">{hostel.startingPrice !== null ? `GHS ${hostel.startingPrice.toLocaleString()}` : "Price unavailable"}</span>
                      <span className="text-muted-foreground text-[10px] font-medium ml-1">/ {hostel.priceFreq || 'sem'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center space-y-2 pr-2">
                  <button 
                    onClick={(e) => handleUnsave(e, hostel.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors shadow-sm cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <HostelDetailsOverlay 
        selectedHostelId={selectedHostelId} 
        setSelectedHostelId={setSelectedHostelId}
        savedHostels={savedHostelIds}
        onSave={handleUnsave}
      />

      {/* Filter Modal */}
      <FilterModal 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        onApplyFilters={setActiveFilters}
        initialFilters={activeFilters}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npm run build`
Expected: same caveat as Tasks 8/9 — errors about `HostelDetailsOverlay`'s props are expected until Task 11 lands.

- [ ] **Step 3: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/pages/Saved.tsx
git commit -m "$(cat <<'EOF'
feat(client): Saved reads real hostel data

Favorites mechanism (localStorage array of hostel ids) is unchanged —
only the source it filters against changes, from the mock ALL_HOSTELS
to the real fetched list.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Manual verification:** Once Task 11 also lands, the human partner saves a couple of real hostels from Explore, visits `/saved`, confirms they appear with correct name/location/price, unsaves one and confirms it disappears.

---

### Task 11: `HostelDetailsOverlay.tsx` — real hostel detail, real rooms

**Files:**
- Modify: `client/src/components/HostelDetailsOverlay.tsx` (full rewrite — the file is 600 lines with deeply interleaved logic; this task replaces its entire contents in one pass rather than many fragile find/replace edits across hardcoded `roomTypes` references, prop renames, and null-safety additions scattered throughout)

**Interfaces:**
- Consumes: `useHostels` from `client/src/contexts/HostelsContext.tsx` (Task 4); `getHostelById` from `client/src/lib/hostels.ts` (Task 2); `toDisplayHostelDetail`, `type DisplayHostelDetail`, `type DisplayRoom` from `client/src/lib/hostelMappers.ts` (Task 3); `ApiError` from `client/src/lib/apiClient.ts` (Stage 1); `useBookings` from `client/src/contexts/BookingContext.tsx` (pre-existing, untouched).
- Produces: `export interface HostelDetailsOverlayProps { selectedHostelId: string | null; setSelectedHostelId: (id: string | null) => void; savedHostels?: string[]; onSave?: (e, id) => void }` — this is the exact new prop shape Tasks 8, 9, 10 already call this component with.

- [ ] **Step 1: Replace the file's contents**

```typescript
// client/src/components/HostelDetailsOverlay.tsx
import { ChevronLeft, ChevronRight, Heart, MapPin, Navigation, Search, Star, ThumbsUp, X, Box, ShieldCheck, Droplets } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useBookings } from "@/contexts/BookingContext";
import { useHostels } from "@/contexts/HostelsContext";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { getHostelById } from "@/lib/hostels";
import { toDisplayHostelDetail, type DisplayHostelDetail, type DisplayRoom } from "@/lib/hostelMappers";
import { ApiError } from "@/lib/apiClient";

export interface HostelDetailsOverlayProps {
  selectedHostelId: string | null;
  setSelectedHostelId: (id: string | null) => void;
  savedHostels?: string[];
  onSave?: (e: React.MouseEvent, id: string) => void;
}

export default function HostelDetailsOverlay({ selectedHostelId, setSelectedHostelId, savedHostels = [], onSave }: HostelDetailsOverlayProps) {
  const navigate = useNavigate();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [detail, setDetail] = useState<DisplayHostelDetail | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const { bookings } = useBookings();
  const { hostels } = useHostels();

  useEffect(() => {
    if (!selectedHostelId) {
      setIsOpen(false);
      const t = setTimeout(() => {
        setDetail(null);
        setDetailError(null);
      }, 500);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    setIsLoadingDetail(true);
    setDetailError(null);
    setSelectedRoom(null);
    setActiveImageIndex(null);

    getHostelById(selectedHostelId)
      .then((backendDetail) => {
        if (cancelled) return;
        const listMatch = hostels.find((h) => h.id === selectedHostelId);
        const mapped = toDisplayHostelDetail(backendDetail);
        setDetail({
          ...mapped,
          rating: listMatch?.rating ?? null,
          reviewCount: listMatch?.reviewCount ?? 0,
        });
        setIsLoadingDetail(false);
        setTimeout(() => setIsOpen(true), 20);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(err instanceof ApiError ? err.message : "Couldn't load this hostel. Please try again.");
        setIsLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedHostelId]);

  const hasActiveBooking = bookings.some((b) => b.studentName === "Sarah Adjei" && (b.status === "PENDING" || b.status === "CONFIRMED"));

  const galleryList: string[] = detail?.gallery || [];
  const activeImage = activeImageIndex !== null ? galleryList[activeImageIndex] : null;

  const showPrevImage = () => setActiveImageIndex((i) => (i === null ? i : (i - 1 + galleryList.length) % galleryList.length));
  const showNextImage = () => setActiveImageIndex((i) => (i === null ? i : (i + 1) % galleryList.length));

  useEffect(() => {
    if (activeImageIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveImageIndex(null);
      if (e.key === "ArrowLeft") showPrevImage();
      if (e.key === "ArrowRight") showNextImage();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeImageIndex, galleryList.length]);

  if (!selectedHostelId && !detail) return null;

  if (selectedHostelId && isLoadingDetail && !detail) {
    return (
      <div className="fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (selectedHostelId && detailError && !detail) {
    return (
      <div className="fixed inset-0 z-[110] bg-background/95 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-foreground font-semibold">{detailError}</p>
        <button
          onClick={() => setSelectedHostelId(null)}
          className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold cursor-pointer"
        >
          Close
        </button>
      </div>
    );
  }

  if (!detail) return null;

  const hostel = detail;
  const roomTypes = detail.rooms;
  const isAvailable = hostel.availability?.toUpperCase() === "AVAILABLE";
  const extraGalleryCount = Math.max((hostel.gallery?.length || 0) - 3, 0);

  const searchSuggestions = searchQuery.trim().length > 0
    ? hostels.filter((h) =>
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.location.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : [];
  const showSearchDropdown = isSearchFocused && searchQuery.trim().length > 0;

  const handleSelectSuggestion = (h: (typeof hostels)[number]) => {
    setSelectedHostelId(h.id);
    setSearchQuery("");
    setIsSearchFocused(false);
  };

  const handleBook = () => {
    if (!selectedRoom || hasActiveBooking) return;
    const activeRoomObj = roomTypes.find((t) => t.id === selectedRoom) || roomTypes[0];
    if (!activeRoomObj) return;
    navigate("/booking", {
      state: {
        hostelName: hostel.name,
        location: hostel.location,
        image: hostel.image,
        roomLabel: activeRoomObj.label,
        price: activeRoomObj.pricePerBed,
        returnToHostel: hostel.id,
        returnPath: window.location.pathname,
      },
    });
  };

  const handlePreview360 = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const activeRoomObj = roomTypes.find((t) => t.id === selectedRoom) || roomTypes[0];
    if (!activeRoomObj) return;
    navigate("/live-preview", {
      state: {
        returnToHostel: hostel.id,
        returnPath: window.location.pathname,
        hostelName: hostel.name,
        location: hostel.location,
        image: hostel.image,
        roomLabel: activeRoomObj.label,
        price: activeRoomObj.pricePerBed,
      },
    });
  };

  const DescriptionText = <p className="text-sm text-muted-foreground leading-relaxed">{hostel.desc}</p>;

  const AmenitiesGrid = (
    <div className="grid grid-cols-2 gap-y-4">
      {hostel.amenities.map(({ label, Icon }) => (
        <div key={label} className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10 group-hover:bg-primary/10 transition-colors">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
      ))}
      <div className="flex items-center space-x-3 group">
        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <span className="text-sm font-medium text-foreground">Security</span>
      </div>
      <div className="flex items-center space-x-3 group">
        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
          <Droplets className="w-5 h-5 text-primary" />
        </div>
        <span className="text-sm font-medium text-foreground">Water Supply</span>
      </div>
    </div>
  );

  const DescriptionBlock = (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-foreground mb-3">Description</h3>
      {DescriptionText}
    </div>
  );

  const AmenitiesBlock = (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-foreground mb-4">What this place offers</h3>
      {AmenitiesGrid}
    </div>
  );

  const mapQuery = encodeURIComponent(`${hostel.name} ${hostel.location}`);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`;
  const mapEmbedSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;

  const LocationMap = (
    <>
      <div className="rounded-2xl overflow-hidden border border-border h-56 bg-muted/50">
        <iframe
          title={`Map showing ${hostel.name}`}
          src={mapEmbedSrc}
          className="w-full h-full"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 text-primary font-bold text-sm hover:text-primary/80 transition-colors"
      >
        <Navigation className="w-4 h-4" />
        <span>Get Directions</span>
      </a>
    </>
  );

  const LocationBlock = (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-foreground mb-4">Location</h3>
      {LocationMap}
    </div>
  );

  const renderRoomOption = (type: DisplayRoom, dense = false, showExpand = true) => (
    <div
      key={type.id}
      className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-accent/50 ${
        selectedRoom === type.id ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 bg-card hover:border-primary/30"
      }`}
      onClick={() => setSelectedRoom(type.id)}
    >
      <div className="flex items-center justify-between w-full gap-3">
        <div>
          <span className={`block font-bold text-foreground ${dense ? "text-sm" : "text-[15px]"}`}>{type.label}</span>
          <span className={`block text-muted-foreground ${dense ? "text-xs" : "text-[13px]"} mt-0.5`}>{type.subtitle}</span>
        </div>
        <span className={`font-bold text-primary shrink-0 ${dense ? "text-sm" : ""}`}>
          GHS {type.pricePerBed.toLocaleString()}
        </span>
      </div>

      {showExpand && selectedRoom === type.id && (
        <div className="mt-4 pt-4 border-t border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-end gap-4 flex-wrap">
          <button
            type="button"
            onClick={handlePreview360}
            className="shrink-0 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs px-3 py-2 rounded-lg transition-colors flex items-center space-x-2 border border-primary/20"
          >
            <Box className="w-3.5 h-3.5" />
            <span>Preview 360°</span>
          </button>
        </div>
      )}
    </div>
  );

  const BookButton = ({ className = "" }: { className?: string }) => (
    <button
      disabled={!selectedRoom || hasActiveBooking}
      onClick={handleBook}
      className={`w-full py-4 rounded-2xl font-bold flex justify-center items-center transition-all text-lg ${
        hasActiveBooking
          ? "bg-red-500/10 text-red-500 opacity-90 cursor-not-allowed border border-red-500/20"
          : selectedRoom
          ? "bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(197,106,48,0.3)] hover:scale-[1.02] active:scale-[0.98]"
          : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
      } ${className}`}
    >
      {hasActiveBooking ? "You already have an active booking" : selectedRoom ? "Book Now" : "Select a room to proceed"}
    </button>
  );

  return (
    <>
      {/* ===== Mobile / Tablet: sliding bottom sheet ===== */}
      <div className="lg:hidden">
        {/* Dimmed Background */}
        <div
          className={`fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setSelectedHostelId(null)}
        />

        {/* Sliding Sheet */}
        <div
          className={`fixed bottom-0 left-0 w-full h-[92vh] z-[110] bg-background rounded-t-[40px] flex flex-col overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          {/* Header / Hero Image */}
          <div className="relative h-64 shrink-0 bg-muted/50">
            <img src={hostel.image} loading="lazy" className="w-full h-full object-cover transition-opacity duration-300" alt="Property Header" />

            <button
              onClick={() => setSelectedHostelId(null)}
              className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-md text-foreground border border-white/40 hover:bg-white transition-colors shadow-sm"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {onSave && (
              <button
                onClick={(e) => onSave(e, hostel.id)}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-md border border-white/40 hover:bg-white transition-colors shadow-sm"
              >
                <Heart className={`w-5 h-5 ${savedHostels.includes(hostel.id) ? "fill-primary text-primary" : "text-foreground"}`} />
              </button>
            )}

            {/* Availability pill straddling image/card boundary */}
            <div
              className={`absolute -bottom-3 left-6 font-extrabold text-[11px] px-3 py-1.5 rounded-full flex items-center space-x-1.5 shadow-sm z-30 ${
                isAvailable ? "bg-[#E6F4EA] text-[#137333]" : "bg-[#FCE8E6] text-[#C5221F]"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isAvailable ? "bg-[#137333]" : "bg-[#C5221F]"}`} />
              <span>{hostel.availability}</span>
            </div>
          </div>

          {/* Content Scrollable Area */}
          <div className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-28 z-20 relative pt-2">
            <div className="bg-background w-full rounded-t-[32px] pt-6 -mt-6 relative">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold text-foreground">{hostel.name}</h2>
                <div className="flex items-center space-x-1 bg-primary/10 px-2.5 py-1 rounded-lg shrink-0">
                  <ThumbsUp className="w-4 h-4 text-primary fill-primary" />
                  <span className="text-sm font-bold text-primary">{hostel.rating !== null ? hostel.rating.toFixed(1) : "New"}</span>
                </div>
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hostel.name} ${hostel.location}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-muted-foreground text-sm font-medium hover:text-primary transition-colors cursor-pointer group w-fit mb-6"
              >
                <MapPin className="w-4 h-4 mr-1 opacity-70 group-hover:opacity-100" />
                <span className="underline decoration-dotted underline-offset-2">{hostel.location}</span>
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                <span className="font-bold text-primary">{hostel.distance}</span>
              </a>

              <div className="mb-8">
                <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase mb-3">Choose a room</h3>
                <div className="space-y-3">
                  {roomTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rooms listed for this hostel yet.</p>
                  ) : (
                    roomTypes.map((type) => renderRoomOption(type, false, false))
                  )}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase mb-3">Description</h3>
                {DescriptionText}
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase mb-4">What this place offers</h3>
                {AmenitiesGrid}
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase mb-3">Location</h3>
                {LocationMap}
              </div>
            </div>
          </div>

          {/* Bottom Sticky Action Bar */}
          <div className="p-4 bg-background border-t border-border shrink-0 z-30 pb-8 flex items-center justify-between gap-4">
            {(() => {
              const activeRoomObj = roomTypes.find((t) => t.id === selectedRoom) || roomTypes[0];
              return (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground truncate">{activeRoomObj?.label || "No rooms available"}</p>
                  <p className="text-xl font-extrabold text-foreground">
                    {activeRoomObj ? `GHS ${activeRoomObj.pricePerBed.toLocaleString()}` : "—"}
                  </p>
                </div>
              );
            })()}
            <button
              disabled={!selectedRoom || hasActiveBooking}
              onClick={handleBook}
              className={`shrink-0 px-8 py-3.5 rounded-full font-bold transition-all ${
                hasActiveBooking
                  ? "bg-red-500/10 text-red-500 opacity-90 cursor-not-allowed border border-red-500/20"
                  : selectedRoom
                  ? "bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(197,106,48,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
              }`}
            >
              {hasActiveBooking ? "Unavailable" : "Book room"}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Desktop: full-page split layout ===== */}
      <div
        className={`hidden lg:block fixed inset-y-0 right-0 left-[88px] z-[110] bg-background overflow-y-auto transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-6xl mx-auto px-10 py-8">
          {/* Top bar: search + notifications + avatar (mirrors Explore desktop header) */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search hostels near Berekuso..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const q = searchQuery;
                    setSelectedHostelId(null);
                    navigate("/explore", { state: { searchQuery: q } });
                  }
                }}
                className="w-full h-14 bg-[#F4ECE3] dark:bg-card rounded-[16px] pl-12 pr-4 text-[15px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-none border border-transparent dark:border-border transition-all"
              />

              {showSearchDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-lg z-30 overflow-hidden">
                  {searchSuggestions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No hostels match "{searchQuery}"</p>
                  ) : (
                    searchSuggestions.map((h) => (
                      <div
                        key={h.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(h);
                        }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60 cursor-pointer transition-colors"
                      >
                        <img src={h.image} alt={h.name} loading="lazy" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{h.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{h.location}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <NotificationsDropdown />
            <Link to="/profile" className="w-[52px] h-[52px] bg-[#E5D0BA] rounded-full flex items-center justify-center font-bold text-[#6c5e57] shadow-sm text-lg cursor-pointer hover:opacity-90 shrink-0">
              SA
            </Link>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm font-bold mb-6">
            <button
              onClick={() => setSelectedHostelId(null)}
              className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Explore</span>
            </button>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-muted-foreground">{hostel.name}</span>
          </div>

          <div className="grid grid-cols-3 gap-10 items-start">
            {/* Left column */}
            <div className="col-span-2">
              {/* Hero image */}
              <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-muted/50 mb-4">
                <img src={hostel.image} loading="lazy" className="w-full h-full object-cover" alt="Property Header" />

                <div
                  className={`absolute top-5 left-5 font-extrabold text-[11px] px-3 py-1.5 rounded-full flex items-center space-x-1.5 ${
                    isAvailable ? "bg-[#E6F4EA] text-[#137333]" : "bg-[#FCE8E6] text-[#C5221F]"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isAvailable ? "bg-[#137333]" : "bg-[#C5221F]"}`} />
                  <span>{hostel.availability}</span>
                </div>

                {onSave && (
                  <button
                    onClick={(e) => onSave(e, hostel.id)}
                    className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-md border border-white/40 hover:bg-white transition-colors shadow-sm"
                  >
                    <Heart className={`w-5 h-5 ${savedHostels.includes(hostel.id) ? "fill-primary text-primary" : "text-foreground"}`} />
                  </button>
                )}
              </div>

              {/* Thumbnails */}
              {hostel.gallery && hostel.gallery.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mb-8">
                  {hostel.gallery.slice(0, 3).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      loading="lazy"
                      onClick={() => setActiveImageIndex(idx)}
                      className="w-full aspect-square rounded-2xl object-cover border border-border shadow-sm cursor-pointer transition-all hover:opacity-80"
                      alt="Gallery item"
                    />
                  ))}
                  {extraGalleryCount > 0 && (
                    <button
                      onClick={() => setActiveImageIndex(3)}
                      className="w-full aspect-square rounded-2xl bg-foreground text-background font-extrabold text-lg flex items-center justify-center hover:opacity-90 transition-opacity"
                    >
                      +{extraGalleryCount}
                    </button>
                  )}
                </div>
              )}

              {/* Title */}
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-extrabold text-foreground tracking-tight">{hostel.name}</h2>
                <div className="flex items-center space-x-1 bg-yellow-400/20 px-2 py-1 rounded-lg">
                  <Star className="w-4 h-4 text-yellow-600 fill-yellow-600" />
                  <span className="text-sm font-bold text-yellow-700">{hostel.rating !== null ? hostel.rating.toFixed(1) : "New"}</span>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hostel.name} ${hostel.location}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-muted-foreground text-sm font-medium hover:text-primary transition-colors cursor-pointer group w-fit mb-8"
              >
                <MapPin className="w-4 h-4 mr-1 opacity-70 group-hover:opacity-100" />
                <span className="underline decoration-dotted underline-offset-2">{hostel.location}</span>
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                <span>{hostel.distance} from campus</span>
              </a>

              {DescriptionBlock}
              {AmenitiesBlock}
              {LocationBlock}
            </div>

            {/* Right column: sticky pricing card */}
            <div className="col-span-1">
              <div className="sticky top-8 bg-card border border-border rounded-2xl p-6 shadow-sm">
                <span className="text-[11px] font-extrabold tracking-wider text-muted-foreground">STARTS FROM</span>
                <div className="flex items-baseline gap-1.5 mt-1 mb-5">
                  <span className="text-3xl font-extrabold text-foreground">
                    {hostel.startingPrice !== null ? `GHS ${hostel.startingPrice.toLocaleString()}` : "Price unavailable"}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">/semester</span>
                </div>

                <span className="text-[11px] font-extrabold tracking-wider text-muted-foreground mb-3 block">CHOOSE A ROOM</span>
                <div className="space-y-3 mb-5">
                  {roomTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rooms listed for this hostel yet.</p>
                  ) : (
                    roomTypes.map((type) => renderRoomOption(type, true))
                  )}
                </div>

                <BookButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full screen Image Preview Modal */}
      {activeImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col justify-center items-center backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveImageIndex(null)}
        >
          <button
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setActiveImageIndex(null)}
          >
            <X className="w-6 h-6" />
          </button>

          {galleryList.length > 1 && (
            <>
              <button
                className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrevImage();
                }}
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button
                className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  showNextImage();
                }}
              >
                <ChevronRight className="w-7 h-7" />
              </button>

              <span className="absolute bottom-6 text-white/80 text-sm font-medium">
                {activeImageIndex! + 1} / {galleryList.length}
              </span>
            </>
          )}

          <img src={activeImage} alt="Preview" className="max-w-[95vw] max-h-[90vh] object-contain shadow-2xl rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npm run build`
Expected: clean build. This is the task that resolves the `HostelDetailsOverlay` prop-mismatch errors Tasks 8, 9, 10 flagged as expected at the time — confirm those are now gone too.

- [ ] **Step 3: Manual verification**

With both dev servers running (`npm run dev` in `server/`, `npm run dev` in `client/`), against the real backend with at least one APPROVED hostel that has images, amenities, and rooms:

1. From Explore, click a hostel card. **Expected:** detail overlay opens with a brief loading spinner, then shows the real name, location, images, amenities, description, and real room options with real prices (Review Focus #1/#2/#3).
2. Select a room, confirm the sticky price bar updates to that room's real price, confirmed "Book room"/"Book Now" enables.
3. Click "Preview 360°" on a selected room. **Expected:** navigates to `/live-preview` (still the hardcoded demo — this stage deliberately didn't wire real tour data).
4. Close the overlay, confirm it slides/fades closed without a stale flash of the previous hostel's data.
5. Stop the backend server, click a hostel card. **Expected:** loading spinner, then an inline error with a "Close" button (Review Focus #5) — not a frozen spinner or a crash.
6. If you have a hostel with zero uploaded images, zero reviews, and zero rooms in your test data: confirm its card shows the placeholder image and "New" instead of a rating, and its detail view shows "Price unavailable," "No rooms listed for this hostel yet," and the placeholder gallery image, with no crash anywhere (Review Focus #1/#2/#3 end-to-end).

- [ ] **Step 4: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/components/HostelDetailsOverlay.tsx
git commit -m "$(cat <<'EOF'
feat(client): HostelDetailsOverlay shows real hostel detail and rooms

Fetches GET /api/hostels/:id on open instead of receiving a full mock
object as a prop — the prop is now just the hostel id. The two
hardcoded fake room types (with an invented ensuite/shared-bath split
and a priceOffset from a fabricated base price) are replaced by the
hostel's real ROOM rows, each carrying its own real price_per_bed.
Rating is pulled from the already-loaded HostelsContext list rather
than re-fetched. Shows a loading spinner while fetching and an inline,
closeable error if the fetch fails (e.g. the hostel was un-approved or
deleted between the list loading and the click).

The internal hostel-search-while-browsing-detail feature now searches
the real hostel list instead of the mock ALL_HOSTELS array.

LivePreview 360 tour wiring remains deferred — "Preview 360°" still
navigates to the existing hardcoded demo page.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Delete the mock data module

**Files:**
- Delete: `client/src/data/hostels.ts`

**Interfaces:**
- Consumes: nothing — this task only runs after confirming nothing imports this file anymore.

- [ ] **Step 1: Confirm nothing still imports it**

Run (from repo root): `grep -rn "data/hostels" client/src`
Expected: no output. If anything is found, STOP — do not delete the file, report which file(s) still reference it (a sign an earlier task's edit was incomplete).

- [ ] **Step 2: Delete the file**

```bash
cd /home/ammes/Github/CampusNest
rm client/src/data/hostels.ts
```

- [ ] **Step 3: Verify**

Run (from `client/`): `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
cd /home/ammes/Github/CampusNest
git add client/src/data/hostels.ts
git commit -m "$(cat <<'EOF'
chore(client): remove the mock hostel data module

No longer imported anywhere — Home, Explore, Saved, and
HostelDetailsOverlay all read real data via HostelsContext now.
Confirmed via grep before deletion.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** every item in the spec's Architecture section maps to a task — backend join (Task 1), `lib/hostels.ts` (Task 2), `hostelMappers.ts` (Task 3), `HostelsContext.tsx` (Task 4), `App.tsx` (Task 5), `data/hostels.ts` deletion (Task 12), Home/Explore/Saved (Tasks 8-10), `HostelDetailsOverlay.tsx` (Task 11) — plus two tasks (6, 7) the spec didn't explicitly call out but that writing this plan surfaced as necessary: `HostelCard.tsx`'s unconditional `.toFixed(1)` would crash on the spec's own "no ratings yet" design, and `FilterModal.tsx`'s hardcoded amenity options didn't match the real enum-derived labels the spec settled on. Both are now in-scope tasks rather than silent gaps.
- **Placeholder scan:** none found — every step has complete, real code.
- **Type consistency:** `DisplayHostel`/`DisplayRoom`/`DisplayHostelDetail` (Task 3) are used with identical field names across Tasks 4, 8, 9, 10, 11 (`distanceKm`, `startingPrice`, `rating`, `amenities: {label,Icon}[]`, etc.) — no renaming drift. `useHostels()`'s return shape (`{hostels, isLoading, error, refetch}`, Task 4) matches every consumer's destructuring in Tasks 8-11.
- **Review Focus:** all five items have an owning task and an explicit manual-verification step tied to them (see each item's task reference above).
