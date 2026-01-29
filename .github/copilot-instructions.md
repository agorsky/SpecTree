# Copilot Instructions for SpecTree

These instructions are automatically loaded by GitHub Copilot and AI coding agents.

---

## 🔴 CRITICAL: Database Safety Rules

**READ THIS FIRST**: This project has experienced multiple data loss incidents from unsafe database commands.

### NEVER Run These Commands

| Command | Why It's Dangerous |
|---------|-------------------|
| `npx prisma migrate reset` | **DELETES ALL DATA** |
| `npx prisma migrate dev` | May require reset, causing data loss |
| `npx prisma db push --force-reset` | **DELETES ALL DATA** |
| `npm run db:migrate` | Blocked - shows warning |

### ALWAYS Do This Instead

```bash
# 1. Create backup FIRST
npm run db:backup

# 2. Use safe migration (backs up automatically)
npm run db:migrate:safe

# 3. For schema changes without migrations (safe)
npx prisma db push
```

### Test vs Production Database

| Database | File | Purpose |
|----------|------|---------|
| Production | `spectree.db` | Real user data |
| Test | `spectree-test.db` | Test suite only |

**Tests automatically use the test database** via `vitest.config.ts`. Do NOT change this configuration.

### Before ANY Database Work

1. Run `npm run db:backup` to create a backup
2. Verify you're not modifying the test database configuration
3. Read `docs/database-safety-guide.md` for full details

---

## Project Structure

- `packages/api` - Fastify REST API with Prisma ORM
- `packages/web` - React frontend
- `packages/mcp` - MCP server for AI tool integration
- `packages/shared` - Shared types and utilities

## Common Commands

```bash
# Development
pnpm dev              # Start all packages in dev mode
pnpm build            # Build all packages
pnpm test             # Run all tests

# API-specific
cd packages/api
npm run dev           # Start API server
npm run test          # Run API tests
npm run db:studio     # Open Prisma Studio
npm run db:backup     # Backup database
```

## Code Conventions

- TypeScript strict mode
- ESLint + Prettier for formatting
- Vitest for testing
- Zod for validation schemas
