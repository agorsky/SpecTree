/**
 * Invitation Service for SpecTree API
 *
 * Handles invitation code generation, CRUD operations, and validation
 * for the user invitation system.
 */

import crypto from "crypto";
import { prisma } from "../lib/db.js";
import { ValidationError, NotFoundError, ConflictError } from "../errors/index.js";

// Characters that are unambiguous (no 0/O, 1/I/L confusion)
const INVITE_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 8;
const INVITE_EXPIRY_HOURS = 72;
const ALLOWED_DOMAIN = "@toro.com";

// =============================================================================
// Types
// =============================================================================

export interface ListInvitationsOptions {
  status?: "pending" | "used" | "expired" | "all" | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface ListInvitationsResult {
  invitations: InvitationWithCreator[];
  meta: {
    hasMore: boolean;
    cursor: string | null;
  };
}

export interface InvitationWithCreator {
  id: string;
  email: string;
  code: string;
  createdBy: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  creator: {
    id: string;
    name: string;
    email: string;
  };
}

// =============================================================================
// Code Generation
// =============================================================================

/**
 * Generates a cryptographically secure invitation code.
 * Uses unambiguous characters to avoid confusion (no 0/O, 1/I/L).
 *
 * @returns An 8-character uppercase invitation code
 */
export function generateInviteCode(): string {
  const buffer = crypto.randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (const byte of buffer) {
    const char = INVITE_CODE_CHARS[byte % INVITE_CODE_CHARS.length];
    if (char !== undefined) {
      code += char;
    }
  }
  return code.substring(0, INVITE_CODE_LENGTH);
}

// =============================================================================
// Create Invitation
// =============================================================================

/**
 * Creates a new invitation for the specified email address.
 *
 * @param email - The email address to invite (must be @toro.com)
 * @param createdBy - The ID of the admin user creating the invitation
 * @returns The created invitation with creator details
 * @throws ValidationError if email domain is not allowed
 * @throws ConflictError if user already exists or has pending invitation
 */
export async function createInvitation(
  email: string,
  createdBy: string
): Promise<InvitationWithCreator> {
  const normalizedEmail = email.toLowerCase();

  // Validate domain
  if (!normalizedEmail.endsWith(ALLOWED_DOMAIN)) {
    throw new ValidationError(`Email must end with ${ALLOWED_DOMAIN}`);
  }

  // Check for existing user
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new ConflictError("User with this email already exists");
  }

  // Check for pending invitation
  const existingInvite = await prisma.userInvitation.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingInvite && !existingInvite.usedAt && existingInvite.expiresAt > new Date()) {
    throw new ConflictError("Pending invitation already exists for this email");
  }

  // If there's an expired or used invitation for this email, delete it first
  if (existingInvite) {
    await prisma.userInvitation.delete({ where: { id: existingInvite.id } });
  }

  // Create invitation
  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

  return prisma.userInvitation.create({
    data: { email: normalizedEmail, code, createdBy, expiresAt },
    include: { creator: { select: { id: true, name: true, email: true } } },
  });
}

// =============================================================================
// List & Get Invitations
// =============================================================================

/**
 * Lists invitations with optional filtering and pagination.
 *
 * @param options - Filter and pagination options
 * @returns Paginated list of invitations with creator details
 */
export async function listInvitations(
  options: ListInvitationsOptions = {}
): Promise<ListInvitationsResult> {
  const { status = "pending", limit = 20, cursor } = options;
  const now = new Date();

  // Build where clause based on status filter
  type WhereClause = 
    | Record<string, never>
    | { usedAt: null; expiresAt: { gt: Date } }
    | { usedAt: { not: null } }
    | { usedAt: null; expiresAt: { lte: Date } };
  
  let where: WhereClause = {};

  switch (status) {
    case "pending":
      where = { usedAt: null, expiresAt: { gt: now } };
      break;
    case "used":
      where = { usedAt: { not: null } };
      break;
    case "expired":
      where = { usedAt: null, expiresAt: { lte: now } };
      break;
    // 'all' - no filter
  }

  const queryOptions: {
    where: WhereClause;
    take: number;
    orderBy: { createdAt: "desc" };
    include: { creator: { select: { id: true; name: true; email: true } } };
    cursor?: { id: string };
    skip?: number;
  } = {
    where,
    take: limit + 1,
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { id: true, name: true, email: true } } },
  };

  if (cursor) {
    queryOptions.cursor = { id: cursor };
    queryOptions.skip = 1; // Skip the cursor item itself
  }

  const invitations = await prisma.userInvitation.findMany(queryOptions);

  const hasMore = invitations.length > limit;
  if (hasMore) invitations.pop();

  const lastInvitation = invitations[invitations.length - 1];
  return {
    invitations: invitations as InvitationWithCreator[],
    meta: {
      hasMore,
      cursor: hasMore && lastInvitation ? lastInvitation.id : null,
    },
  };
}

/**
 * Gets an invitation by its ID.
 *
 * @param id - The invitation UUID
 * @returns The invitation with creator details, or null if not found
 */
export async function getInvitationById(id: string): Promise<InvitationWithCreator | null> {
  return prisma.userInvitation.findUnique({
    where: { id },
    include: { creator: { select: { id: true, name: true, email: true } } },
  });
}

/**
 * Gets an invitation by its code.
 *
 * @param code - The invitation code (case-insensitive)
 * @returns The invitation, or null if not found
 */
export async function getInvitationByCode(code: string) {
  return prisma.userInvitation.findUnique({
    where: { code: code.toUpperCase() },
  });
}

// =============================================================================
// Revoke Invitation
// =============================================================================

/**
 * Revokes (deletes) an invitation.
 *
 * @param id - The invitation UUID
 * @throws NotFoundError if invitation doesn't exist
 * @throws ValidationError if invitation has already been used
 */
export async function revokeInvitation(id: string): Promise<void> {
  const invitation = await prisma.userInvitation.findUnique({ where: { id } });

  if (!invitation) {
    throw new NotFoundError("Invitation not found");
  }

  if (invitation.usedAt) {
    throw new ValidationError("Cannot revoke used invitation");
  }

  await prisma.userInvitation.delete({ where: { id } });
}

// =============================================================================
// Validate & Use Invitation
// =============================================================================

/**
 * Validates an invitation code and marks it as used.
 * Used during the account activation flow.
 *
 * @param email - The email address (must match invitation)
 * @param code - The invitation code
 * @returns The updated invitation record
 * @throws NotFoundError if email/code combination is invalid
 * @throws ValidationError if invitation is already used or expired
 */
export async function validateAndUseInvitation(email: string, code: string) {
  return validateAndUseInvitationInTransaction(prisma, email, code);
}

/**
 * Validates an invitation code and marks it as used within an existing transaction.
 * Used by the activation route to ensure invitation consumption and user creation
 * are atomic — if user creation fails, the invitation is not consumed.
 */
export async function validateAndUseInvitationInTransaction(
  tx: { userInvitation: typeof prisma.userInvitation },
  email: string,
  code: string
) {
  const normalizedEmail = email.toLowerCase();
  const normalizedCode = code.toUpperCase();

  const invitation = await tx.userInvitation.findFirst({
    where: { email: normalizedEmail, code: normalizedCode },
  });

  if (!invitation) {
    throw new NotFoundError("Invalid email or code");
  }

  if (invitation.usedAt) {
    throw new ValidationError("This invitation has already been used");
  }

  if (invitation.expiresAt < new Date()) {
    throw new ValidationError("This invitation has expired");
  }

  // Mark as used
  return tx.userInvitation.update({
    where: { id: invitation.id },
    data: { usedAt: new Date() },
  });
}
