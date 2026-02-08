import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "@/components/common/command-palette";
import { LiveIndicator } from "@/components/live-indicator";
import { ToastContainer } from "@/components/toast-container";

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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with LiveIndicator */}
        <header className="flex items-center justify-end px-6 py-3 border-b border-border bg-background">
          <div className="hidden sm:flex">
            <LiveIndicator />
          </div>
        </header>
        {/* Main content area */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <ToastContainer />
    </div>
  );
}
