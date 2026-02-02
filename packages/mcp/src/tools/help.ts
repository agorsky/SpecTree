/**
 * MCP Help Tool
 *
 * Provides instructions and guidance for AI agents using SpecTree.
 * This tool helps agents understand available capabilities and best practices.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createResponse } from "./utils.js";

// Available topics for the schema
const topicValues = ["all", "overview", "execution", "progress", "search", "workflow", "personal", "templates", "sessions", "structured", "codeContext"] as const;
type TopicKey = Exclude<typeof topicValues[number], "all">;

// Topic-specific help content
const helpTopics: Record<TopicKey, string> = {
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

3. **Start work (use progress tools!)**
   \`\`\`
   spectree__start_work({ id: "COM-123", type: "feature" })
   \`\`\`

4. **Log progress for long tasks**
   \`\`\`
   spectree__log_progress({ id: "COM-123", type: "feature", message: "50% complete", percentComplete: 50 })
   \`\`\`

5. **Mark completion**
   \`\`\`
   spectree__complete_work({ id: "COM-123", type: "feature", summary: "Implemented feature X" })
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
2. **Use progress tools** - \`start_work\`, \`complete_work\` instead of manual status updates
3. **Set complexity estimates** - Helps with planning
4. **Log progress on long tasks** - Helps future sessions understand state
5. **Use tasks for sub-work** - Break features into smaller pieces
6. **Use session handoff** - Start/end sessions to preserve context for successor AI sessions`,

  sessions: `# Session Handoff System

The Session Handoff System enables AI sessions to preserve context for successor sessions at the epic level. This solves the problem of context loss between AI conversations.

## Why Use Sessions?

When an AI session ends, valuable context is typically lost:
- What was accomplished
- What was tried but didn't work
- What should be done next
- Decisions made and their rationale

Session Handoff preserves this information for the next session.

## Tools

| Tool | Purpose |
|------|---------|
| \`spectree__start_session\` | Start session, get previous handoff |
| \`spectree__end_session\` | End session with handoff data |
| \`spectree__get_last_session\` | Read previous session without starting new |
| \`spectree__get_session_history\` | View all sessions for an epic |
| \`spectree__get_active_session\` | Check if session is active |
| \`spectree__log_session_work\` | Manually log work (usually automatic) |

## Recommended Workflow

### At Session Start

\`\`\`
// Always start a session when beginning work on an epic
const result = spectree__start_session({ 
  epicId: "Epic Name or UUID" 
})

// Review previous session context
if (result.previousSession) {
  // Read: summary, nextSteps, blockers, decisions
  console.log(result.previousSession.summary)
  console.log(result.previousSession.nextSteps)
}

// Check epic progress
console.log(result.epicProgress)  // totalFeatures, completedFeatures, etc.
\`\`\`

### During Work

Work is **automatically tracked** when you use progress tools:
- \`spectree__start_work\` → logs "started" action to session
- \`spectree__complete_work\` → logs "completed" action to session

No manual logging needed for normal work!

### At Session End

\`\`\`
// Always end your session with handoff data
spectree__end_session({
  epicId: "Epic Name",
  summary: "Completed login feature, started on profile page",
  nextSteps: [
    "Finish profile page header",
    "Add error handling for API calls"
  ],
  blockers: [
    "API endpoint for profile update not deployed"
  ],
  decisions: [
    {
      decision: "Use React Query for data fetching",
      rationale: "Better caching and automatic refetch"
    }
  ]
})
\`\`\`

## Handoff Data Guidelines

**Summary:** Be specific about what was done, mention code changes, note current state.

**Next Steps:** Be actionable, prioritize important items, include dependencies.

**Blockers:** Document what's preventing progress and what's needed to unblock.

**Decisions:** Record significant choices with rationale for future context.

## Best Practice

**Always start and end sessions** when working on SpecTree epics:
1. Call \`spectree__start_session\` at the start of your work
2. Review the previous session's handoff data
3. Do your work (automatically tracked)
4. Call \`spectree__end_session\` before finishing with good handoff data

This ensures every AI session benefits from the work of previous sessions.`,

  progress: `# Progress Tracking Tools

SpecTree provides purpose-built tools for automatic progress tracking that make status updates natural.

## Tools

| Tool | Purpose |
|------|---------|
| \`spectree__start_work\` | Begin work - sets "In Progress", records start time |
| \`spectree__complete_work\` | Finish work - sets "Done", calculates duration |
| \`spectree__log_progress\` | Log incremental progress without status change |
| \`spectree__report_blocker\` | Report blockers with reason |

## Recommended Workflow

\`\`\`
// 1. When starting a task
spectree__start_work({ id: "COM-123", type: "feature" })

// 2. For long-running work, log progress
spectree__log_progress({ 
  id: "COM-123", 
  type: "feature", 
  message: "Database schema complete, starting API endpoints",
  percentComplete: 50 
})

// 3. If blocked
spectree__report_blocker({ 
  id: "COM-123", 
  type: "feature", 
  reason: "Waiting for API credentials" 
})

// 4. When done
spectree__complete_work({ 
  id: "COM-123", 
  type: "feature", 
  summary: "Implemented full authentication flow" 
})
\`\`\`

## Benefits

- **Automatic timestamps**: Start/end times recorded automatically
- **Duration tracking**: Work duration calculated in minutes
- **AI notes integration**: Progress events logged to AI notes for cross-session context
- **Status management**: Status changes handled automatically

## Best Practice

**Always use progress tools instead of manual status updates:**
- Use \`spectree__start_work\` instead of \`spectree__update_feature({ status: "In Progress" })\`
- Use \`spectree__complete_work\` instead of \`spectree__update_feature({ status: "Done" })\`

This ensures timing data is captured and progress is logged for future sessions.`,

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

  templates: `# Implementation Plan Templates

Templates provide reusable structures for creating standardized epic/feature/task hierarchies. Use templates to quickly scaffold common workflows.

## Built-in Templates

| Template | Use Case | Variables |
|----------|----------|-----------|
| **Code Feature** | Standard feature development | \`{{featureName}}\` |
| **Bug Fix** | Bug investigation and resolution | \`{{bugTitle}}\`, \`{{component}}\` |
| **Refactoring** | Code refactoring workflow | \`{{refactoringTarget}}\` |
| **API Endpoint** | New API endpoint development | \`{{endpointName}}\`, \`{{resource}}\` |

## Tools

| Tool | Purpose |
|------|---------|
| \`spectree__list_templates\` | List all available templates |
| \`spectree__get_template\` | Get template details and required variables |
| \`spectree__preview_template\` | Preview what will be created (without creating) |
| \`spectree__create_from_template\` | Create full epic/features/tasks from template |
| \`spectree__save_as_template\` | Save existing epic structure as reusable template |

## Variable Substitution

Templates use \`{{variableName}}\` placeholders:

\`\`\`
Template title: "Implement {{featureName}} for {{moduleName}}"
Variables: { featureName: "OAuth", moduleName: "auth" }
Result: "Implement OAuth for auth"
\`\`\`

## Recommended Workflow

### Using an Existing Template

\`\`\`
// 1. List available templates
spectree__list_templates()

// 2. Preview what will be created
spectree__preview_template({
  templateName: "Code Feature",
  epicName: "User Authentication",
  variables: { featureName: "OAuth Login" }
})

// 3. Create the work items
spectree__create_from_template({
  templateName: "Code Feature",
  epicName: "User Authentication",
  team: "Backend",
  variables: { featureName: "OAuth Login" }
})
\`\`\`

### Saving a Successful Pattern

\`\`\`
// Save an epic's structure as a template for future use
spectree__save_as_template({
  epicId: "epic-uuid",
  templateName: "My Team's Workflow",
  description: "Standard workflow we use for API features"
})
\`\`\`

## Best Practices

1. **Preview first**: Always preview before creating to verify variable substitution
2. **Provide all variables**: Missing variables appear as \`{{variableName}}\` in output
3. **Save successful patterns**: When a workflow works well, save it as a template
4. **Use for consistency**: Templates ensure teams follow standard processes`,

  structured: `# Structured Descriptions

Features and Tasks support rich, structured descriptions with AI-friendly sections that enable direct data extraction without parsing unstructured text.

## Why Use Structured Descriptions?

Instead of parsing freeform text to find requirements or file references, AI agents can:
- Directly access specific sections (e.g., \`acceptanceCriteria\`, \`filesInvolved\`)
- Update individual sections without overwriting others
- Get typed data (arrays, enums) instead of text parsing

## Available Sections

| Section | Type | Description |
|---------|------|-------------|
| \`summary\` | string | **Required.** Brief overview of the work item |
| \`aiInstructions\` | string | Specific guidance for AI agents |
| \`acceptanceCriteria\` | string[] | List of completion conditions |
| \`filesInvolved\` | string[] | Relevant file paths |
| \`functionsToModify\` | string[] | Functions/methods to change |
| \`testingStrategy\` | string | How to test the implementation |
| \`testFiles\` | string[] | Test file paths |
| \`relatedItemIds\` | string[] | Links to related features/tasks |
| \`externalLinks\` | object[] | URLs with title/description |
| \`technicalNotes\` | string | Implementation constraints/gotchas |
| \`riskLevel\` | enum | "low", "medium", "high" |
| \`estimatedEffort\` | enum | "trivial", "small", "medium", "large", "xl" |

## Tools

| Tool | Purpose |
|------|---------|
| \`spectree__get_structured_description\` | Get parsed structured description |
| \`spectree__set_structured_description\` | Replace entire structured description |
| \`spectree__update_section\` | Update single section (recommended) |
| \`spectree__add_acceptance_criterion\` | Append to acceptanceCriteria |
| \`spectree__link_file\` | Add to filesInvolved |
| \`spectree__add_external_link\` | Add to externalLinks |

## Recommended Workflow

### Reading Structured Data

\`\`\`
// Get the full structured description
const desc = spectree__get_structured_description({ 
  id: "COM-123", 
  type: "feature" 
})

// Access specific fields directly
console.log(desc.acceptanceCriteria)  // Array of criteria
console.log(desc.filesInvolved)       // Array of file paths
console.log(desc.riskLevel)           // "low", "medium", or "high"
\`\`\`

### Updating Sections

\`\`\`
// Update a single section (preserves others)
spectree__update_section({
  id: "COM-123",
  type: "feature",
  section: "aiInstructions",
  value: "Use existing auth service pattern in src/auth/"
})

// Add to lists with convenience tools (handles duplicates)
spectree__add_acceptance_criterion({
  id: "COM-123",
  type: "feature",
  criterion: "User receives confirmation email"
})

spectree__link_file({
  id: "COM-123",
  type: "feature",
  filePath: "src/services/userService.ts"
})
\`\`\`

## Best Practices

1. **Use convenience tools for lists**: \`add_acceptance_criterion\`, \`link_file\`, \`add_external_link\` handle duplicates automatically
2. **Use \`update_section\` over \`set_structured_description\`**: Avoids accidentally overwriting other sections
3. **Link files as you discover them**: Call \`link_file\` when you find relevant files during exploration
4. **Set risk level appropriately**: Helps future AI agents understand required caution
5. **Include AI instructions**: Provide specific guidance for agents working on this item`,

  codeContext: `# Code Context (Codebase Integration)

Code Context links features and tasks directly to code artifacts, enabling AI agents to instantly understand the code context for any work item without needing to explore the codebase.

## Why Use Code Context?

When you start working on a feature/task, you can immediately see:
- Which files were previously modified
- Which functions were touched
- What git branch is being used
- What commits have been made
- What PR is associated

This eliminates the need to search/explore to understand what code is involved.

## Difference from Structured Descriptions

| Structured Descriptions | Code Context |
|------------------------|--------------|
| \`filesInvolved\` - Files you *plan* to modify | \`relatedFiles\` - Files you *actually* modified |
| \`functionsToModify\` - Functions you *plan* to change | \`relatedFunctions\` - Functions *actually* changed |
| Planning/specification focused | Implementation/tracking focused |
| Set **before** work begins | Updated **during/after** work |

Both can be used together - structured descriptions for planning, code context for tracking.

## Tools

| Tool | Purpose |
|------|---------|
| \`spectree__link_code_file\` | Link a source file |
| \`spectree__unlink_code_file\` | Remove a file link |
| \`spectree__link_function\` | Link a function (stored as "filePath:functionName") |
| \`spectree__link_branch\` | Set git branch (one per item) |
| \`spectree__link_commit\` | Add commit SHA (accumulates) |
| \`spectree__link_pr\` | Link pull request (one per item) |
| \`spectree__get_code_context\` | Get all code context |

## Recommended Workflow

### Starting Work

\`\`\`
// 1. Get existing context to see what was previously tracked
const context = spectree__get_code_context({ 
  id: "COM-123", 
  type: "feature" 
})

// 2. Link your branch when you create it
spectree__link_branch({ 
  id: "COM-123", 
  type: "feature",
  branch: "feature/COM-123-user-auth" 
})
\`\`\`

### During Development

\`\`\`
// 3. Link files as you modify them
spectree__link_code_file({
  id: "COM-123",
  type: "feature",
  filePath: "src/services/userService.ts"
})

// 4. Link functions for significant changes
spectree__link_function({
  id: "COM-123",
  type: "feature",
  filePath: "src/services/userService.ts",
  functionName: "createUser"
})

// 5. Record commits after committing
spectree__link_commit({
  id: "COM-123",
  type: "feature",
  commitSha: "abc123def456"
})
\`\`\`

### Completing Work

\`\`\`
// 6. Link the PR when opened
spectree__link_pr({
  id: "COM-123",
  type: "feature",
  prNumber: 42,
  prUrl: "https://github.com/org/repo/pull/42"
})
\`\`\`

## Best Practices

1. **Link your branch early**: Set the branch when you start work
2. **Link files as you touch them**: Don't try to remember at the end
3. **Link key functions**: Focus on the important ones, not every helper
4. **Record commits**: Especially for significant changes
5. **Get context first**: When resuming work, call \`get_code_context\` to understand previous state
6. **Duplicates are safe**: The tools handle deduplication automatically`,
};

// Full instructions combining all topics
const fullInstructions = `# SpecTree AI Agent Instructions

${helpTopics.overview}

---

${helpTopics.sessions}

---

${helpTopics.execution}

---

${helpTopics.progress}

---

${helpTopics.structured}

---

${helpTopics.codeContext}

---

${helpTopics.templates}

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
| **Start session** | \`spectree__start_session\` |
| **End session** | \`spectree__end_session\` |
| List all epics | \`spectree__list_epics\` |
| Get execution plan | \`spectree__get_execution_plan\` |
| Search work items | \`spectree__search\` |
| Create feature | \`spectree__create_feature\` |
| Update feature | \`spectree__update_feature\` |
| Create task | \`spectree__create_task\` |
| Update task | \`spectree__update_task\` |
| **Start work** | \`spectree__start_work\` |
| **Complete work** | \`spectree__complete_work\` |
| **Log progress** | \`spectree__log_progress\` |
| **Report blocker** | \`spectree__report_blocker\` |
| Set execution metadata | \`spectree__set_execution_metadata\` |
| Mark blocked | \`spectree__mark_blocked\` |
| **Get structured description** | \`spectree__get_structured_description\` |
| **Update section** | \`spectree__update_section\` |
| **Link file** | \`spectree__link_file\` |
| **Get code context** | \`spectree__get_code_context\` |
| **Link code file** | \`spectree__link_code_file\` |
| **Link branch** | \`spectree__link_branch\` |
| **Link commit** | \`spectree__link_commit\` |
| **Link PR** | \`spectree__link_pr\` |
| **List templates** | \`spectree__list_templates\` |
| **Create from template** | \`spectree__create_from_template\` |
`;

export function registerHelpTools(server: McpServer): void {
  server.registerTool(
    "spectree__get_instructions",
    {
      description:
        "Get instructions and guidance for using SpecTree effectively. " +
        "Call this tool at the start of a session to understand available capabilities, " +
        "best practices, and recommended workflows. Topics include: overview, sessions " +
        "(handoff between AI sessions), execution (planning & dependencies), progress " +
        "(tracking tools), structured (rich descriptions), codeContext (link code artifacts), " +
        "search (filtering), workflow (recommended patterns), personal (private workspace), " +
        "and templates (implementation plan templates).",
      inputSchema: {
        topic: z
          .enum(topicValues)
          .default("all")
          .describe(
            "Which topic to get help on. Use 'all' for complete instructions, or choose " +
            "a specific topic: 'overview' (concepts), 'sessions' (AI session handoff), " +
            "'execution' (planning & dependencies), 'progress' (tracking tools), 'structured' " +
            "(rich descriptions), 'codeContext' (link code artifacts), 'search' (filtering), " +
            "'workflow' (recommended patterns), 'personal' (private workspace), " +
            "'templates' (implementation plan templates)."
          ),
      },
    },
    (input) => {
      const topic = input.topic;

      if (topic === "all") {
        return createResponse({ instructions: fullInstructions });
      }

      const content = helpTopics[topic];
      return createResponse({ topic, instructions: content });
    }
  );
}
