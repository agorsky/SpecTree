import { createBrowserRouter } from "react-router-dom";
import { RootLayout } from "@/components/layout/root-layout";
import { HomePage } from "@/pages/home";
import { AboutPage } from "@/pages/about";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "about",
        element: <AboutPage />,
      },
    ],
  },
]);
