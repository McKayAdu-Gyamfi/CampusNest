import { describe, it, expect } from "vitest";
import { DEFAULT_EXPLORE, parseExploreParams, toExploreParams, type ExploreState } from "./exploreParams";
import { QUICK_CHIPS } from "./hostelFilters";

const parse = (qs: string) => parseExploreParams(new URLSearchParams(qs));

describe("exploreParams", () => {
  it("an empty URL is the default state, and the default state is an empty URL", () => {
    expect(parse("")).toEqual(DEFAULT_EXPLORE);
    expect(toExploreParams(DEFAULT_EXPLORE).toString()).toBe("");
  });

  it("round-trips every field", () => {
    const state: ExploreState = {
      q: "dufie",
      chip: "WiFi",
      filters: { distance: 3, amenities: ["WiFi", "Gym"], priceRange: [2000, 7000] },
    };
    expect(parseExploreParams(toExploreParams(state))).toEqual(state);
  });

  it("round-trips every quick chip, including ones with spaces and commas in the label", () => {
    for (const { label } of QUICK_CHIPS) {
      const s: ExploreState = { ...DEFAULT_EXPLORE, chip: label };
      expect(parseExploreParams(toExploreParams(s)).chip).toBe(label);
    }
  });

  it("only writes what differs from the defaults", () => {
    const p = toExploreParams({ ...DEFAULT_EXPLORE, filters: { ...DEFAULT_EXPLORE.filters, priceRange: [0, 6500] } });
    expect(p.toString()).toBe("maxPrice=6500");
  });

  it("ignores junk instead of breaking the page", () => {
    const s = parse("maxDistance=banana&minPrice=-5&maxPrice=1e99&chip=nope&amenities=WiFi,Hacking,&q=" + "x".repeat(500));
    expect(s.filters.distance).toBe(DEFAULT_EXPLORE.filters.distance);
    expect(s.filters.priceRange).toEqual([0, 10000]);
    expect(s.chip).toBe("All");
    expect(s.filters.amenities).toEqual(["WiFi"]);
    expect(s.q.length).toBe(100);
  });

  it("clamps the distance and fixes a reversed price range", () => {
    expect(parse("maxDistance=0").filters.distance).toBe(0.5);
    expect(parse("maxDistance=99").filters.distance).toBe(10);
    expect(parse("minPrice=9000&maxPrice=3000").filters.priceRange).toEqual([3000, 9000]);
  });
});
