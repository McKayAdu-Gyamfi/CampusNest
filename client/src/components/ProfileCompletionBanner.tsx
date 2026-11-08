import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { AlertCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { missingProfileFields } from "@/lib/profile";

/** Prompts students and managers to finish the details we need. Renders nothing once complete. */
export default function ProfileCompletionBanner({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  if (!user?.details || (user.role !== "student" && user.role !== "manager")) return null;
  const missing = missingProfileFields(user.details, user.details.user_type);
  if (missing.length === 0) return null;
  const to = user.role === "manager" ? ROUTES.manager.profile : ROUTES.student.settings;
  return (
    <Link
      to={to}
      state={{ editProfile: true }}
      className={`flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 text-amber-900 p-4 shadow-sm hover:bg-amber-100/70 transition-colors ${className}`}
    >
      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-extrabold">Complete your profile</p>
        <p className="text-[12px] font-medium mt-0.5">
          {user.role === "student" ? "You need these before you can book a room: " : "Needed to publish listings and get paid: "}
          {missing.map((m) => m.label).join(", ")}.
        </p>
      </div>
      <ChevronRight className="w-4 h-4 mt-1 shrink-0 text-amber-700" />
    </Link>
  );
}
