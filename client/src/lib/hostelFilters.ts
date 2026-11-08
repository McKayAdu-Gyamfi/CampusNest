import type { Hostel } from "./hostels";

export interface HostelFilters {
  /** km; the slider's top value (10) means "10+ km", i.e. no limit. */
  distance: number;
  amenities: string[];
  priceRange: [number, number];
}

export const DEFAULT_FILTERS: HostelFilters = { distance: 10, amenities: [], priceRange: [0, 10000] };
export const MAX_DISTANCE = 10;

export function matchesHostelFilters(h: Hostel, f: HostelFilters, search = ""): boolean {
  const q = search.trim().toLowerCase();
  if (q && !h.name.toLowerCase().includes(q) && !h.location.toLowerCase().includes(q)) return false;
  if (f.distance < MAX_DISTANCE && parseFloat(h.distance) > f.distance) return false;
  if (h.startingPrice < f.priceRange[0] || h.startingPrice > f.priceRange[1]) return false;
  if (f.amenities.length > 0 && !f.amenities.every((a) => h.amenities.includes(a))) return false;
  return true;
}

/** Quick-filter chips shown under the search bar on Explore. */
export const QUICK_CHIPS: { label: string; test: (h: Hostel) => boolean }[] = [
  { label: "All", test: () => true },
  { label: "Available", test: (h) => h.availability !== "FULL" },
  { label: "Under GHS 6,500", test: (h) => h.startingPrice > 0 && h.startingPrice <= 6500 },
  { label: "Air-conditioned", test: (h) => h.amenities.includes("AC") },
  { label: "WiFi", test: (h) => h.amenities.includes("WiFi") },
];
