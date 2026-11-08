import { apiFetch } from "./apiClient";

// A hostel as the manager edits it. Shapes mirror server/convex/hostels.ts.
export interface ManagerHostelImage { id: string; url: string }

export interface ManagerRoom {
  id: string;
  number: string;
  type: string;
  price: number;
  capacity: number;
  occupancy: number;
  /** Metres; set by the manager. */
  length: number | null;
  width: number | null;
  height: number | null;
}

export const ROOM_TYPES = [
  { value: "SINGLE", label: "Single (1 bed)", capacity: 1 },
  { value: "DOUBLE", label: "Standard / double (2 beds)", capacity: 2 },
  { value: "TRIPLE", label: "Triple (3 beds)", capacity: 3 },
  { value: "QUAD", label: "Shared / quad (4 beds)", capacity: 4 },
] as const;

export interface ManagerHostel {
  id: string;
  name: string;
  location: string;
  desc: string;
  distance: number;
  availableRooms: number;
  images: ManagerHostelImage[];
  /** Keys from AMENITY_OPTIONS */
  amenities: string[];
  /** Price per bed for standard (DOUBLE) and shared (QUAD) rooms. */
  standardPrice: number;
  sharedPrice: number;
  rooms: ManagerRoom[];
  rating: number;
}

export const AMENITY_OPTIONS = [
  { key: "WiFi", label: "Wi-Fi", enum: "WIFI" },
  { key: "AC", label: "Air-con", enum: "AIR_CONDITIONING" },
  { key: "Laundry", label: "Laundry", enum: "LAUNDRY" },
  { key: "Kitchen", label: "Kitchen", enum: "KITCHEN_ACCESS" },
  { key: "StudyDesk", label: "Study desk", enum: "STUDY_ROOM" },
] as const;

interface ApiHostel {
  id: string;
  hostel_name: string;
  location: string;
  description?: string;
  distance_from_campus?: number;
  available_rooms: number;
  manager?: { id: string } | null;
}
interface ApiDetail extends ApiHostel {
  ROOM: { id: string; room_number: string; room_type: string; price_per_bed: number; capacity: number; current_occupancy: number; length?: number | null; width?: number | null; height?: number | null }[];
  HOSTEL_IMAGE_URLS: { id: string; image_url: string }[];
  HOSTEL_AMENITY: { name: string }[];
}

function toManagerHostel(d: ApiDetail, ratings: { rating: number }[]): ManagerHostel {
  const priceOf = (type: string, pick: (...n: number[]) => number) => {
    const p = d.ROOM.filter((r) => r.room_type === type).map((r) => r.price_per_bed);
    return p.length ? pick(...p) : 0;
  };
  const allPrices = d.ROOM.map((r) => r.price_per_bed);
  return {
    id: d.id,
    name: d.hostel_name,
    location: d.location,
    desc: d.description ?? "",
    distance: d.distance_from_campus ?? 0,
    availableRooms: d.available_rooms,
    images: d.HOSTEL_IMAGE_URLS.map((i) => ({ id: i.id, url: i.image_url })),
    amenities: AMENITY_OPTIONS.filter((o) => d.HOSTEL_AMENITY.some((a) => a.name === o.enum)).map((o) => o.key),
    standardPrice: priceOf("DOUBLE", Math.max) || (allPrices.length ? Math.max(...allPrices) : 0),
    sharedPrice: priceOf("QUAD", Math.min) || (allPrices.length ? Math.min(...allPrices) : 0),
    rooms: d.ROOM.map((r) => ({
      id: r.id, number: r.room_number, type: r.room_type, price: r.price_per_bed,
      capacity: r.capacity, occupancy: r.current_occupancy,
      length: r.length ?? null, width: r.width ?? null, height: r.height ?? null,
    })),
    rating: ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0,
  };
}

export async function getManagerHostel(id: string): Promise<ManagerHostel> {
  const [detail, ratings] = await Promise.all([
    apiFetch<ApiDetail>(`/hostels/${id}`),
    apiFetch<{ rating: number }[]>(`/reviews?hostel_id=${id}`),
  ]);
  return toManagerHostel(detail, ratings);
}

/** Every approved hostel this manager owns. */
export async function listManagerHostels(managerId: string): Promise<ManagerHostel[]> {
  const list = await apiFetch<ApiHostel[]>("/hostels");
  const mine = list.filter((h) => h.manager?.id === managerId);
  return Promise.all(mine.map((h) => getManagerHostel(h.id)));
}

export interface HostelEdit {
  name: string;
  location: string;
  desc: string;
  standardPrice: number;
  sharedPrice: number;
  amenities: string[];
}

/** Persists an edit to the backend, so the student side sees it too. */
export async function saveManagerHostel(current: ManagerHostel, edit: HostelEdit): Promise<ManagerHostel> {
  await apiFetch(`/hostels/${current.id}`, {
    method: "PATCH",
    body: JSON.stringify({ hostel_name: edit.name, location: edit.location, description: edit.desc }),
  });

  await apiFetch(`/hostels/${current.id}/amenities`, {
    method: "PUT",
    body: JSON.stringify({
      amenities: AMENITY_OPTIONS.filter((o) => edit.amenities.includes(o.key)).map((o) => o.enum),
    }),
  });

  const priceFor = { DOUBLE: edit.standardPrice, QUAD: edit.sharedPrice } as Record<string, number>;
  const changed = current.rooms.filter((r) => r.type in priceFor);
  await Promise.all(
    changed.map((r) =>
      apiFetch(`/rooms/${r.id}`, { method: "PATCH", body: JSON.stringify({ price_per_bed: priceFor[r.type] }) }),
    ),
  );

  return getManagerHostel(current.id);
}

export interface RoomSize { length?: number; width?: number; height?: number }
export interface NewRoom extends RoomSize { number: string; type: string; price: number; capacity: number }

export async function addManagerRoom(hostelId: string, room: NewRoom): Promise<ManagerHostel> {
  await apiFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({
      hostel_id: hostelId, room_number: room.number, room_type: room.type,
      price_per_bed: room.price, capacity: room.capacity,
      ...(room.length ? { length: room.length } : {}),
      ...(room.width ? { width: room.width } : {}),
      ...(room.height ? { height: room.height } : {}),
    }),
  });
  return getManagerHostel(hostelId);
}

/** Sets a room's size (metres). The student's booking page draws its floor plan from this. */
export async function updateRoomSize(hostelId: string, roomId: string, size: Required<RoomSize>): Promise<ManagerHostel> {
  await apiFetch(`/rooms/${roomId}`, { method: "PATCH", body: JSON.stringify(size) });
  return getManagerHostel(hostelId);
}
