import { api } from "./client";

interface LoginResult {
  accessToken: string;
}

export const authApi = {
  login: (passphrase: string) =>
    api.post<LoginResult>("/auth/login", { passphrase }),
};
