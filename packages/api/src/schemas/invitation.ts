/**
 * Zod validation schemas for invitation endpoints.
 */

import { z } from "zod";

/**
 * Schema for creating a new invitation
 */
export const createInvitationSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .refine((e) => e.toLowerCase().endsWith("@toro.com"), {
      message: "Email must be a @toro.com address",
    }),
});

/**
 * Schema for listing invitations query parameters
 */
export const listInvitationsQuerySchema = z.object({
  status: z.enum(["pending", "used", "expired", "all"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

/**
 * Schema for invitation ID parameter
 */
export const invitationIdParamSchema = z.object({
  id: z.string().uuid(),
});

// Type exports
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;
export type InvitationIdParam = z.infer<typeof invitationIdParamSchema>;
