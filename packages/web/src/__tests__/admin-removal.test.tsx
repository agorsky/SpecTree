import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "../components/layout/sidebar";

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn((selector) => {
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
    data: { data: { name: "Test", isGlobalAdmin: true } },
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

describe("Admin removal", () => {
  describe("router module", () => {
    it("does not contain an admin route", async () => {
      const source = await import("../router?raw");
      const code = (source as { default: string }).default;
      expect(code).not.toContain("AdminGuard");
      expect(code).not.toContain("AdminUsersPage");
      expect(code).not.toMatch(/path:\s*["']admin["']/);
    });
  });

  describe("sidebar", () => {
    it("does not render admin navigation even for global admins", () => {
      renderWithProviders(<Sidebar />);

      expect(screen.queryByText("Admin")).toBeNull();
      expect(screen.queryByText("User Management")).toBeNull();
    });

    it("renders standard nav items", () => {
      renderWithProviders(<Sidebar />);

      expect(screen.getByText("Requests")).toBeDefined();
      expect(screen.getByText("Dashboard")).toBeDefined();
      expect(screen.getByText("Epics")).toBeDefined();
      expect(screen.getByText("Teams")).toBeDefined();
    });
  });
});
