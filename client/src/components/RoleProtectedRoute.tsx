import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type FrontendRole } from "@/contexts/AuthContext";
import { ROLE_HOME, ROLE_LOGIN } from "@/lib/routes";

export type UserRole = FrontendRole;

export default function RoleProtectedRoute({ allow, children }: { allow: FrontendRole[]; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    // Send them to the sign-in page for this area, and remember where they were headed.
    return <Navigate to={ROLE_LOGIN[allow[0]]} replace state={{ from: location.pathname + location.search }} />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <>{children}</>;
}
