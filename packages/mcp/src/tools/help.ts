/**
 * MCP Help Tool
 *
 * Provides instructions and guidance for AI agents using SpecTree.
 * This tool helps agents understand available capabilities and best practices.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createResponse } from "./utils.js";

// Topic-specific help content
const helpTopics: Record<string, string> = {
  overview: `# SpecTree Overview

SpecTree is a project management tool similar to Linear. It organizes work into:

**Hierarchy:**
- Teams → Epics → Features → Tasks
- Personal Scope → Personal Projects → Features → Tasks

**Key Concepts:**
- **Epics** (or Projects): Containers for features, belong to a team or personal scope
- **Features**: Primary work items with identifiers like "COM-123"
- **Tasks**: Sub-items under features with identifiers like "COM-123-1"
- **Statuses**: Workflow states (Backlog, Todo, In Progress, Done, etc.)

**Best Practices:**
1. Start by listing epics to understand the workspace
2. Use search to find existing work before creating duplicates
3. Update status as you complete work
4. Use execution metadata to plan multi-step work`,

  execution: `# Execution Metadata for AI Agents

SpecTree supports execution metadata to help AI agents plan and execute work intelligently.

## Fields (on Features and Tasks)

| Field | Type | Description |
|-------|------|-------------|
| executionOrder | Integer | Suggested sequence (1, 2, 3...). Lower = work first |
| canParallelize | Boolean | Can run alongside other items |
| parallelGroup | String | Group ID for items that can run together |
| dependencies | UUID[] | Items that must complete first |
| estimatedComplexity | Enum | trivial (<1hr), simple (1-4hr), moderate (1-3d), complex (>3d) |

## Tools

- **spectree__get_execution_plan**: Get ordered phases for an epic
- **spectree__set_execution_metadata**: Set execution fields on a feature/task
- **spectree__mark_blocked**: Add a dependency
- **spectree__mark_unblocked**: Remove a dependency

## Recommended Workflow

1. **Before starting work**: Call \`spectree__get_execution_plan\` to understand ordering
2. **Respect dependencies**: Don't start items until their dependencies are complete
3. **Use parallel groups**: Group independent work that can run simultaneously
4. **Update complexity**: Refine estimates as you learn more
5. **Mark blockers**: As you discover blockers during implementation, record them

## Example

\`\`\`
// Get execution plan for an epic
spectree__get_execution_plan({ epicId: "Mobile App Redesign" })

// Returns phases like:
// Phase 1: Database Schema (must be done first)
// Phase 2: API Endpoints + Service Layer (can run in parallel)
// Phase 3: Frontend Integration (depends on Phase 2)
\`\`\``,

  search: `# Search Capabilities

The \`spectree__search\` tool provides powerful filtering:

## Parameters

| Parameter | Description | Examples |
|-----------|-------------|----------|
| query | Text search in title/description | "authentication", "login" |
| epic | Filter by epic name or ID | "Mobile App Redesign" |
| status | Filter by status name | "In Progress", "Done" |
| statusCategory | Filter by category | "started", "completed" |
| assignee | Filter by assignee | "me", "none", email |
| createdAt | Created after date/duration | "2024-01-01", "-P7D" |
| updatedAt | Updated after date/duration | "-P1D" (last day) |
| type | Item type | "feature", "task", "all" |

## Duration Format

- \`-P7D\` = last 7 days
- \`-P1M\` = last month
- \`-P1W\` = last week

## Examples

\`\`\`
// Find my in-progress features
spectree__search({ assignee: "me", statusCategory: "started", type: "feature" })

// Find auth-related work created this week
spectree__search({ query: "auth", createdAt: "-P7D" })

// Find unassigned tasks in an epic
spectree__search({ epic: "Q1 Features", assignee: "none", type: "task" })
\`\`\``,

  workflow: `# Recommended AI Agent Workflow

## Starting Work on an Epic

1. **Understand the work**
   \`\`\`
   spectree__get_epic({ query: "Epic Name" })
   spectree__get_execution_plan({ epicId: "Epic Name" })
   \`\`\`

2. **Check for blockers**
   - Review dependencies in execution plan
   - Ensure required items are complete

3. **Update status as you work**
   \`\`\`
   spectree__update_feature({ id: "COM-123", status: "In Progress" })
   \`\`\`

4. **Mark completion**
   \`\`\`
   spectree__update_feature({ id: "COM-123", status: "Done" })
   \`\`\`

## Creating Structured Work

When creating features with dependencies:

\`\`\`
// 1. Create the base feature first
spectree__create_feature({
  title: "Database Schema",
  epic: "My Epic",
  executionOrder: 1,
  estimatedComplexity: "simple"
})

// 2. Create dependent features with references
spectree__create_feature({
  title: "API Endpoints",
  epic: "My Epic",
  executionOrder: 2,
  dependencies: ["<uuid-of-database-feature>"],
  canParallelize: true,
  parallelGroup: "backend"
})
\`\`\`

## Best Practices

1. **Always check existing work first** - Use search before creating
2. **Use meaningful identifiers** - Epic and feature names should be clear
3. **Set complexity estimates** - Helps with planning
4. **Update statuses promptly** - Keep the system accurate
5. **Use tasks for sub-work** - Break features into smaller pieces`,

  personal: `# Personal Scope

Each user has a private personal scope for work not shared with any team.

## Tools

- **spectree__get_personal_scope**: Get or create personal scope
- **spectree__list_personal_projects**: List personal epics/projects
- **spectree__create_personal_project**: Create a personal project
- **spectree__list_personal_statuses**: List personal workflow statuses

## Usage

Personal projects work like team projects but are only visible to you.

\`\`\`
// Create a personal project
spectree__create_personal_project({
  name: "Side Project Ideas",
  description: "Personal tracking"
})

// List personal projects
spectree__list_personal_projects()
\`\`\``,
};

// Full instructions combining all topics
const fullInstructions = `# SpecTree AI Agent Instructions

${helpTopics.overview}

---

${helpTopics.execution}

---

${helpTopics.search}

---

${helpTopics.workflow}

---

${helpTopics.personal}

---

## Quick Reference - Common Tools

| Action | Tool |
|--------|------|
| List all epics | \`spectree__list_epics\` |
| Get execution plan | \`spectree__get_execution_plan\` |
| Search work items | \`spectree__search\` |
| Create feature | \`spectree__create_feature\` |
| Update feature | \`spectree__update_feature\` |
| Create task | \`spectree__create_task\` |
| Update task | \`spectree__update_task\` |
| Set execution metadata | \`spectree__set_execution_metadata\` |
| Mark blocked | \`spectree__mark_blocked\` |
`;

// Available topics for the schema
const topicValues = ["all", "overview", "execution", "search", "workflow", "personal"] as const;

export function registerHelpTools(server: McpServer): void {
  server.registerTool(
    "spectree__get_instructions",
    {
      description:
        "Get instructions and guidance for using SpecTree effectively. " +
        "Call this tool at the start of a session to understand available capabilities, " +
        "best practices, and recommended workflows. Topics include: overview, execution " +
        "(planning & dependencies), search (filtering), workflow (recommended patterns), " +
        "and personal (private workspace).",
      inputSchema: {
        topic: z
          .enum(topicValues)
          .default("all")
          .describe(
            "Which topic to get help on. Use 'all' for complete instructions, or choose " +
            "a specific topic: 'overview' (concepts), 'execution' (planning & dependencies), " +
            "'search' (filtering), 'workflow' (recommended patterns), 'personal' (private workspace)."
          ),
      },
    },
    async (input) => {
      const topic = input.topic || "all";

      if (topic === "all") {
        return createResponse({ instructions: fullInstructions });
      }

      const content = helpTopics[topic];
      if (!content) {
        return createResponse({
          error: `Unknown topic: ${topic}`,
          availableTopics: Object.keys(helpTopics),
        });
      }

      return createResponse({ topic, instructions: content });
    }
  );
}
