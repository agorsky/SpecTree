import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { InboxPage } from "@/pages/inbox";
import { ProjectsPage } from "@/pages/projects/index";
import { ProjectDetailPage } from "@/pages/projects/project-detail";
import { FeatureDetail } from "@/components/features/feature-detail";
import { TeamsPage } from "@/pages/teams/index";
import { TeamDetailPage } from "@/pages/teams/team-detail";
import { SettingsPage } from "@/pages/settings";

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
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: "inbox", element: <InboxPage /> },
      { path: "projects", element: <ProjectsPage /> },
      {
        path: "projects/:projectId",
        element: <ProjectDetailPage />,
      },
      {
        path: "features/:featureId",
        element: <FeatureDetail />,
      },
      { path: "teams", element: <TeamsPage /> },
      { path: "teams/:teamId", element: <TeamDetailPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
