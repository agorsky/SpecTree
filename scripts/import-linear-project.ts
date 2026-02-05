#!/usr/bin/env npx tsx
/**
 * Import Linear Project to SpecTree
 * 
 * This script imports a Linear project (with issues and sub-issues) into SpecTree
 * as an Epic with Features and Tasks.
 * 
 * Linear Mapping:
 *   Project     → Epic
 *   Issue       → Feature  
 *   Sub-Issue   → Task
 */

// Linear project data (extracted from API)
const linearProject = {
  name: "Orchestrator MCP Integration",
  description: `Integrate the full SpecTree MCP toolset into the orchestrator CLI to ensure epics, features, and tasks are properly documented with structured descriptions, templates, validation checklists, and code context.

## Background

The orchestrator CLI (\`packages/orchestrator/\`) was built to externalize control from AI agents (sessions, work lifecycle). However, it currently does not populate the rich metadata that makes tasks self-describing for subsequent AI agents.

## Goals

1. **Structured Descriptions** — Every feature and task should have \`aiInstructions\`, \`acceptanceCriteria\`, \`filesInvolved\`
2. **Template Support** — Use built-in templates as starting points for plan generation
3. **Validation Checklists** — Create executable acceptance criteria for tasks
4. **Code Context** — Properly link files, branches, commits, PRs via real API
5. **Decision Log** — Use the real Decision API instead of logging as progress notes

## Key Files

* \`packages/orchestrator/src/orchestrator/plan-generator.ts\` — Plan generation from prompts
* \`packages/orchestrator/src/spectree/mcp-bridge.ts\` — Agent-facing tools
* \`packages/orchestrator/src/spectree/api-client.ts\` — SpecTree API client

## Reference Documentation

* \`docs/MCP/IMPLEMENTATION-REFERENCE.md\` — Full MCP implementation reference
* \`docs/MCP/tools-reference.md\` — Complete MCP tools reference
* \`.github/copilot-instructions.md\` — Original requirements (commented out)

---

## Implementation Order

### Phase 1: Foundation (MUST BE FIRST)
- COM-437: Fix MCP Bridge to Use Real APIs (prerequisite for all others)

### Phase 2: Plan Generator Enhancements (PARALLEL)
- COM-434: Integrate Structured Descriptions into Plan Generator
- COM-436: Add Template Support to Plan Generator

### Phase 3: Extensions (PARALLEL)
- COM-435: Expose Additional Agent Tools in MCP Bridge
- COM-438: Add Validation Checklist Creation to Plan Generator`,
};

// Issues (will become Features)
interface LinearIssue {
  identifier: string;
  title: string;
  description: string;
  priority: number; // 1=Urgent, 2=High, 3=Medium, 4=Low
  executionOrder: number;
  canParallelize: boolean;
  parallelGroup: string | null;
  estimatedComplexity: "trivial" | "simple" | "moderate" | "complex";
  subIssues: LinearSubIssue[];
}

interface LinearSubIssue {
  identifier: string;
  title: string;
  description: string;
  executionOrder: number;
  canParallelize: boolean;
  parallelGroup: string | null;
  estimatedComplexity: "trivial" | "simple" | "moderate" | "complex";
}

const linearIssues: LinearIssue[] = [
  // Phase 1 - Foundation
  {
    identifier: "COM-437",
    title: "Fix MCP Bridge to Use Real APIs",
    description: `## Summary

The MCP bridge (\`packages/orchestrator/src/spectree/mcp-bridge.ts\`) provides 5 tools to agents, but 3 of them don't call the real SpecTree APIs:

| Tool | Current Behavior | Should Do |
| -- | -- | -- |
| \`link_code_file\` | Logs as progress note (line 385) | Call \`POST /features/:id/code-context/file\` |
| \`log_decision\` | Logs as progress note (line 345-349) | Call \`POST /decisions\` |
| \`get_code_context\` | Returns empty arrays (line 467-475) | Call \`GET /features/:id/code-context\` |

This means:

* Linked files are NOT persisted to the code context
* Decisions are NOT searchable via decision API
* Code context retrieval returns nothing

## Goal

Fix all 3 tools to call the real SpecTree APIs.

## Files to Modify

* \`packages/orchestrator/src/spectree/api-client.ts\` — Add new methods
* \`packages/orchestrator/src/spectree/mcp-bridge.ts\` — Fix tool handlers

## Acceptance Criteria

- [ ] \`link_code_file\` tool calls \`POST /features/:id/code-context/file\` API
- [ ] \`log_decision\` tool calls \`POST /decisions\` API
- [ ] \`get_code_context\` tool calls \`GET /features/:id/code-context\` API
- [ ] All tools return proper success/error responses
- [ ] Unit tests verify correct API calls`,
    priority: 1,
    executionOrder: 1,
    canParallelize: false,
    parallelGroup: null,
    estimatedComplexity: "moderate",
    subIssues: [
      {
        identifier: "COM-443",
        title: "Add linkCodeFile, getCodeContext, and logDecision to SpecTreeClient",
        description: `## Summary

Add three missing API methods to \`SpecTreeClient\` for code context, decisions, and file linking.

## Methods to Add

In \`packages/orchestrator/src/spectree/api-client.ts\`:

### 1. linkCodeFile
\`\`\`typescript
async linkCodeFile(
  type: "feature" | "task",
  id: string,
  filePath: string
): Promise<void> {
  const basePath = type === "feature" ? "/features" : "/tasks";
  await this.request("POST", \`\${basePath}/\${id}/code-context/file\`, { filePath });
}
\`\`\`

### 2. getCodeContext
\`\`\`typescript
async getCodeContext(
  type: "feature" | "task",
  id: string
): Promise<CodeContext> {
  const basePath = type === "feature" ? "/features" : "/tasks";
  const response = await this.request<{ data: CodeContext }>(
    "GET",
    \`\${basePath}/\${id}/code-context\`
  );
  return response.data;
}
\`\`\`

### 3. logDecision
\`\`\`typescript
async logDecision(input: {
  epicId: string;
  featureId?: string;
  taskId?: string;
  question: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
  category?: string;
  impact?: string;
}): Promise<Decision> {
  const response = await this.request<{ data: Decision }>("POST", "/decisions", input);
  return response.data;
}
\`\`\`

## Acceptance Criteria

- [ ] \`linkCodeFile\` method added and typed correctly
- [ ] \`getCodeContext\` method added with proper response type
- [ ] \`logDecision\` method added with all input fields
- [ ] All methods use proper error handling`,
        executionOrder: 1,
        canParallelize: false,
        parallelGroup: null,
        estimatedComplexity: "simple",
      },
      {
        identifier: "COM-444",
        title: "Fix link_code_file tool handler",
        description: `## Summary

Fix the \`link_code_file\` tool handler to call the real API instead of logging as a progress note.

## Current Implementation (lines 367-400)
\`\`\`typescript
// Current: Just logs a progress note
await client.logProgress(args.type, args.id, {
  message: \`Linked file: \${args.filePath}\`,
});
\`\`\`

## Fixed Implementation
\`\`\`typescript
handler: async (args: LinkCodeFileArgs) => {
  try {
    await client.linkCodeFile(args.type, args.id, args.filePath);
    const item = args.type === "feature" 
      ? await client.getFeature(args.id)
      : await client.getTask(args.id);

    return successResult({
      type: args.type,
      id: item.id,
      identifier: item.identifier,
      filePath: args.filePath,
      message: \`File '\${args.filePath}' linked to \${args.type} \${item.identifier}\`,
    });
  } catch (error) {
    return errorResult(error);
  }
},
\`\`\`

## Acceptance Criteria

- [ ] Handler calls \`client.linkCodeFile()\` instead of \`logProgress()\`
- [ ] Returns proper success response with item metadata
- [ ] Handles errors correctly`,
        executionOrder: 2,
        canParallelize: true,
        parallelGroup: "fix-handlers",
        estimatedComplexity: "simple",
      },
      {
        identifier: "COM-445",
        title: "Fix log_decision tool handler",
        description: `## Summary

Fix the \`log_decision\` tool handler to call the real Decision API instead of logging as a progress note.

## Current Implementation (lines 329-361)
\`\`\`typescript
// Current: Formats decision as text and logs as progress note
let decisionMsg = \`DECISION: \${args.question}\\n\\nChoice: \${args.decision}...\`;
await client.logProgress("task", args.taskId, { message: decisionMsg });
\`\`\`

## Fixed Implementation
\`\`\`typescript
handler: async (args: LogDecisionArgs) => {
  try {
    const decision = await client.logDecision({
      epicId: args.epicId,
      featureId: args.featureId,
      taskId: args.taskId,
      question: args.question,
      decision: args.decision,
      rationale: args.rationale,
      alternatives: args.alternatives,
      category: args.category,
      impact: args.impact,
    });

    return successResult({
      id: decision.id,
      question: args.question,
      decision: args.decision,
      message: "Decision logged successfully",
    });
  } catch (error) {
    return errorResult(error);
  }
},
\`\`\`

## Acceptance Criteria

- [ ] Handler calls \`client.logDecision()\` instead of \`logProgress()\`
- [ ] All decision fields passed through correctly
- [ ] Returns proper success response with decision ID`,
        executionOrder: 2,
        canParallelize: true,
        parallelGroup: "fix-handlers",
        estimatedComplexity: "simple",
      },
      {
        identifier: "COM-446",
        title: "Fix get_code_context tool handler",
        description: `## Summary

Fix the \`get_code_context\` tool handler to call the real API instead of returning empty arrays.

## Current Implementation (lines 449-491)
\`\`\`typescript
// Current: Returns empty/null values
const codeContext: CodeContext = {
  files: [],        // Always empty
  functions: [],    // Always empty
  branch: null,     // Always null
  commits: [],      // Always empty
  pr: null,         // Always null
};
\`\`\`

## Fixed Implementation
\`\`\`typescript
handler: async (args: GetCodeContextArgs) => {
  try {
    const item = args.type === "feature"
      ? await client.getFeature(args.id)
      : await client.getTask(args.id);

    const codeContext = await client.getCodeContext(args.type, args.id);

    return successResult({
      type: args.type,
      id: item.id,
      identifier: item.identifier,
      title: item.title,
      codeContext: {
        files: codeContext.relatedFiles ?? [],
        functions: codeContext.relatedFunctions ?? [],
        branch: codeContext.gitBranch ?? null,
        commits: codeContext.gitCommits ?? [],
        pr: codeContext.gitPrNumber 
          ? { number: codeContext.gitPrNumber, url: codeContext.gitPrUrl ?? "" }
          : null,
      },
    });
  } catch (error) {
    return errorResult(error);
  }
},
\`\`\`

## Acceptance Criteria

- [ ] Handler calls \`client.getCodeContext()\` to fetch real data
- [ ] Maps API response fields to tool output format
- [ ] Handles missing/null fields gracefully`,
        executionOrder: 2,
        canParallelize: true,
        parallelGroup: "fix-handlers",
        estimatedComplexity: "simple",
      },
    ],
  },

  // Phase 2 - Plan Generator Enhancements (parallel)
  {
    identifier: "COM-434",
    title: "Integrate Structured Descriptions into Plan Generator",
    description: `## Summary

The plan generator (\`packages/orchestrator/src/orchestrator/plan-generator.ts\`) currently creates features and tasks with only basic fields. It does NOT populate structured descriptions.

## Goal

After the plan generator creates features and tasks, it should also call the structured description API to populate rich metadata.

## Files to Modify

* \`packages/orchestrator/src/orchestrator/plan-generator.ts\`
* \`packages/orchestrator/src/spectree/api-client.ts\`

## Acceptance Criteria

- [ ] AI prompt requests structured description fields in JSON response
- [ ] \`PlannedFeature\` and \`PlannedTask\` types include new fields
- [ ] \`SpecTreeClient\` has \`setStructuredDescription()\` method
- [ ] Plan generator calls structured description API after creating each feature/task
- [ ] Dry-run mode includes structured descriptions in output
- [ ] Unit tests verify structured descriptions are set`,
    priority: 2,
    executionOrder: 2,
    canParallelize: true,
    parallelGroup: "phase-2",
    estimatedComplexity: "moderate",
    subIssues: [
      {
        identifier: "COM-439",
        title: "Update AI prompt to request structured description fields",
        description: `## Summary

Update the \`PLANNER_SYSTEM_PROMPT\` constant to request structured description fields in the JSON output.

## Current Prompt (line 120-166)

The prompt only requests: \`title\`, \`description\`, \`executionOrder\`, \`canParallelize\`, \`parallelGroup\`, \`estimatedComplexity\`, \`dependencies\`

## Required Changes

Add to each feature/task in the JSON response:
\`\`\`typescript
{
  "aiInstructions": "Step-by-step guidance for implementing this feature...",
  "acceptanceCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
  "filesInvolved": ["src/path/file.ts"],
  "technicalNotes": "Any constraints or considerations",
  "riskLevel": "low|medium|high",
  "estimatedEffort": "trivial|small|medium|large|xl"
}
\`\`\`

## Acceptance Criteria

- [ ] Prompt requests all structured description fields
- [ ] Examples show expected format for each field
- [ ] Quality requirements ensure detailed descriptions`,
        executionOrder: 1,
        canParallelize: true,
        parallelGroup: "com434-parallel",
        estimatedComplexity: "simple",
      },
      {
        identifier: "COM-440",
        title: "Add setStructuredDescription method to SpecTreeClient",
        description: `## Summary

Add the \`setStructuredDescription\` method to \`SpecTreeClient\` class.

## Implementation

In \`packages/orchestrator/src/spectree/api-client.ts\`:

\`\`\`typescript
export interface StructuredDescription {
  summary: string;
  aiInstructions?: string;
  acceptanceCriteria?: string[];
  filesInvolved?: string[];
  technicalNotes?: string;
  riskLevel?: "low" | "medium" | "high";
  estimatedEffort?: "trivial" | "small" | "medium" | "large" | "xl";
}

async setStructuredDescription(
  type: "feature" | "task",
  id: string,
  structuredDesc: StructuredDescription
): Promise<void> {
  const basePath = type === "feature" ? "/features" : "/tasks";
  await this.request("PATCH", \`\${basePath}/\${id}/structured-description\`, structuredDesc);
}
\`\`\`

## Acceptance Criteria

- [ ] Type definition matches API schema
- [ ] Method calls correct endpoint
- [ ] Error handling follows existing patterns`,
        executionOrder: 1,
        canParallelize: true,
        parallelGroup: "com434-parallel",
        estimatedComplexity: "simple",
      },
      {
        identifier: "COM-442",
        title: "Extend PlannedFeature and PlannedTask types",
        description: `## Summary

Update the \`PlannedFeature\` and \`PlannedTask\` interfaces to include structured description fields.

## Current Types (lines 38-60)

\`\`\`typescript
export interface PlannedTask {
  title: string;
  description: string;
  estimatedComplexity: Complexity;
}

export interface PlannedFeature {
  title: string;
  description: string;
  executionOrder: number;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: number[];
  estimatedComplexity: Complexity;
  tasks: PlannedTask[];
}
\`\`\`

## Updated Types

\`\`\`typescript
export interface PlannedTask {
  title: string;
  description: string;
  estimatedComplexity: Complexity;
  // NEW structured description fields
  aiInstructions?: string;
  acceptanceCriteria?: string[];
  filesInvolved?: string[];
  technicalNotes?: string;
  riskLevel?: "low" | "medium" | "high";
  estimatedEffort?: "trivial" | "small" | "medium" | "large" | "xl";
}
\`\`\`

## Acceptance Criteria

- [ ] Both types include new optional fields
- [ ] Zod validation schema updated
- [ ] Existing tests still pass`,
        executionOrder: 2,
        canParallelize: false,
        parallelGroup: null,
        estimatedComplexity: "simple",
      },
      {
        identifier: "COM-441",
        title: "Call setStructuredDescription after creating features/tasks",
        description: `## Summary

After creating each feature and task, call the API to set structured descriptions.

## Changes to createFeature() (line 534)

\`\`\`typescript
private async createFeature(
  epicId: string,
  planned: PlannedFeature,
  featureIdMap: Map<number, string>
): Promise<GeneratedFeature> {
  // ... existing creation logic ...
  
  // NEW: Set structured description
  if (planned.aiInstructions || planned.acceptanceCriteria?.length) {
    await this.spectreeClient.setStructuredDescription("feature", feature.id, {
      summary: planned.description,
      aiInstructions: planned.aiInstructions,
      acceptanceCriteria: planned.acceptanceCriteria,
      filesInvolved: planned.filesInvolved,
      technicalNotes: planned.technicalNotes,
      riskLevel: planned.riskLevel,
      estimatedEffort: planned.estimatedEffort,
    });
  }

  return { id: feature.id, identifier: feature.identifier, title: feature.title };
}
\`\`\`

## Acceptance Criteria

- [ ] Structured description set after feature creation
- [ ] Structured description set after task creation
- [ ] Handles missing fields gracefully
- [ ] Dry-run logs what would be set`,
        executionOrder: 3,
        canParallelize: false,
        parallelGroup: null,
        estimatedComplexity: "simple",
      },
    ],
  },
  {
    identifier: "COM-436",
    title: "Add Template Support to Plan Generator",
    description: `## Summary

The orchestrator generates plans entirely from scratch via an AI prompt. It does not use the existing template system, which provides standardized structures for common workflows.

## Built-in Templates

* **Code Feature** — Design, Implement, Test, Document
* **Bug Fix** — Investigate, Reproduce, Fix, Verify
* **Refactoring** — Analysis, Implementation, Testing
* **API Endpoint** — Design, Implementation, Testing, Documentation

## Goal

Allow the orchestrator to use templates as starting points, with AI customization.

## Files to Modify

* \`packages/orchestrator/src/cli/commands/run.ts\` — Add \`--template\` flag
* \`packages/orchestrator/src/spectree/api-client.ts\` — Add template methods
* \`packages/orchestrator/src/orchestrator/plan-generator.ts\` — Add template support

## Acceptance Criteria

- [ ] \`--template\` flag available on \`spectree-agent run\` command
- [ ] \`SpecTreeClient\` has template methods (list, get, preview, apply)
- [ ] Plan generator supports template-based creation
- [ ] Template features/tasks get customized descriptions based on prompt
- [ ] Dry-run shows template preview when \`--template\` specified
- [ ] Help text documents available template names`,
    priority: 2,
    executionOrder: 2,
    canParallelize: true,
    parallelGroup: "phase-2",
    estimatedComplexity: "moderate",
    subIssues: [
      {
        identifier: "COM-448",
        title: "Add template methods to SpecTreeClient",
        description: `## Summary

Add template-related methods to \`SpecTreeClient\`.

## Methods to Add

\`\`\`typescript
async listTemplates(): Promise<Template[]>
async getTemplate(name: string): Promise<Template>
async previewTemplate(templateName: string, epicName: string, variables?: Record<string, string>): Promise<TemplatePreview>
async createFromTemplate(templateName: string, epicName: string, teamId: string, variables?: Record<string, string>): Promise<{ epic: Epic; features: Feature[]; tasks: Task[] }>
\`\`\`

## Acceptance Criteria

- [ ] All four methods implemented
- [ ] Types defined for Template and TemplatePreview
- [ ] Error handling for template not found`,
        executionOrder: 1,
        canParallelize: false,
        parallelGroup: null,
        estimatedComplexity: "simple",
      },
      {
        identifier: "COM-447",
        title: "Add template mode to PlanGenerator",
        description: `## Summary

Add template-based plan generation mode to \`PlanGenerator\`.

## Changes

\`\`\`typescript
export interface GeneratePlanOptions {
  team: string;
  teamId: string;
  dryRun?: boolean;
  template?: string;  // NEW
}

async generatePlan(prompt: string, options: GeneratePlanOptions): Promise<GeneratedPlan> {
  if (options.template) {
    return this.generateFromTemplate(prompt, options);
  }
  // ... existing logic ...
}
\`\`\`

## Acceptance Criteria

- [ ] Template mode creates from template API
- [ ] AI customizes titles/descriptions based on prompt
- [ ] Dry-run shows template preview`,
        executionOrder: 2,
        canParallelize: false,
        parallelGroup: null,
        estimatedComplexity: "moderate",
      },
      {
        identifier: "COM-449",
        title: "Add --template CLI flag to run command",
        description: `## Summary

Add the \`--template\` CLI flag to the \`run\` command.

## Changes

\`\`\`typescript
program
  .command('run <prompt>')
  .option('-T, --template <name>', 'Use a template as starting point')
  // ... existing options ...
\`\`\`

## Acceptance Criteria

- [ ] Flag parses correctly
- [ ] Value passed to plan generator
- [ ] Help text shows available templates`,
        executionOrder: 3,
        canParallelize: false,
        parallelGroup: null,
        estimatedComplexity: "trivial",
      },
    ],
  },

  // Phase 3 - Extensions (parallel)
  {
    identifier: "COM-435",
    title: "Expose Additional Agent Tools in MCP Bridge",
    description: `## Summary

The MCP bridge currently exposes only 5 tools to agents. Several useful tools are missing.

## Tools to Add

* \`report_blocker\` — Agent can report when blocked
* \`get_ai_context\` — Read context from previous sessions
* \`append_ai_note\` — Leave notes for future sessions
* \`run_validation\` / \`run_all_validations\` — Run validation checks
* \`get_structured_description\` — Read full task requirements

## Files to Modify

* \`packages/orchestrator/src/spectree/api-client.ts\`
* \`packages/orchestrator/src/spectree/mcp-bridge.ts\`

## Acceptance Criteria

- [ ] \`report_blocker\` tool exposed and calls real API
- [ ] \`get_ai_context\` tool returns context from previous sessions
- [ ] \`append_ai_note\` tool persists notes for future sessions
- [ ] \`run_validation\` / \`run_all_validations\` tools work
- [ ] \`get_structured_description\` tool returns full task requirements
- [ ] All new tools documented in tool descriptions
- [ ] \`agentToolNames\` array updated`,
    priority: 3,
    executionOrder: 3,
    canParallelize: true,
    parallelGroup: "phase-3",
    estimatedComplexity: "moderate",
    subIssues: [],
  },
  {
    identifier: "COM-438",
    title: "Add Validation Checklist Creation to Plan Generator",
    description: `## Summary

The MCP system supports executable validation checklists on tasks. The orchestrator does not create these.

## Available Validation Types

* \`command\` — Run a shell command, check exit code
* \`file_exists\` — Verify a file exists
* \`file_contains\` — Search file for regex pattern
* \`test_passes\` — Run test command
* \`manual\` — Human verification required

## Goal

When the plan generator creates tasks, it should also create appropriate validation checks based on the acceptance criteria.

## Files to Modify

* \`packages/orchestrator/src/orchestrator/plan-generator.ts\`
* \`packages/orchestrator/src/spectree/api-client.ts\`

## Acceptance Criteria

- [ ] AI prompt requests validation checks in task JSON
- [ ] \`PlannedTask\` type includes \`validations\` array
- [ ] \`SpecTreeClient\` has \`addValidation()\` method
- [ ] Plan generator creates validations after each task
- [ ] Default validations inferred for common patterns
- [ ] Dry-run shows planned validations`,
    priority: 3,
    executionOrder: 3,
    canParallelize: true,
    parallelGroup: "phase-3",
    estimatedComplexity: "moderate",
    subIssues: [],
  },
];

// ============================================================================
// Import Script
// ============================================================================

const SPECTREE_API_URL = "http://127.0.0.1:3001";
const SPECTREE_TOKEN = process.env.SPECTREE_TOKEN || "st_dOgWVinyyVEte2u9TeGD8SFJO8nkMGcHwnzy5S4z2hw";
const ENGINEERING_TEAM_ID = "76141991-401c-49bb-996a-7ac118038912";

interface ApiResponse<T> {
  data: T;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${SPECTREE_API_URL}/api/v1${path}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${SPECTREE_TOKEN}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function main() {
  console.log("🚀 Importing Linear project to SpecTree...\n");

  // 1. Create Epic
  console.log("📦 Creating Epic:", linearProject.name);
  const epicResponse = await request<ApiResponse<{ id: string; name: string }>>(
    "POST",
    "/epics",
    {
      name: linearProject.name,
      teamId: ENGINEERING_TEAM_ID,
      description: linearProject.description,
      icon: "⚙️",
      color: "#3b82f6",
    }
  );
  const epic = epicResponse.data;
  console.log(`   ✅ Created Epic: ${epic.name} (${epic.id})\n`);

  // Track created features for reference
  const featureMap = new Map<string, string>(); // identifier -> id

  // 2. Create Features (from Issues)
  for (const issue of linearIssues) {
    console.log(`📋 Creating Feature: ${issue.identifier} - ${issue.title}`);
    
    const featureResponse = await request<ApiResponse<{ id: string; identifier: string; title: string }>>(
      "POST",
      "/features",
      {
        title: issue.title,
        epicId: epic.id,
        description: issue.description,
        executionOrder: issue.executionOrder,
        canParallelize: issue.canParallelize,
        parallelGroup: issue.parallelGroup,
        estimatedComplexity: issue.estimatedComplexity,
      }
    );
    const feature = featureResponse.data;
    featureMap.set(issue.identifier, feature.id);
    console.log(`   ✅ Created: ${feature.identifier} (${feature.id})`);

    // 3. Create Tasks (from Sub-Issues)
    for (const subIssue of issue.subIssues) {
      console.log(`   📝 Creating Task: ${subIssue.identifier} - ${subIssue.title}`);
      
      const taskResponse = await request<ApiResponse<{ id: string; identifier: string; title: string }>>(
        "POST",
        "/tasks",
        {
          title: subIssue.title,
          featureId: feature.id,
          description: subIssue.description,
          executionOrder: subIssue.executionOrder,
          canParallelize: subIssue.canParallelize,
          parallelGroup: subIssue.parallelGroup,
          estimatedComplexity: subIssue.estimatedComplexity,
        }
      );
      const task = taskResponse.data;
      console.log(`      ✅ Created: ${task.identifier} (${task.id})`);
    }
    console.log();
  }

  // Summary
  console.log("═".repeat(60));
  console.log("✨ Import Complete!");
  console.log("═".repeat(60));
  console.log(`Epic: ${linearProject.name}`);
  console.log(`Features: ${linearIssues.length}`);
  console.log(`Tasks: ${linearIssues.reduce((sum, i) => sum + i.subIssues.length, 0)}`);
  console.log();
  console.log("You can now run:");
  console.log(`  spectree-agent continue "${linearProject.name}"`);
}

main().catch((error) => {
  console.error("❌ Import failed:", error);
  process.exit(1);
});
