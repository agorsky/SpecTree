import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Default admin credentials
const ADMIN_EMAIL = "admin@spectree.dev";
const ADMIN_NAME = "Admin";
const DEFAULT_PASSWORD = "Password123!";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log("Seeding database with minimal setup...");
  console.log(`Admin email: ${ADMIN_EMAIL}`);
  console.log(`Admin password: ${DEFAULT_PASSWORD}`);
  console.log("");

  // =============================================================================
  // Health Checks
  // =============================================================================
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
  console.log("✓ Health check records created");

  // =============================================================================
  // Default Team (Engineering)
  // =============================================================================
  const engineeringTeam = await prisma.team.upsert({
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
  console.log(`✓ Default team created: ${engineeringTeam.name}`);

  // =============================================================================
  // Admin User
  // =============================================================================
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      isActive: true,
    },
  });
  console.log(`✓ Admin user created: ${adminUser.email}`);

  // =============================================================================
  // Admin Membership (admin of Engineering team)
  // =============================================================================
  await prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId: adminUser.id,
        teamId: engineeringTeam.id,
      },
    },
    update: { role: "admin" },
    create: {
      userId: adminUser.id,
      teamId: engineeringTeam.id,
      role: "admin",
    },
  });
  console.log(`✓ Admin membership created`);

  // =============================================================================
  // Default Statuses for Engineering Team
  // =============================================================================
  const statusDefinitions = [
    { name: "Backlog", category: "backlog", color: "#6b7280", position: 0 },
    { name: "Todo", category: "unstarted", color: "#3b82f6", position: 1 },
    { name: "In Progress", category: "started", color: "#f59e0b", position: 2 },
    { name: "Done", category: "completed", color: "#10b981", position: 3 },
    { name: "Canceled", category: "canceled", color: "#ef4444", position: 4 },
  ];

  for (const statusDef of statusDefinitions) {
    await prisma.status.upsert({
      where: {
        teamId_name: {
          teamId: engineeringTeam.id,
          name: statusDef.name,
        },
      },
      update: {},
      create: {
        teamId: engineeringTeam.id,
        name: statusDef.name,
        category: statusDef.category,
        color: statusDef.color,
        position: statusDef.position,
      },
    });
  }
  console.log(`✓ Default statuses created for ${engineeringTeam.name}`);

  // =============================================================================
  // Summary
  // =============================================================================
  console.log("\n========================================");
  console.log("Database seeding completed!");
  console.log("========================================");
  console.log(`Team: ${engineeringTeam.name} (${engineeringTeam.key})`);
  console.log(`Admin: ${adminUser.email}`);
  console.log(`Password: ${DEFAULT_PASSWORD}`);
  console.log("========================================\n");
  console.log("You can now log in and create your own projects, features, and tasks.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
