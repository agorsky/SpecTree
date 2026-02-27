# Dispatcher AI Framework Packaging Strategy

## Purpose
This document explains how Dispatcher currently uses Copilot instructions, GitHub instructions, custom agents, and skills, and proposes the most effective way to package and share these assets across other projects.

---

## 1) Current State: How the AI Framework Actually Works

### 1.1 Layered architecture in this repository

Dispatcher currently uses four AI-configuration layers:

1. **Global Copilot instruction policy**  
   - File: `.github/copilot-instructions.md`
   - Role: global operating rules, workflow constraints, and Dispatcher MCP usage requirements.

2. **Path-scoped instruction packs**  
   - Files: `.github/instructions/*.instructions.md`
   - Role: domain-specific review/implementation rules based on file globs (`applyTo`).

3. **Custom agents**  
   - Files: `.github/agents/*.md`
   - Role: named execution roles invoked with `@agent-name` (planner, orchestrator, reviewer, etc.).

4. **Skills (procedural playbooks)**  
   - Files: `.github/skills/*/SKILL.md`
   - Role: reusable procedures/rubrics that agents can reference.

### 1.2 Runtime paths (important distinction)

There are **two different execution paths** in Dispatcher:

#### A) Direct Copilot agent invocation path
- Used by shell wrappers:
  - `scripts/dispatcher-plan.sh` -> `@planner`
  - `scripts/dispatcher-run.sh` -> `@orchestrator`
  - `scripts/dispatcher-validate.sh` -> `@reviewer`
- This path directly uses `.github/agents/*` and global instructions.

#### B) Orchestrator package ACP path
- Used by `packages/orchestrator` internals.
- Sessions are created with **internal system prompts** (`PLANNER_SYSTEM_PROMPT`, `AGENT_SYSTEM_PROMPT`, `buildAgentPrompt(...)`) rather than selecting custom agent names.
- ACP options support `agent?: string`, but the main orchestrator flow currently uses `systemMessage`.

**Implication:** packaging `.github/agents` helps path A immediately, but path B only benefits indirectly unless orchestrator is aligned to consume those agent definitions explicitly.

---

## 2) Inventory Snapshot (as of this analysis)

### 2.1 Actual assets present

- **Custom agents (6):**
  - `planner`
  - `orchestrator`
  - `feature-worker`
  - `reviewer`
  - `request-formulator`
  - `plan-reviewer`

- **Skills (4):**
  - `dispatcher-planning`
  - `dispatcher-session`
  - `dispatcher-validation`
  - `dispatcher-plan-review`

### 2.2 Drift and consistency findings

> **Status: All resolved** (2026-02-16). Items 1–4 were fixed; item 5 was intentionally kept.

1. **~~Count drift in top-level docs~~** ✅ FIXED
   - `.github/copilot-instructions.md` now correctly says *six custom agents* and *four skills*, and includes sections for `@plan-reviewer` agent and `dispatcher-plan-review` skill.

2. **~~Governance conflict in planner tool policy~~** ✅ FIXED
   - `.github/agents/planner.md` no longer includes `agent` in frontmatter tools, matching the policy in `.github/instructions/agents.instructions.md`.

3. **~~Outdated tool example in reviewer agent doc~~** ✅ FIXED
   - Reviewer examples now use the correct task-based signature (`taskId`) instead of the incorrect `type`/`id` parameters.

4. **~~Automation quickstart lagging current inventory~~** ✅ FIXED
   - `docs/guides/automation-quickstart.md` now lists all 6 agents and 4 skills.

5. **Deprecated instruction file intentionally retained**
   - `CLAUDE.md` remains in root as a deliberate redirect stub pointing to `.github/copilot-instructions.md`. This is an intentional design choice — it serves as a breadcrumb for any AI or developer that encounters it.

These were **governance and maintainability issues**, not runtime blockers.

---

## 3) How Each Layer Should Be Packaged for Reuse

### 3.1 What to treat as reusable productized assets

Package and version these as a cohesive "AI integration kit":

- `.github/copilot-instructions.md` (global policy)
- `.github/instructions/*.instructions.md` (path-scoped rules)
- `.github/agents/*.md` (execution roles)
- `.github/skills/*/SKILL.md` (procedures)
- wrapper scripts (`scripts/dispatcher-plan.sh`, `dispatcher-run.sh`, `dispatcher-validate.sh`) where helpful
- setup docs for MCP config + token/auth flow

### 3.2 What should remain project-local

Do **not** over-package project-specific content that will drift quickly:
- project-specific implementation details tightly tied to one repo
- repo-local migration/history notes
- hardcoded environment paths or personal auth assumptions

---

## 4) Repository Strategy: Single Repo vs Multiple Repos

### Option A - Single shared repo for everything

**Pros**
- Single discovery point
- One release/version stream
- Easy to onboard new teams quickly

**Cons**
- Harder ownership boundaries (core vs UI/UX vs domain teams)
- Higher risk of accidental coupling and noisy reviews
- One pipeline may block all domains

### Option B - Separate repos by domain (core, UI/UX, etc.)

**Pros**
- Strong team ownership and independent cadence
- Smaller, clearer code review surface per domain

**Cons**
- Harder discoverability for new users
- Version compatibility management becomes fragmented
- Higher overhead for governance/tooling duplication

### Option C (Recommended) - **Hybrid modular model**

Use a **single catalog repo** with modular packs, then split later only if needed:

- `pack-core-spec-tree` (required base pack)
- `pack-uiux` (optional extension)
- future domain packs (`pack-api`, `pack-data`, etc.)

This gives one place to discover/install while preserving domain ownership through CODEOWNERS and per-pack release tags.

---

## 5) Recommended Packaging Model for Your Team

### Recommendation summary
Start with **one shared "AI packs" repo**, but enforce strict modular boundaries:

- **Core pack** (Dispatcher MCP interaction, sessions, validations, execution lifecycle)
- **UI/UX extension pack** (owned by UI/UX engineer/team)
- Pack-level versioning and compatibility metadata
- Automated sync into consumer repos

This is the best near-term balance of:
- fast adoption,
- low governance overhead,
- clear ownership,
- and future split-readiness.

### Proposed pack layout (in the shared pack repo)

```text
ai-packs/
  packs/
    core/
      .github/
        copilot-instructions.md
        instructions/
        agents/
        skills/
      scripts/
      pack.json
    uiux/
      .github/
        instructions/
        agents/
        skills/
      pack.json
  tools/
    install-pack.sh
    verify-pack.sh
  compatibility/
    matrix.json
```

### `pack.json` minimum contract

Each pack should declare:
- `name`
- `version`
- `dependsOn` (e.g., `core >=1.2.0`)
- `compatibleDispatcherApi` (version range)
- `compatibleMcpToolset` (tool API baseline)
- `owners`

---

## 6) Distribution and Adoption Pattern (Consumer Repos)

### 6.1 Installation pattern

For each consuming project:
1. Install/sync `core` pack into `.github/*` paths.
2. Optionally install domain extension packs (e.g., UI/UX).
3. Run a validation script that checks:
   - required files exist,
   - agent names are unique,
   - tool signatures match current MCP schema,
   - policy constraints are satisfied.

### 6.2 Versioning pattern

- Semantic version per pack.
- Compatibility matrix maps pack versions <-> Dispatcher MCP/API versions.
- Consumer repos pin pack tags (do not track moving main branch).

### 6.3 Governance pattern

- CODEOWNERS by pack path (core vs UI/UX).
- Required CI checks:
  - schema/signature lint for agent examples,
  - docs consistency checks (counts, referenced assets exist),
  - policy checks (e.g., planner tool restrictions).

---

## 7) Immediate Improvements Recommended in Dispatcher Before Externalizing

> **Status: All resolved** (2026-02-16).

Before publishing these packs broadly, clean up drift in this repo first:

1. ~~Align declared counts with actual inventory (agents/skills).~~ ✅ Done
2. ~~Resolve planner-tool policy conflict (`agent` tool mismatch).~~ ✅ Done
3. ~~Update outdated reviewer validation example to current tool signature.~~ ✅ Done
4. ~~Refresh `automation-quickstart.md` inventory list.~~ ✅ Done
5. ~~Decide whether `CLAUDE.md` remains as a redirect stub or is removed.~~ ✅ Kept intentionally as redirect stub

---

## 8) Practical Answer to "Should we have one repo for everything?"

**Yes - start with one repo, but make it modular from day one.**

Use one shared "AI packs" repository with:
- a required **core** pack,
- optional **UI/UX** and other domain packs,
- strict compatibility/version metadata,
- and automated sync/validation into each project.

If UI/UX velocity or ownership pressure grows, you can split that pack into its own repo later without changing the consumer contract.

---

## 9) Evidence Used for This Analysis

- Deprecation redirect: `CLAUDE.md`
- Global policy and inventory text: `.github/copilot-instructions.md`
- Agent governance rules: `.github/instructions/agents.instructions.md`
- Actual agent definitions: `.github/agents/*.md`
- Skills inventory: `.github/skills/*/SKILL.md`
- Headless invocation path: `scripts/dispatcher-plan.sh`, `scripts/dispatcher-run.sh`, `scripts/dispatcher-validate.sh`
- ACP session behavior: `packages/orchestrator/src/orchestrator/*.ts`, `packages/orchestrator/src/acp/types.ts`
- Onboarding/quickstart references: `docs/guides/automation-quickstart.md`, `docs/guides/setup-guide.md`
