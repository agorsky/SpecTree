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

// =============================================================================
// Built-in Plan Templates
// =============================================================================

const BUILT_IN_TEMPLATES = [
  {
    name: "Code Feature",
    description: "Standard software feature implementation workflow: Research → Design → Implementation → Testing → Documentation",
    structure: JSON.stringify({
      epicDefaults: {
        icon: "🚀",
        color: "#3b82f6",
        descriptionPrompt: "Implementation of {{topic}}",
      },
      features: [
        {
          titleTemplate: "Research: {{topic}}",
          descriptionPrompt: "Research existing solutions, patterns, and best practices for {{topic}}",
          executionOrder: 1,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Review existing codebase for similar patterns", executionOrder: 1 },
            { titleTemplate: "Research industry best practices", executionOrder: 2 },
            { titleTemplate: "Document findings and recommendations", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Design: {{topic}}",
          descriptionPrompt: "Design the architecture and approach for {{topic}}",
          executionOrder: 2,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Create technical design document", executionOrder: 1 },
            { titleTemplate: "Define interfaces and data models", executionOrder: 2 },
            { titleTemplate: "Review design with team", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Implement: {{topic}}",
          descriptionPrompt: "Build the core functionality for {{topic}}",
          executionOrder: 3,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Set up project structure", executionOrder: 1 },
            { titleTemplate: "Implement core logic", executionOrder: 2 },
            { titleTemplate: "Add error handling", executionOrder: 3 },
            { titleTemplate: "Code review and refactoring", executionOrder: 4 },
          ],
        },
        {
          titleTemplate: "Test: {{topic}}",
          descriptionPrompt: "Comprehensive testing for {{topic}}",
          executionOrder: 4,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Write unit tests", executionOrder: 1 },
            { titleTemplate: "Write integration tests", executionOrder: 2 },
            { titleTemplate: "Manual testing and edge cases", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Document: {{topic}}",
          descriptionPrompt: "Documentation for {{topic}}",
          executionOrder: 5,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Update API documentation", executionOrder: 1 },
            { titleTemplate: "Add code comments", executionOrder: 2 },
            { titleTemplate: "Update README if needed", executionOrder: 3 },
          ],
        },
      ],
    }),
  },
  {
    name: "Bug Fix",
    description: "Bug investigation and fix workflow: Reproduce → Investigate → Fix → Verify",
    structure: JSON.stringify({
      epicDefaults: {
        icon: "🐛",
        color: "#ef4444",
        descriptionPrompt: "Fix bug: {{topic}}",
      },
      features: [
        {
          titleTemplate: "Reproduce: {{topic}}",
          descriptionPrompt: "Reliably reproduce the bug to understand the issue",
          executionOrder: 1,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Create minimal reproduction case", executionOrder: 1 },
            { titleTemplate: "Document reproduction steps", executionOrder: 2 },
            { titleTemplate: "Identify affected versions/environments", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Investigate: {{topic}}",
          descriptionPrompt: "Root cause analysis for the bug",
          executionOrder: 2,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Analyze logs and error messages", executionOrder: 1 },
            { titleTemplate: "Debug and trace execution", executionOrder: 2 },
            { titleTemplate: "Identify root cause", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Fix: {{topic}}",
          descriptionPrompt: "Implement the fix and ensure quality",
          executionOrder: 3,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Implement fix", executionOrder: 1 },
            { titleTemplate: "Add regression test", executionOrder: 2 },
            { titleTemplate: "Code review", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Verify: {{topic}}",
          descriptionPrompt: "Verify the fix works and doesn't introduce regressions",
          executionOrder: 4,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Verify fix resolves original issue", executionOrder: 1 },
            { titleTemplate: "Run full test suite", executionOrder: 2 },
            { titleTemplate: "Test related functionality", executionOrder: 3 },
          ],
        },
      ],
    }),
  },
  {
    name: "Refactoring",
    description: "Code refactoring project: Analyze → Plan → Execute → Validate",
    structure: JSON.stringify({
      epicDefaults: {
        icon: "🔧",
        color: "#8b5cf6",
        descriptionPrompt: "Refactoring: {{topic}}",
      },
      features: [
        {
          titleTemplate: "Analyze: {{topic}}",
          descriptionPrompt: "Analyze current code structure and identify improvements",
          executionOrder: 1,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Map current code structure", executionOrder: 1 },
            { titleTemplate: "Identify code smells and issues", executionOrder: 2 },
            { titleTemplate: "Document technical debt", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Plan: {{topic}}",
          descriptionPrompt: "Plan the refactoring approach",
          executionOrder: 2,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Define target architecture", executionOrder: 1 },
            { titleTemplate: "Create migration strategy", executionOrder: 2 },
            { titleTemplate: "Identify risks and mitigation", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Execute: {{topic}}",
          descriptionPrompt: "Execute the refactoring in safe increments",
          executionOrder: 3,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Ensure test coverage before changes", executionOrder: 1 },
            { titleTemplate: "Apply refactoring in small commits", executionOrder: 2 },
            { titleTemplate: "Run tests after each change", executionOrder: 3 },
            { titleTemplate: "Code review", executionOrder: 4 },
          ],
        },
        {
          titleTemplate: "Validate: {{topic}}",
          descriptionPrompt: "Validate refactoring success",
          executionOrder: 4,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Run full test suite", executionOrder: 1 },
            { titleTemplate: "Performance testing", executionOrder: 2 },
            { titleTemplate: "Document improvements", executionOrder: 3 },
          ],
        },
      ],
    }),
  },
  {
    name: "API Endpoint",
    description: "New API endpoint development: Design → Implement → Test → Document",
    structure: JSON.stringify({
      epicDefaults: {
        icon: "🔌",
        color: "#10b981",
        descriptionPrompt: "API Endpoint: {{topic}}",
      },
      features: [
        {
          titleTemplate: "Design API: {{topic}}",
          descriptionPrompt: "Design the API contract and data models",
          executionOrder: 1,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Define request/response schemas", executionOrder: 1 },
            { titleTemplate: "Design error responses", executionOrder: 2 },
            { titleTemplate: "Review with API consumers", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Implement Route: {{topic}}",
          descriptionPrompt: "Implement the API route and business logic",
          executionOrder: 2,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Create route handler", executionOrder: 1 },
            { titleTemplate: "Implement validation", executionOrder: 2 },
            { titleTemplate: "Implement business logic", executionOrder: 3 },
            { titleTemplate: "Add authentication/authorization", executionOrder: 4 },
          ],
        },
        {
          titleTemplate: "Test API: {{topic}}",
          descriptionPrompt: "Comprehensive API testing",
          executionOrder: 3,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Write integration tests", executionOrder: 1 },
            { titleTemplate: "Test error scenarios", executionOrder: 2 },
            { titleTemplate: "Test edge cases and limits", executionOrder: 3 },
          ],
        },
        {
          titleTemplate: "Document API: {{topic}}",
          descriptionPrompt: "API documentation",
          executionOrder: 4,
          canParallelize: false,
          tasks: [
            { titleTemplate: "Add OpenAPI/Swagger documentation", executionOrder: 1 },
            { titleTemplate: "Create usage examples", executionOrder: 2 },
            { titleTemplate: "Update API changelog", executionOrder: 3 },
          ],
        },
      ],
    }),
  },
];

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
  // Built-in Plan Templates (COM-4)
  // Templates for common development workflows
  // =============================================================================
  for (const templateDef of BUILT_IN_TEMPLATES) {
    await prisma.planTemplate.upsert({
      where: { name: templateDef.name },
      update: {
        description: templateDef.description,
        structure: templateDef.structure,
      },
      create: {
        name: templateDef.name,
        description: templateDef.description,
        structure: templateDef.structure,
        isBuiltIn: true,
      },
    });
  }
  console.log(`✓ Built-in templates created: ${BUILT_IN_TEMPLATES.map(t => t.name).join(", ")}`);

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
