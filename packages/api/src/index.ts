import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "./lib/db.js";
import { registerErrorHandler } from "./middleware/errorHandler.js";
import { NotFoundError } from "./errors/index.js";
import { initializeJwtSecret } from "./utils/jwt.js";
import { getSecretsProvider } from "./lib/secrets/index.js";
import usersRoutes from "./routes/users.js";
import teamsRoutes from "./routes/teams.js";
import projectsRoutes from "./routes/projects.js";
import statusesRoutes from "./routes/statuses.js";
import { teamMembershipsRoutes, userTeamsRoutes } from "./routes/memberships.js";
import featuresRoutes from "./routes/features.js";
import tasksRoutes, { featureTasksRoutes } from "./routes/tasks.js";
import authRoutes from "./routes/auth.js";
import tokensRoutes from "./routes/tokens.js";
import meRoutes from "./routes/me.js";
import invitationRoutes from "./routes/admin/invitations.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST ?? "0.0.0.0";

async function main(): Promise<void> {
  // Initialize secrets provider and load secrets
  const secretsProvider = getSecretsProvider();
  console.log(`[startup] Secrets provider: ${secretsProvider.providerName}`);
  
  // Initialize JWT secret from secrets provider
  await initializeJwtSecret();

  const fastify = Fastify({
    logger: true,
  });

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  });
  await fastify.register(helmet);
  await fastify.register(compress);
  
  // Register rate limit plugin (allows per-route config via route.config.rateLimit)
  await fastify.register(rateLimit, {
    global: false, // Don't apply rate limiting globally, only to routes with explicit config
  });

  // Register error handler
  registerErrorHandler(fastify);

  // Register route plugins
  await fastify.register(usersRoutes, { prefix: "/api/v1/users" });
  await fastify.register(teamsRoutes, { prefix: "/api/v1/teams" });
  await fastify.register(projectsRoutes, { prefix: "/api/v1/projects" });
  await fastify.register(statusesRoutes, { prefix: "/api/v1/statuses" });
  await fastify.register(teamMembershipsRoutes, { prefix: "/api/v1/teams" });
  await fastify.register(userTeamsRoutes, { prefix: "/api/v1/users" });
  await fastify.register(featuresRoutes, { prefix: "/api/v1/features" });
  await fastify.register(featureTasksRoutes, { prefix: "/api/v1/features" });
  await fastify.register(tasksRoutes, { prefix: "/api/v1/tasks" });
  await fastify.register(authRoutes, { prefix: "/api/v1/auth" });
  await fastify.register(tokensRoutes, { prefix: "/api/v1/tokens" });
  await fastify.register(meRoutes, { prefix: "/api/v1/me" });
  await fastify.register(invitationRoutes, { prefix: "/api/v1/admin/invitations" });

  // Graceful shutdown - disconnect Prisma
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  // Health check endpoint
  fastify.get("/health", () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Database health check - verifies Prisma connection
  fastify.get("/health/db", async () => {
    try {
      await prisma.$queryRaw`SELECT 1 as result`;
      return { status: "ok", database: "connected" };
    } catch (error) {
      return { status: "error", database: "disconnected", error: String(error) };
    }
  });

  // API routes
  fastify.get("/api/v1/status", () => {
    return {
      name: "spectree-api",
      version: "0.1.0",
      environment: process.env.NODE_ENV ?? "development",
    };
  });

  // =============================================================================
  // HealthCheck CRUD endpoints - for testing Prisma with Azure SQL
  // =============================================================================

  // Create a health check record
  fastify.post<{ Body: { name: string; status: string } }>(
    "/api/v1/health-checks",
    async (request, reply) => {
      const { name, status } = request.body;
      const record = await prisma.healthCheck.create({
        data: { name, status },
      });
      return reply.status(201).send(record);
    }
  );

  // Read all health check records
  fastify.get("/api/v1/health-checks", async () => {
    return prisma.healthCheck.findMany({
      orderBy: { createdAt: "desc" },
    });
  });

  // Read a single health check record by ID
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/health-checks/:id",
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const record = await prisma.healthCheck.findUnique({
        where: { id },
      });
      if (!record) {
        throw new NotFoundError("Health check record not found", { id });
      }
      return record;
    }
  );

  // Update a health check record
  fastify.put<{ Params: { id: string }; Body: { name?: string; status?: string } }>(
    "/api/v1/health-checks/:id",
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const { name, status } = request.body;

      // Check if record exists first
      const existing = await prisma.healthCheck.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundError("Health check record not found", { id });
      }

      const record = await prisma.healthCheck.update({
        where: { id },
        data: { ...(name && { name }), ...(status && { status }) },
      });
      return record;
    }
  );

  // Delete a health check record
  fastify.delete<{ Params: { id: string } }>(
    "/api/v1/health-checks/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);

      // Check if record exists first
      const existing = await prisma.healthCheck.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundError("Health check record not found", { id });
      }

      await prisma.healthCheck.delete({
        where: { id },
      });
      return reply.status(204).send();
    }
  );

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server is running on http://${HOST}:${String(PORT)}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
