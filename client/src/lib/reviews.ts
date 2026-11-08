import { apiFetch } from "./apiClient";

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  student_id?: string;
  hostel_id: string;
  created_at: string;
  updated_at: string;
  USERS?: { email: string; name?: string } | null;
}

export const fetchReviews = (hostelId: string) =>
  apiFetch<Review[]>(`/reviews?hostel_id=${encodeURIComponent(hostelId)}`);

/** Files the signed-in student's review. A second one edits their first. */
export const submitReview = (body: { hostel_id: string; rating: number; comment?: string }) =>
  apiFetch<Review>("/reviews", { method: "POST", body: JSON.stringify(body) });
