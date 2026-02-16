/**
 * Global Test Setup for SpecTree API
 *
 * This file configures the test database connection, provides setup/cleanup
 * utilities, and exports helper functions for integration tests.
 *
 * For unit tests that mock the database, you don't need to use these functions.
 * For integration tests that need a real database, use:
 *
 * ```typescript
 * import {
 *   setupTestDatabase,
 *   cleanupTestDatabase,
 *   disconnectTestDatabase,
 * } from '../fixtures/index.js';
 *
 * beforeAll(async () => {
 *   await setupTestDatabase();
 * });
 *
 * afterEach(async () => {
 *   await cleanupTestDatabase();
 * });
 *
 * afterAll(async () => {
 *   await disconnectTestDatabase();
 * });
 * ```
 */

import { PrismaClient } from "../src/generated/prisma/index.js";
import { execSync } from "child_process";

// Global reference for ensuring app code uses the same client as tests
// This MUST be defined early, before any other imports could create a PrismaClient
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// =============================================================================
// SAFETY GUARD: Refuse to run tests against the production database.
// This prevents catastrophic data loss from test fixtures overwriting real data.
// =============================================================================
function assertTestDatabase(url: string | undefined): void {
  if (url && !url.includes("test") && !url.includes("Test")) {
    throw new Error(
      "\n\n🛑 ABORTING: DATABASE_URL does not point to a test database!\n" +
      `   Current: ${url}\n` +
      "   Tests MUST use a database with 'test' in the filename (e.g., spectree-test.db).\n" +
      "   This guard prevents tests from overwriting production data.\n" +
      "   Fix: Run tests via 'pnpm --filter api test' or from packages/api/.\n\n"
    );
  }
}

assertTestDatabase(process.env.DATABASE_URL);

// Create a dedicated test Prisma client instance IMMEDIATELY
// This ensures it's set in the global singleton before lib/db.ts is imported
// which fixes issues where authenticate middleware couldn't find test users
let testPrisma: PrismaClient | null = null;

// Initialize immediately if DATABASE_URL is set (vitest.config.ts sets it via env)
if (process.env.DATABASE_URL && !globalForPrisma.prisma) {
  testPrisma = new PrismaClient({
    log: process.env.DEBUG_TESTS ? ["query", "error", "warn"] : ["error"],
  });
  globalForPrisma.prisma = testPrisma;
}

/**
 * Gets or creates the test Prisma client instance.
 * Uses the test database URL from environment.
 * 
 * NOTE: The client is typically already created at module load time
 * (see initialization above). This function exists for backward compatibility
 * and to ensure the client is available.
 */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient({
      log: process.env.DEBUG_TESTS ? ["query", "error", "warn"] : ["error"],
    });
    // Ensure the global singleton is set for lib/db.ts compatibility
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = testPrisma;
    }
  }
  return testPrisma;
}

/**
 * Sets up the test database connection and environment.
 * Should be called before running integration tests.
 *
 * - Ensures DATABASE_URL points to test database
 * - Runs database migrations
 * - Initializes the Prisma client
 */
export async function setupTestDatabase(): Promise<void> {
  // Ensure we're using a test database URL
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Please configure it to point to your test database (spectree_test)."
    );
  }

  // HARD FAIL if the URL doesn't appear to be a test database
  if (!databaseUrl.includes("test") && !databaseUrl.includes("Test")) {
    throw new Error(
      "\n🛑 ABORTING: DATABASE_URL does not point to a test database!\n" +
      `   Current: ${databaseUrl}\n` +
      "   This guard prevents tests from overwriting production data.\n"
    );
  }

  // Set JWT_SECRET for tests if not already set
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "test-secret-key-for-jwt-signing-minimum-32-chars";
  }

  // Run database migrations to ensure schema is up to date
  try {
    execSync("pnpm db:migrate:deploy", {
      cwd: process.cwd().includes("packages/api")
        ? process.cwd()
        : `${process.cwd()}/packages/api`,
      stdio: process.env.DEBUG_TESTS ? "inherit" : "pipe",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
  } catch {
    // Migrations might fail if already applied or if DB doesn't exist yet
    // This is expected for unit tests that don't need a real database
  }

  // Initialize Prisma client and verify connection
  const prisma = getTestPrisma();
  await prisma.$connect();
}

/**
 * Cleans up all test data from the database.
 * Truncates tables in the correct order to respect foreign key constraints.
 *
 * Call this in beforeEach/afterEach hooks to ensure test isolation.
 */
export async function cleanupTestDatabase(): Promise<void> {
  const prisma = getTestPrisma();

  // SAFETY CHECK: Only cleanup if we're using a test database
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl.includes("test")) {
    console.warn(
      "⚠️  SKIPPING cleanup - DATABASE_URL does not contain 'test'. " +
      "To enable cleanup, use a test database (e.g., spectree-test.db)"
    );
    return;
  }

  // Delete in order to respect foreign key constraints:
  // 1. ApiTokens (depends on User)
  // 2. SessionEvents (depends on Epic, AiSession)
  // 3. AiSessions (depends on Epic, User)
  // 4. Tasks (depends on Feature, Status, User)
  // 5. Features (depends on Epic, Status, User)
  // 6. Epics (depends on Team or PersonalScope)
  // 7. Statuses (depends on Team or PersonalScope)
  // 8. Memberships (depends on Team, User)
  // 9. Teams
  // 10. PersonalScopes (depends on User)
  // 11. Users
  // 12. HealthCheck (no dependencies)

  await prisma.apiToken.deleteMany();
  await prisma.sessionEvent.deleteMany();
  await prisma.aiSession.deleteMany();
  await prisma.task.deleteMany();
  await prisma.feature.deleteMany();
  await prisma.epic.deleteMany();
  await prisma.status.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.team.deleteMany();
  await prisma.personalScope.deleteMany();
  await prisma.userInvitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.healthCheck.deleteMany();
}

/**
 * Disconnects from the test database.
 * Call this after all tests complete (in globalTeardown or afterAll).
 */
export async function disconnectTestDatabase(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}

/**
 * Resets the test database by cleaning and reconnecting.
 * Useful for ensuring a completely fresh state.
 */
export async function resetTestDatabase(): Promise<void> {
  await cleanupTestDatabase();
}

// =============================================================================
// Global Setup for Integration Tests
// =============================================================================
// Note: This setup runs for ALL test files when this file is included in
// vitest.config.ts setupFiles. For unit tests that mock the database,
// these hooks will run but should not interfere (they catch connection errors).
//
// If you want to run ONLY unit tests without database setup, you can:
// 1. Set SKIP_DB_SETUP=true environment variable
// 2. Or run tests from specific directories that don't need the database
// =============================================================================

const skipDbSetup = process.env.SKIP_DB_SETUP === "true";

if (!skipDbSetup) {
  // Before all tests: set up environment (JWT_SECRET is always needed)
  beforeAll(async () => {
    // Always set JWT_SECRET for tests
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "test-secret-key-for-jwt-signing-minimum-32-chars";
    }

    // Only try database setup if DATABASE_URL is configured
    if (process.env.DATABASE_URL) {
      try {
        await setupTestDatabase();
      } catch {
        // Database setup failed - this is OK for unit tests that mock the DB
        // Integration tests will fail later with a more specific error
      }
    }
  });

  // After all tests: disconnect if connected
  afterAll(async () => {
    try {
      await disconnectTestDatabase();
    } catch {
      // Ignore disconnect errors
    }
  });
}
