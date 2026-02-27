import { api } from "./client";
import type { LoginResponse, User } from "./types";
import type {
  ActivateAccountRequest,
  ActivateAccountResponse,
} from "@spectree/shared";

export const authApi = {
  login: (passphrase: string) =>
    api.post<LoginResponse>("/auth/login", { passphrase }),

  refresh: (refreshToken: string) =>
    api.post<LoginResponse>("/auth/refresh", { refreshToken }),

  me: () => api.get<User>("/auth/me"),

  logout: () => api.post("/auth/logout", {}),

  activate: (data: ActivateAccountRequest): Promise<ActivateAccountResponse> =>
    api.post<ActivateAccountResponse>("/auth/activate", data),
};
