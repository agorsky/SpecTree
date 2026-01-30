import { api } from "./client";
import type {
  CreateInvitationRequest,
  CreateInvitationResponse,
  ListInvitationsParams,
  ListInvitationsResponse,
} from "@spectree/shared";

interface ListUsersParams {
  limit?: number;
  cursor?: string;
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  isGlobalAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListUsersResponse {
  users: UserResponse[];
  meta: {
    hasMore: boolean;
    cursor: string | null;
  };
}

export const adminApi = {
  // Invitations
  createInvitation: (data: CreateInvitationRequest) =>
    api.post<CreateInvitationResponse>("/admin/invitations", data),

  listInvitations: (params?: ListInvitationsParams) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    return api.get<ListInvitationsResponse>(
      `/admin/invitations${query ? `?${query}` : ""}`
    );
  },

  revokeInvitation: (id: string) => api.delete(`/admin/invitations/${id}`),

  // Users
  listUsers: (params?: ListUsersParams) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    return api.get<ListUsersResponse>(`/admin/users${query ? `?${query}` : ""}`);
  },

  deactivateUser: (id: string) =>
    api.patch<UserResponse>(`/admin/users/${id}`, { isActive: false }),

  reactivateUser: (id: string) =>
    api.patch<UserResponse>(`/admin/users/${id}`, { isActive: true }),
};
