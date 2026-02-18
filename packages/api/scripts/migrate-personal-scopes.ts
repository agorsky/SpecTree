/**
 * Migration Script: Provision PersonalScopes for Existing Users
 *
 * This one-time migration script creates PersonalScopes for all existing users
 * who don't already have one. Part of the Identity & Collaboration vNext migration.
 *
 * Run with: npx tsx scripts/migrate-personal-scopes.ts
 *
 * Safety:
 * - Idempotent: Safe to run multiple times
 * - Does not modify existing PersonalScopes
 * - Handles failures gracefully
 * - Runs in transactions for data integrity
 *
 * @see docs/architecture/identity-collaboration-vnext-implementation-reference.md
 */
import { prisma } from "../src/lib/db.js";
import { createPersonalScope, userHasPersonalScope } from "../src/services/personalScopeService.js";

interface MigrationResult {
  totalUsers: number;
  usersWithExistingScope: number;
  scopesCreated: number;
  failures: Array<{ userId: string; email: string; error: string }>;
}

/**
 * Find all users who don't have a PersonalScope.
 */
async function findUsersWithoutPersonalScope(): Promise<Array<{ id: string; email: string; name: string }>> {
  return prisma.user.findMany({
    where: {
      personalScope: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

/**
 * Migrate a single user by creating their PersonalScope.
 * Returns { success: true } if successful, or { success: false, error: string } if failed.
 */
async function migrateUser(user: { id: string; email: string; name: string }): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // Double-check they don't already have a scope (idempotency)
    if (await userHasPersonalScope(user.id)) {
      return { success: true }; // Already has scope, consider success
    }

    await createPersonalScope(user.id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Run the migration for all users without PersonalScopes.
 */
export async function migratePersonalScopes(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalUsers: 0,
    usersWithExistingScope: 0,
    scopesCreated: 0,
    failures: [],
  };

  console.log("\n===========================================");
  console.log("PersonalScope Migration Script");
  console.log("===========================================\n");

  // Get total user count
  result.totalUsers = await prisma.user.count();
  console.log(`Total users in database: ${result.totalUsers}`);

  // Find users without PersonalScope
  const usersToMigrate = await findUsersWithoutPersonalScope();
  result.usersWithExistingScope = result.totalUsers - usersToMigrate.length;

  console.log(`Users with existing PersonalScope: ${result.usersWithExistingScope}`);
  console.log(`Users to migrate: ${usersToMigrate.length}\n`);

  if (usersToMigrate.length === 0) {
    console.log("✅ No migration needed - all users have PersonalScopes\n");
    return result;
  }

  console.log("Starting migration...\n");

  // Migrate each user
  for (const user of usersToMigrate) {
    try {
      const migrationResult = await migrateUser(user);

      if (migrationResult.success) {
        result.scopesCreated++;
        console.log(`  ✅ Created PersonalScope for: ${user.email}`);
      } else {
        result.failures.push({ userId: user.id, email: user.email, error: migrationResult.error });
        console.log(`  ❌ Failed for: ${user.email} - ${migrationResult.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      result.failures.push({ userId: user.id, email: user.email, error: errorMsg });
      console.log(`  ❌ Failed for: ${user.email} - ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n===========================================");
  console.log("Migration Summary");
  console.log("===========================================");
  console.log(`Total users: ${result.totalUsers}`);
  console.log(`Already had scope: ${result.usersWithExistingScope}`);
  console.log(`Scopes created: ${result.scopesCreated}`);
  console.log(`Failures: ${result.failures.length}`);

  if (result.failures.length > 0) {
    console.log("\nFailed users:");
    for (const failure of result.failures) {
      console.log(`  - ${failure.email}: ${failure.error}`);
    }
  }

  const allSuccess = result.failures.length === 0;
  console.log(`\n${allSuccess ? "✅" : "⚠️"} Migration ${allSuccess ? "completed successfully" : "completed with errors"}\n`);

  return result;
}

// Main execution
async function main() {
  try {
    const result = await migratePersonalScopes();

    // Exit with error code if there were failures
    if (result.failures.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Migration failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly (not imported as a module for testing)
// Check if this module is the entry point
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}
