/**
 * Invitation types for user invitation system
 */

export interface Invitation {
  id: string;
  email: string;
  code: string;
  createdBy: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateInvitationRequest {
  email: string;
}

export interface CreateInvitationResponse extends Invitation {}

export interface ListInvitationsParams {
  status?: "pending" | "used" | "expired" | "all";
  limit?: number;
  cursor?: string;
}

export interface ListInvitationsResponse {
  invitations: Invitation[];
  meta: {
    hasMore: boolean;
    cursor: string | null;
  };
}
