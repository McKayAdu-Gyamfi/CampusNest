import { DEFAULT_FILTERS, MAX_DISTANCE, QUICK_CHIPS, type HostelFilters } from "./hostelFilters";

/** Everything the Explore page can be filtered by, as it appears in the URL. */
export interface ExploreState {
  q: string;
  /** A `QUICK_CHIPS` label; "All" when none is chosen. */
  chip: string;
  filters: HostelFilters;
}

export const DEFAULT_EXPLORE: ExploreState = { q: "", chip: "All", filters: DEFAULT_FILTERS };

const MAX_PRICE = DEFAULT_FILTERS.priceRange[1];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const chipLabelFor = (value: string | null) => QUICK_CHIPS.find((c) => slug(c.label) === value)?.label ?? "All";

/** A finite number within [min, max], else the fallback. */
function num(value: string | null, min: number, max: number, fallback: number) {
  if (value === null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Reads the Explore URL. Anything missing or malformed falls back to its default. */
export function parseExploreParams(params: URLSearchParams): ExploreState {
  const minPrice = num(params.get("minPrice"), 0, MAX_PRICE, 0);
  const maxPrice = num(params.get("maxPrice"), 0, MAX_PRICE, MAX_PRICE);
  const known = new Set(["WiFi", "AC", "Gym", "Laundry", "Kitchen Shared", "Kitchen Personal"]);
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    chip: chipLabelFor(params.get("chip")),
    filters: {
      distance: num(params.get("maxDistance"), 0.5, MAX_DISTANCE, MAX_DISTANCE),
      amenities: (params.get("amenities") ?? "").split(",").map((a) => a.trim()).filter((a) => known.has(a)),
      // A reversed range would match nothing; swap it instead.
      priceRange: minPrice <= maxPrice ? [minPrice, maxPrice] : [maxPrice, minPrice],
    },
  };
}

/** Writes the Explore URL query. Defaults are left out so a clean page has a clean URL. */
export function toExploreParams(state: ExploreState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set("q", state.q);
  if (state.chip !== "All") p.set("chip", slug(state.chip));
  const f = state.filters;
  if (f.distance < MAX_DISTANCE) p.set("maxDistance", String(f.distance));
  if (f.amenities.length) p.set("amenities", f.amenities.join(","));
  if (f.priceRange[0] > 0) p.set("minPrice", String(f.priceRange[0]));
  if (f.priceRange[1] < MAX_PRICE) p.set("maxPrice", String(f.priceRange[1]));
  return p;
}
