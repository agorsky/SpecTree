#!/usr/bin/env npx tsx
/**
 * Script to create the Parallel Agent Orchestrator epic in SpecTree
 * via the REST API.
 * 
 * Usage:
 *   1. Make sure the SpecTree API is running: pnpm --filter @spectree/api dev
 *   2. Run: npx tsx scripts/create-orchestrator-epic.ts
 */

const API_URL = process.env.SPECTREE_API_URL || "http://localhost:3001";
const TEAM_NAME = "Engineering";

interface StructuredDesc {
  summary: string;
  aiInstructions?: string;
  acceptanceCriteria?: string[];
  filesInvolved?: string[];
  technicalNotes?: string;
  riskLevel?: "low" | "medium" | "high";
  estimatedEffort?: "trivial" | "small" | "medium" | "large" | "xl";
}

interface Task {
  title: string;
  executionOrder?: number;
  estimatedComplexity?: "trivial" | "simple" | "moderate" | "complex";
  structuredDesc?: StructuredDesc;
}

interface Feature {
  title: string;
  executionOrder: number;
  estimatedComplexity: "trivial" | "simple" | "moderate" | "complex";
  canParallelize?: boolean;
  parallelGroup?: string;
  dependencies?: number[];
  structuredDesc?: StructuredDesc;
  tasks: Task[];
}

interface EpicPayload {
  name: string;
  team: string;
  description?: string;
  icon?: string;
  color?: string;
  features: Feature[];
}

// ============================================================================
// EPIC DEFINITION: Parallel Agent Orchestrator CLI
// ============================================================================

const epicPayload: EpicPayload = {
  name: "Parallel Agent Orchestrator CLI",
  team: TEAM_NAME,
  description: `CLI tool (@spectree/orchestrator) that enables developers to:
1. Describe a project/epic in natural language
2. Have AI automatically create structured plans in SpecTree
3. Execute work using parallel AI agents when possible
4. Track progress, decisions, and handoffs automatically

See docs/orchestrator-implementation-briefing.md for full specifications.`,
  icon: "rocket",
  color: "#3B82F6",
  features: [
    // =========================================================================
    // FEATURE 1: Core Configuration Module
    // =========================================================================
    {
      title: "Configuration Module",
      executionOrder: 1,
      estimatedComplexity: "simple",
      canParallelize: false,
      structuredDesc: {
        summary: "Implement configuration management for user and project settings",
        aiInstructions: `Create src/config/index.ts that:
1. Loads user config from ~/.spectree/config.json
2. Loads project config from .spectree.json in repo root
3. Merges configs with sensible defaults
4. Provides typed accessors for all config values
5. Creates default config if missing

Use the 'conf' package for user config storage.
Export: getConfig(), getApiUrl(), getDefaultTeam(), getMaxAgents() helpers.`,
        acceptanceCriteria: [
          "getConfig() returns merged user + project config",
          "getApiUrl() returns configured API URL (default: http://localhost:3001)",
          "getDefaultTeam() returns configured default team",
          "getMaxAgents() returns max concurrent agents (default: 4)",
          "Creates default config file if ~/.spectree/config.json missing",
          "Project config (.spectree.json) overrides user config",
          "TypeScript types exported for all config shapes",
        ],
        filesInvolved: [
          "packages/orchestrator/src/config/index.ts",
          "packages/orchestrator/src/config/types.ts",
        ],
        technicalNotes: `Config structure:
User (~/.spectree/config.json):
{
  "apiUrl": "http://localhost:3001",
  "defaultTeam": "Engineering",
  "maxConcurrentAgents": 4,
  "autoMerge": true,
  "branchPrefix": "feature/",
  "copilot": { "model": "gpt-4.1" }
}

Project (.spectree.json):
{
  "team": "Engineering",
  "testCommand": "pnpm test",
  "lintCommand": "pnpm lint",
  "buildCommand": "pnpm build"
}`,
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          title: "Create config types",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDesc: {
            summary: "Define TypeScript interfaces for user and project configuration",
            aiInstructions: "Create types.ts with UserConfig, ProjectConfig, and MergedConfig interfaces. Include all fields from the briefing document.",
            filesInvolved: ["packages/orchestrator/src/config/types.ts"],
          },
        },
        {
          title: "Implement config loading and merging",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Implement loadUserConfig(), loadProjectConfig(), and getConfig() functions",
            aiInstructions: `Use 'conf' package for user config. Use fs.readFileSync for project config.
Merge with: { ...defaults, ...userConfig, ...projectConfig }
Handle missing files gracefully - create defaults for user config.`,
            acceptanceCriteria: [
              "User config loaded from ~/.spectree/config.json",
              "Project config loaded from .spectree.json in cwd",
              "Missing user config creates default file",
              "Missing project config is handled gracefully (uses defaults)",
              "Config values are properly typed",
            ],
            filesInvolved: ["packages/orchestrator/src/config/index.ts"],
          },
        },
        {
          title: "Add helper functions",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDesc: {
            summary: "Add convenience helper functions for common config values",
            aiInstructions: "Implement getApiUrl(), getDefaultTeam(), getMaxAgents(), getBranchPrefix(), getCopilotModel() helpers that call getConfig() internally.",
            filesInvolved: ["packages/orchestrator/src/config/index.ts"],
          },
        },
        {
          title: "Write unit tests for config module",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Test config loading, merging, and default creation",
            aiInstructions: "Use vitest. Test: default config creation, user config loading, project config override, missing file handling.",
            filesInvolved: ["packages/orchestrator/tests/unit/config.test.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 2: SpecTree API Client
    // =========================================================================
    {
      title: "SpecTree API Client",
      executionOrder: 2,
      estimatedComplexity: "moderate",
      canParallelize: false,
      structuredDesc: {
        summary: "HTTP client for SpecTree REST API with authentication and error handling",
        aiInstructions: `Create src/spectree/api-client.ts that:
1. Uses fetch or axios for HTTP requests
2. Authenticates with stored token (from conf)
3. Provides methods for all CRUD operations (epics, features, tasks)
4. Calls get execution plan endpoint
5. Has typed errors: AuthError, NetworkError, NotFoundError
6. Supports retry logic for transient failures

Base URL from config: getApiUrl()
Auth header: Authorization: Bearer <token>`,
        acceptanceCriteria: [
          "createEpic(), getEpic(), updateEpic() work correctly",
          "createFeature(), getFeature(), updateFeature() work correctly",
          "createTask(), getTask(), updateTask() work correctly",
          "getExecutionPlan(epicId) returns typed phases",
          "startWork(), completeWork(), logProgress() work correctly",
          "Auth errors throw specific AuthError with helpful message",
          "Network errors throw NetworkError with retry hints",
          "404 errors throw NotFoundError",
          "All responses are properly typed",
        ],
        filesInvolved: [
          "packages/orchestrator/src/spectree/api-client.ts",
          "packages/orchestrator/src/spectree/types.ts",
        ],
        technicalNotes: `Key endpoints:
- POST /api/v1/epics/complete - Create epic with features/tasks
- GET /api/v1/epics/:id - Get epic details
- GET /api/v1/epics/:id/progress-summary - Progress summary
- PUT /api/v1/features/:id - Update feature
- POST /api/v1/features/:id/progress/start - Start work
- POST /api/v1/features/:id/progress/complete - Complete work
- POST /api/v1/features/:id/progress/log - Log progress

See packages/api/src/routes/ for full API spec.`,
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Create API types",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Define TypeScript types for API requests and responses",
            aiInstructions: "Create types.ts with interfaces for Epic, Feature, Task, ExecutionPlan, Phase, etc. Match the types from packages/api/src/schemas/.",
            filesInvolved: ["packages/orchestrator/src/spectree/types.ts"],
          },
        },
        {
          title: "Create error types",
          executionOrder: 2,
          estimatedComplexity: "trivial",
          structuredDesc: {
            summary: "Define typed error classes for API errors",
            aiInstructions: "Create AuthError, NetworkError, NotFoundError, ValidationError classes extending Error. Include context and recovery hints.",
            filesInvolved: ["packages/orchestrator/src/errors.ts"],
          },
        },
        {
          title: "Implement base HTTP client",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Create base HTTP client with auth and error handling",
            aiInstructions: `Implement request() method that:
1. Gets token from config/credentials
2. Sets Authorization header
3. Handles errors and converts to typed errors
4. Supports GET, POST, PUT, DELETE methods`,
            filesInvolved: ["packages/orchestrator/src/spectree/api-client.ts"],
          },
        },
        {
          title: "Implement epic/feature/task methods",
          executionOrder: 4,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Add CRUD methods for epics, features, and tasks",
            aiInstructions: "Implement createEpicComplete(), getEpic(), createFeature(), getFeature(), updateFeature(), createTask(), getTask(), updateTask(). Use the base request() method.",
            acceptanceCriteria: [
              "createEpicComplete() posts to /api/v1/epics/complete",
              "All methods return properly typed responses",
              "Error handling converts HTTP errors to typed errors",
            ],
            filesInvolved: ["packages/orchestrator/src/spectree/api-client.ts"],
          },
        },
        {
          title: "Implement progress tracking methods",
          executionOrder: 5,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Add methods for progress tracking (start, complete, log)",
            aiInstructions: "Implement startWork(), completeWork(), logProgress(), getProgressSummary() methods.",
            filesInvolved: ["packages/orchestrator/src/spectree/api-client.ts"],
          },
        },
        {
          title: "Implement execution plan method",
          executionOrder: 6,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Add getExecutionPlan() method for orchestration",
            aiInstructions: "Note: SpecTree doesn't have a direct execution plan endpoint. Either call MCP tool or compute from features with execution metadata. Check if /api/v1/epics/:id/execution-plan exists, otherwise compute from feature data.",
            filesInvolved: ["packages/orchestrator/src/spectree/api-client.ts"],
          },
        },
        {
          title: "Add retry logic for transient failures",
          executionOrder: 7,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Implement exponential backoff retry for network errors",
            aiInstructions: "Wrap request() with retry logic. Retry 3 times with exponential backoff (1s, 2s, 4s) for network errors. Don't retry auth errors or 4xx errors.",
            acceptanceCriteria: [
              "Network errors retry 3 times with exponential backoff",
              "Auth errors (401) do not retry",
              "Client errors (4xx) do not retry",
              "Server errors (5xx) do retry",
            ],
            filesInvolved: ["packages/orchestrator/src/spectree/api-client.ts"],
          },
        },
        {
          title: "Write unit tests for API client",
          executionOrder: 8,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Test API client methods with mocked HTTP",
            aiInstructions: "Use vitest with msw (Mock Service Worker) or nock for mocking. Test success cases, error handling, and retry logic.",
            filesInvolved: ["packages/orchestrator/tests/unit/api-client.test.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 3: MCP Bridge
    // =========================================================================
    {
      title: "MCP Bridge for Copilot SDK",
      executionOrder: 3,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "core-infra",
      dependencies: [1], // Depends on API Client
      structuredDesc: {
        summary: "Wraps SpecTree MCP tools for Copilot SDK consumption",
        aiInstructions: `Create src/spectree/mcp-bridge.ts that:
1. Defines tools using defineTool() from Copilot SDK
2. Exposes key MCP tools: start_work, complete_work, log_progress, log_decision, link_code_file, link_branch, link_commit
3. Each tool calls the SpecTree API client under the hood
4. Provides consistent error handling

The Copilot SDK requires tools in a specific format - use defineTool() pattern.`,
        acceptanceCriteria: [
          "startWorkTool defined and callable",
          "completeWorkTool defined and callable",
          "logProgressTool defined and callable",
          "logDecisionTool defined and callable",
          "linkCodeFileTool defined and callable",
          "linkBranchTool defined and callable",
          "linkCommitTool defined and callable",
          "All tools use API client, not direct HTTP",
          "Tool definitions compatible with Copilot SDK format",
        ],
        filesInvolved: [
          "packages/orchestrator/src/spectree/mcp-bridge.ts",
        ],
        technicalNotes: `Copilot SDK tool format:
import { defineTool } from "@github/copilot-sdk";

export const startWorkTool = defineTool({
  name: "start_work",
  description: "Mark a feature or task as in-progress",
  parameters: z.object({ id: z.string(), type: z.enum(["feature", "task"]) }),
  execute: async ({ id, type }) => { ... }
});`,
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Research Copilot SDK tool format",
          executionOrder: 1,
          estimatedComplexity: "trivial",
          structuredDesc: {
            summary: "Verify the defineTool() pattern from Copilot SDK",
            aiInstructions: "Check @github/copilot-sdk docs/types. Confirm tool definition format. If SDK not available yet, create compatible interface.",
            filesInvolved: ["packages/orchestrator/src/spectree/mcp-bridge.ts"],
          },
        },
        {
          title: "Implement progress tools (start, complete, log)",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Create startWorkTool, completeWorkTool, logProgressTool",
            aiInstructions: "Each tool should: validate inputs with zod, call API client method, return result. Handle errors consistently.",
            filesInvolved: ["packages/orchestrator/src/spectree/mcp-bridge.ts"],
          },
        },
        {
          title: "Implement decision logging tool",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Create logDecisionTool for recording AI decisions",
            aiInstructions: "Tool should accept: question, decision, rationale, category, alternatives. Call decision API endpoint.",
            filesInvolved: ["packages/orchestrator/src/spectree/mcp-bridge.ts"],
          },
        },
        {
          title: "Implement code context tools",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Create linkCodeFileTool, linkBranchTool, linkCommitTool",
            aiInstructions: "Tools to link code artifacts to features/tasks. Call respective API endpoints.",
            filesInvolved: ["packages/orchestrator/src/spectree/mcp-bridge.ts"],
          },
        },
        {
          title: "Export tool collection",
          executionOrder: 5,
          estimatedComplexity: "trivial",
          structuredDesc: {
            summary: "Export all tools as array for SDK consumption",
            aiInstructions: "Export const spectreeTools = [startWorkTool, completeWorkTool, ...] for use in SDK sessions.",
            filesInvolved: ["packages/orchestrator/src/spectree/mcp-bridge.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 4: Plan Generator
    // =========================================================================
    {
      title: "Plan Generator",
      executionOrder: 4,
      estimatedComplexity: "complex",
      canParallelize: false,
      dependencies: [1], // Depends on API Client
      structuredDesc: {
        summary: "Uses Copilot SDK to create epic structure from natural language prompt",
        aiInstructions: `Create src/orchestrator/plan-generator.ts that:
1. Takes natural language prompt
2. Uses Copilot SDK session to analyze and structure the request
3. Calls SpecTree API to create epic/features/tasks
4. Sets execution metadata (order, complexity, parallelism)

Flow:
1. Create Copilot session with structured prompt
2. AI analyzes prompt and outputs structured JSON
3. Convert JSON to createEpicComplete payload
4. Call API to create epic
5. Return created epic ID and summary`,
        acceptanceCriteria: [
          "generatePlan(prompt, team) creates full epic in SpecTree",
          "Returns created epic ID and feature count",
          "Uses structured prompts to ensure consistent output",
          "Sets executionOrder on all features",
          "Sets estimatedComplexity on all features",
          "Identifies parallelizable work (canParallelize, parallelGroup)",
          "Creates at least one task per feature",
          "Handles AI parsing errors gracefully",
        ],
        filesInvolved: [
          "packages/orchestrator/src/orchestrator/plan-generator.ts",
        ],
        technicalNotes: `System prompt should instruct AI to output JSON like:
{
  "epicName": "...",
  "epicDescription": "...",
  "features": [
    {
      "title": "...",
      "executionOrder": 1,
      "estimatedComplexity": "moderate",
      "canParallelize": false,
      "summary": "...",
      "tasks": [...]
    }
  ]
}`,
        riskLevel: "high",
        estimatedEffort: "large",
      },
      tasks: [
        {
          title: "Create plan generation prompt template",
          executionOrder: 1,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Design system prompt for structured epic generation",
            aiInstructions: `Create a detailed system prompt that:
1. Explains the epic/feature/task hierarchy
2. Requires specific fields (title, executionOrder, complexity, etc.)
3. Instructs on parallelization analysis
4. Outputs valid JSON format
Store as constant in plan-generator.ts`,
            filesInvolved: ["packages/orchestrator/src/orchestrator/plan-generator.ts"],
          },
        },
        {
          title: "Implement generatePlan function",
          executionOrder: 2,
          estimatedComplexity: "complex",
          structuredDesc: {
            summary: "Main function to generate epic from prompt",
            aiInstructions: `Implement generatePlan(prompt: string, team: string):
1. Create Copilot SDK session
2. Send prompt with system instructions
3. Parse JSON response
4. Validate structure
5. Convert to createEpicComplete payload
6. Call API client
7. Return result`,
            acceptanceCriteria: [
              "Creates Copilot SDK session",
              "Sends structured prompt",
              "Parses and validates JSON response",
              "Converts to API payload format",
              "Calls createEpicComplete",
              "Returns epic ID and summary",
            ],
            filesInvolved: ["packages/orchestrator/src/orchestrator/plan-generator.ts"],
          },
        },
        {
          title: "Add JSON parsing with error recovery",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Robust JSON parsing for AI output",
            aiInstructions: "AI sometimes outputs markdown code blocks or extra text. Implement parseAiJson() that extracts JSON from response, handles common issues.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/plan-generator.ts"],
          },
        },
        {
          title: "Add plan validation",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Validate generated plan meets requirements",
            aiInstructions: "Use zod to validate the parsed JSON matches expected structure. Check: all features have executionOrder, all have complexity, all have at least one task.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/plan-generator.ts"],
          },
        },
        {
          title: "Write tests for plan generator",
          executionOrder: 5,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Test plan generation with mocked SDK",
            aiInstructions: "Mock Copilot SDK session. Test: successful generation, JSON parsing, validation errors, API errors.",
            filesInvolved: ["packages/orchestrator/tests/unit/plan-generator.test.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 5: Single Agent Orchestrator
    // =========================================================================
    {
      title: "Single Agent Orchestrator",
      executionOrder: 5,
      estimatedComplexity: "complex",
      canParallelize: false,
      dependencies: [1, 2, 3], // Depends on API Client, MCP Bridge, Plan Generator
      structuredDesc: {
        summary: "Main orchestration controller for sequential agent execution",
        aiInstructions: `Create src/orchestrator/orchestrator.ts that:
1. Loads execution plan from SpecTree
2. Executes items sequentially (single agent)
3. Manages Copilot SDK session lifecycle
4. Reports progress back to SpecTree
5. Handles errors and saves state for recovery

This is the MVP - parallel execution comes in a later feature.`,
        acceptanceCriteria: [
          "run(epicId) executes all features/tasks sequentially",
          "Each item: start_work → agent executes → complete_work",
          "Progress shown in terminal via ora spinners",
          "Errors are caught and reported",
          "Session properly started at beginning",
          "Session properly ended at completion",
          "Can resume from last completed item on failure",
        ],
        filesInvolved: [
          "packages/orchestrator/src/orchestrator/orchestrator.ts",
        ],
        technicalNotes: `Orchestration flow:
1. Load epic from SpecTree
2. Get features sorted by executionOrder
3. For each feature:
   a. Call start_work
   b. Create Copilot session with feature context
   c. Send prompt: "Implement this feature: {description}"
   d. Wait for completion
   e. Call complete_work with summary
4. End SpecTree session with handoff data`,
        riskLevel: "high",
        estimatedEffort: "large",
      },
      tasks: [
        {
          title: "Create orchestrator class structure",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Define Orchestrator class with basic structure",
            aiInstructions: `Create class with:
- constructor(apiClient, config)
- run(epicId): Promise<void>
- private executeFeature(feature)
- private executeTask(task)`,
            filesInvolved: ["packages/orchestrator/src/orchestrator/orchestrator.ts"],
          },
        },
        {
          title: "Implement run() method",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Main orchestration loop",
            aiInstructions: `run(epicId):
1. Get epic from API
2. Get features sorted by executionOrder
3. Start SpecTree session
4. Loop through features, call executeFeature()
5. End session with summary
6. Handle errors at each step`,
            filesInvolved: ["packages/orchestrator/src/orchestrator/orchestrator.ts"],
          },
        },
        {
          title: "Implement executeFeature() method",
          executionOrder: 3,
          estimatedComplexity: "complex",
          structuredDesc: {
            summary: "Execute a single feature with Copilot SDK",
            aiInstructions: `executeFeature(feature):
1. Log start with ora spinner
2. Call apiClient.startWork(feature.id, 'feature')
3. Create Copilot session with spectreeTools
4. Build prompt from feature.structuredDesc
5. await session.sendAndWait(prompt)
6. Parse response for summary
7. Call apiClient.completeWork()
8. Update spinner to success`,
            filesInvolved: ["packages/orchestrator/src/orchestrator/orchestrator.ts"],
          },
        },
        {
          title: "Add progress display",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Terminal progress with ora spinners",
            aiInstructions: "Use ora package. Show: current feature name, progress (x/n), elapsed time. Update on start/complete.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/orchestrator.ts"],
          },
        },
        {
          title: "Add error handling and state saving",
          executionOrder: 5,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Handle errors gracefully and save checkpoint state",
            aiInstructions: `On error:
1. Save current state (completed features) to ~/.spectree/state/{epicId}.json
2. Log helpful error message
3. Suggest resume command
Recovery: Check for state file on run(), skip completed features.`,
            filesInvolved: ["packages/orchestrator/src/orchestrator/orchestrator.ts"],
          },
        },
        {
          title: "Write tests for orchestrator",
          executionOrder: 6,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Test orchestrator with mocked dependencies",
            aiInstructions: "Mock API client and Copilot SDK. Test: full run, error handling, resume from checkpoint.",
            filesInvolved: ["packages/orchestrator/tests/unit/orchestrator.test.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 6: Run Command Implementation
    // =========================================================================
    {
      title: "Run Command Implementation",
      executionOrder: 6,
      estimatedComplexity: "moderate",
      canParallelize: false,
      dependencies: [3, 4], // Depends on Plan Generator, Orchestrator
      structuredDesc: {
        summary: "Replace run command stub with actual implementation",
        aiInstructions: `Update src/cli/commands/run.ts to:
1. Authenticate (check for token, prompt if missing)
2. Call plan generator with prompt
3. Execute orchestrator with created epic
4. Handle --dry-run (show plan without executing)
5. Handle --sequential flag
6. Handle --max-agents flag`,
        acceptanceCriteria: [
          "spectree-agent run 'prompt' creates and executes epic",
          "--dry-run shows plan and exits without executing",
          "--team allows specifying team (prompts if not specified)",
          "--sequential forces sequential execution",
          "--max-agents sets concurrent agent limit",
          "Missing auth prompts for token",
          "Error messages are helpful and actionable",
        ],
        filesInvolved: [
          "packages/orchestrator/src/cli/commands/run.ts",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Add authentication check",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Check for auth token, prompt if missing",
            aiInstructions: "Check config for token. If missing, use inquirer to prompt. Validate token works by calling API.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/run.ts"],
          },
        },
        {
          title: "Implement team selection",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Handle --team flag or prompt for team",
            aiInstructions: "If --team provided, use it. Otherwise, use defaultTeam from config. If neither, prompt with inquirer showing available teams.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/run.ts"],
          },
        },
        {
          title: "Implement dry-run mode",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Show plan without executing when --dry-run",
            aiInstructions: "Call plan generator, display formatted plan (features, tasks, execution order), exit without creating in SpecTree.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/run.ts"],
          },
        },
        {
          title: "Wire up plan generator and orchestrator",
          executionOrder: 4,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Connect all pieces for full run flow",
            aiInstructions: `Flow:
1. Check auth
2. Select team
3. Generate plan (or show dry-run)
4. Create epic in SpecTree
5. Run orchestrator
6. Show summary`,
            filesInvolved: ["packages/orchestrator/src/cli/commands/run.ts"],
          },
        },
        {
          title: "Add error handling and messages",
          executionOrder: 5,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "User-friendly error messages",
            aiInstructions: "Catch errors, display with chalk colors. Include: what went wrong, how to fix, command to retry.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/run.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 7: Git Branch Manager
    // =========================================================================
    {
      title: "Git Branch Manager",
      executionOrder: 7,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "git",
      structuredDesc: {
        summary: "Create and manage git branches for agents",
        aiInstructions: `Create src/git/branch-manager.ts using simple-git package:
1. Create feature branches from base
2. Checkout branches
3. Get current branch
4. List branches by pattern
5. Delete branches`,
        acceptanceCriteria: [
          "createBranch(name, base) creates and checks out new branch",
          "getCurrentBranch() returns current branch name",
          "checkoutBranch(name) switches to existing branch",
          "listBranches(pattern) returns matching branches",
          "deleteBranch(name) removes branch",
          "Handles existing branch gracefully (doesn't fail)",
          "Uses branchPrefix from config",
        ],
        filesInvolved: [
          "packages/orchestrator/src/git/branch-manager.ts",
        ],
        technicalNotes: "Use simple-git package. Branch naming: {branchPrefix}{featureIdentifier} e.g., feature/ENG-42",
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          title: "Implement basic branch operations",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Create, checkout, get current branch",
            aiInstructions: "Use simpleGit(). Implement createBranch, checkoutBranch, getCurrentBranch.",
            filesInvolved: ["packages/orchestrator/src/git/branch-manager.ts"],
          },
        },
        {
          title: "Add branch listing and deletion",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "List and delete branches",
            aiInstructions: "Implement listBranches(pattern) using git branch -l with glob. Implement deleteBranch.",
            filesInvolved: ["packages/orchestrator/src/git/branch-manager.ts"],
          },
        },
        {
          title: "Add branch name generation",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDesc: {
            summary: "Generate branch names from feature identifiers",
            aiInstructions: "Implement getBranchName(featureIdentifier) that uses config.branchPrefix.",
            filesInvolved: ["packages/orchestrator/src/git/branch-manager.ts"],
          },
        },
        {
          title: "Write tests for branch manager",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Test branch operations",
            aiInstructions: "Use vitest. Create temp git repo for tests. Test create, checkout, list, delete.",
            filesInvolved: ["packages/orchestrator/tests/unit/branch-manager.test.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 8: Git Merge Coordinator
    // =========================================================================
    {
      title: "Git Merge Coordinator",
      executionOrder: 8,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "git",
      dependencies: [6], // Depends on Branch Manager
      structuredDesc: {
        summary: "Merge feature branches and handle conflicts",
        aiInstructions: `Create src/git/merge-coordinator.ts:
1. Merge feature branch to base
2. Detect and report conflicts
3. Provide resolution guidance
4. Abort failed merges cleanly`,
        acceptanceCriteria: [
          "mergeBranch(feature, base) merges successfully or throws",
          "Conflict errors include which files conflict",
          "Can abort failed merge cleanly",
          "Provides guidance for manual resolution",
          "Supports --no-ff merge option",
        ],
        filesInvolved: [
          "packages/orchestrator/src/git/merge-coordinator.ts",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Implement merge operation",
          executionOrder: 1,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Merge branch with conflict detection",
            aiInstructions: `Implement mergeBranch(feature, base):
1. Checkout base
2. Attempt merge
3. Check for conflicts
4. If conflict, throw MergeConflictError with file list`,
            filesInvolved: ["packages/orchestrator/src/git/merge-coordinator.ts"],
          },
        },
        {
          title: "Implement abort and cleanup",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Abort failed merge and clean up",
            aiInstructions: "Implement abortMerge() that calls git merge --abort. Clean up any partial state.",
            filesInvolved: ["packages/orchestrator/src/git/merge-coordinator.ts"],
          },
        },
        {
          title: "Add MergeConflictError with guidance",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Rich error with resolution guidance",
            aiInstructions: "MergeConflictError should include: conflicting files, suggested commands to resolve, option to skip.",
            filesInvolved: ["packages/orchestrator/src/errors.ts"],
          },
        },
        {
          title: "Write tests for merge coordinator",
          executionOrder: 4,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Test merge and conflict scenarios",
            aiInstructions: "Create test repo with conflicting changes. Test successful merge, conflict detection, abort.",
            filesInvolved: ["packages/orchestrator/tests/unit/merge-coordinator.test.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 9: Agent Pool for Parallel Execution
    // =========================================================================
    {
      title: "Agent Pool for Parallel Execution",
      executionOrder: 9,
      estimatedComplexity: "complex",
      canParallelize: false,
      dependencies: [4, 6], // Depends on Orchestrator, Branch Manager
      structuredDesc: {
        summary: "Manage multiple concurrent Copilot SDK sessions",
        aiInstructions: `Create src/orchestrator/agent-pool.ts:
1. Spawn N agents up to max limit
2. Track agent status (idle, working, completed, failed)
3. Each agent gets its own branch
4. Clean up sessions on completion
5. Handle failed agents without crashing pool`,
        acceptanceCriteria: [
          "spawnAgent(task, branch) creates new SDK session",
          "waitForAll() resolves when all agents complete",
          "Failed agents don't crash the pool",
          "Respects maxConcurrentAgents config",
          "Each agent has unique worker ID",
          "Agent status trackable (getAgentStatus())",
          "Clean shutdown terminates all sessions",
        ],
        filesInvolved: [
          "packages/orchestrator/src/orchestrator/agent-pool.ts",
        ],
        technicalNotes: `Agent structure:
{
  id: "worker-1",
  status: "working" | "idle" | "completed" | "failed",
  taskId: "ENG-42",
  branch: "feature/ENG-42",
  session: CopilotSession,
  error?: Error
}`,
        riskLevel: "high",
        estimatedEffort: "large",
      },
      tasks: [
        {
          title: "Create Agent and AgentPool types",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Define Agent interface and AgentPool class",
            aiInstructions: "Create types for Agent with id, status, taskId, branch, session. Create AgentPool class structure.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/agent-pool.ts"],
          },
        },
        {
          title: "Implement spawnAgent()",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Create new agent with SDK session and branch",
            aiInstructions: `spawnAgent(item, branchName):
1. Check if pool has capacity
2. Create branch via branch manager
3. Create Copilot SDK session
4. Add agent to pool
5. Return agent ID`,
            filesInvolved: ["packages/orchestrator/src/orchestrator/agent-pool.ts"],
          },
        },
        {
          title: "Implement waitForAll()",
          executionOrder: 3,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Wait for all agents to complete",
            aiInstructions: "Use Promise.all() on agent completion promises. Track results. Don't reject on single failure.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/agent-pool.ts"],
          },
        },
        {
          title: "Implement status tracking",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Track and report agent status",
            aiInstructions: "Implement getAgentStatus(id), getAllAgentStatuses(). Update status as agents progress.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/agent-pool.ts"],
          },
        },
        {
          title: "Implement clean shutdown",
          executionOrder: 5,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Terminate all agents cleanly",
            aiInstructions: "Implement shutdown() that closes all SDK sessions, saves state, reports summary.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/agent-pool.ts"],
          },
        },
        {
          title: "Write tests for agent pool",
          executionOrder: 6,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Test pool management with mocked sessions",
            aiInstructions: "Mock SDK sessions. Test spawn, wait, status tracking, failure handling, shutdown.",
            filesInvolved: ["packages/orchestrator/tests/unit/agent-pool.test.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 10: Phase Executor
    // =========================================================================
    {
      title: "Phase Executor",
      executionOrder: 10,
      estimatedComplexity: "complex",
      canParallelize: false,
      dependencies: [8], // Depends on Agent Pool
      structuredDesc: {
        summary: "Execute execution plan phases with parallel support",
        aiInstructions: `Create src/orchestrator/phase-executor.ts:
1. Execute a single phase from execution plan
2. If canRunInParallel: spawn agents via agent pool
3. If not: execute sequentially with single agent
4. Wait for phase completion before returning
5. Merge branches after parallel phase`,
        acceptanceCriteria: [
          "executePhase(phase) runs all items in phase",
          "Parallel items get separate branches and agents",
          "Sequential items use single agent",
          "Reports individual item progress",
          "Waits for all items before returning",
          "Merges branches after parallel execution",
          "Handles partial failures gracefully",
        ],
        filesInvolved: [
          "packages/orchestrator/src/orchestrator/phase-executor.ts",
        ],
        riskLevel: "high",
        estimatedEffort: "large",
      },
      tasks: [
        {
          title: "Create PhaseExecutor class",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Define class structure",
            aiInstructions: "Create class with constructor(agentPool, branchManager, mergeCoordinator, apiClient).",
            filesInvolved: ["packages/orchestrator/src/orchestrator/phase-executor.ts"],
          },
        },
        {
          title: "Implement sequential execution path",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Execute phase items one at a time",
            aiInstructions: "For phases where canRunInParallel=false, execute items sequentially using single agent (like current orchestrator).",
            filesInvolved: ["packages/orchestrator/src/orchestrator/phase-executor.ts"],
          },
        },
        {
          title: "Implement parallel execution path",
          executionOrder: 3,
          estimatedComplexity: "complex",
          structuredDesc: {
            summary: "Execute phase items in parallel with agent pool",
            aiInstructions: `For phases where canRunInParallel=true:
1. Create branch for each item
2. Spawn agent for each item
3. Wait for all to complete
4. Merge all branches to base`,
            filesInvolved: ["packages/orchestrator/src/orchestrator/phase-executor.ts"],
          },
        },
        {
          title: "Add branch merging after parallel phase",
          executionOrder: 4,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Merge all parallel branches",
            aiInstructions: "After parallel phase completes, merge each branch to base. Handle conflicts by pausing and reporting.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/phase-executor.ts"],
          },
        },
        {
          title: "Write tests for phase executor",
          executionOrder: 5,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Test sequential and parallel paths",
            aiInstructions: "Test both execution paths, branch management, merge handling.",
            filesInvolved: ["packages/orchestrator/tests/unit/phase-executor.test.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 11: Enhanced Orchestrator with Parallel Support
    // =========================================================================
    {
      title: "Enhanced Orchestrator with Parallel Support",
      executionOrder: 11,
      estimatedComplexity: "moderate",
      canParallelize: false,
      dependencies: [9], // Depends on Phase Executor
      structuredDesc: {
        summary: "Update orchestrator to use PhaseExecutor for parallel execution",
        aiInstructions: `Update src/orchestrator/orchestrator.ts to:
1. Load execution plan as phases
2. Execute phases using PhaseExecutor
3. Handle merge conflicts between phases
4. Support --sequential flag to disable parallel`,
        acceptanceCriteria: [
          "Orchestrator uses PhaseExecutor for execution",
          "Parallel phases spawn multiple agents",
          "Branches merged before next phase starts",
          "Merge conflicts pause execution with guidance",
          "--sequential flag forces sequential execution",
          "Progress display shows parallel agent status",
        ],
        filesInvolved: [
          "packages/orchestrator/src/orchestrator/orchestrator.ts",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Refactor orchestrator to use phases",
          executionOrder: 1,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Change from feature list to phase-based execution",
            aiInstructions: "Compute or load execution plan phases. Loop through phases calling phaseExecutor.executePhase().",
            filesInvolved: ["packages/orchestrator/src/orchestrator/orchestrator.ts"],
          },
        },
        {
          title: "Add sequential mode support",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Support --sequential flag",
            aiInstructions: "If sequential mode, force all phases to execute sequentially regardless of canRunInParallel.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/orchestrator.ts"],
          },
        },
        {
          title: "Integrate with run command",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Pass options from run command to orchestrator",
            aiInstructions: "Update run.ts to pass sequential, maxAgents options to orchestrator constructor.",
            filesInvolved: [
              "packages/orchestrator/src/cli/commands/run.ts",
              "packages/orchestrator/src/orchestrator/orchestrator.ts",
            ],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 12: Progress Display UI
    // =========================================================================
    {
      title: "Progress Display UI",
      executionOrder: 12,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "ui",
      structuredDesc: {
        summary: "Terminal-based progress display for orchestration",
        aiInstructions: `Create src/ui/progress.ts:
1. Show overall epic progress (% complete)
2. Show current phase and items
3. Use ora spinners for active work
4. Show completed items with checkmarks
5. Clear error display`,
        acceptanceCriteria: [
          "Progress updates in real-time",
          "Shows which items are in-progress",
          "Shows completed items with checkmarks",
          "Shows overall progress percentage",
          "Clear error display with context",
          "Works with both sequential and parallel",
        ],
        filesInvolved: [
          "packages/orchestrator/src/ui/progress.ts",
        ],
        riskLevel: "low",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Create ProgressDisplay class",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Define progress display interface",
            aiInstructions: "Create class with methods: start(), updateItem(), completeItem(), showError(), finish().",
            filesInvolved: ["packages/orchestrator/src/ui/progress.ts"],
          },
        },
        {
          title: "Implement overall progress display",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Show epic-level progress",
            aiInstructions: "Display: Epic name, total items, completed items, percentage, elapsed time.",
            filesInvolved: ["packages/orchestrator/src/ui/progress.ts"],
          },
        },
        {
          title: "Implement item-level progress",
          executionOrder: 3,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Show individual item status",
            aiInstructions: "Use ora spinner for active item. Show checkmark for completed. Show X for failed.",
            filesInvolved: ["packages/orchestrator/src/ui/progress.ts"],
          },
        },
        {
          title: "Integrate with orchestrator",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Wire progress display to orchestrator events",
            aiInstructions: "Create event emitter in orchestrator. ProgressDisplay subscribes to events.",
            filesInvolved: [
              "packages/orchestrator/src/ui/progress.ts",
              "packages/orchestrator/src/orchestrator/orchestrator.ts",
            ],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 13: Agent Status Display
    // =========================================================================
    {
      title: "Agent Status Display",
      executionOrder: 13,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "ui",
      dependencies: [11], // Depends on Progress Display
      structuredDesc: {
        summary: "Show status of parallel agents in terminal",
        aiInstructions: `Create src/ui/agent-status.ts:
1. Show status of each parallel agent
2. Display agent ID, task, branch, progress
3. Update without flickering
4. Handle dynamic number of agents`,
        acceptanceCriteria: [
          "Multi-line display for parallel agents",
          "Each agent shows: ID, task, branch, progress %",
          "Updates without flickering",
          "Handles agents starting/stopping",
          "Clear when phase completes",
        ],
        filesInvolved: [
          "packages/orchestrator/src/ui/agent-status.ts",
        ],
        riskLevel: "low",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Create AgentStatusDisplay class",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Define agent status display interface",
            aiInstructions: "Methods: addAgent(id), updateAgent(id, status), removeAgent(id), render().",
            filesInvolved: ["packages/orchestrator/src/ui/agent-status.ts"],
          },
        },
        {
          title: "Implement multi-line display",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Render multiple agent statuses",
            aiInstructions: "Use ANSI escape codes to update multiple lines. Each agent on its own line.",
            filesInvolved: ["packages/orchestrator/src/ui/agent-status.ts"],
          },
        },
        {
          title: "Add flicker-free updates",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Update display without visual artifacts",
            aiInstructions: "Use cursor positioning to update in place. Buffer output and write in single operation.",
            filesInvolved: ["packages/orchestrator/src/ui/agent-status.ts"],
          },
        },
        {
          title: "Integrate with agent pool",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Wire display to agent pool events",
            aiInstructions: "Subscribe to agent pool events. Update display on status changes.",
            filesInvolved: [
              "packages/orchestrator/src/ui/agent-status.ts",
              "packages/orchestrator/src/orchestrator/agent-pool.ts",
            ],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 14: Continue Command
    // =========================================================================
    {
      title: "Continue Command",
      executionOrder: 14,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "commands",
      dependencies: [4], // Depends on Orchestrator
      structuredDesc: {
        summary: "Resume work on existing epic",
        aiInstructions: `Update src/cli/commands/continue.ts to:
1. Load existing epic from SpecTree
2. Get execution plan
3. Find next incomplete item
4. Resume orchestration
5. Use session handoff context`,
        acceptanceCriteria: [
          "spectree-agent continue 'Epic Name' resumes work",
          "Reads previous session handoff",
          "--from COM-5 starts from specific feature",
          "Shows what was already completed",
          "Creates new session with handoff context",
        ],
        filesInvolved: [
          "packages/orchestrator/src/cli/commands/continue.ts",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Implement epic lookup",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Find epic by name or ID",
            aiInstructions: "Accept epic name or ID. Call API to get epic. Handle not found error.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/continue.ts"],
          },
        },
        {
          title: "Load progress and find next item",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Determine where to resume",
            aiInstructions: "Get progress summary. Find first incomplete feature. Handle --from flag to override.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/continue.ts"],
          },
        },
        {
          title: "Load session handoff context",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Get context from previous session",
            aiInstructions: "Call getLastSession API. Display previous session summary. Pass context to new session.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/continue.ts"],
          },
        },
        {
          title: "Display completion status",
          executionOrder: 4,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Show what's done and what's remaining",
            aiInstructions: "Display completed features with checkmarks. Show next items to work on.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/continue.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 15: Status Command
    // =========================================================================
    {
      title: "Status Command",
      executionOrder: 15,
      estimatedComplexity: "simple",
      canParallelize: true,
      parallelGroup: "commands",
      structuredDesc: {
        summary: "Show current orchestration status",
        aiInstructions: `Update src/cli/commands/status.ts to:
1. Check for running orchestration
2. If running, show progress and agent status
3. If not running, show last known state
4. Display helpful next steps`,
        acceptanceCriteria: [
          "Shows 'No active orchestration' if none running",
          "Shows epic progress with feature breakdown",
          "Shows agent status if parallel execution active",
          "Suggests next actions",
        ],
        filesInvolved: [
          "packages/orchestrator/src/cli/commands/status.ts",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          title: "Check for active orchestration",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Detect if orchestration is running",
            aiInstructions: "Check for lock file or PID file in ~/.spectree/state/. Or check for active session via API.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/status.ts"],
          },
        },
        {
          title: "Display progress summary",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Show epic and feature progress",
            aiInstructions: "Call getProgressSummary API. Display formatted output with percentages and counts.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/status.ts"],
          },
        },
        {
          title: "Display agent status",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Show parallel agent status if applicable",
            aiInstructions: "If parallel execution active, show each agent's status from state file.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/status.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 16: Pause and Resume Commands
    // =========================================================================
    {
      title: "Pause and Resume Commands",
      executionOrder: 16,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "commands",
      dependencies: [8], // Depends on Agent Pool
      structuredDesc: {
        summary: "Pause and resume running orchestration",
        aiInstructions: `Create src/cli/commands/pause.ts and resume.ts:
1. Pause saves state and stops agents gracefully
2. Resume loads state and continues
3. Support pausing specific agent or all`,
        acceptanceCriteria: [
          "spectree-agent pause pauses all agents",
          "spectree-agent pause worker-1 pauses specific agent",
          "State saved to allow resume",
          "spectree-agent resume continues from pause point",
          "Graceful shutdown on pause",
        ],
        filesInvolved: [
          "packages/orchestrator/src/cli/commands/pause.ts",
          "packages/orchestrator/src/cli/commands/resume.ts",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Implement pause command",
          executionOrder: 1,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Pause running orchestration",
            aiInstructions: `pause command:
1. Find active orchestration (from state/PID)
2. Send pause signal
3. Wait for graceful pause
4. Save state to file`,
            filesInvolved: ["packages/orchestrator/src/cli/commands/pause.ts"],
          },
        },
        {
          title: "Implement resume command",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Resume paused orchestration",
            aiInstructions: `resume command:
1. Load state from file
2. Restore orchestrator state
3. Continue execution`,
            filesInvolved: ["packages/orchestrator/src/cli/commands/resume.ts"],
          },
        },
        {
          title: "Add pause/resume to orchestrator",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Support pause/resume in orchestrator class",
            aiInstructions: "Add pause(), resume(), getState(), restoreState() methods to Orchestrator class.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/orchestrator.ts"],
          },
        },
        {
          title: "Register commands in CLI",
          executionOrder: 4,
          estimatedComplexity: "trivial",
          structuredDesc: {
            summary: "Add pause/resume to commander",
            aiInstructions: "Register pause and resume commands in src/cli/index.ts",
            filesInvolved: ["packages/orchestrator/src/cli/index.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 17: Auth Command Enhancement
    // =========================================================================
    {
      title: "Auth Command Enhancement",
      executionOrder: 17,
      estimatedComplexity: "simple",
      canParallelize: true,
      parallelGroup: "commands",
      structuredDesc: {
        summary: "Improve authentication command with validation",
        aiInstructions: `Update src/cli/commands/auth.ts to:
1. Prompt for token interactively
2. Validate token against API
3. Store securely
4. Show current auth status`,
        acceptanceCriteria: [
          "spectree-agent auth prompts for token",
          "Token validated by calling API",
          "Token stored in ~/.spectree/credentials",
          "spectree-agent auth --status shows current auth",
          "Invalid token shows helpful error",
        ],
        filesInvolved: [
          "packages/orchestrator/src/cli/commands/auth.ts",
        ],
        riskLevel: "low",
        estimatedEffort: "small",
      },
      tasks: [
        {
          title: "Add token validation",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Validate token by calling API",
            aiInstructions: "After getting token, call /api/v1/me to validate. Show error if invalid.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/auth.ts"],
          },
        },
        {
          title: "Add --status flag",
          executionOrder: 2,
          estimatedComplexity: "trivial",
          structuredDesc: {
            summary: "Show current authentication status",
            aiInstructions: "If --status flag, check for token and validate. Show 'Authenticated as X' or 'Not authenticated'.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/auth.ts"],
          },
        },
        {
          title: "Improve credential storage",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Store token securely",
            aiInstructions: "Store in ~/.spectree/credentials with restricted permissions (0600). Use conf package.",
            filesInvolved: ["packages/orchestrator/src/cli/commands/auth.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 18: Comprehensive Error Handling
    // =========================================================================
    {
      title: "Comprehensive Error Handling",
      executionOrder: 18,
      estimatedComplexity: "moderate",
      canParallelize: false,
      structuredDesc: {
        summary: "Robust error handling throughout the orchestrator",
        aiInstructions: `Enhance src/errors.ts and integrate throughout:
1. Typed errors: AuthError, NetworkError, AgentError, MergeConflictError
2. Include context and recovery hints
3. Automatic retry for transient failures
4. Recovery state for crash recovery`,
        acceptanceCriteria: [
          "All errors have code, message, context",
          "Recovery hints are actionable",
          "Network errors retry 3 times",
          "Auth errors don't retry",
          "Agent errors offer retry or skip",
          "State saved after each completed item",
          "Can resume from checkpoint on crash",
        ],
        filesInvolved: [
          "packages/orchestrator/src/errors.ts",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Define comprehensive error types",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Create all error classes",
            aiInstructions: `Create: AuthError, NetworkError, AgentError, MergeConflictError, ValidationError, ConfigError.
Each should have: code, message, context object, recoveryHint.`,
            filesInvolved: ["packages/orchestrator/src/errors.ts"],
          },
        },
        {
          title: "Implement retry wrapper",
          executionOrder: 2,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Reusable retry logic",
            aiInstructions: "Create withRetry(fn, options) that retries with exponential backoff. Options: maxRetries, shouldRetry predicate.",
            filesInvolved: ["packages/orchestrator/src/utils/retry.ts"],
          },
        },
        {
          title: "Implement checkpoint state management",
          executionOrder: 3,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Save and restore checkpoint state",
            aiInstructions: "After each completed item, save state to ~/.spectree/state/{epicId}.json. Include completed IDs, current phase, agent states.",
            filesInvolved: ["packages/orchestrator/src/state/checkpoint.ts"],
          },
        },
        {
          title: "Integrate error handling in orchestrator",
          executionOrder: 4,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Wire up error handling throughout",
            aiInstructions: "Catch errors at each level. Log appropriately. Save state. Provide recovery options.",
            filesInvolved: ["packages/orchestrator/src/orchestrator/orchestrator.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 19: Unit Tests
    // =========================================================================
    {
      title: "Unit Tests",
      executionOrder: 19,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "testing",
      structuredDesc: {
        summary: "Comprehensive unit tests for all modules",
        aiInstructions: `Create tests/unit/ with tests for:
1. Configuration loading
2. API client methods (with mocks)
3. Branch manager
4. Phase execution logic
Target: 80% code coverage`,
        acceptanceCriteria: [
          "Config module has 90%+ coverage",
          "API client has 80%+ coverage",
          "Branch manager has 80%+ coverage",
          "Orchestrator has 70%+ coverage",
          "All tests pass",
          "Tests are fast (< 30s total)",
        ],
        filesInvolved: [
          "packages/orchestrator/tests/unit/",
        ],
        riskLevel: "low",
        estimatedEffort: "large",
      },
      tasks: [
        {
          title: "Set up test infrastructure",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Configure vitest and mocking",
            aiInstructions: "Verify vitest.config.ts. Set up msw or nock for HTTP mocking. Create test utilities.",
            filesInvolved: [
              "packages/orchestrator/vitest.config.ts",
              "packages/orchestrator/tests/setup.ts",
            ],
          },
        },
        {
          title: "Write remaining unit tests",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Fill in missing tests",
            aiInstructions: "Review existing tests. Add tests for any untested modules. Aim for 80% coverage.",
            filesInvolved: ["packages/orchestrator/tests/unit/"],
          },
        },
        {
          title: "Add coverage reporting",
          executionOrder: 3,
          estimatedComplexity: "trivial",
          structuredDesc: {
            summary: "Configure coverage reporting",
            aiInstructions: "Add coverage config to vitest. Add 'pnpm test:coverage' script.",
            filesInvolved: [
              "packages/orchestrator/vitest.config.ts",
              "packages/orchestrator/package.json",
            ],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 20: Integration Tests
    // =========================================================================
    {
      title: "Integration Tests",
      executionOrder: 20,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "testing",
      structuredDesc: {
        summary: "Integration tests for full flows",
        aiInstructions: `Create tests/integration/ with tests for:
1. Full run flow with mocked SDK
2. SpecTree API integration
3. Git operations`,
        acceptanceCriteria: [
          "Full run flow test passes",
          "API integration test passes",
          "Git operations test passes",
          "Tests use real SpecTree API (test instance)",
        ],
        filesInvolved: [
          "packages/orchestrator/tests/integration/",
        ],
        riskLevel: "medium",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Create integration test setup",
          executionOrder: 1,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Set up integration test environment",
            aiInstructions: "Create test setup that starts SpecTree API. Create test team and user.",
            filesInvolved: ["packages/orchestrator/tests/integration/setup.ts"],
          },
        },
        {
          title: "Write full flow integration test",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Test complete run flow",
            aiInstructions: "Test: run command → plan generation → epic creation → orchestration (mocked SDK) → completion.",
            filesInvolved: ["packages/orchestrator/tests/integration/full-flow.test.ts"],
          },
        },
        {
          title: "Write API integration tests",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "Test API client against real API",
            aiInstructions: "Test CRUD operations, progress tracking, against running SpecTree API.",
            filesInvolved: ["packages/orchestrator/tests/integration/api-client.test.ts"],
          },
        },
      ],
    },

    // =========================================================================
    // FEATURE 21: Documentation
    // =========================================================================
    {
      title: "Documentation",
      executionOrder: 21,
      estimatedComplexity: "moderate",
      canParallelize: true,
      parallelGroup: "docs",
      structuredDesc: {
        summary: "User and developer documentation",
        aiInstructions: `Update documentation:
1. packages/orchestrator/README.md - User guide
2. docs/orchestrator-architecture.md - Technical docs`,
        acceptanceCriteria: [
          "README has installation instructions",
          "README has authentication setup",
          "README has command reference with examples",
          "README has troubleshooting guide",
          "Architecture doc has component diagram",
          "Architecture doc has data flow diagrams",
        ],
        filesInvolved: [
          "packages/orchestrator/README.md",
          "docs/orchestrator-architecture.md",
        ],
        riskLevel: "low",
        estimatedEffort: "medium",
      },
      tasks: [
        {
          title: "Update README with user guide",
          executionOrder: 1,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Complete user documentation",
            aiInstructions: "Write: Installation, Quick Start, Authentication, Commands, Configuration, Troubleshooting sections.",
            filesInvolved: ["packages/orchestrator/README.md"],
          },
        },
        {
          title: "Create architecture documentation",
          executionOrder: 2,
          estimatedComplexity: "moderate",
          structuredDesc: {
            summary: "Technical documentation for developers",
            aiInstructions: "Document: Component architecture, data flow, extension points, contributing guide.",
            filesInvolved: ["docs/orchestrator-architecture.md"],
          },
        },
        {
          title: "Add inline code documentation",
          executionOrder: 3,
          estimatedComplexity: "simple",
          structuredDesc: {
            summary: "JSDoc comments for public APIs",
            aiInstructions: "Add JSDoc comments to all exported functions and classes.",
            filesInvolved: ["packages/orchestrator/src/"],
          },
        },
      ],
    },
  ],
};

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================

async function main() {
  console.log("🚀 Creating Parallel Agent Orchestrator Epic in SpecTree...\n");
  console.log(`API URL: ${API_URL}`);
  console.log(`Team: ${TEAM_NAME}\n`);

  // Get auth token
  let token = process.env.SPECTREE_TOKEN;
  if (!token) {
    // Try to read from config file
    const os = await import("os");
    const fs = await import("fs");
    const path = await import("path");
    const configPath = path.join(os.homedir(), ".spectree", "credentials.json");
    try {
      const creds = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      token = creds.token;
    } catch {
      // Ignore - will prompt below
    }
  }

  if (!token) {
    console.error("❌ No authentication token found.");
    console.error("   Set SPECTREE_TOKEN environment variable or create ~/.spectree/credentials.json");
    console.error('   Example: { "token": "your-api-token" }');
    process.exit(1);
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/epics/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(epicPayload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`❌ API Error: ${response.status}`);
      console.error(JSON.stringify(error, null, 2));
      process.exit(1);
    }

    const result = await response.json();
    console.log("✅ Epic created successfully!\n");
    console.log(`Epic ID: ${result.data.epic.id}`);
    console.log(`Epic Name: ${result.data.epic.name}`);
    console.log(`\nSummary:`);
    console.log(`  - Features: ${result.data.summary.totalFeatures}`);
    console.log(`  - Tasks: ${result.data.summary.totalTasks}`);
    console.log(`\nFeatures created:`);
    for (const feature of result.data.features) {
      console.log(`  ${feature.identifier}: ${feature.title} (${feature.tasks.length} tasks)`);
    }
    console.log(`\n🎉 Done! View your epic in SpecTree at http://localhost:3000`);
  } catch (error) {
    console.error("❌ Network error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
