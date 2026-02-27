import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "../components/layout/sidebar";

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    user: { name: "Test", isGlobalAdmin: true },
    logout: vi.fn(),
  }),
}));

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
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );

      expect(screen.queryByText("Admin")).toBeNull();
      expect(screen.queryByText("User Management")).toBeNull();
    });

    it("renders standard nav items", () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );

      expect(screen.getByText("Requests")).toBeDefined();
      expect(screen.getByText("Dashboard")).toBeDefined();
      expect(screen.getByText("Epics")).toBeDefined();
      expect(screen.getByText("Teams")).toBeDefined();
    });
  });
});
