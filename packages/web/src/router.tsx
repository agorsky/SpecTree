import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { LoginPage } from "@/pages/login";
import { InboxPage } from "@/pages/inbox";
import { EpicsPage } from "@/pages/epics/index";
import { EpicDetailPage } from "@/pages/epics/epic-detail";
import { EpicRequestsPage } from "@/pages/epic-requests/index";
import { EpicRequestDetailPage } from "@/pages/epic-requests/epic-request-detail";
import { FeatureDetail } from "@/components/features/feature-detail";
import { TaskDetail } from "@/components/tasks/task-detail";
import { TeamsPage } from "@/pages/teams/index";
import { TeamDetailPage } from "@/pages/teams/team-detail";
import { SettingsPage } from "@/pages/settings";
import { DashboardPage } from "@/pages/dashboard";
import { WhatsNewPage } from "@/pages/whats-new";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "inbox", element: <InboxPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "whats-new", element: <WhatsNewPage /> },
      { path: "epic-requests", element: <EpicRequestsPage /> },
      { path: "epic-requests/:requestId", element: <EpicRequestDetailPage /> },
      { path: "epics", element: <EpicsPage /> },
      {
        path: "epics/:epicId",
        element: <EpicDetailPage />,
      },
      {
        path: "features/:featureId",
        element: <FeatureDetail />,
      },
      {
        path: "tasks/:taskId",
        element: <TaskDetail />,
      },
      { path: "teams", element: <TeamsPage /> },
      { path: "teams/:teamId", element: <TeamDetailPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
