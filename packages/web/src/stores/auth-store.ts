import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api/auth";

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (passphrase: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      isAuthenticated: false,

      login: async (passphrase) => {
        const response = await authApi.login(passphrase);
        set({
          accessToken: response.accessToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          accessToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
