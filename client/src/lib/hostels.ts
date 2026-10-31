import { apiFetch } from "./apiClient";

// Shape the hostel pages/cards/overlay render. Kept identical to the old
// static data/hostels.ts objects so none of those components had to change.
export interface Hostel {
  id: string;
  name: string;
  location: string;
  distance: string;
  price: number;
  startingPrice: number;
  priceFreq: string;
  rating: number;
  availability: "AVAILABLE" | "FEW ROOMS LEFT" | "FULL";
  amenities: string[];
  image: string;
  gallery: string[];
  desc: string;
}

interface ApiHostel {
  id: string;
  hostel_name: string;
  location: string;
  description?: string;
  available_rooms: number;
  distance_from_campus?: number;
}

interface ApiHostelDetail extends ApiHostel {
  ROOM: { price_per_bed: number }[];
  HOSTEL_IMAGE_URLS: { image_url: string }[];
  HOSTEL_AMENITY: { name: string }[];
}

// Backend amenity enum -> the labels the filter modal and overlay icons use.
// RESERVED_1 is the schema's spare slot, used here for "Kitchen Personal"
// since the enum has no dedicated value for it. RUNNING_WATER is omitted
// because the overlay already always shows a "Water Supply" entry.
const AMENITY_LABELS: Record<string, string> = {
  WIFI: "WiFi",
  AIR_CONDITIONING: "AC",
  GYM: "Gym",
  LAUNDRY: "Laundry",
  KITCHEN_ACCESS: "Kitchen Shared",
  RESERVED_1: "Kitchen Personal",
  PARKING: "Parking",
  STUDY_ROOM: "Study Room",
};

const FEW_ROOMS_THRESHOLD = 2;

function toAvailability(availableRooms: number): Hostel["availability"] {
  if (availableRooms <= 0) return "FULL";
  if (availableRooms <= FEW_ROOMS_THRESHOLD) return "FEW ROOMS LEFT";
  return "AVAILABLE";
}

function toHostel(detail: ApiHostelDetail, reviews: { rating: number }[]): Hostel {
  const prices = detail.ROOM.map((r) => r.price_per_bed);
  const images = detail.HOSTEL_IMAGE_URLS.map((i) => i.image_url);
  const rating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return {
    id: detail.id,
    name: detail.hostel_name,
    location: detail.location,
    distance: `${detail.distance_from_campus ?? 0} km`,
    price: prices.length ? Math.max(...prices) : 0,
    startingPrice: prices.length ? Math.min(...prices) : 0,
    priceFreq: "per semester",
    rating,
    availability: toAvailability(detail.available_rooms),
    amenities: detail.HOSTEL_AMENITY.map((a) => AMENITY_LABELS[a.name]).filter(Boolean),
    image: images[0] ?? "",
    gallery: images,
    desc: detail.description ?? "",
  };
}

// The list endpoint returns bare hostel rows, so each one is expanded with
// its rooms/images/amenities (and reviews, for the rating) via the detail
// endpoints. Fine for a campus-sized catalogue; if it grows, fold these into
// a single backend list query instead.
export async function fetchHostels(): Promise<Hostel[]> {
  const list = await apiFetch<ApiHostel[]>("/hostels");
  return Promise.all(
    list.map(async (h) => {
      const [detail, reviews] = await Promise.all([
        apiFetch<ApiHostelDetail>(`/hostels/${h.id}`),
        apiFetch<{ rating: number }[]>(`/reviews?hostel_id=${h.id}`),
      ]);
      return toHostel(detail, reviews);
    })
  );
}
