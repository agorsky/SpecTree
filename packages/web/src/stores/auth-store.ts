import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/lib/api/types";
import { authApi } from "@/lib/api/auth";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email, password) => {
        const response = await authApi.login(email, password);
        set({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isLoading: false });
          return;
        }
        try {
          const user = await authApi.me();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          get().logout();
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
