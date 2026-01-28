# CLAUDE.md - AI Agent Instructions

This file contains critical instructions for AI agents working on this codebase.

---

## 🔴 DATABASE SAFETY - READ FIRST

This project has suffered multiple complete data loss incidents. Follow these rules strictly.

### Forbidden Commands

**NEVER run these commands - they DELETE ALL DATA:**

```bash
# ❌ FORBIDDEN - Will delete everything
npx prisma migrate reset
npx prisma migrate dev  
npx prisma db push --force-reset
```

### Safe Commands

```bash
# ✅ SAFE - Use these instead
npm run db:backup              # Always backup first
npm run db:migrate:safe        # Backs up then migrates
npx prisma db push             # Safe schema sync (no --force-reset!)
npx prisma generate            # Regenerate client (safe)
```

### Why This Matters

1. Tests previously wiped production because no separate test DB existed
2. `prisma migrate reset` was run during development, deleting all user data
3. Safeguards are now in place - DO NOT remove them

### Key Files

- `packages/api/vitest.config.ts` - Sets test DATABASE_URL (don't change!)
- `packages/api/tests/setup.ts` - Has safety check in cleanup (don't remove!)
- `docs/database-safety-guide.md` - Full documentation

---

## Project Overview

SpecTree is a project management tool similar to Linear, with:
- REST API (Fastify + Prisma + SQLite)
- Web frontend (React + Vite)
- MCP server for AI integration

## Before Making Changes

1. **Database changes**: Read `docs/database-safety-guide.md`
2. **Run tests**: `pnpm test` - ensure they pass
3. **Check types**: `pnpm typecheck`

## Testing

Tests use a **separate database** (`spectree-test.db`). This is intentional.
Do not modify `vitest.config.ts` to use the production database.
