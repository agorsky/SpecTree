import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Default status definitions (used for both team and personal scopes)
const DEFAULT_STATUS_DEFINITIONS = [
  { name: "Backlog", category: "backlog", color: "#6b7280", position: 0 },
  { name: "Todo", category: "unstarted", color: "#3b82f6", position: 1 },
  { name: "In Progress", category: "started", color: "#f59e0b", position: 2 },
  { name: "Done", category: "completed", color: "#10b981", position: 3 },
  { name: "Canceled", category: "canceled", color: "#ef4444", position: 4 },
];

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
    update: { passwordHash, isGlobalAdmin: true },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      isActive: true,
      isGlobalAdmin: true,
    },
  });
  console.log(`✓ Admin user created: ${adminUser.email}`);

  // =============================================================================
  // PersonalScope for Admin User (COM-316)
  // Creates a private workspace for personal projects
  // =============================================================================
  const adminPersonalScope = await prisma.personalScope.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
    },
  });
  console.log(`✓ PersonalScope created for ${adminUser.email}`);

  // =============================================================================
  // Default Statuses for Admin's PersonalScope (COM-320)
  // =============================================================================
  for (const statusDef of DEFAULT_STATUS_DEFINITIONS) {
    const existingStatus = await prisma.status.findFirst({
      where: {
        personalScopeId: adminPersonalScope.id,
        name: statusDef.name,
      },
    });
    if (!existingStatus) {
      await prisma.status.create({
        data: {
          personalScopeId: adminPersonalScope.id,
          name: statusDef.name,
          category: statusDef.category,
          color: statusDef.color,
          position: statusDef.position,
        },
      });
    }
  }
  console.log(`✓ Default statuses created for Admin's PersonalScope`);

  // =============================================================================
  // Admin Membership (admin of Engineering team) (COM-318)
  // Team memberships are explicit - users must be manually added to teams
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
  for (const statusDef of DEFAULT_STATUS_DEFINITIONS) {
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
  // Sample Personal Projects (COM-313)
  // Demo projects in the admin's PersonalScope to showcase personal workspace
  // =============================================================================
  
  // Get the backlog status for personal scope to assign to features
  const personalBacklogStatus = await prisma.status.findFirst({
    where: {
      personalScopeId: adminPersonalScope.id,
      category: "backlog",
    },
  });

  const personalTodoStatus = await prisma.status.findFirst({
    where: {
      personalScopeId: adminPersonalScope.id,
      category: "unstarted",
    },
  });

  // Personal Project 1: Side Project Ideas
  const sideProjectIdeas = await prisma.project.upsert({
    where: { id: "personal-side-projects" },
    update: {},
    create: {
      id: "personal-side-projects",
      name: "Side Project Ideas",
      description: "A collection of personal project ideas to explore",
      icon: "💡",
      color: "#8b5cf6",
      scopeType: "personal",
      personalScopeId: adminPersonalScope.id,
      sortOrder: 0,
    },
  });
  console.log(`✓ Personal project created: ${sideProjectIdeas.name}`);

  // Add sample features to Side Project Ideas
  const existingFeature1 = await prisma.feature.findUnique({
    where: { identifier: "PERSONAL-1" },
  });
  if (!existingFeature1) {
    await prisma.feature.create({
      data: {
        identifier: "PERSONAL-1",
        title: "Build a habit tracker app",
        description: "Create a simple habit tracking app with daily reminders and streak tracking",
        projectId: sideProjectIdeas.id,
        statusId: personalBacklogStatus?.id,
        sortOrder: 0,
      },
    });
  }

  const existingFeature2 = await prisma.feature.findUnique({
    where: { identifier: "PERSONAL-2" },
  });
  if (!existingFeature2) {
    await prisma.feature.create({
      data: {
        identifier: "PERSONAL-2",
        title: "Learn Rust by building a CLI tool",
        description: "Pick a simple CLI project to learn Rust fundamentals",
        projectId: sideProjectIdeas.id,
        statusId: personalTodoStatus?.id,
        sortOrder: 1,
      },
    });
  }

  // Personal Project 2: Learning Goals
  const learningGoals = await prisma.project.upsert({
    where: { id: "personal-learning-goals" },
    update: {},
    create: {
      id: "personal-learning-goals",
      name: "Learning Goals 2026",
      description: "Personal learning objectives and skill development",
      icon: "📚",
      color: "#10b981",
      scopeType: "personal",
      personalScopeId: adminPersonalScope.id,
      sortOrder: 1,
    },
  });
  console.log(`✓ Personal project created: ${learningGoals.name}`);

  // Add sample features to Learning Goals
  const existingFeature3 = await prisma.feature.findUnique({
    where: { identifier: "PERSONAL-3" },
  });
  if (!existingFeature3) {
    await prisma.feature.create({
      data: {
        identifier: "PERSONAL-3",
        title: "Complete TypeScript advanced patterns course",
        description: "Deep dive into advanced TypeScript patterns including mapped types and conditional types",
        projectId: learningGoals.id,
        statusId: personalBacklogStatus?.id,
        sortOrder: 0,
      },
    });
  }

  console.log(`✓ Sample features created for personal projects`);

  // =============================================================================
  // Summary
  // =============================================================================
  console.log("\n========================================");
  console.log("Database seeding completed!");
  console.log("========================================");
  console.log(`Team: ${engineeringTeam.name} (${engineeringTeam.key})`);
  console.log(`Admin: ${adminUser.email}`);
  console.log(`Password: ${DEFAULT_PASSWORD}`);
  console.log(`PersonalScope: ${adminPersonalScope.id}`);
  console.log(`Personal Epics: ${sideProjectIdeas.name}, ${learningGoals.name}`);
  console.log("========================================\n");
  console.log("You can now log in and create your own epics, features, and tasks.");
  console.log("Personal epics are private and only visible to you.");
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
