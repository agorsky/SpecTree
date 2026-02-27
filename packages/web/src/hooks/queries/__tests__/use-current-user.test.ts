import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useCurrentUser } from "../use-current-user";

const mockMe = vi.fn();

vi.mock("@/lib/api/users", () => ({
  usersApi: {
    me: () => mockMe(),
  },
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: vi.fn((selector) => {
    const state = { isAuthenticated: true };
    return selector ? selector(state) : state;
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches user data when authenticated", async () => {
    const userData = { data: { id: "u1", name: "Alice", email: "alice@test.com" } };
    mockMe.mockResolvedValueOnce(userData);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(userData);
    expect(mockMe).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when not authenticated", async () => {
    const { useAuthStore } = await import("@/stores/auth-store");
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: { isAuthenticated: boolean }) => unknown) => {
        const state = { isAuthenticated: false };
        return selector ? selector(state) : state;
      }
    );

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    // Should remain in idle state (not fetch)
    expect(result.current.isFetching).toBe(false);
    expect(mockMe).not.toHaveBeenCalled();
  });
});
