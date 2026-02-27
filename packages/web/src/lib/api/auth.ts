import { api } from "./client";
import type { LoginResponse, User } from "./types";

export const authApi = {
  login: (passphrase: string) =>
    api.post<LoginResponse>("/auth/login", { passphrase }),

  refresh: (refreshToken: string) =>
    api.post<LoginResponse>("/auth/refresh", { refreshToken }),

  me: () => api.get<User>("/auth/me"),

  logout: () => api.post("/auth/logout", {}),
};
