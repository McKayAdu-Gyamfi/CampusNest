import { apiFetch } from "./apiClient";

// Response shapes mirror server/convex/{settings,schools,stats}.ts exactly.

export interface PlatformSettings {
  platform_name: string;
  support_email: string;
  maintenance_mode: boolean;
  updated_at: string | null;
}

export interface School {
  id: string;
  name: string;
  location: string;
  email_domain: string;
  hostel_count: number;
  student_count: number;
}

export type HostelStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface SchoolHostel {
  id: string;
  hostel_name: string;
  location: string;
  distance_from_campus: number | null;
  status: HostelStatus;
  beds: number;
}

export interface HostelOccupancy {
  hostel_id: string;
  hostel_name: string;
  status: HostelStatus;
  beds_total: number;
  beds_filled: number;
  occupancy_rate: number;
  rooms_total?: number;
  rooms_full?: number;
}

export interface RecentBooking {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "CHECKED_OUT";
  student_name: string | null;
  student_email: string | null;
  room_number: string | null;
  hostel_name: string | null;
  amount: number;
  created_at: string;
}

export interface ManagerStats {
  month: string;
  beds_total: number;
  beds_filled: number;
  occupancy_rate: number;
  rooms_total?: number;
  rooms_full?: number;
  revenue_this_month: number;
  pending_bookings: number;
  recent_bookings: RecentBooking[];
  hostels: HostelOccupancy[];
}

export interface AdminStats {
  revenue_total: number;
  revenue_this_month: number;
  revenue_by_month: { month: string; key: string; revenue: number }[];
  pending_approvals: {
    id: string;
    hostel_name: string;
    location: string;
    manager_name: string | null;
    manager_email: string | null;
    created_at: string;
  }[];
  top_hostels: (HostelOccupancy & { bookings: number })[];
  counts: {
    students: number;
    managers: number;
    admins: number;
    hostels: number;
    approved_hostels: number;
    bookings: number;
  };
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const getSettings = () => apiFetch<PlatformSettings>("/settings");
export const updateSettings = (patch: Partial<Omit<PlatformSettings, "updated_at">>) =>
  apiFetch<PlatformSettings>("/settings", json("PATCH", patch));

export const getSchools = () => apiFetch<School[]>("/schools");
export const createSchool = (s: { name: string; location: string; email_domain: string }) =>
  apiFetch<School>("/schools", json("POST", s));
export const getSchoolHostels = (schoolId: string) => apiFetch<SchoolHostel[]>(`/schools/${schoolId}/hostels`);
export const getUnassignedHostels = () => apiFetch<SchoolHostel[]>("/schools/unassigned-hostels");
export const assignHostel = (schoolId: string, hostelId: string) =>
  apiFetch(`/schools/${schoolId}/hostels`, json("POST", { hostel_id: hostelId }));
export const unassignHostel = (schoolId: string, hostelId: string) =>
  apiFetch(`/schools/${schoolId}/hostels/${hostelId}`, { method: "DELETE" });

export const updateSchool = (id: string, patch: { name?: string; location?: string; email_domain?: string }) =>
  apiFetch<School>(`/schools/${id}`, json("PATCH", patch));
export const deleteSchool = (id: string) => apiFetch<{ detached: number }>(`/schools/${id}`, { method: "DELETE" });

// ── Hostels ──
export interface AdminHostel {
  id: string;
  hostel_name: string;
  location: string;
  description?: string;
  distance_from_campus?: number;
  status: HostelStatus;
  status_reason?: string;
  reviewed_at?: string;
  reviewed_by_name: string | null;
  created_at: string;
  rooms_total: number;
  beds_total: number;
  beds_filled: number;
  images: { id: string; url: string }[];
  manager: { id: string; name: string; email: string; phone: string | null; business_name: string | null } | null;
  school: { id: string; name: string } | null;
}
export const listAdminHostels = (status?: HostelStatus) =>
  apiFetch<AdminHostel[]>(`/hostels/admin/all${status ? `?status=${status}` : ""}`);
export const setHostelStatus = (id: string, status: HostelStatus, reason?: string) =>
  apiFetch(`/hostels/${id}/status`, json("PATCH", { status, ...(reason ? { reason } : {}) }));
export const uploadHostelPhotos = (id: string, files: File[]) => {
  const form = new FormData();
  files.forEach((f) => form.append("images", f));
  return apiFetch(`/hostels/${id}/images`, { method: "POST", body: form });
};
export const removeHostelPhoto = (id: string, imageId: string) =>
  apiFetch(`/hostels/${id}/images/${imageId}`, { method: "DELETE" });

// ── Users ──
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  user_type: "STUDENT" | "HOSTEL_MANAGER" | "ADMIN";
  profile_complete: boolean;
  emailVerified: boolean;
  createdAt?: string;
  suspended_at?: string;
  suspended_reason?: string;
  phone?: string;
  institution?: string;
  course?: string;
  level?: string;
  student_id?: string;
  business_name?: string;
}
export interface AdminUserDetail extends AdminUser {
  gender?: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  ghana_card_number?: string;
  payout_method?: "momo" | "bank";
  momo_network?: string;
  momo_number?: string;
  bank_name?: string;
  booking_counts: { total: number; confirmed: number; pending: number; spent: number };
  hostels: { id: string; hostel_name: string; status: HostelStatus }[];
}
export const listAdminUsers = () => apiFetch<AdminUser[]>("/users");
export const getAdminUserDetail = (id: string) => apiFetch<AdminUserDetail>(`/users/${id}/detail`);
export const setUserSuspension = (id: string, suspended: boolean, reason?: string) =>
  apiFetch(`/users/${id}/suspension`, json("PATCH", { suspended, ...(reason ? { reason } : {}) }));
export const createAdminUser = (u: { name: string; email: string; password: string }) =>
  apiFetch<AdminUser>("/users", json("POST", u));

// ── Moderation, money and the audit trail ──
export interface AdminReview {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  USERS: { email: string; name?: string } | null;
  HOSTEL: { hostel_name: string } | null;
}
export const listAdminReviews = () => apiFetch<AdminReview[]>("/reviews");
export const deleteReview = (id: string, reason?: string) =>
  apiFetch(`/reviews/${id}`, json("DELETE", { reason }));

export interface AdminBooking {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "CHECKED_OUT";
  created_at: string;
  check_in_date: string;
  payment_reference?: string;
  amount_paid?: number;
  USERS: { email: string; name?: string } | null;
  ROOM: { room_number: string; price_per_bed?: number; HOSTEL: { hostel_name: string } | null } | null;
}
export const listAdminBookings = () => apiFetch<AdminBooking[]>("/bookings");

export interface AuditEntry {
  id: string;
  action: string;
  target_type: string;
  summary: string;
  created_at: string;
  actor: { id: string; name: string; email: string } | null;
}
export const listAuditLog = (limit = 100) => apiFetch<AuditEntry[]>(`/audit?limit=${limit}`);

export const changePassword = (currentPassword: string, newPassword: string) =>
  apiFetch("/auth/change-password", json("POST", { currentPassword, newPassword, revokeOtherSessions: true }));

// ── Room tours ──
export interface AdminRoom { id: string; room_number: string; room_type: string; capacity: number; tour_scene_count: number }
export interface TourScene { id: string; scene_name: string; scene_config_url: string; created_at: string }
export const listRooms = (hostelId: string) => apiFetch<AdminRoom[]>(`/rooms?hostel_id=${encodeURIComponent(hostelId)}`);
export const getRoomScenes = (roomId: string) =>
  apiFetch<{ ROOM_TOUR_SCENES: TourScene[] }>(`/rooms/${roomId}`).then((r) => r.ROOM_TOUR_SCENES);
export const addTourScene = (roomId: string, sceneName: string, image: File) => {
  const form = new FormData();
  form.append("scene_name", sceneName);
  form.append("image", image);
  return apiFetch<{ id: string }>(`/rooms/${roomId}/tours/generate`, { method: "POST", body: form });
};
export const deleteTourScene = (roomId: string, sceneId: string) =>
  apiFetch(`/rooms/${roomId}/tours/${sceneId}`, { method: "DELETE" });

export const getManagerStats = () => apiFetch<ManagerStats>("/stats/manager");
export const getAdminStats = () => apiFetch<AdminStats>("/stats/admin");

export const formatGHS = (n: number) => {
  if (n >= 1_000_000) return `GHS ${(n / 1_000_000).toFixed(1)}M`;
  return `GHS ${Math.round(n).toLocaleString("en-GH")}`;
};

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
