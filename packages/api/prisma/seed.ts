import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // =============================================================================
  // Health Checks (existing)
  // =============================================================================
  const healthChecks = await prisma.healthCheck.createMany({
    data: [
      { name: "API Server", status: "healthy" },
      { name: "Database Connection", status: "healthy" },
      { name: "Cache Layer", status: "healthy" },
    ],
    skipDuplicates: true,
  });
  console.log(`Created ${healthChecks.count} health check records`);

  // =============================================================================
  // Teams
  // =============================================================================
  console.log("Seeding teams...");

  const engineeringTeam = await prisma.team.upsert({
    where: { key: "ENG" },
    update: {},
    create: {
      name: "Engineering",
      key: "ENG",
      description: "Software engineering team responsible for building and maintaining the platform",
      icon: "code",
      color: "#2563eb",
      isArchived: false,
    },
  });
  console.log(`Upserted team: ${engineeringTeam.name}`);

  const productTeam = await prisma.team.upsert({
    where: { key: "PRD" },
    update: {},
    create: {
      name: "Product",
      key: "PRD",
      description: "Product management team focused on roadmap and feature prioritization",
      icon: "lightbulb",
      color: "#7c3aed",
      isArchived: false,
    },
  });
  console.log(`Upserted team: ${productTeam.name}`);

  // =============================================================================
  // Users
  // =============================================================================
  console.log("Seeding users...");

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@spectree.dev" },
    update: {},
    create: {
      email: "admin@spectree.dev",
      name: "Alex Chen",
      passwordHash: "hashed_password_placeholder",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
      isActive: true,
    },
  });
  console.log(`Upserted user: ${adminUser.name}`);

  const developerUser = await prisma.user.upsert({
    where: { email: "developer@spectree.dev" },
    update: {},
    create: {
      email: "developer@spectree.dev",
      name: "Jordan Smith",
      passwordHash: "hashed_password_placeholder",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=jordan",
      isActive: true,
    },
  });
  console.log(`Upserted user: ${developerUser.name}`);

  const guestUser = await prisma.user.upsert({
    where: { email: "guest@spectree.dev" },
    update: {},
    create: {
      email: "guest@spectree.dev",
      name: "Taylor Wong",
      passwordHash: "hashed_password_placeholder",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=taylor",
      isActive: true,
    },
  });
  console.log(`Upserted user: ${guestUser.name}`);

  // =============================================================================
  // Memberships
  // =============================================================================
  console.log("Seeding memberships...");

  // Admin user is admin of Engineering team
  await prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId: adminUser.id,
        teamId: engineeringTeam.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      teamId: engineeringTeam.id,
      role: "admin",
    },
  });

  // Admin user is member of Product team
  await prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId: adminUser.id,
        teamId: productTeam.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      teamId: productTeam.id,
      role: "member",
    },
  });

  // Developer user is member of Engineering team
  await prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId: developerUser.id,
        teamId: engineeringTeam.id,
      },
    },
    update: {},
    create: {
      userId: developerUser.id,
      teamId: engineeringTeam.id,
      role: "member",
    },
  });

  // Developer user is admin of Product team
  await prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId: developerUser.id,
        teamId: productTeam.id,
      },
    },
    update: {},
    create: {
      userId: developerUser.id,
      teamId: productTeam.id,
      role: "admin",
    },
  });

  // Guest user is guest of both teams
  await prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId: guestUser.id,
        teamId: engineeringTeam.id,
      },
    },
    update: {},
    create: {
      userId: guestUser.id,
      teamId: engineeringTeam.id,
      role: "guest",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_teamId: {
        userId: guestUser.id,
        teamId: productTeam.id,
      },
    },
    update: {},
    create: {
      userId: guestUser.id,
      teamId: productTeam.id,
      role: "guest",
    },
  });

  console.log("Memberships seeded");

  // =============================================================================
  // Statuses (5 per team, one for each category)
  // =============================================================================
  console.log("Seeding statuses...");

  const statusDefinitions = [
    { name: "Backlog", category: "backlog", color: "#6b7280", position: 0 },
    { name: "Todo", category: "unstarted", color: "#3b82f6", position: 1 },
    { name: "In Progress", category: "started", color: "#f59e0b", position: 2 },
    { name: "Done", category: "completed", color: "#10b981", position: 3 },
    { name: "Canceled", category: "canceled", color: "#ef4444", position: 4 },
  ];

  const engineeringStatuses: Record<string, { id: string }> = {};
  const productStatuses: Record<string, { id: string }> = {};

  for (const statusDef of statusDefinitions) {
    const engStatus = await prisma.status.upsert({
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
    engineeringStatuses[statusDef.category] = engStatus;

    const prdStatus = await prisma.status.upsert({
      where: {
        teamId_name: {
          teamId: productTeam.id,
          name: statusDef.name,
        },
      },
      update: {},
      create: {
        teamId: productTeam.id,
        name: statusDef.name,
        category: statusDef.category,
        color: statusDef.color,
        position: statusDef.position,
      },
    });
    productStatuses[statusDef.category] = prdStatus;
  }

  console.log("Statuses seeded for both teams");

  // =============================================================================
  // Projects (2 per team)
  // =============================================================================
  console.log("Seeding projects...");

  // Engineering Projects
  const apiProject = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      teamId: engineeringTeam.id,
      name: "API Development",
      description: "Backend API development including REST endpoints, authentication, and database integration",
      icon: "server",
      color: "#2563eb",
      sortOrder: 1,
      isArchived: false,
    },
  });
  console.log(`Upserted project: ${apiProject.name}`);

  const frontendProject = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      teamId: engineeringTeam.id,
      name: "Frontend Application",
      description: "React-based frontend application with modern UI/UX design patterns",
      icon: "layout",
      color: "#06b6d4",
      sortOrder: 2,
      isArchived: false,
    },
  });
  console.log(`Upserted project: ${frontendProject.name}`);

  // Product Projects
  const roadmapProject = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000003",
      teamId: productTeam.id,
      name: "Product Roadmap Q1",
      description: "Q1 2024 product roadmap planning and feature prioritization",
      icon: "map",
      color: "#7c3aed",
      sortOrder: 1,
      isArchived: false,
    },
  });
  console.log(`Upserted project: ${roadmapProject.name}`);

  const userResearchProject = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000004" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000004",
      teamId: productTeam.id,
      name: "User Research",
      description: "User interviews, surveys, and usability testing initiatives",
      icon: "users",
      color: "#ec4899",
      sortOrder: 2,
      isArchived: false,
    },
  });
  console.log(`Upserted project: ${userResearchProject.name}`);

  // =============================================================================
  // Features (3-5 per project)
  // =============================================================================
  console.log("Seeding features...");

  // API Project Features
  const apiFeatures = [
    {
      identifier: "ENG-1",
      title: "Implement user authentication",
      description: "Build JWT-based authentication system with login, logout, and token refresh endpoints",
      statusId: engineeringStatuses["completed"].id,
      assigneeId: adminUser.id,
      sortOrder: 1,
    },
    {
      identifier: "ENG-2",
      title: "Create team management endpoints",
      description: "REST API endpoints for CRUD operations on teams including membership management",
      statusId: engineeringStatuses["started"].id,
      assigneeId: developerUser.id,
      sortOrder: 2,
    },
    {
      identifier: "ENG-3",
      title: "Add project and feature APIs",
      description: "Implement endpoints for projects and features with proper authorization checks",
      statusId: engineeringStatuses["unstarted"].id,
      assigneeId: developerUser.id,
      sortOrder: 3,
    },
    {
      identifier: "ENG-4",
      title: "Set up database migrations",
      description: "Configure Prisma migrations for SQL Server with proper indexing strategy",
      statusId: engineeringStatuses["completed"].id,
      assigneeId: adminUser.id,
      sortOrder: 4,
    },
  ];

  for (const featureData of apiFeatures) {
    await prisma.feature.upsert({
      where: { identifier: featureData.identifier },
      update: {},
      create: {
        projectId: apiProject.id,
        ...featureData,
      },
    });
  }

  // Frontend Project Features
  const frontendFeatures = [
    {
      identifier: "ENG-5",
      title: "Build login and registration pages",
      description: "Create responsive login and registration forms with validation and error handling",
      statusId: engineeringStatuses["completed"].id,
      assigneeId: developerUser.id,
      sortOrder: 1,
    },
    {
      identifier: "ENG-6",
      title: "Implement dashboard layout",
      description: "Build main dashboard with sidebar navigation and responsive design",
      statusId: engineeringStatuses["started"].id,
      assigneeId: developerUser.id,
      sortOrder: 2,
    },
    {
      identifier: "ENG-7",
      title: "Create kanban board component",
      description: "Drag-and-drop kanban board for feature management with status columns",
      statusId: engineeringStatuses["backlog"].id,
      assigneeId: null,
      sortOrder: 3,
    },
    {
      identifier: "ENG-8",
      title: "Add team settings page",
      description: "Team configuration page for managing members, statuses, and preferences",
      statusId: engineeringStatuses["backlog"].id,
      assigneeId: null,
      sortOrder: 4,
    },
    {
      identifier: "ENG-9",
      title: "Implement dark mode support",
      description: "Add dark mode theme with system preference detection and manual toggle",
      statusId: engineeringStatuses["unstarted"].id,
      assigneeId: adminUser.id,
      sortOrder: 5,
    },
  ];

  for (const featureData of frontendFeatures) {
    await prisma.feature.upsert({
      where: { identifier: featureData.identifier },
      update: {},
      create: {
        projectId: frontendProject.id,
        ...featureData,
      },
    });
  }

  // Roadmap Project Features
  const roadmapFeatures = [
    {
      identifier: "PRD-1",
      title: "Define Q1 OKRs",
      description: "Establish quarterly objectives and key results aligned with company goals",
      statusId: productStatuses["completed"].id,
      assigneeId: developerUser.id,
      sortOrder: 1,
    },
    {
      identifier: "PRD-2",
      title: "Prioritize feature backlog",
      description: "Review and prioritize feature requests using RICE scoring framework",
      statusId: productStatuses["started"].id,
      assigneeId: developerUser.id,
      sortOrder: 2,
    },
    {
      identifier: "PRD-3",
      title: "Create release timeline",
      description: "Plan release schedule with milestones and dependencies mapped out",
      statusId: productStatuses["unstarted"].id,
      assigneeId: adminUser.id,
      sortOrder: 3,
    },
  ];

  for (const featureData of roadmapFeatures) {
    await prisma.feature.upsert({
      where: { identifier: featureData.identifier },
      update: {},
      create: {
        projectId: roadmapProject.id,
        ...featureData,
      },
    });
  }

  // User Research Project Features
  const researchFeatures = [
    {
      identifier: "PRD-4",
      title: "Conduct user interviews",
      description: "Schedule and conduct 10 user interviews to understand pain points and needs",
      statusId: productStatuses["started"].id,
      assigneeId: guestUser.id,
      sortOrder: 1,
    },
    {
      identifier: "PRD-5",
      title: "Design usability test scenarios",
      description: "Create test scenarios for key user flows in the application",
      statusId: productStatuses["unstarted"].id,
      assigneeId: developerUser.id,
      sortOrder: 2,
    },
    {
      identifier: "PRD-6",
      title: "Analyze competitor products",
      description: "Research and document competitor features, pricing, and user experience",
      statusId: productStatuses["backlog"].id,
      assigneeId: null,
      sortOrder: 3,
    },
    {
      identifier: "PRD-7",
      title: "Create user personas",
      description: "Develop detailed user personas based on research findings",
      statusId: productStatuses["backlog"].id,
      assigneeId: null,
      sortOrder: 4,
    },
  ];

  for (const featureData of researchFeatures) {
    await prisma.feature.upsert({
      where: { identifier: featureData.identifier },
      update: {},
      create: {
        projectId: userResearchProject.id,
        ...featureData,
      },
    });
  }

  console.log("Features seeded");

  // =============================================================================
  // Tasks (2-3 per feature)
  // =============================================================================
  console.log("Seeding tasks...");

  // Get features for task assignment
  const eng1 = await prisma.feature.findUnique({ where: { identifier: "ENG-1" } });
  const eng2 = await prisma.feature.findUnique({ where: { identifier: "ENG-2" } });
  const eng5 = await prisma.feature.findUnique({ where: { identifier: "ENG-5" } });
  const eng6 = await prisma.feature.findUnique({ where: { identifier: "ENG-6" } });
  const prd1 = await prisma.feature.findUnique({ where: { identifier: "PRD-1" } });
  const prd2 = await prisma.feature.findUnique({ where: { identifier: "PRD-2" } });
  const prd4 = await prisma.feature.findUnique({ where: { identifier: "PRD-4" } });

  // Tasks for ENG-1 (User authentication)
  if (eng1) {
    const eng1Tasks = [
      {
        identifier: "ENG-1-1",
        title: "Set up JWT token generation",
        description: "Implement JWT token creation with proper claims and expiration",
        statusId: engineeringStatuses["completed"].id,
        assigneeId: adminUser.id,
        sortOrder: 1,
      },
      {
        identifier: "ENG-1-2",
        title: "Create login endpoint",
        description: "POST /auth/login endpoint with email/password validation",
        statusId: engineeringStatuses["completed"].id,
        assigneeId: adminUser.id,
        sortOrder: 2,
      },
      {
        identifier: "ENG-1-3",
        title: "Add token refresh mechanism",
        description: "Implement refresh token rotation for extended sessions",
        statusId: engineeringStatuses["completed"].id,
        assigneeId: adminUser.id,
        sortOrder: 3,
      },
    ];

    for (const taskData of eng1Tasks) {
      await prisma.task.upsert({
        where: { identifier: taskData.identifier },
        update: {},
        create: {
          featureId: eng1.id,
          ...taskData,
        },
      });
    }
  }

  // Tasks for ENG-2 (Team management)
  if (eng2) {
    const eng2Tasks = [
      {
        identifier: "ENG-2-1",
        title: "Create team CRUD endpoints",
        description: "Implement GET, POST, PUT, DELETE for teams",
        statusId: engineeringStatuses["completed"].id,
        assigneeId: developerUser.id,
        sortOrder: 1,
      },
      {
        identifier: "ENG-2-2",
        title: "Add membership management",
        description: "Endpoints for adding/removing team members and changing roles",
        statusId: engineeringStatuses["started"].id,
        assigneeId: developerUser.id,
        sortOrder: 2,
      },
    ];

    for (const taskData of eng2Tasks) {
      await prisma.task.upsert({
        where: { identifier: taskData.identifier },
        update: {},
        create: {
          featureId: eng2.id,
          ...taskData,
        },
      });
    }
  }

  // Tasks for ENG-5 (Login pages)
  if (eng5) {
    const eng5Tasks = [
      {
        identifier: "ENG-5-1",
        title: "Design login form UI",
        description: "Create responsive login form with proper styling",
        statusId: engineeringStatuses["completed"].id,
        assigneeId: developerUser.id,
        sortOrder: 1,
      },
      {
        identifier: "ENG-5-2",
        title: "Add form validation",
        description: "Client-side validation for email format and password requirements",
        statusId: engineeringStatuses["completed"].id,
        assigneeId: developerUser.id,
        sortOrder: 2,
      },
      {
        identifier: "ENG-5-3",
        title: "Implement error handling",
        description: "Display API errors and network issues gracefully",
        statusId: engineeringStatuses["completed"].id,
        assigneeId: developerUser.id,
        sortOrder: 3,
      },
    ];

    for (const taskData of eng5Tasks) {
      await prisma.task.upsert({
        where: { identifier: taskData.identifier },
        update: {},
        create: {
          featureId: eng5.id,
          ...taskData,
        },
      });
    }
  }

  // Tasks for ENG-6 (Dashboard layout)
  if (eng6) {
    const eng6Tasks = [
      {
        identifier: "ENG-6-1",
        title: "Build sidebar navigation",
        description: "Collapsible sidebar with team and project navigation",
        statusId: engineeringStatuses["completed"].id,
        assigneeId: developerUser.id,
        sortOrder: 1,
      },
      {
        identifier: "ENG-6-2",
        title: "Create header component",
        description: "Top header with search, notifications, and user menu",
        statusId: engineeringStatuses["started"].id,
        assigneeId: developerUser.id,
        sortOrder: 2,
      },
      {
        identifier: "ENG-6-3",
        title: "Add responsive breakpoints",
        description: "Mobile and tablet responsive layouts",
        statusId: engineeringStatuses["unstarted"].id,
        assigneeId: null,
        sortOrder: 3,
      },
    ];

    for (const taskData of eng6Tasks) {
      await prisma.task.upsert({
        where: { identifier: taskData.identifier },
        update: {},
        create: {
          featureId: eng6.id,
          ...taskData,
        },
      });
    }
  }

  // Tasks for PRD-1 (Q1 OKRs)
  if (prd1) {
    const prd1Tasks = [
      {
        identifier: "PRD-1-1",
        title: "Draft initial objectives",
        description: "Create first draft of Q1 objectives based on company strategy",
        statusId: productStatuses["completed"].id,
        assigneeId: developerUser.id,
        sortOrder: 1,
      },
      {
        identifier: "PRD-1-2",
        title: "Define key results metrics",
        description: "Establish measurable KRs for each objective",
        statusId: productStatuses["completed"].id,
        assigneeId: developerUser.id,
        sortOrder: 2,
      },
    ];

    for (const taskData of prd1Tasks) {
      await prisma.task.upsert({
        where: { identifier: taskData.identifier },
        update: {},
        create: {
          featureId: prd1.id,
          ...taskData,
        },
      });
    }
  }

  // Tasks for PRD-2 (Feature backlog)
  if (prd2) {
    const prd2Tasks = [
      {
        identifier: "PRD-2-1",
        title: "Gather feature requests",
        description: "Collect and consolidate feature requests from all channels",
        statusId: productStatuses["completed"].id,
        assigneeId: developerUser.id,
        sortOrder: 1,
      },
      {
        identifier: "PRD-2-2",
        title: "Apply RICE scoring",
        description: "Score each feature using Reach, Impact, Confidence, Effort",
        statusId: productStatuses["started"].id,
        assigneeId: developerUser.id,
        sortOrder: 2,
      },
      {
        identifier: "PRD-2-3",
        title: "Create prioritized list",
        description: "Generate final prioritized backlog document",
        statusId: productStatuses["unstarted"].id,
        assigneeId: adminUser.id,
        sortOrder: 3,
      },
    ];

    for (const taskData of prd2Tasks) {
      await prisma.task.upsert({
        where: { identifier: taskData.identifier },
        update: {},
        create: {
          featureId: prd2.id,
          ...taskData,
        },
      });
    }
  }

  // Tasks for PRD-4 (User interviews)
  if (prd4) {
    const prd4Tasks = [
      {
        identifier: "PRD-4-1",
        title: "Prepare interview script",
        description: "Create standardized questions and discussion guide",
        statusId: productStatuses["completed"].id,
        assigneeId: guestUser.id,
        sortOrder: 1,
      },
      {
        identifier: "PRD-4-2",
        title: "Schedule interview sessions",
        description: "Recruit participants and book interview slots",
        statusId: productStatuses["started"].id,
        assigneeId: guestUser.id,
        sortOrder: 2,
      },
    ];

    for (const taskData of prd4Tasks) {
      await prisma.task.upsert({
        where: { identifier: taskData.identifier },
        update: {},
        create: {
          featureId: prd4.id,
          ...taskData,
        },
      });
    }
  }

  console.log("Tasks seeded");

  // =============================================================================
  // Summary
  // =============================================================================
  const teamCount = await prisma.team.count();
  const userCount = await prisma.user.count();
  const membershipCount = await prisma.membership.count();
  const statusCount = await prisma.status.count();
  const projectCount = await prisma.project.count();
  const featureCount = await prisma.feature.count();
  const taskCount = await prisma.task.count();

  console.log("\n=== Seed Summary ===");
  console.log(`Teams: ${teamCount}`);
  console.log(`Users: ${userCount}`);
  console.log(`Memberships: ${membershipCount}`);
  console.log(`Statuses: ${statusCount}`);
  console.log(`Projects: ${projectCount}`);
  console.log(`Features: ${featureCount}`);
  console.log(`Tasks: ${taskCount}`);
  console.log("====================\n");

  console.log("Database seeding completed successfully!");
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
