import { Navigate } from "react-router-dom";
import { useAuth, type FrontendRole } from "@/contexts/AuthContext";

export type UserRole = FrontendRole;

const ROLE_HOME: Record<FrontendRole, string> = {
  student: "/",
  manager: "/manager",
  admin: "/admin",
};

export default function RoleProtectedRoute({ allow, children }: { allow: FrontendRole[]; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <>{children}</>;
}
