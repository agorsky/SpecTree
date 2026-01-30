import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function AdminGuard() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user?.isGlobalAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
