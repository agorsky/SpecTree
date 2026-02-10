---
applyTo:
  - "**/prisma/**"
  - "**/migrations/**"
  - "**/*migration*"
  - "**/*schema*prisma*"
---
# Database Review Rules

## 🔴 Forbidden Commands

Flag as **blocking** if any of these appear in code, scripts, or comments suggesting their use:
- `prisma migrate reset` — deletes all data
- `prisma migrate dev` — may require destructive reset
- `prisma db push --force-reset` — deletes all data

The safe alternative is `npx prisma db push` (without `--force-reset`).

## Schema Conventions

- **SQL Server fields:** All JSON and long-text `String` fields MUST use `@db.NVarChar(Max)`. Prisma defaults to `nvarchar(1000)` which silently truncates data. Check for fields like `aiContext`, `structuredDesc`, `description`, `context`, `handoffData`.
- **UUIDs:** Primary keys use `@id @default(uuid())`
- **Timestamps:** Always include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
- **Field mapping:** Use `@map("snake_case")` for database column names
- **Indexes:** Foreign key fields must have `@@index` declarations
- **Unique constraints:** Use `@@unique` for composite uniqueness (e.g., `@@unique([userId, teamId])`)

## Multi-Provider Awareness

This project supports both SQLite (development) and SQL Server (production):
- SQLite has no native enums — use string fields with application-level validation
- SQL Server requires `onDelete: NoAction` on cyclic/self-referencing cascades
- Schema differences are documented in `packages/api/prisma/schema.sqlserver.prisma`

## Testing Safety

- Tests use a separate database (`spectree-test.db`) configured in `packages/api/vitest.config.ts`
- Never run API tests from the project root — the root `vitest.config.ts` does NOT set `DATABASE_URL` to the test database
- Always run tests via `pnpm --filter api test` or from `packages/api/`
