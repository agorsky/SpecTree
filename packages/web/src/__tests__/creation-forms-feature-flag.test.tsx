import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Polyfill localStorage for happy-dom
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  },
  writable: true,
  configurable: true,
});

// Mock hooks used by EpicsPage
vi.mock("@/hooks/queries/use-epics", () => ({
  useEpics: () => ({
    data: { pages: [{ data: [] }] },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  }),
  useEpic: () => ({
    data: {
      id: "epic-1",
      name: "Test Epic",
      description: "desc",
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    isLoading: false,
  }),
  useCreateEpic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateEpic: () => ({ mutateAsync: vi.fn() }),
  useDeleteEpic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveEpic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnarchiveEpic: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/queries/use-current-user", () => ({
  useCurrentUser: () => ({
    data: { data: { id: "user-1", name: "Test User" } },
  }),
}));

vi.mock("@/hooks/queries/use-features", () => ({
  useFeature: () => ({
    data: {
      id: "feat-1",
      title: "Test Feature",
      description: "desc",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      epic: { name: "Test Epic", teamId: "team-1" },
    },
    isLoading: false,
  }),
  useUpdateFeature: () => ({ mutateAsync: vi.fn() }),
  useDeleteFeature: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/queries/use-tasks", () => ({
  useTasks: () => ({
    data: { pages: [{ data: [] }] },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  }),
  useCreateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/queries/use-statuses", () => ({
  useStatuses: () => ({ data: [] }),
}));

vi.mock("@/hooks/queries/use-users", () => ({
  useUsers: () => ({ data: [] }),
}));

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

// Mock react-router-dom params for detail pages
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ epicId: "epic-1", featureId: "feat-1" }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

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

describe("VITE_SHOW_CREATION_FORMS feature flag", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("EpicsPage", () => {
    it("hides 'New Epic' button when flag is not set", async () => {
      const { EpicsPage } = await import("@/pages/epics/index");
      renderWithProviders(<EpicsPage />);
      expect(screen.queryByText("New Epic")).toBeNull();
    });

    it("shows 'New Epic' button when flag is 'true'", async () => {
      vi.stubEnv("VITE_SHOW_CREATION_FORMS", "true");
      vi.resetModules();
      const { EpicsPage } = await import("@/pages/epics/index");
      renderWithProviders(<EpicsPage />);
      expect(screen.getByText("New Epic")).toBeDefined();
    });
  });

  describe("TaskList", () => {
    it("hides 'Add task' button when flag is not set", async () => {
      vi.resetModules();
      const { TaskList } = await import("@/components/tasks/task-list");
      renderWithProviders(<TaskList featureId="feat-1" teamId="team-1" />);
      expect(screen.queryByText("Add task")).toBeNull();
    });

    it("shows 'Add task' button when flag is 'true'", async () => {
      vi.stubEnv("VITE_SHOW_CREATION_FORMS", "true");
      vi.resetModules();
      const { TaskList } = await import("@/components/tasks/task-list");
      renderWithProviders(<TaskList featureId="feat-1" teamId="team-1" />);
      expect(screen.getByText("Add task")).toBeDefined();
    });
  });
});
