/**
 * Plan Generator for SpecTree Orchestrator
 *
 * Generates SpecTree epic structures from natural language prompts using the Copilot SDK.
 * Takes a user prompt, analyzes it with AI to produce a structured breakdown, and
 * creates the corresponding epic/features/tasks in SpecTree.
 *
 * Features:
 * - Structured JSON output from AI for reliable parsing
 * - Automatic feature/task creation in SpecTree
 * - Execution metadata (order, complexity, parallelism)
 * - Dry-run mode for plan preview without creation
 */

import { CopilotClient } from "@github/copilot-sdk";
import {
  SpecTreeClient,
  type CreateEpicInput,
  type CreateFeatureInput,
  type CreateTaskInput,
  type Epic,
  type Feature,
  type Task,
  type EstimatedComplexity,
  type StructuredDescription,
  type RiskLevel as ApiRiskLevel,
  type EstimatedEffort as ApiEstimatedEffort,
  type TemplatePreview,
  type CreateFromTemplateResult,
  type AddValidationInput,
} from "../spectree/api-client.js";
import { OrchestratorError, ErrorCode, wrapError } from "../errors.js";
import { getCopilotModel } from "../config/index.js";

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Complexity levels for features and tasks
 */
export type Complexity = "trivial" | "simple" | "moderate" | "complex";

/**
 * Risk level for features and tasks
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * Estimated effort level
 */
export type EstimatedEffort = "trivial" | "small" | "medium" | "large" | "xl";

/**
 * Validation check type for a planned task
 */
export type PlannedValidationType =
  | "command"
  | "file_exists"
  | "file_contains"
  | "test_passes"
  | "manual";

/**
 * A validation check planned by the AI
 */
export interface PlannedValidation {
  type: PlannedValidationType;
  description: string;
  command?: string;
  expectedExitCode?: number;
  filePath?: string;
  searchPattern?: string;
  testCommand?: string;
}

/**
 * A task planned by the AI
 */
export interface PlannedTask {
  title: string;
  description: string;
  estimatedComplexity: Complexity;
  // Structured description fields
  aiInstructions?: string;
  acceptanceCriteria?: string[];
  filesInvolved?: string[];
  technicalNotes?: string;
  riskLevel?: RiskLevel;
  estimatedEffort?: EstimatedEffort;
  // Validation checks
  validations?: PlannedValidation[];
}

/**
 * A feature planned by the AI
 */
export interface PlannedFeature {
  title: string;
  description: string;
  executionOrder: number;
  canParallelize: boolean;
  parallelGroup: string | null;
  estimatedComplexity: Complexity;
  dependencies: number[]; // Indexes of features this depends on
  tasks: PlannedTask[];
  // Structured description fields
  aiInstructions?: string;
  acceptanceCriteria?: string[];
  filesInvolved?: string[];
  technicalNotes?: string;
  riskLevel?: RiskLevel;
  estimatedEffort?: EstimatedEffort;
}

/**
 * The AI's response structure for plan generation
 */
export interface PlannerResponse {
  epicName: string;
  epicDescription: string;
  features: PlannedFeature[];
}

/**
 * A created task with IDs
 */
export interface GeneratedTask {
  id: string;
  identifier: string;
  title: string;
}

/**
 * A created feature with IDs and tasks
 */
export interface GeneratedFeature {
  id: string;
  identifier: string;
  title: string;
  executionOrder: number;
  canParallelize: boolean;
  parallelGroup: string | null;
  estimatedComplexity: Complexity | null;
  tasks: GeneratedTask[];
}

/**
 * The complete generated plan with all created IDs
 */
export interface GeneratedPlan {
  epicId: string;
  epicName: string;
  epicDescription: string;
  features: GeneratedFeature[];
  executionOrder: string[]; // Feature IDs in execution order
  parallelGroups: string[]; // Unique parallel group names
  totalFeatures: number;
  totalTasks: number;
}

/**
 * Options for plan generation
 */
export interface GeneratePlanOptions {
  team: string;
  teamId: string;
  dryRun?: boolean;
  /** Use a template as starting point (by name or ID) */
  template?: string;
}

// =============================================================================
// System Prompt for Planning
// =============================================================================

const PLANNER_SYSTEM_PROMPT = `You are a project planning assistant that breaks down software feature requests into structured implementation plans.

Given a feature request, you must:
1. Create an appropriate epic name and description
2. Break the request into 3-7 logical features
3. For each feature, create 2-5 implementation tasks
4. Identify dependencies between features (which must complete before others)
5. Mark which features can run in parallel (no dependencies, distinct code areas)
6. Estimate complexity for each feature and task
7. Provide detailed AI instructions and acceptance criteria
8. Add validation checks to verify task completion

Complexity levels:
- trivial: Simple config changes, single-line fixes (~15 min)
- simple: Small, well-defined changes (~1 hour)
- moderate: Multi-file changes, some complexity (~2-4 hours)
- complex: Major implementation, many files (~4+ hours)

Risk levels:
- low: Well-understood changes with minimal risk
- medium: Some uncertainty or moderate impact
- high: Significant complexity or broad impact

Effort estimates:
- trivial: Less than 1 hour
- small: 1-4 hours
- medium: 1-2 days
- large: 3-5 days
- xl: More than 5 days

Validation types:
- command: Run a shell command, check exit code (e.g., lint, typecheck)
- file_exists: Verify a file exists
- file_contains: Search file content with regex pattern
- test_passes: Run a specific test command
- manual: Requires human verification

You MUST respond with ONLY valid JSON in exactly this format, with no additional text:
{
  "epicName": "Short descriptive name for the epic",
  "epicDescription": "Detailed description of what this epic accomplishes",
  "features": [
    {
      "title": "Feature title",
      "description": "What this feature implements and why",
      "executionOrder": 1,
      "canParallelize": false,
      "parallelGroup": null,
      "estimatedComplexity": "moderate",
      "dependencies": [],
      "aiInstructions": "Step-by-step guidance for implementing this feature. Be specific about approach, key considerations, and potential pitfalls.",
      "acceptanceCriteria": [
        "Criterion 1: Specific measurable outcome",
        "Criterion 2: Another verifiable condition"
      ],
      "filesInvolved": ["src/path/to/file.ts"],
      "technicalNotes": "Any architectural decisions, constraints, or implementation details",
      "riskLevel": "low",
      "estimatedEffort": "medium",
      "tasks": [
        {
          "title": "Task title",
          "description": "Specific implementation task details",
          "estimatedComplexity": "simple",
          "aiInstructions": "Detailed steps for completing this task",
          "acceptanceCriteria": ["Task-specific acceptance criteria"],
          "filesInvolved": ["src/specific/file.ts"],
          "technicalNotes": "Task-specific technical notes",
          "riskLevel": "low",
          "estimatedEffort": "small",
          "validations": [
            {
              "type": "command",
              "description": "TypeScript compiles without errors",
              "command": "pnpm exec tsc --noEmit",
              "expectedExitCode": 0
            },
            {
              "type": "file_exists",
              "description": "New component file exists",
              "filePath": "src/components/NewComponent.tsx"
            },
            {
              "type": "test_passes",
              "description": "Unit tests pass",
              "testCommand": "pnpm test src/specific/file.test.ts"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- executionOrder is 1-indexed, with 1 being first
- dependencies array contains executionOrder numbers of features that must complete first
- parallelGroup should be a short identifier like "api", "frontend", "tests" when canParallelize is true
- Features with no dependencies and canParallelize=true in the same parallelGroup can run simultaneously
- aiInstructions should be detailed enough for an AI agent to implement without additional context
- acceptanceCriteria should be specific, measurable conditions that can be verified
- filesInvolved should list known or likely files to be modified (can be estimated)
- technicalNotes capture important implementation decisions and constraints
- validations are optional but recommended for verifiable tasks (at least one "command" check for type checking/linting)`;

// =============================================================================
// Plan Generation Errors
// =============================================================================

/**
 * Error thrown when AI response parsing fails
 */
export class PlanParsingError extends OrchestratorError {
  constructor(message: string, rawResponse: string, cause?: Error) {
    const options: {
      context: Record<string, unknown>;
      recoveryHint: string;
      cause?: Error;
    } = {
      context: {
        rawResponse: rawResponse.substring(0, 500), // Truncate for logging
      },
      recoveryHint:
        "The AI response was not in the expected JSON format. Try simplifying your prompt or retrying.",
    };
    if (cause) {
      options.cause = cause;
    }
    super(message, ErrorCode.UNKNOWN_ERROR, options);
    this.name = "PlanParsingError";
  }
}

// =============================================================================
// Plan Generator Class
// =============================================================================

/**
 * Generates SpecTree epic structures from natural language prompts.
 */
export class PlanGenerator {
  private copilotClient: CopilotClient;
  private spectreeClient: SpecTreeClient;
  private model: string;

  constructor(spectreeClient: SpecTreeClient, copilotClient?: CopilotClient) {
    this.spectreeClient = spectreeClient;
    this.copilotClient = copilotClient ?? new CopilotClient();
    this.model = getCopilotModel();
  }

  /**
   * Generate a plan from a natural language prompt.
   *
   * @param prompt - User's feature request in natural language
   * @param options - Generation options including team and dry-run mode
   * @returns The generated plan with all created IDs (or planned structure for dry-run)
   */
  async generatePlan(
    prompt: string,
    options: GeneratePlanOptions
  ): Promise<GeneratedPlan> {
    // Template mode: use a template as starting point
    if (options.template) {
      return this.generateFromTemplate(prompt, { ...options, template: options.template });
    }

    // Step 1: Generate plan structure using Copilot SDK
    const plannerResponse = await this.generatePlanStructure(prompt);

    // Step 2: If dry-run, return the planned structure without creating
    if (options.dryRun) {
      return this.buildDryRunPlan(plannerResponse);
    }

    // Step 3: Create the epic, features, and tasks in SpecTree
    return this.createPlanInSpecTree(plannerResponse, options);
  }

  /**
   * Generate a plan using a template as starting point.
   */
  private async generateFromTemplate(
    prompt: string,
    options: GeneratePlanOptions & { template: string }
  ): Promise<GeneratedPlan> {
    // Extract a good epic name from the prompt (use first line or truncate)
    const epicName = this.extractEpicNameFromPrompt(prompt);

    // For dry-run, preview the template
    if (options.dryRun) {
      const preview: TemplatePreview = await this.spectreeClient.previewTemplate(
        options.template,
        epicName
      );
      return this.buildDryRunPlanFromPreview(preview);
    }

    // Create from template
    const result: CreateFromTemplateResult = await this.spectreeClient.createFromTemplate(
      options.template,
      epicName,
      options.teamId,
      { epicDescription: prompt }
    );

    return this.buildPlanFromTemplateResult(result);
  }

  /**
   * Extract a suitable epic name from the prompt.
   */
  private extractEpicNameFromPrompt(prompt: string): string {
    // Use first line if it's short enough
    const firstLine = prompt.split("\n")[0] ?? prompt;
    if (firstLine && firstLine.length <= 100) {
      return firstLine.trim();
    }
    // Otherwise truncate
    return prompt.substring(0, 97).trim() + "...";
  }

  /**
   * Build a dry-run plan from a template preview.
   */
  private buildDryRunPlanFromPreview(preview: TemplatePreview): GeneratedPlan {
    const features: GeneratedFeature[] = preview.features.map((f, index) => ({
      id: `template-feature-${index + 1}`,
      identifier: `TPL-${index + 1}`,
      title: f.title,
      executionOrder: f.executionOrder,
      canParallelize: f.canParallelize,
      parallelGroup: null,
      estimatedComplexity: null,
      tasks: f.tasks.map((t, tIndex) => ({
        id: `template-task-${index + 1}-${tIndex + 1}`,
        identifier: `TPL-${index + 1}-${tIndex + 1}`,
        title: t.title,
      })),
    }));

    const executionOrder = features
      .sort((a, b) => a.executionOrder - b.executionOrder)
      .map((f) => f.id);

    return {
      epicId: "template-preview",
      epicName: preview.epicName,
      epicDescription: preview.epicDescription ?? "",
      features,
      executionOrder,
      parallelGroups: [],
      totalFeatures: features.length,
      totalTasks: features.reduce((sum, f) => sum + f.tasks.length, 0),
    };
  }

  /**
   * Build a GeneratedPlan from a template creation result.
   */
  private buildPlanFromTemplateResult(result: CreateFromTemplateResult): GeneratedPlan {
    // Group tasks by feature
    const tasksByFeature = new Map<string, Task[]>();
    for (const task of result.tasks) {
      const existing = tasksByFeature.get(task.featureId) ?? [];
      existing.push(task);
      tasksByFeature.set(task.featureId, existing);
    }

    const features: GeneratedFeature[] = result.features.map((f) => {
      const featureTasks = tasksByFeature.get(f.id) ?? [];
      return {
        id: f.id,
        identifier: f.identifier,
        title: f.title,
        executionOrder: f.executionOrder ?? 0,
        canParallelize: f.canParallelize,
        parallelGroup: f.parallelGroup,
        estimatedComplexity: f.estimatedComplexity,
        tasks: featureTasks.map((t) => ({
          id: t.id,
          identifier: t.identifier,
          title: t.title,
        })),
      };
    });

    // Extract unique parallel groups
    const parallelGroups = [
      ...new Set(
        features
          .filter((f) => f.parallelGroup)
          .map((f) => f.parallelGroup as string)
      ),
    ];

    // Build execution order
    const executionOrder = features
      .sort((a, b) => a.executionOrder - b.executionOrder)
      .map((f) => f.id);

    return {
      epicId: result.epic.id,
      epicName: result.epic.name,
      epicDescription: result.epic.description ?? "",
      features,
      executionOrder,
      parallelGroups,
      totalFeatures: features.length,
      totalTasks: result.tasks.length,
    };
  }

  /**
   * Use the Copilot SDK to generate a structured plan from the prompt.
   */
  private async generatePlanStructure(prompt: string): Promise<PlannerResponse> {
    const session = await this.copilotClient.createSession({
      model: this.model,
      systemMessage: { content: PLANNER_SYSTEM_PROMPT },
    });

    try {
      const response = await session.sendAndWait({
        prompt: `Create an implementation plan for the following feature request:\n\n${prompt}`,
      });

      // Extract content from the response
      if (!response) {
        throw new PlanParsingError(
          "No response received from AI",
          ""
        );
      }

      const content = response.data.content;
      if (!content) {
        throw new PlanParsingError(
          "Empty response content from AI",
          ""
        );
      }

      // Parse the AI response as JSON
      return this.parseAIResponse(content);
    } finally {
      // Clean up the session
      await session.destroy();
    }
  }

  /**
   * Parse and validate the AI's JSON response.
   */
  private parseAIResponse(content: string): PlannerResponse {
    // Try to extract JSON from the response (AI might include extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new PlanParsingError(
        "No JSON object found in AI response",
        content
      );
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      return this.validatePlannerResponse(parsed);
    } catch (error) {
      if (error instanceof PlanParsingError) {
        throw error;
      }
      throw new PlanParsingError(
        "Failed to parse AI response as JSON",
        content,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate the parsed response matches expected structure.
   */
  private validatePlannerResponse(data: unknown): PlannerResponse {
    if (typeof data !== "object" || data === null) {
      throw new PlanParsingError(
        "AI response is not an object",
        JSON.stringify(data)
      );
    }

    const obj = data as Record<string, unknown>;

    // Validate required fields
    if (typeof obj.epicName !== "string" || !obj.epicName) {
      throw new PlanParsingError(
        "Missing or invalid epicName in AI response",
        JSON.stringify(data)
      );
    }

    if (!Array.isArray(obj.features) || obj.features.length === 0) {
      throw new PlanParsingError(
        "Missing or empty features array in AI response",
        JSON.stringify(data)
      );
    }

    // Validate each feature
    const features: PlannedFeature[] = [];
    for (let i = 0; i < obj.features.length; i++) {
      const feature = obj.features[i] as Record<string, unknown>;
      features.push(this.validateFeature(feature, i));
    }

    return {
      epicName: obj.epicName,
      epicDescription:
        typeof obj.epicDescription === "string" ? obj.epicDescription : "",
      features,
    };
  }

  /**
   * Validate a single feature in the response.
   */
  private validateFeature(
    feature: Record<string, unknown>,
    index: number
  ): PlannedFeature {
    if (typeof feature.title !== "string" || !feature.title) {
      throw new PlanParsingError(
        `Feature ${index + 1} missing title`,
        JSON.stringify(feature)
      );
    }

    const tasks: PlannedTask[] = [];
    if (Array.isArray(feature.tasks)) {
      for (let i = 0; i < feature.tasks.length; i++) {
        const task = feature.tasks[i] as Record<string, unknown>;
        tasks.push(this.validateTask(task, index, i));
      }
    }

    const result: PlannedFeature = {
      title: feature.title,
      description:
        typeof feature.description === "string" ? feature.description : "",
      executionOrder:
        typeof feature.executionOrder === "number" ? feature.executionOrder : index + 1,
      canParallelize: Boolean(feature.canParallelize),
      parallelGroup:
        typeof feature.parallelGroup === "string" ? feature.parallelGroup : null,
      estimatedComplexity: this.validateComplexity(feature.estimatedComplexity),
      dependencies: Array.isArray(feature.dependencies)
        ? (feature.dependencies as number[]).filter(
            (d) => typeof d === "number"
          )
        : [],
      tasks,
    };

    // Extract structured description fields
    if (typeof feature.aiInstructions === "string" && feature.aiInstructions) {
      result.aiInstructions = feature.aiInstructions;
    }
    if (Array.isArray(feature.acceptanceCriteria)) {
      result.acceptanceCriteria = (feature.acceptanceCriteria as unknown[])
        .filter((c): c is string => typeof c === "string");
    }
    if (Array.isArray(feature.filesInvolved)) {
      result.filesInvolved = (feature.filesInvolved as unknown[])
        .filter((f): f is string => typeof f === "string");
    }
    if (typeof feature.technicalNotes === "string" && feature.technicalNotes) {
      result.technicalNotes = feature.technicalNotes;
    }
    if (this.isValidRiskLevel(feature.riskLevel)) {
      result.riskLevel = feature.riskLevel;
    }
    if (this.isValidEstimatedEffort(feature.estimatedEffort)) {
      result.estimatedEffort = feature.estimatedEffort;
    }

    return result;
  }

  /**
   * Validate a single task in the response.
   */
  private validateTask(
    task: Record<string, unknown>,
    featureIndex: number,
    taskIndex: number
  ): PlannedTask {
    if (typeof task.title !== "string" || !task.title) {
      throw new PlanParsingError(
        `Task ${taskIndex + 1} in feature ${featureIndex + 1} missing title`,
        JSON.stringify(task)
      );
    }

    const result: PlannedTask = {
      title: task.title,
      description: typeof task.description === "string" ? task.description : "",
      estimatedComplexity: this.validateComplexity(task.estimatedComplexity),
    };

    // Extract structured description fields
    if (typeof task.aiInstructions === "string" && task.aiInstructions) {
      result.aiInstructions = task.aiInstructions;
    }
    if (Array.isArray(task.acceptanceCriteria)) {
      result.acceptanceCriteria = (task.acceptanceCriteria as unknown[])
        .filter((c): c is string => typeof c === "string");
    }
    if (Array.isArray(task.filesInvolved)) {
      result.filesInvolved = (task.filesInvolved as unknown[])
        .filter((f): f is string => typeof f === "string");
    }
    if (typeof task.technicalNotes === "string" && task.technicalNotes) {
      result.technicalNotes = task.technicalNotes;
    }
    if (this.isValidRiskLevel(task.riskLevel)) {
      result.riskLevel = task.riskLevel;
    }
    if (this.isValidEstimatedEffort(task.estimatedEffort)) {
      result.estimatedEffort = task.estimatedEffort;
    }

    return result;
  }

  /**
   * Validate and normalize complexity value.
   */
  private validateComplexity(value: unknown): Complexity {
    const validComplexities: Complexity[] = [
      "trivial",
      "simple",
      "moderate",
      "complex",
    ];
    if (typeof value === "string" && validComplexities.includes(value as Complexity)) {
      return value as Complexity;
    }
    return "moderate"; // Default
  }

  /**
   * Type guard for RiskLevel values.
   */
  private isValidRiskLevel(value: unknown): value is RiskLevel {
    return typeof value === "string" && ["low", "medium", "high"].includes(value);
  }

  /**
   * Type guard for EstimatedEffort values.
   */
  private isValidEstimatedEffort(value: unknown): value is EstimatedEffort {
    return typeof value === "string" && ["trivial", "small", "medium", "large", "xl"].includes(value);
  }

  /**
   * Build a dry-run plan without creating anything in SpecTree.
   */
  private buildDryRunPlan(response: PlannerResponse): GeneratedPlan {
    const features: GeneratedFeature[] = response.features.map((f, index) => ({
      id: `dry-run-feature-${index + 1}`,
      identifier: `DRY-${index + 1}`,
      title: f.title,
      executionOrder: f.executionOrder,
      canParallelize: f.canParallelize,
      parallelGroup: f.parallelGroup,
      estimatedComplexity: f.estimatedComplexity,
      tasks: f.tasks.map((t, tIndex) => ({
        id: `dry-run-task-${index + 1}-${tIndex + 1}`,
        identifier: `DRY-${index + 1}-${tIndex + 1}`,
        title: t.title,
      })),
    }));

    // Extract unique parallel groups
    const parallelGroups = [
      ...new Set(
        response.features
          .filter((f) => f.parallelGroup)
          .map((f) => f.parallelGroup as string)
      ),
    ];

    // Build execution order
    const executionOrder = features
      .sort((a, b) => a.executionOrder - b.executionOrder)
      .map((f) => f.id);

    return {
      epicId: "dry-run-epic",
      epicName: response.epicName,
      epicDescription: response.epicDescription,
      features,
      executionOrder,
      parallelGroups,
      totalFeatures: features.length,
      totalTasks: features.reduce((sum, f) => sum + f.tasks.length, 0),
    };
  }

  /**
   * Create the epic, features, and tasks in SpecTree.
   */
  private async createPlanInSpecTree(
    response: PlannerResponse,
    options: GeneratePlanOptions
  ): Promise<GeneratedPlan> {
    // Step 1: Create the epic
    const epicInput: CreateEpicInput = {
      name: response.epicName,
      teamId: options.teamId,
      description: response.epicDescription,
    };

    let epic: Epic;
    try {
      epic = await this.spectreeClient.createEpic(epicInput);
    } catch (error) {
      throw wrapError(error, "Failed to create epic in SpecTree");
    }

    // Step 2: Create features and collect ID mapping
    const featureIdMap = new Map<number, string>(); // executionOrder -> featureId
    const createdFeatures: GeneratedFeature[] = [];

    for (const plannedFeature of response.features) {
      const feature = await this.createFeature(
        epic.id,
        plannedFeature,
        featureIdMap
      );
      featureIdMap.set(plannedFeature.executionOrder, feature.id);
      createdFeatures.push(feature);
    }

    // Extract unique parallel groups
    const parallelGroups = [
      ...new Set(
        createdFeatures
          .filter((f) => f.parallelGroup)
          .map((f) => f.parallelGroup as string)
      ),
    ];

    // Build execution order
    const executionOrder = createdFeatures
      .sort((a, b) => a.executionOrder - b.executionOrder)
      .map((f) => f.id);

    return {
      epicId: epic.id,
      epicName: epic.name,
      epicDescription: epic.description ?? "",
      features: createdFeatures,
      executionOrder,
      parallelGroups,
      totalFeatures: createdFeatures.length,
      totalTasks: createdFeatures.reduce((sum, f) => sum + f.tasks.length, 0),
    };
  }

  /**
   * Create a single feature with its tasks.
   */
  private async createFeature(
    epicId: string,
    planned: PlannedFeature,
    featureIdMap: Map<number, string>
  ): Promise<GeneratedFeature> {
    // Resolve dependencies from executionOrder to feature IDs
    const dependencyIds = planned.dependencies
      .map((order) => featureIdMap.get(order))
      .filter((id): id is string => id !== undefined);

    // Build input, only including optional fields if they have values
    const featureInput: CreateFeatureInput = {
      title: planned.title,
      epicId,
      description: planned.description,
      executionOrder: planned.executionOrder,
      canParallelize: planned.canParallelize,
      estimatedComplexity: planned.estimatedComplexity as EstimatedComplexity,
    };
    if (planned.parallelGroup !== null) {
      featureInput.parallelGroup = planned.parallelGroup;
    }
    if (dependencyIds.length > 0) {
      featureInput.dependencies = dependencyIds;
    }

    let feature: Feature;
    try {
      feature = await this.spectreeClient.createFeature(featureInput);
    } catch (error) {
      throw wrapError(
        error,
        `Failed to create feature "${planned.title}" in SpecTree`
      );
    }

    // Set structured description if we have any structured fields
    if (this.hasStructuredDescriptionFields(planned)) {
      try {
        await this.spectreeClient.setStructuredDescription("feature", feature.id, 
          this.buildStructuredDescription(planned)
        );
      } catch (error) {
        // Log but don't fail - the feature was created successfully
        console.warn(`Warning: Failed to set structured description for feature ${feature.identifier}:`, error);
      }
    }

    // Create tasks for this feature
    const createdTasks: GeneratedTask[] = [];
    for (let i = 0; i < planned.tasks.length; i++) {
      const plannedTask = planned.tasks[i];
      if (plannedTask) {
        const task = await this.createTask(feature.id, plannedTask, i + 1);
        createdTasks.push(task);
      }
    }

    return {
      id: feature.id,
      identifier: feature.identifier,
      title: feature.title,
      executionOrder: planned.executionOrder,
      canParallelize: planned.canParallelize,
      parallelGroup: planned.parallelGroup,
      estimatedComplexity: planned.estimatedComplexity,
      tasks: createdTasks,
    };
  }

  /**
   * Create a single task.
   */
  private async createTask(
    featureId: string,
    planned: PlannedTask,
    order: number
  ): Promise<GeneratedTask> {
    const taskInput: CreateTaskInput = {
      title: planned.title,
      featureId,
      description: planned.description,
      executionOrder: order,
      estimatedComplexity: planned.estimatedComplexity as EstimatedComplexity,
    };

    let task: Task;
    try {
      task = await this.spectreeClient.createTask(taskInput);
    } catch (error) {
      throw wrapError(
        error,
        `Failed to create task "${planned.title}" in SpecTree`
      );
    }

    // Set structured description if we have any structured fields
    if (this.hasStructuredDescriptionFields(planned)) {
      try {
        await this.spectreeClient.setStructuredDescription("task", task.id,
          this.buildStructuredDescription(planned)
        );
      } catch (error) {
        // Log but don't fail - the task was created successfully
        console.warn(`Warning: Failed to set structured description for task ${task.identifier}:`, error);
      }
    }

    // Create validation checks if specified
    if (planned.validations && planned.validations.length > 0) {
      for (const validation of planned.validations) {
        try {
          // Build input object conditionally to satisfy exactOptionalPropertyTypes
          const validationInput: AddValidationInput = {
            type: validation.type,
            description: validation.description,
          };
          if (validation.command) validationInput.command = validation.command;
          if (validation.expectedExitCode !== undefined) validationInput.expectedExitCode = validation.expectedExitCode;
          if (validation.filePath) validationInput.filePath = validation.filePath;
          if (validation.searchPattern) validationInput.searchPattern = validation.searchPattern;
          if (validation.testCommand) validationInput.testCommand = validation.testCommand;

          await this.spectreeClient.addValidation(task.id, validationInput);
        } catch (error) {
          // Log but don't fail - the task was created successfully
          console.warn(`Warning: Failed to add validation "${validation.description}" for task ${task.identifier}:`, error);
        }
      }
    }

    return {
      id: task.id,
      identifier: task.identifier,
      title: task.title,
    };
  }

  /**
   * Check if a planned item has any structured description fields.
   */
  private hasStructuredDescriptionFields(planned: PlannedFeature | PlannedTask): boolean {
    return !!(
      planned.aiInstructions ||
      planned.acceptanceCriteria?.length ||
      planned.filesInvolved?.length ||
      planned.technicalNotes ||
      planned.riskLevel ||
      planned.estimatedEffort
    );
  }

  /**
   * Build a StructuredDescription from a PlannedFeature or PlannedTask.
   */
  private buildStructuredDescription(planned: PlannedFeature | PlannedTask): StructuredDescription {
    const desc: StructuredDescription = {
      summary: planned.description || planned.title,
    };
    if (planned.aiInstructions) desc.aiInstructions = planned.aiInstructions;
    if (planned.acceptanceCriteria?.length) desc.acceptanceCriteria = planned.acceptanceCriteria;
    if (planned.filesInvolved?.length) desc.filesInvolved = planned.filesInvolved;
    if (planned.technicalNotes) desc.technicalNotes = planned.technicalNotes;
    if (planned.riskLevel) desc.riskLevel = planned.riskLevel as ApiRiskLevel;
    if (planned.estimatedEffort) desc.estimatedEffort = planned.estimatedEffort as ApiEstimatedEffort;
    return desc;
  }
}

// =============================================================================
// Convenience Function
// =============================================================================

/**
 * Generate a plan from a natural language prompt.
 *
 * @param prompt - User's feature request in natural language
 * @param options - Generation options including team and dry-run mode
 * @param spectreeClient - SpecTree API client
 * @param copilotClient - Optional Copilot SDK client (created if not provided)
 * @returns The generated plan with all created IDs
 */
export async function generatePlan(
  prompt: string,
  options: GeneratePlanOptions,
  spectreeClient: SpecTreeClient,
  copilotClient?: CopilotClient
): Promise<GeneratedPlan> {
  const generator = new PlanGenerator(spectreeClient, copilotClient);
  return generator.generatePlan(prompt, options);
}
