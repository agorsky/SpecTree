# Copilot Instructions for SpecTree

SpecTree is a project management tool similar to Linear, with a REST API, React frontend, and MCP server for AI integration.

---

## 🚀 SESSION START CHECKLIST

**At the start of every coding session, Copilot MUST:**

1. **Check git status and branch state:**
   ```bash
   git fetch origin && git status
   ```

2. **If on `main`, remind user to create a feature branch before making changes**

3. **If on a feature/bugfix branch, check if it's behind main:**
   ```bash
   git log HEAD..origin/main --oneline
   ```
   - If commits exist, recommend: `git rebase origin/main`

4. **Before any code changes, confirm the branch is synced with remote**

**Prompt the user if:**
- Working directly on `main` (should create feature branch)
- Branch is more than 1 day old without sync
- About to commit without recent fetch

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

## AI Session Context

### Per-Item Context (Features/Tasks)

SpecTree provides dedicated AI context fields on Features and Tasks for cross-session continuity:

- `spectree__get_ai_context` - Read context from previous sessions
- `spectree__set_ai_context` - Set structured summary context  
- `spectree__append_ai_note` - Log observations, decisions, blockers, next-steps

See `docs/MCP/ai-session-context.md` for full documentation.

### Session Handoff (Epics)

For epic-level workflow continuity, use the Session Handoff System:

**At session start:**
```typescript
const { previousSession, epicProgress } = await spectree__start_session({
  epicId: "Epic Name or ID"
});
// Review previousSession.summary, nextSteps, blockers, decisions
```

**During work:** Work is automatically tracked when using `spectree__start_work` and `spectree__complete_work`.

**At session end:**
```typescript
await spectree__end_session({
  epicId: "Epic Name or ID",
  summary: "What was accomplished",
  nextSteps: ["Recommended next actions"],
  blockers: ["Any blockers encountered"],
  decisions: [{ decision: "Choice made", rationale: "Why" }]
});
```

See `docs/MCP/session-handoff.md` for full documentation.

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

---

## 🔴 CRITICAL: Git Workflow Safety

This project follows the **Git Release Flow** strategy. Full documentation: `docs/GIT/`

### Before Creating ANY Branch

**ALWAYS sync with remote first:**
```bash
git fetch origin
git checkout main
git pull origin main
```

**Then create your branch:**
```bash
git checkout -b feature/TICKET-123-description
```

### Branch Source Rules

| Work Type | Branch From | PR Target |
|-----------|-------------|-----------|
| New feature | `main` (freshly pulled) | `main` |
| Bug fix (dev) | `main` (freshly pulled) | `main` |
| Bug fix (QA/release) | `release/x.y` | `release/x.y` |
| Hotfix (production) | Recreate from tag | `release/x.y` |

### Before Opening a PR

**ALWAYS check for upstream changes:**
```bash
git fetch origin
git log HEAD..origin/main --oneline  # See what's new on main
```

**If main has advanced, rebase your feature branch:**
```bash
git rebase origin/main
# Resolve any conflicts
git push --force-with-lease  # Safe force push for your branch only
```

### Forbidden Actions

**NEVER:**
- Create a branch without fetching first
- Work on a branch for extended periods without syncing with main
- Force push to `main` or `release/*` branches
- Rebase shared branches or release branches after RC tags exist
- Cherry-pick as a primary strategy (use merge-forward)

### Long-Running Work Sessions

If working across multiple sessions or days:
```bash
# At start of each session
git fetch origin
git rebase origin/main  # Keep your branch current
```

### Forward-Port Requirement

Every fix on `release/*` **MUST** be forward-ported to `main` within 2 business days:
```bash
git checkout main
git pull origin main
git merge release/x.y
# Open PR for forward-port
```

### Quick Reference

- **Policy docs:** `docs/GIT/git-release-flow-strategy-final-with-definitions.md`
- **Cheat sheet:** `docs/GIT/git-release-flow-cheat-sheet.md`
- **PR template:** `docs/GIT/PULL_REQUEST_TEMPLATE.md`
