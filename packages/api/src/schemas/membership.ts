import { z } from "zod";

/**
 * Validation schemas for Membership entities.
 */

/**
 * Enum for membership roles
 */
export const membershipRoleEnum = z.enum(["admin", "member", "guest"]);

/**
 * Schema for adding a member to a team
 */
export const addMemberSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  role: membershipRoleEnum.optional(),
});

/**
 * Schema for updating a member's role
 */
export const updateMemberRoleSchema = z.object({
  role: membershipRoleEnum,
});

// Type exports for use in route handlers
export type MembershipRole = z.infer<typeof membershipRoleEnum>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
