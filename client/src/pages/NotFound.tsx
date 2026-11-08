import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_HOME, ROUTES } from "@/lib/routes";

/** A real 404: the URL doesn't exist, so say so instead of silently bouncing to the home page. */
export default function NotFound() {
  const { user } = useAuth();
  const home = user?.id ? ROLE_HOME[user.role] : ROUTES.student.home;
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center">
      <p className="text-[64px] font-extrabold tracking-tight text-primary leading-none">404</p>
      <h1 className="text-2xl font-extrabold text-foreground mt-4">We can't find that page</h1>
      <p className="text-sm font-medium text-muted-foreground mt-2 max-w-sm">
        The link may be old or mistyped. Let's get you back on track.
      </p>
      <Link to={home} className="mt-8 h-12 px-8 rounded-full bg-primary text-primary-foreground font-bold inline-flex items-center hover:bg-[#b05b26] transition-colors">
        {user?.id ? "Go to my dashboard" : "Go to home"}
      </Link>
    </div>
  );
}
