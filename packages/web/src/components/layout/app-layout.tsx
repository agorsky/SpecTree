import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "@/components/common/command-palette";

export function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  );
}
