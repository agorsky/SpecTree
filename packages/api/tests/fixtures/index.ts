/**
 * Test Fixtures Entry Point
 *
 * Re-exports all test utilities from a single location for convenient imports.
 *
 * @example
 * import {
 *   createTestUser,
 *   createAuthenticatedUser,
 *   setupTestDatabase,
 *   cleanupTestDatabase,
 * } from '../fixtures/index.js';
 */

// Factory functions for creating test entities
export {
  // Individual entity factories
  createTestUser,
  createTestTeam,
  createTestMembership,
  createTestProject,
  createTestStatus,
  createTestFeature,
  createTestTask,

  // Composite factories for common scenarios
  createTestUserWithTeam,
  createTestProjectWithFeatures,
  createTestWorkflow,

  // Utility functions
  resetFactoryCounter,

  // Invitation factories
  createTestInvitation,
  createExpiredTestInvitation,
  createUsedTestInvitation,
  createTestGlobalAdmin,

  // Type exports
  type UserInput,
  type TeamInput,
  type MembershipInput,
  type ProjectInput,
  type StatusInput,
  type FeatureInput,
  type TaskInput,
  type InvitationInput,
} from "./factories.js";

// Authentication helpers
export {
  // Header creation
  createAuthHeader,
  createRefreshHeader,
  generateTokens,

  // Authenticated user factories
  createAuthenticatedUser,
  createAuthenticatedTeamMember,
  createAuthenticatedAdmin,
  createAuthenticatedGuest,

  // Invalid auth helpers for testing error cases
  createExpiredAuthHeader,
  createInvalidAuthHeader,
  createEmptyAuthHeader,
  createMalformedAuthHeader,

  // Type exports
  type AuthHeader,
  type AuthenticatedUser,
  type AuthenticatedTeamMember,
} from "./auth.js";

// Database setup and cleanup utilities
export {
  getTestPrisma,
  setupTestDatabase,
  cleanupTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
} from "../setup.js";
