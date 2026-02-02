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

## Implementation Plan Templates

SpecTree supports reusable templates for creating standardized epic/feature/task structures. Templates use `{{variable}}` placeholders for customization.

**Key MCP tools:**
- `spectree__list_templates` - List available templates
- `spectree__preview_template` - Preview what will be created
- `spectree__create_from_template` - Create full hierarchy from template
- `spectree__save_as_template` - Save existing epic as template

**Built-in templates:** Code Feature, Bug Fix, Refactoring, API Endpoint

See `docs/MCP/templates.md` for full documentation.

## Structured Descriptions

Features and Tasks support rich, structured descriptions with AI-friendly sections for easier data extraction. Instead of parsing unstructured text, AI agents can directly access specific sections.

**Available sections:**
- `summary` (required) - Brief overview
- `aiInstructions` - Specific guidance for AI agents
- `acceptanceCriteria` - List of completion conditions
- `filesInvolved` - Relevant file paths
- `functionsToModify` - Functions/methods to change
- `testingStrategy` - How to test the implementation
- `testFiles` - Test file paths
- `relatedItemIds` - Links to related items
- `externalLinks` - URLs to docs/specs
- `technicalNotes` - Implementation constraints
- `riskLevel` - "low", "medium", "high"
- `estimatedEffort` - "trivial", "small", "medium", "large", "xl"

**Key MCP tools:**
- `spectree__get_structured_description` - Get parsed structured description
- `spectree__set_structured_description` - Replace entire structured description
- `spectree__update_section` - Update single section (recommended)
- `spectree__add_acceptance_criterion` - Append acceptance criterion
- `spectree__link_file` - Add file to filesInvolved
- `spectree__add_external_link` - Add external URL reference

See `docs/MCP/structured-descriptions.md` for full documentation.

## Code Context (Codebase Integration)

Link features and tasks directly to code artifacts for instant code context:

**MCP tools:**
- `spectree__link_code_file` - Link a source file
- `spectree__unlink_code_file` - Remove a file link
- `spectree__link_function` - Link a function (format: `filePath:functionName`)
- `spectree__link_branch` - Set git branch
- `spectree__link_commit` - Add commit SHA
- `spectree__link_pr` - Link pull request
- `spectree__get_code_context` - Get all code context

**Difference from Structured Descriptions:**
- Structured descriptions (`filesInvolved`) = files you *plan* to modify
- Code context (`relatedFiles`) = files you *actually* modified

See `docs/MCP/code-context.md` for full documentation.

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
