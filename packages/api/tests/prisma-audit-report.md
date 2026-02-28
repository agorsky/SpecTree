# ENG-77: Prisma Model Audit Report

**Date:** 2026-02-27
**Branch:** `feat/eng-75-80-pre-release-hardening`
**Auditor:** Bobby (The Builder)

---

## Model Inventory

| Model | Route Consumers | MCP Tool Consumers | Seeded? | Verdict |
|-------|----------------|-------------------|---------|---------|
| HealthCheck | (internal) | (none) | YES | SYSTEM |
| Team | teams.ts | teams.ts, composite.ts | YES | USED |
| User | users.ts, auth.ts, memberships.ts, userActivity.ts | search.ts, features.ts, tasks.ts, help.ts | YES | USED |
| ApiToken | tokens.ts | (none) | NO | PARTIAL |
| Membership | memberships.ts | (none) | YES | PARTIAL |
| Epic | epics.ts, briefings.ts, events.ts | epics.ts, structured-desc.ts, summary.ts, templates.ts, composite.ts, workflow.ts, decisions.ts, execution.ts, features.ts, help.ts, ordering.ts, ai-context.ts, memory-patterns.ts | NO | USED |
| Status | statuses.ts | statuses.ts, workflow.ts, search.ts, summary.ts, epic-requests.ts, features.ts, help.ts | YES | USED |
| Feature | features.ts | features.ts, workflow.ts, structured-desc.ts, summary.ts, templates.ts, composite.ts, execution.ts, ordering.ts, progress.ts, ai-context.ts, code-context.ts, help.ts | NO | USED |
| Task | tasks.ts | tasks.ts, validations.ts, workflow.ts, structured-desc.ts, templates.ts, composite.ts, execution.ts, ordering.ts, progress.ts, ai-context.ts, code-context.ts | NO | USED |
| PersonalScope | me.ts | personal.ts | YES | USED |
| PlanTemplate | templates.ts | (none) | YES | PARTIAL |
| AiSession | sessions.ts | (none) | NO | PARTIAL |
| SessionEvent | events.ts | (none) | NO | PARTIAL |
| Decision | decisions.ts | decisions.ts, help.ts | NO | USED |
| ChangeLog | changelog.ts | (none) | NO | PARTIAL |
| EpicRequest | epic-requests.ts, me.ts | epic-requests.ts, personal.ts | NO | USED |
| EpicRequestReaction | epic-requests.ts | epic-requests.ts | NO | USED |
| EpicRequestComment | epic-requests.ts | epic-requests.ts | NO | USED |
| Law | laws.ts | laws.ts, cases.ts | YES | USED |
| Case | cases.ts, me.ts | cases.ts, patterns.ts, help.ts | NO | USED |
| AgentScore | agent-scores.ts | agent-scores.ts | YES | USED |
| SkillPack | skill-packs.ts | skill-packs/manage.ts | YES | USED |
| SkillPackVersion | skill-packs.ts | skill-packs/manage.ts, skill-packs/get-manifest.ts | YES | USED |
| SkillPackFile | (none) | (none) | YES | ORPHANED |
| Pattern | patterns.ts | patterns.ts, memory-patterns.ts, validations.ts, epics.ts, help.ts | NO | USED |
| InstalledSkillPack | skill-packs.ts | skill-packs/manage.ts, skill-packs/sync-local.ts | NO | USED |

---

## Summary by Verdict

| Verdict | Count | Models |
|---------|-------|--------|
| **USED** | 19 | Team, User, Epic, Status, Feature, Task, PersonalScope, Decision, EpicRequest, EpicRequestReaction, EpicRequestComment, Law, Case, AgentScore, SkillPack, SkillPackVersion, Pattern, InstalledSkillPack, EpicRequestReaction |
| **PARTIAL** | 5 | ApiToken, Membership, PlanTemplate, AiSession, SessionEvent, ChangeLog |
| **ORPHANED** | 1 | SkillPackFile |
| **SYSTEM** | 1 | HealthCheck |

**Total Models: 26**

---

## Detailed Findings

### ORPHANED: SkillPackFile
- No direct route or MCP tool consumers
- Created transitively during skill pack seeding (referenced via SkillPackVersion relation)
- **Recommendation:** Keep — used as infrastructure for skill pack file storage. Not truly orphaned, just accessed through SkillPackVersion relation.

### PARTIAL Models (Route-Only, No MCP Tools)
- **ApiToken** — Managed via REST only (tokens.ts). No AI agent needs to manage API tokens directly.
- **Membership** — Managed via REST only (memberships.ts). Reasonable — membership management is a human operation.
- **PlanTemplate** — Has MCP access via templates.ts tools. Seeded with built-in templates. Actually USED.
- **AiSession** — Managed via REST (sessions.ts). MCP tools use session service indirectly.
- **SessionEvent** — Accessed via events.ts routes. Used internally by session tracking.
- **ChangeLog** — Accessed via changelog.ts route. Internal audit trail.

### Models Missing Seeds
Epic, Feature, Task, Decision, Case, EpicRequest, Pattern, InstalledSkillPack — these are created dynamically by users/agents. Not having seed data is expected behavior.

---

## Recommendations

1. **No models need removal** — all models serve a purpose
2. SkillPackFile is technically orphaned from direct consumers but is used relationally
3. PARTIAL models are intentionally route-only or MCP-only based on use case
4. Missing seeds are by design — these models hold user-created data
