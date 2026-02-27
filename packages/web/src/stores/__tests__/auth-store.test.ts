/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup-storage";
import { useAuthStore } from "../auth-store";

const mockLogin = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  authApi: {
    login: (passphrase: string) => mockLogin(passphrase) as Promise<{ accessToken: string }>,
  },
}));

describe("auth-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it("has correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  describe("login", () => {
    it("stores accessToken and sets isAuthenticated on success", async () => {
      mockLogin.mockResolvedValueOnce({ accessToken: "tok-123" });

      await useAuthStore.getState().login("my-secret");

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe("tok-123");
      expect(state.isAuthenticated).toBe(true);
      expect(mockLogin).toHaveBeenCalledWith("my-secret");
    });

    it("propagates errors on login failure", async () => {
      mockLogin.mockRejectedValueOnce(new Error("Unauthorized"));

      await expect(
        useAuthStore.getState().login("wrong")
      ).rejects.toThrow("Unauthorized");

      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("logout", () => {
    it("clears token and sets isAuthenticated to false", () => {
      useAuthStore.setState({
        accessToken: "tok-123",
        isAuthenticated: true,
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  it("does not store user, refreshToken, or isLoading", () => {
    const state = useAuthStore.getState();
    expect("user" in state).toBe(false);
    expect("refreshToken" in state).toBe(false);
    expect("isLoading" in state).toBe(false);
    expect("setTokens" in state).toBe(false);
    expect("checkAuth" in state).toBe(false);
  });
});
