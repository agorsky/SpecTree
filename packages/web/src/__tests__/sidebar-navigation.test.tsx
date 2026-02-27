import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "../components/layout/sidebar";

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      accessToken: "test-token",
      isAuthenticated: true,
      logout: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/hooks/queries/use-current-user", () => ({
  useCurrentUser: () => ({
    data: { data: { name: "Test", isGlobalAdmin: false } },
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Sidebar navigation", () => {
  it("renders exactly 4 nav items: Dashboard, Epic Requests, Epics, Settings", () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Epic Requests")).toBeDefined();
    expect(screen.getByText("Epics")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("does not render removed nav items", () => {
    renderWithProviders(<Sidebar />);

    expect(screen.queryByText("Teams")).toBeNull();
    expect(screen.queryByText("Inbox")).toBeNull();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByText("User Management")).toBeNull();
  });

  it("links to the correct paths", () => {
    renderWithProviders(<Sidebar />);

    const links = screen.getAllByRole("link");
    const navLinks = links.filter((link) =>
      ["/dashboard", "/epic-requests", "/epics", "/settings"].includes(
        link.getAttribute("href") ?? ""
      )
    );
    expect(navLinks).toHaveLength(4);
  });

  it("highlights the active nav item", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink?.className).toContain("bg-accent");
  });
});
