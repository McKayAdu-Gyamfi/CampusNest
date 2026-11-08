import { useCallback, useEffect, useState } from "react";
import { Star, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBookings } from "@/contexts/BookingContext";
import { useToast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/adminApi";
import { fetchReviews, submitReview, type Review } from "@/lib/reviews";
import { timeAgo } from "@/lib/notificationIcon";
import { getInitials } from "@/lib/utils";

const MAX = 1000;
const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

function Stars({ value, size = "w-4 h-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(value) ? "fill-[#E8A33D] text-[#E8A33D]" : "text-border"}`} />
      ))}
    </span>
  );
}

/** Reviews for a hostel, plus a form for students who have a confirmed stay there. */
export default function HostelReviews({ hostelId, hostelName }: { hostelId: string; hostelName: string }) {
  const { user } = useAuth();
  const { bookings } = useBookings();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    fetchReviews(hostelId)
      .then((rows) => setReviews(rows.sort((a, b) => b.created_at.localeCompare(a.created_at))))
      .catch(() => setReviews([]));
  }, [hostelId]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const isStudent = user?.role === "student";
  const atHostel = bookings.filter((b) => b.hostelId === hostelId);
  const canReview = isStudent && atHostel.some((b) => b.status === "CONFIRMED" || b.status === "CHECKED_OUT");
  const waiting = isStudent && !canReview && atHostel.some((b) => b.status === "PENDING");
  const mine = reviews?.find((r) => r.student_id === user?.id);
  const average = reviews && reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const startEdit = () => { setRating(mine?.rating ?? 0); setComment(mine?.comment ?? ""); setEditing(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) { toast("Choose a star rating first.", "error"); return; }
    setSending(true);
    try {
      await submitReview({ hostel_id: hostelId, rating, comment: comment.trim() || undefined });
      toast(mine ? "Your review was updated." : "Thanks! Your review was posted.");
      setEditing(false); setRating(0); setComment("");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  const showForm = canReview && (!mine || editing);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-bold text-foreground">Reviews</h3>
        {reviews && reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={average} />
            <span className="text-sm font-extrabold text-foreground">{average.toFixed(1)}</span>
            <span className="text-xs font-medium text-muted-foreground">({reviews.length})</span>
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="rounded-2xl border border-[#137333]/25 bg-[#E6F4EA]/40 p-4 mb-5 space-y-3">
          <p className="text-[14px] font-extrabold text-foreground">{mine ? "Edit your review" : `How was your stay at ${hostelName}?`}</p>
          <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={rating === n}
                onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}
                className="p-1 rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Star className={`w-8 h-8 transition-colors ${n <= (hover || rating) ? "fill-[#E8A33D] text-[#E8A33D]" : "text-border"}`} />
              </button>
            ))}
            <span className="ml-2 text-[13px] font-bold text-muted-foreground">{LABELS[hover || rating]}</span>
          </div>
          <div>
            <label htmlFor="review-comment" className="sr-only">Your review</label>
            <textarea
              id="review-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value.slice(0, MAX))}
              placeholder="Share what it was like: the room, the facilities, the manager… (optional)"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-[14px] font-medium resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[11px] text-muted-foreground font-medium text-right mt-1">{comment.length}/{MAX}</p>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={sending} className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 disabled:opacity-60 cursor-pointer">
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}{sending ? "Posting…" : mine ? "Update review" : "Post review"}
            </button>
            {editing && <button type="button" onClick={() => setEditing(false)} className="h-11 px-6 rounded-full border border-border font-bold text-sm cursor-pointer">Cancel</button>}
          </div>
        </form>
      )}

      {waiting && (
        <p className="rounded-xl bg-muted/60 border border-border/60 px-4 py-3 mb-5 text-[13px] font-medium text-muted-foreground flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />You can review {hostelName} once the manager approves your booking.
        </p>
      )}

      {reviews === null ? (
        <p className="text-sm font-medium text-muted-foreground">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm font-medium text-muted-foreground">No reviews yet.{canReview ? " Be the first to share your experience." : ""}</p>
      ) : (
        <ul className="space-y-4">
          {reviews.slice(0, 6).map((r) => {
            const name = r.USERS?.name || r.USERS?.email?.split("@")[0] || "Student";
            const isMine = r.id === mine?.id;
            return (
              <li key={r.id} className="flex gap-3">
                <span className="w-10 h-10 rounded-full bg-[#E5D0BA] text-[#6c5e57] font-extrabold text-sm flex items-center justify-center shrink-0">{getInitials(name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-extrabold text-foreground truncate">{name}{isMine && <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wider bg-[#E6F4EA] dark:bg-emerald-500/15 text-[#137333] dark:text-emerald-400 px-2 py-0.5 rounded-full">You</span>}</p>
                    <span className="text-[11px] font-medium text-muted-foreground shrink-0">{timeAgo(r.created_at)}</span>
                  </div>
                  <Stars value={r.rating} size="w-3.5 h-3.5" />
                  {r.comment && <p className="text-[13px] font-medium text-foreground/80 mt-1 whitespace-pre-wrap break-words">{r.comment}</p>}
                  {isMine && !editing && canReview && (
                    <button onClick={startEdit} className="mt-1.5 text-[12px] font-bold text-primary hover:underline cursor-pointer">Edit your review</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
