# Copilot Instructions for SpecTree

SpecTree is a project management tool similar to Linear, with a REST API, React frontend, and MCP server for AI integration.

---

## 🔴 CRITICAL: Database Safety

This project has experienced data loss from unsafe Prisma commands. Follow these rules strictly.

**NEVER run:**
- `npx prisma migrate reset` - Deletes all data
- `npx prisma migrate dev` - May require reset
- `npx prisma db push --force-reset` - Deletes all data

**ALWAYS:**
```bash
npm run db:backup              # Backup first
npm run db:migrate:safe        # Safe migration (backs up automatically)
npx prisma db push             # Schema sync without --force-reset
```

Tests use a separate database (`spectree-test.db`) configured in `packages/api/vitest.config.ts`. Do not modify this configuration.

---

## Build, Test, and Lint

```bash
# Full suite
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm typecheck        # TypeScript checking

# Single package
pnpm --filter @spectree/api test
pnpm --filter @spectree/web build

# Single test file (from packages/api)
cd packages/api
npx vitest run tests/services/featureService.test.ts

# Watch mode for a specific test
npx vitest tests/services/featureService.test.ts
```

---

## Architecture

### Monorepo Structure

```
packages/
├── api/      → Fastify REST API + Prisma ORM (SQLite)
├── web/      → React + Vite + Tailwind + Radix UI
├── mcp/      → MCP server (imports from api package)
└── shared/   → Shared TypeScript types (no dependencies)
```

Package dependencies: `shared` ← `api`, `web`, `mcp`; and `api` ← `mcp`

### API Layer Pattern

Routes → Services → Prisma. Each domain has:
- `src/routes/{domain}.ts` - Fastify route handlers with Zod validation
- `src/services/{domain}Service.ts` - Business logic and database access
- `src/schemas/{domain}.ts` - Zod schemas for request/response validation

### Error Handling

Use custom error classes from `src/errors/index.ts`:
- `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409)
- `UnauthorizedError` (401), `ForbiddenError` (403)

All extend `AppError` with `statusCode`, `code`, and optional `details`.

### Database

- Schema: `packages/api/prisma/schema.prisma`
- Data: `packages/api/prisma/data/spectree.db` (SQLite)
- Generated client: `packages/api/src/generated/prisma/`

---

## Key Conventions

### TypeScript
- Strict mode enabled; avoid `any`
- Use type-only imports: `import type { User } from "./types"`
- Files: kebab-case (`user-service.ts`), React components: PascalCase (`UserProfile.tsx`)

### Validation
- All API inputs validated with Zod schemas
- Common schemas in `src/schemas/common.ts` (pagination, date filters, UUID params)

### Frontend
- Functional components with hooks; prefer named exports
- Use `cn()` utility for conditional Tailwind classes
- State management: Zustand; data fetching: TanStack Query

### Testing
- Tests in `packages/api/tests/` mirror source structure
- Integration tests use factories from `tests/fixtures/factories.ts`
- Test setup handles separate test database automatically
