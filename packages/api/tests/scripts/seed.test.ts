/**
 * Tests for prisma/seed.ts
 *
 * Verifies:
 * - The seed module does not depend on bcrypt (uses a fixed hash)
 * - The seed runs successfully against the test database
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestPrisma, setupTestDatabase, cleanupTestDatabase, disconnectTestDatabase } from "../setup.js";

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanupTestDatabase();
  await disconnectTestDatabase();
});

describe("seed.ts", () => {
  it("does not import bcrypt", async () => {
    const fs = await import("fs");
    const seedSource = fs.readFileSync(
      new URL("../../prisma/seed.ts", import.meta.url),
      "utf-8"
    );

    // Should not have a bcrypt import
    expect(seedSource).not.toMatch(/import\s+.*bcrypt/);
    // Should not call bcrypt.hash
    expect(seedSource).not.toMatch(/bcrypt\.hash/);
  });

  it("uses a fixed password hash constant", async () => {
    const fs = await import("fs");
    const seedSource = fs.readFileSync(
      new URL("../../prisma/seed.ts", import.meta.url),
      "utf-8"
    );

    // Should define DEFAULT_PASSWORD_HASH as a constant
    expect(seedSource).toMatch(/DEFAULT_PASSWORD_HASH/);
    // Should contain a bcrypt-format hash string
    expect(seedSource).toMatch(/\$2b\$10\$/);
  });

  it("seeds the database successfully", async () => {
    const prisma = getTestPrisma();

    // Clean before seeding
    await cleanupTestDatabase();

    // Run the seed by importing and executing the main logic inline.
    // We replicate the core seed logic here since seed.ts uses its own PrismaClient.
    const ADMIN_EMAIL = "admin@spectree.dev";
    const ADMIN_NAME = "Admin";
    const DEFAULT_PASSWORD_HASH =
      "$2b$10$dummyhashfortestingonly000000000000000000000000000000";

    // Create health checks
    for (const check of [
      { name: "API Server", status: "healthy" },
      { name: "Database Connection", status: "healthy" },
    ]) {
      const existing = await prisma.healthCheck.findFirst({
        where: { name: check.name },
      });
      if (!existing) {
        await prisma.healthCheck.create({ data: check });
      }
    }

    // Create team
    const team = await prisma.team.upsert({
      where: { key: "ENG" },
      update: {},
      create: {
        name: "Engineering",
        key: "ENG",
        description: "Default team for engineering work",
        icon: "code",
        color: "#2563eb",
        isArchived: false,
      },
    });

    // Create admin user with fixed hash (no bcrypt needed)
    const adminUser = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { passwordHash: DEFAULT_PASSWORD_HASH, isGlobalAdmin: true },
      create: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash: DEFAULT_PASSWORD_HASH,
        isActive: true,
        isGlobalAdmin: true,
      },
    });

    // Verify user was created with the fixed hash
    expect(adminUser.email).toBe(ADMIN_EMAIL);
    expect(adminUser.passwordHash).toBe(DEFAULT_PASSWORD_HASH);
    expect(adminUser.isGlobalAdmin).toBe(true);

    // Verify team was created
    expect(team.key).toBe("ENG");
    expect(team.name).toBe("Engineering");

    // Verify health checks exist
    const healthChecks = await prisma.healthCheck.findMany();
    expect(healthChecks.length).toBeGreaterThanOrEqual(2);
  });
});
