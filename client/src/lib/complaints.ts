import { apiFetch } from "./apiClient";

export type ComplaintKind = "COMPLAINT" | "ENQUIRY";
export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface Complaint {
  id: string;
  kind?: ComplaintKind;
  subject?: string;
  content: string;
  status: ComplaintStatus;
  reply?: string;
  replied_at?: string;
  hostel_id: string;
  booking_id?: string;
  student_id: string;
  created_at: string;
  updated_at: string;
  USERS?: { email: string; name?: string } | null;
  HOSTEL?: { hostel_name: string } | null;
}

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved",
};

/** The signed-in student's own messages, or (for a manager) the ones about their hostels. */
export const fetchComplaints = (hostelId?: string) =>
  apiFetch<Complaint[]>(`/complaints${hostelId ? `?hostel_id=${encodeURIComponent(hostelId)}` : ""}`);

export const createComplaint = (body: {
  hostel_id: string; booking_id?: string; kind: ComplaintKind; subject?: string; content: string;
}) => apiFetch<Complaint>("/complaints", { method: "POST", body: JSON.stringify(body) });

export const answerComplaint = (id: string, patch: { reply?: string; status?: ComplaintStatus }) =>
  apiFetch<Complaint>(`/complaints/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
