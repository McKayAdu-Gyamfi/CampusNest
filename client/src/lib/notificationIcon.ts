import { Bell, Building2, CalendarPlus, CheckCircle2, MessageSquare, Star, XCircle, type LucideIcon } from "lucide-react";

export function notificationIcon(type: string): { Icon: LucideIcon } {
  switch (type) {
    case "booking_request": return { Icon: CalendarPlus };
    case "booking_submitted":
    case "booking_approved": return { Icon: CheckCircle2 };
    case "booking_declined":
    case "booking_cancelled":
    case "hostel_rejected": return { Icon: XCircle };
    case "hostel_approved": return { Icon: Building2 };
    case "new_review": return { Icon: Star };
    case "enquiry_new":
    case "complaint_new":
    case "complaint_reply": return { Icon: MessageSquare };
    default: return { Icon: Bell };
  }
}

/** Good news is green, bad news is red, everything else keeps the brand orange. */
export function notificationTone(type: string): { border: string; icon: string } {
  switch (type) {
    case "booking_approved":
    case "hostel_approved":
      return { border: "border-[#137333]/40", icon: "bg-[#E6F4EA] text-[#137333]" };
    case "booking_declined":
    case "booking_cancelled":
    case "hostel_rejected":
      return { border: "border-[#C5221F]/40", icon: "bg-[#FCE8E6] text-[#C5221F]" };
    default:
      return { border: "border-[#C56A30]/30", icon: "bg-[#C56A30]/15 text-[#C56A30]" };
  }
}

export function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "Just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
