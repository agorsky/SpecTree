import { api } from "./client";
import type { LoginResponse, User } from "./types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }),

  refresh: (refreshToken: string) =>
    api.post<LoginResponse>("/auth/refresh", { refreshToken }),

  me: () => api.get<User>("/auth/me"),

  logout: () => api.post("/auth/logout", {}),
};
