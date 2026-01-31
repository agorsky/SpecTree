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

---

## 🔴 GIT WORKFLOW SAFETY - READ FIRST

This project has experienced merge conflicts from working on stale branches. Follow Git Release Flow strictly.

### Before Creating ANY Branch

**ALWAYS sync first:**
```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b feature/TICKET-123-description
```

### Before Opening a PR

**ALWAYS check for upstream changes and rebase:**
```bash
git fetch origin
git rebase origin/main
# Resolve conflicts if any
```

### Forbidden Git Actions

- Creating branches without fetching first
- Working for extended periods without syncing with main  
- Force pushing to `main` or `release/*`
- Rebasing shared/release branches after RC tags

### Forward-Port Requirement

Every fix on `release/*` MUST be forward-ported to `main` within 2 business days.

### Full Documentation

- **Policy:** `docs/GIT/git-release-flow-strategy-final-with-definitions.md`
- **Cheat sheet:** `docs/GIT/git-release-flow-cheat-sheet.md`
