import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { ActivatePage } from "@/pages/activate";
import { InboxPage } from "@/pages/inbox";
import { EpicsPage } from "@/pages/epics/index";
import { EpicDetailPage } from "@/pages/epics/epic-detail";
import { FeatureDetail } from "@/components/features/feature-detail";
import { TeamsPage } from "@/pages/teams/index";
import { TeamDetailPage } from "@/pages/teams/team-detail";
import { SettingsPage } from "@/pages/settings";
import { AdminGuard } from "@/components/guards/AdminGuard";
import { AdminUsersPage } from "@/pages/admin/UsersPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/activate",
    element: <ActivatePage />,
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: "inbox", element: <InboxPage /> },
      { path: "epics", element: <EpicsPage /> },
      {
        path: "epics/:epicId",
        element: <EpicDetailPage />,
      },
      {
        path: "features/:featureId",
        element: <FeatureDetail />,
      },
      { path: "teams", element: <TeamsPage /> },
      { path: "teams/:teamId", element: <TeamDetailPage /> },
      { path: "settings", element: <SettingsPage /> },
      {
        path: "admin",
        element: <AdminGuard />,
        children: [
          { index: true, element: <Navigate to="/admin/users" replace /> },
          { path: "users", element: <AdminUsersPage /> },
        ],
      },
    ],
  },
]);
