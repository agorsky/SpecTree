---
applyTo:
  - ".github/agents/**"
  - ".github/copilot-instructions.md"
  - ".github/instructions/**"
  - ".github/skills/**"
---
# Agent & Instructions Review Rules

## Agent Frontmatter Format

Agent files use YAML frontmatter with these fields:
```yaml
---
name: Agent Display Name
description: "What the agent does"
tools: ['read', 'search', 'spectree/*']  # Tool allowlist
agents: ['sub-agent-name']               # Sub-agents it can spawn
user-invokable: true                     # Whether user can invoke directly
---
```

## Tool Access Rules

- MCP tools require explicit `server-name/*` syntax (e.g., `spectree/*`)
- Omitting `tools` grants access to ALL tools — always set explicitly
- The `planner` agent must NEVER have `agent` in its tools list — it must not spawn sub-agents (especially the orchestrator)
- The `feature-worker` must have `user-invokable: false` — it's only spawned by the orchestrator

## Critical Policy Rules

These rules MUST be present and enforced in `copilot-instructions.md`:
- 🔴 Database safety: NEVER `prisma migrate reset`, `prisma migrate dev`, `db push --force-reset`
- 🔴 Epic descriptions must be rich markdown (Overview, Problem Statement, Goals, Approach, Execution Plan, Technical Considerations)
- 🔴 Structured descriptions required for ALL features and ALL tasks
- 🔴 Templates must be used for epic creation
- 🔴 Epic execution summary must be appended after completion

## Instruction File Format

Path-scoped instruction files (`.github/instructions/*.instructions.md`) must have:
- YAML frontmatter with `applyTo` glob patterns
- Clear section headers for rule categories
- Actionable rules (not vague guidance)
- Code examples where patterns are non-obvious
