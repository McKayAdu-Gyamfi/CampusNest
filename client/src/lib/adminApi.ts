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

export const getManagerStats = () => apiFetch<ManagerStats>("/stats/manager");
export const getAdminStats = () => apiFetch<AdminStats>("/stats/admin");

export const formatGHS = (n: number) => {
  if (n >= 1_000_000) return `GHS ${(n / 1_000_000).toFixed(1)}M`;
  return `GHS ${Math.round(n).toLocaleString("en-GH")}`;
};

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
