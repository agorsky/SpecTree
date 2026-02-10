---
applyTo:
  - "packages/api/**"
---
# API Review Rules

## Architecture Pattern

This package follows a strict **Routes → Services → Prisma** layering:
- `src/routes/{domain}.ts` — Fastify route handlers (HTTP concerns only)
- `src/services/{domain}Service.ts` — Business logic and database access
- `src/schemas/{domain}.ts` — Zod schemas for request/response validation

Route handlers should NOT contain business logic or direct Prisma calls. Flag violations.

## Route Handler Pattern

All route handlers must follow this structure:
```ts
fastify.post<{ Body: CreateInput }>(
  "/endpoint",
  { preHandler: [authenticate, validateBody(schema)] },
  async (request, reply) => { ... }
)
```

Required middleware for all non-public routes:
- `authenticate` — JWT/API token verification
- `validateBody(schema)` or `validateParams(schema)` — Zod validation

## Error Handling

- Use custom error classes from `src/errors/index.ts`: `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409), `UnauthorizedError` (401), `ForbiddenError` (403)
- All extend `AppError` with `statusCode`, `code`, and optional `details`
- Do NOT use raw `reply.status(xxx).send()` for error responses — throw the appropriate `AppError` subclass and let the centralized error handler format the response

## Auth & Authorization

- `authenticate` middleware verifies JWT Bearer tokens and API tokens (prefixed `st_`)
- `scopeAuth` handles personal/team scope access control with UUID validation
- `requireTeamAccess` and `requireRole` enforce role-based access
- Never bypass auth middleware — all routes handling user data must be authenticated

## Validation

- All API inputs must be validated with Zod schemas
- Common schemas (pagination, UUID params, date filters) are in `src/schemas/common.ts` — reuse them
- New schemas should compose with existing common schemas via `.merge()`

## TypeScript

- Strict mode is enabled — avoid `any`
- Use type-only imports: `import type { User } from "./types"`
- File naming: kebab-case (e.g., `user-service.ts`)
