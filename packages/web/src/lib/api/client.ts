import { useAuthStore } from "@/stores/auth-store";

export class ApiError extends Error {
  constructor(
    public response: Response,
    public data?: unknown
  ) {
    super(`API Error: ${String(response.status)}`);
  }
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

class ApiClient {
  private baseUrl = "/api/v1";

  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    // Only set Content-Type for requests with a body
    if (options?.body) {
      headers["Content-Type"] = "application/json";
    }

    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && !path.startsWith("/auth/")) {
      // Attempt refresh or redirect to login (skip for auth endpoints)
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        useAuthStore.getState().logout();
        window.location.href = "/login";
        throw new ApiError(res, { message: "Unauthorized" });
      }
      // Retry original request
      return this.request<T>(path, options);
    }

    if (!res.ok) {
      const data: unknown = await res.json().catch(() => null);
      throw new ApiError(res, data);
    }

    // Handle 204 No Content responses
    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as RefreshResponse;
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export const api = new ApiClient();
