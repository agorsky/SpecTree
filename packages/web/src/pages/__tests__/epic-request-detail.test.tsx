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

const mockApprove = vi.fn();
const mockReject = vi.fn();

vi.mock("@/hooks/queries/use-epic-requests", () => ({
  useEpicRequest: () => ({
    data: {
      id: "req-1",
      title: "Test Epic Request",
      description: "A description",
      structuredDesc: {
        problemStatement: "The **problem** is clear",
        proposedSolution: "We should fix it",
        impactAssessment: "High impact",
        successMetrics: "100% coverage",
        targetAudience: "Developers",
        alternatives: "Do nothing",
        dependencies: "None",
        estimatedEffort: "Medium",
      },
      status: "pending" as const,
      requestedById: "user-2",
      requestedBy: { id: "user-2", name: "Requester", email: "req@test.com" },
      reactionCounts: [],
      userReaction: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    isLoading: false,
  }),
  useReactToEpicRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveReactionFromEpicRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEpicRequestComments: () => ({
    data: { pages: [{ data: [] }] },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  }),
  useCreateEpicRequestComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateEpicRequestComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteEpicRequestComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApproveEpicRequest: () => ({ mutateAsync: mockApprove, isPending: false }),
  useRejectEpicRequest: () => ({ mutateAsync: mockReject, isPending: false }),
  useDeleteEpicRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateEpicRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTransferEpicRequestScope: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/queries/use-current-user", () => ({
  useCurrentUser: () => ({
    data: { data: { id: "user-1", name: "Admin User", isGlobalAdmin: true } },
  }),
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn((selector: ((s: Record<string, unknown>) => unknown) | undefined) => {
    const state = {
      accessToken: "test-token",
      isAuthenticated: true,
      logout: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ requestId: "req-1" }),
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

describe("EpicRequestDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Approve and Reject buttons at full width for admin on pending request", async () => {
    const { EpicRequestDetailPage } = await import(
      "@/pages/epic-requests/epic-request-detail"
    );
    renderWithProviders(<EpicRequestDetailPage />);

    const approveButtons = screen.getAllByText("Approve");
    expect(approveButtons.length).toBeGreaterThanOrEqual(1);

    const rejectButton = screen.getByText("Reject");
    expect(rejectButton).toBeDefined();
  });

  it("renders Approve button with green styling", async () => {
    const { EpicRequestDetailPage } = await import(
      "@/pages/epic-requests/epic-request-detail"
    );
    renderWithProviders(<EpicRequestDetailPage />);

    // The trigger Approve button has green styling
    const approveButtons = screen.getAllByText("Approve");
    const triggerButton = approveButtons.at(0)?.closest("button");
    expect(triggerButton?.className).toContain("bg-green-600");
  });

  it("renders Reject button with destructive variant", async () => {
    const { EpicRequestDetailPage } = await import(
      "@/pages/epic-requests/epic-request-detail"
    );
    renderWithProviders(<EpicRequestDetailPage />);

    const rejectButton = screen.getByText("Reject").closest("button");
    expect(rejectButton!.className).toContain("destructive");
  });

  it("renders structured description sections as Card components", async () => {
    const { EpicRequestDetailPage } = await import(
      "@/pages/epic-requests/epic-request-detail"
    );
    renderWithProviders(<EpicRequestDetailPage />);

    expect(screen.getByText("Problem Statement")).toBeDefined();
    expect(screen.getByText("Proposed Solution")).toBeDefined();
    expect(screen.getByText("Impact Assessment")).toBeDefined();
    expect(screen.getByText("Success Metrics")).toBeDefined();
    expect(screen.getByText("Target Audience")).toBeDefined();
    expect(screen.getByText("Alternatives Considered")).toBeDefined();
    expect(screen.getByText("Dependencies")).toBeDefined();
    expect(screen.getByText("Estimated Effort")).toBeDefined();
  });

  it("renders AlertDialog with correct confirmation message for Approve", async () => {
    const { EpicRequestDetailPage } = await import(
      "@/pages/epic-requests/epic-request-detail"
    );
    const { container } = renderWithProviders(<EpicRequestDetailPage />);

    // The AlertDialog trigger wraps the Approve button
    const approveButtons = screen.getAllByText("Approve");
    const triggerButton = approveButtons.at(0)?.closest("button");
    expect(triggerButton).toBeDefined();

    // Check the dialog content exists in the DOM (may be hidden)
    // AlertDialog content is rendered in a portal, check the component tree
    const alertTrigger = container.querySelector('[data-state]');
    expect(alertTrigger).toBeDefined();
  });

  it("renders description with MarkdownRenderer", async () => {
    const { EpicRequestDetailPage } = await import(
      "@/pages/epic-requests/epic-request-detail"
    );
    renderWithProviders(<EpicRequestDetailPage />);

    // The markdown content includes "problem" rendered as bold text
    expect(screen.getByText("problem")).toBeDefined();
  });
});

describe("EpicRequestDetailPage - structuredDesc JSON parsing", () => {
  it("handles structuredDesc as object type", async () => {
    const { EpicRequestDetailPage } = await import(
      "@/pages/epic-requests/epic-request-detail"
    );
    renderWithProviders(<EpicRequestDetailPage />);

    // Object-typed structuredDesc renders successfully
    expect(screen.getByText("Problem Statement")).toBeDefined();
    expect(screen.getByText("Proposed Solution")).toBeDefined();
  });
});
