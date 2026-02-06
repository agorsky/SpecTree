/**
 * SpecTree API Client for Orchestrator
 *
 * HTTP client for interacting with the SpecTree REST API.
 * Features:
 * - Bearer token authentication
 * - Automatic retry with exponential backoff
 * - Proper error mapping to orchestrator error types
 * - 30-second request timeout
 */

import {
  AuthError,
  NetworkError,
  SpecTreeAPIError,
  ErrorCode,
} from "../errors.js";
import { getApiUrl } from "../config/index.js";

// =============================================================================
// Types and Interfaces
// =============================================================================

// -----------------------------------------------------------------------------
// Common Types
// -----------------------------------------------------------------------------

/** Pagination metadata */
export interface PaginationMeta {
  cursor: string | null;
  hasMore: boolean;
}

/** Team information */
export interface Team {
  id: string;
  name: string;
  key: string;
}

/** Status information */
export interface Status {
  id: string;
  name: string;
  category: string;
  color: string | null;
}

// -----------------------------------------------------------------------------
// Epic Types
// -----------------------------------------------------------------------------

export interface Epic {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isArchived: boolean;
  teamId: string;
  team?: Team;
  createdAt: string;
  updatedAt: string;
  _count?: { features: number };
}

export interface CreateEpicInput {
  name: string;
  teamId: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateEpicInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

// -----------------------------------------------------------------------------
// Feature Types
// -----------------------------------------------------------------------------

/** Valid complexity values */
export type EstimatedComplexity = "trivial" | "simple" | "moderate" | "complex";

export interface Feature {
  id: string;
  epicId: string;
  identifier: string;
  title: string;
  description: string | null;
  statusId: string | null;
  status?: Status;
  assigneeId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Execution metadata
  executionOrder: number | null;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: string | null; // JSON array of feature IDs
  estimatedComplexity: EstimatedComplexity | null;
  // Blocker
  blockerReason: string | null;
  tasks?: Task[];
  _count?: { tasks: number };
}

export interface CreateFeatureInput {
  title: string;
  epicId: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  executionOrder?: number;
  canParallelize?: boolean;
  parallelGroup?: string;
  dependencies?: string[];
  estimatedComplexity?: EstimatedComplexity;
}

export interface UpdateFeatureInput {
  title?: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  executionOrder?: number;
  canParallelize?: boolean;
  parallelGroup?: string;
  dependencies?: string[];
  estimatedComplexity?: EstimatedComplexity;
}

// -----------------------------------------------------------------------------
// Task Types
// -----------------------------------------------------------------------------

export interface Task {
  id: string;
  featureId: string;
  identifier: string;
  title: string;
  description: string | null;
  statusId: string | null;
  status?: Status;
  assigneeId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Execution metadata
  executionOrder: number | null;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: string | null;
  estimatedComplexity: EstimatedComplexity | null;
  // Blocker
  blockerReason: string | null;
}

export interface CreateTaskInput {
  title: string;
  featureId: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  executionOrder?: number;
  canParallelize?: boolean;
  parallelGroup?: string;
  dependencies?: string[];
  estimatedComplexity?: EstimatedComplexity;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  executionOrder?: number;
  canParallelize?: boolean;
  parallelGroup?: string;
  dependencies?: string[];
  estimatedComplexity?: EstimatedComplexity;
}

// -----------------------------------------------------------------------------
// Execution Plan Types
// -----------------------------------------------------------------------------

export interface ExecutionItem {
  type: "feature" | "task";
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  statusId: string | null;
  epicId?: string;
  executionOrder: number | null;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: string[];
  estimatedComplexity: EstimatedComplexity | null;
}

export interface ExecutionPhase {
  order: number;
  items: ExecutionItem[];
  canRunInParallel: boolean;
  estimatedComplexity: EstimatedComplexity | null;
}

export interface ExecutionPlan {
  epicId: string;
  phases: ExecutionPhase[];
  totalItems: number;
}

// -----------------------------------------------------------------------------
// Session Types
// -----------------------------------------------------------------------------

export type SessionStatus = "active" | "completed" | "abandoned";

export interface SessionWorkItem {
  type: "feature" | "task";
  id: string;
  identifier: string;
  action: string;
  timestamp: string;
}

export interface SessionDecision {
  decision: string;
  rationale?: string;
}

export interface Session {
  id: string;
  epicId: string;
  externalId: string | null;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  itemsWorkedOn: SessionWorkItem[];
  summary: string | null;
  nextSteps: string[] | null;
  blockers: string[] | null;
  decisions: SessionDecision[] | null;
  contextBlob: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartSessionInput {
  epicId: string;
  externalId?: string;
}

export interface EpicProgress {
  totalFeatures: number;
  completedFeatures: number;
  inProgressFeatures: number;
  totalTasks: number;
  completedTasks: number;
}

export interface StartSessionResponse {
  session: Session;
  previousSession: Session | null;
  epicProgress: EpicProgress;
}

export interface SessionHandoff {
  summary?: string;
  nextSteps?: string[];
  blockers?: string[];
  decisions?: SessionDecision[];
  contextBlob?: string;
}

// -----------------------------------------------------------------------------
// Progress Types
// -----------------------------------------------------------------------------

export interface StartWorkInput {
  sessionId?: string;
}

export interface CompleteWorkInput {
  summary?: string;
  sessionId?: string;
}

export interface LogProgressInput {
  message: string;
  percentComplete?: number;
  sessionId?: string;
}

export interface ProgressResponse {
  id: string;
  identifier: string;
  status: string | null;
  startedAt: string | null;
  completedAt: string | null;
  percentComplete: number | null;
}

// -----------------------------------------------------------------------------
// Code Context Types
// -----------------------------------------------------------------------------

export interface CodeContextResponse {
  relatedFiles: string[] | null;
  relatedFunctions: string[] | null;
  gitBranch: string | null;
  gitCommits: string[] | null;
  gitPrNumber: number | null;
  gitPrUrl: string | null;
}

// -----------------------------------------------------------------------------
// Decision Types
// -----------------------------------------------------------------------------

export type DecisionCategory =
  | "architecture"
  | "library"
  | "approach"
  | "scope"
  | "design"
  | "tradeoff"
  | "deferral";

export type ImpactLevel = "low" | "medium" | "high";

export interface CreateDecisionInput {
  epicId: string;
  featureId?: string;
  taskId?: string;
  question: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
  madeBy?: string;
  category?: DecisionCategory;
  impact?: ImpactLevel;
}

export interface Decision {
  id: string;
  epicId: string;
  featureId: string | null;
  taskId: string | null;
  question: string;
  decision: string;
  rationale: string;
  alternatives: string[] | null;
  madeBy: string;
  category: DecisionCategory | null;
  impact: ImpactLevel | null;
  madeAt: string;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Structured Description Types
// -----------------------------------------------------------------------------

export type RiskLevel = "low" | "medium" | "high";
export type EstimatedEffort = "trivial" | "small" | "medium" | "large" | "xl";

export interface ExternalLink {
  url: string;
  title: string;
}

export interface StructuredDescription {
  summary: string;
  aiInstructions?: string;
  acceptanceCriteria?: string[];
  filesInvolved?: string[];
  functionsToModify?: string[];
  testingStrategy?: string;
  testFiles?: string[];
  relatedItemIds?: string[];
  externalLinks?: ExternalLink[];
  technicalNotes?: string;
  riskLevel?: RiskLevel;
  estimatedEffort?: EstimatedEffort;
}

// -----------------------------------------------------------------------------
// Template Types
// -----------------------------------------------------------------------------

export interface TemplateTask {
  titleTemplate: string;
  descriptionPrompt?: string;
  executionOrder: number;
  estimatedComplexity?: EstimatedComplexity;
}

export interface TemplateFeature {
  titleTemplate: string;
  descriptionPrompt?: string;
  executionOrder: number;
  canParallelize?: boolean;
  estimatedComplexity?: EstimatedComplexity;
  tasks?: TemplateTask[];
}

export interface TemplateStructure {
  epicDefaults?: {
    icon?: string;
    color?: string;
    descriptionPrompt?: string;
  };
  features: TemplateFeature[];
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateWithStructure extends Template {
  structure: TemplateStructure;
  availableVariables?: string[];
}

export interface TemplatePreview {
  epicName: string;
  epicDescription?: string;
  features: Array<{
    title: string;
    description: string;
    executionOrder: number;
    canParallelize: boolean;
    tasks: Array<{
      title: string;
      description: string;
      executionOrder: number;
    }>;
  }>;
}

export interface CreateFromTemplateResult {
  epic: Epic;
  features: Feature[];
  tasks: Task[];
}

// -----------------------------------------------------------------------------
// AI Context and Notes Types
// -----------------------------------------------------------------------------

export type AiNoteType =
  | "observation"
  | "decision"
  | "blocker"
  | "next-step"
  | "context";

export interface AiNote {
  id: string;
  noteType: AiNoteType;
  content: string;
  sessionId: string | null;
  createdAt: string;
}

export interface AiContext {
  context: string | null;
  notes: AiNote[];
}

export interface AppendAiNoteInput {
  noteType: AiNoteType;
  content: string;
  sessionId?: string;
}

// -----------------------------------------------------------------------------
// Validation Types
// -----------------------------------------------------------------------------

export type ValidationType =
  | "command"
  | "file_exists"
  | "file_contains"
  | "test_passes"
  | "manual";

export type ValidationStatus = "pending" | "passed" | "failed";

export interface ValidationCheck {
  id: string;
  type: ValidationType;
  description: string;
  status: ValidationStatus;
  command?: string;
  expectedExitCode?: number;
  filePath?: string;
  searchPattern?: string;
  testCommand?: string;
  timeoutMs?: number;
  lastRunAt?: string;
  lastError?: string;
  createdAt: string;
}

export interface ValidationResult {
  check: ValidationCheck;
  passed: boolean;
  error?: string;
  output?: string;
  duration?: number;
}

export interface RunAllValidationsResult {
  taskId: string;
  identifier: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  results: ValidationResult[];
  allPassed: boolean;
}

// -----------------------------------------------------------------------------
// Add Validation Input
// -----------------------------------------------------------------------------

export interface AddValidationInput {
  type: ValidationType;
  description: string;
  command?: string;
  expectedExitCode?: number;
  filePath?: string;
  searchPattern?: string;
  testCommand?: string;
  timeoutMs?: number;
}

// -----------------------------------------------------------------------------
// Report Blocker Types
// -----------------------------------------------------------------------------

export interface ReportBlockerInput {
  reason: string;
  blockedById?: string;
  sessionId?: string;
}

// =============================================================================
// Client Configuration
// =============================================================================

export interface SpecTreeClientOptions {
  apiUrl?: string;
  token: string;
  timeout?: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum retry attempts for transient failures */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const BASE_RETRY_DELAY = 1000;

/** Default request timeout (ms) */
const DEFAULT_TIMEOUT = 30000;

/** Network error codes that trigger retry */
const RETRYABLE_ERROR_CODES = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"];

// =============================================================================
// SpecTree API Client
// =============================================================================

export class SpecTreeClient {
  private baseUrl: string;
  private token: string;
  private timeout: number;

  constructor(options: SpecTreeClientOptions) {
    this.baseUrl = (options.apiUrl ?? getApiUrl()).replace(/\/$/, "");
    this.token = options.token;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  // ---------------------------------------------------------------------------
  // Private Request Methods
  // ---------------------------------------------------------------------------

  /**
   * Make an HTTP request with retry logic and timeout.
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            "User-Agent": "SpecTree-Orchestrator/1.0",
          },
          signal: controller.signal,
        };

        if (body !== undefined) {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        // Handle non-2xx responses
        if (!response.ok) {
          const errorBody = await this.parseErrorBody(response);
          const errorMessage = this.extractErrorMessage(errorBody, response.status);

          // Map HTTP status to appropriate error type
          this.throwMappedError(response.status, errorMessage, path, method, errorBody);
        }

        // Handle 204 No Content
        if (response.status === 204) {
          return undefined as T;
        }

        // Parse successful response
        const data = (await response.json()) as T;
        return data;
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle abort (timeout)
        if (error instanceof DOMException && error.name === "AbortError") {
          throw NetworkError.timeout(this.timeout);
        }

        // Don't retry auth errors or validation errors
        if (error instanceof AuthError || error instanceof SpecTreeAPIError) {
          throw error;
        }

        // Retry network errors
        if (error instanceof NetworkError && error.retryable) {
          lastError = error;
          await this.delay(BASE_RETRY_DELAY * Math.pow(2, attempt));
          continue;
        }

        // Handle raw network errors
        if (this.isNetworkError(error)) {
          lastError = NetworkError.connectionFailed(error instanceof Error ? error : undefined);
          await this.delay(BASE_RETRY_DELAY * Math.pow(2, attempt));
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new NetworkError(`Request failed after ${MAX_RETRIES} attempts`);
  }

  private async parseErrorBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }

  private extractErrorMessage(body: unknown, status: number): string {
    if (typeof body === "object" && body !== null && "message" in body) {
      return (body as { message: string }).message;
    }
    if (typeof body === "object" && body !== null && "error" in body) {
      return (body as { error: string }).error;
    }
    return `HTTP ${status}`;
  }

  private throwMappedError(
    status: number,
    message: string,
    endpoint: string,
    method: string,
    body: unknown
  ): never {
    // Authentication errors
    if (status === 401) {
      throw new AuthError(
        message || "Authentication required",
        ErrorCode.AUTH_INVALID_TOKEN
      );
    }
    if (status === 403) {
      throw new AuthError(
        message || "Access denied",
        ErrorCode.AUTH_INVALID_TOKEN
      );
    }

    // Not found
    if (status === 404) {
      throw SpecTreeAPIError.notFound(endpoint, method, endpoint);
    }

    // Validation errors
    if (status === 400 || status === 422) {
      const errors = this.extractValidationErrors(body);
      throw SpecTreeAPIError.validationError(endpoint, method, errors);
    }

    // Rate limiting - retryable
    if (status === 429) {
      throw new NetworkError("Rate limited", {
        code: ErrorCode.NETWORK_SERVER_ERROR,
        statusCode: 429,
        retryable: true,
      });
    }

    // Server errors - retryable
    if (status >= 500) {
      throw NetworkError.serverError(status, message);
    }

    // Generic API error
    throw new SpecTreeAPIError(message, endpoint, method, {
      statusCode: status,
    });
  }

  private extractValidationErrors(body: unknown): string[] {
    if (typeof body === "object" && body !== null) {
      if ("errors" in body && Array.isArray((body as { errors: unknown }).errors)) {
        return ((body as { errors: unknown[] }).errors).map((e) =>
          typeof e === "string" ? e : JSON.stringify(e)
        );
      }
      if ("message" in body) {
        return [(body as { message: string }).message];
      }
    }
    return ["Validation failed"];
  }

  private isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError) {
      return true; // fetch throws TypeError for network failures
    }
    if (error instanceof Error) {
      const code = (error as NodeJS.ErrnoException).code;
      return code !== undefined && RETRYABLE_ERROR_CODES.includes(code);
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
  }

  // ---------------------------------------------------------------------------
  // Team Operations
  // ---------------------------------------------------------------------------

  /**
   * List teams with optional pagination.
   */
  async listTeams(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ data: Team[]; meta: PaginationMeta }> {
    const query = this.buildQueryString({
      limit: options?.limit,
      cursor: options?.cursor,
    });
    return this.request<{ data: Team[]; meta: PaginationMeta }>("GET", `/teams${query}`);
  }

  /**
   * Get a team by ID, name, or key.
   */
  async getTeam(idOrNameOrKey: string): Promise<Team> {
    const response = await this.request<{ data: Team }>("GET", `/teams/${encodeURIComponent(idOrNameOrKey)}`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Epic Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new epic.
   */
  async createEpic(data: CreateEpicInput): Promise<Epic> {
    const response = await this.request<{ data: Epic }>("POST", "/epics", data);
    return response.data;
  }

  /**
   * Get an epic by ID.
   */
  async getEpic(id: string): Promise<Epic> {
    const response = await this.request<{ data: Epic }>("GET", `/epics/${id}`);
    return response.data;
  }

  /**
   * Update an epic.
   */
  async updateEpic(id: string, data: UpdateEpicInput): Promise<Epic> {
    const response = await this.request<{ data: Epic }>("PUT", `/epics/${id}`, data);
    return response.data;
  }

  /**
   * List epics with optional filters.
   */
  async listEpics(options?: {
    teamId?: string;
    includeArchived?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<{ data: Epic[]; meta: PaginationMeta }> {
    const query = this.buildQueryString({
      teamId: options?.teamId,
      includeArchived: options?.includeArchived,
      limit: options?.limit,
      cursor: options?.cursor,
    });
    return this.request<{ data: Epic[]; meta: PaginationMeta }>("GET", `/epics${query}`);
  }

  // ---------------------------------------------------------------------------
  // Feature Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new feature.
   */
  async createFeature(data: CreateFeatureInput): Promise<Feature> {
    const response = await this.request<{ data: Feature }>("POST", "/features", data);
    return response.data;
  }

  /**
   * Get a feature by ID.
   */
  async getFeature(id: string): Promise<Feature> {
    const response = await this.request<{ data: Feature }>("GET", `/features/${id}`);
    return response.data;
  }

  /**
   * Update a feature.
   */
  async updateFeature(id: string, data: UpdateFeatureInput): Promise<Feature> {
    const response = await this.request<{ data: Feature }>("PUT", `/features/${id}`, data);
    return response.data;
  }

  /**
   * List features with optional filters.
   */
  async listFeatures(options?: {
    epicId?: string;
    statusId?: string;
    assigneeId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ data: Feature[]; meta: PaginationMeta }> {
    const query = this.buildQueryString({
      epicId: options?.epicId,
      statusId: options?.statusId,
      assigneeId: options?.assigneeId,
      limit: options?.limit,
      cursor: options?.cursor,
    });
    return this.request<{ data: Feature[]; meta: PaginationMeta }>("GET", `/features${query}`);
  }

  // ---------------------------------------------------------------------------
  // Task Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new task.
   */
  async createTask(data: CreateTaskInput): Promise<Task> {
    const response = await this.request<{ data: Task }>("POST", "/tasks", data);
    return response.data;
  }

  /**
   * Get a task by ID.
   */
  async getTask(id: string): Promise<Task> {
    const response = await this.request<{ data: Task }>("GET", `/tasks/${id}`);
    return response.data;
  }

  /**
   * Update a task.
   */
  async updateTask(id: string, data: UpdateTaskInput): Promise<Task> {
    const response = await this.request<{ data: Task }>("PUT", `/tasks/${id}`, data);
    return response.data;
  }

  /**
   * List tasks with optional filters.
   */
  async listTasks(options?: {
    featureId?: string;
    epicId?: string;
    statusId?: string;
    assigneeId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ data: Task[]; meta: PaginationMeta }> {
    const query = this.buildQueryString({
      featureId: options?.featureId,
      epicId: options?.epicId,
      statusId: options?.statusId,
      assigneeId: options?.assigneeId,
      limit: options?.limit,
      cursor: options?.cursor,
    });
    return this.request<{ data: Task[]; meta: PaginationMeta }>("GET", `/tasks${query}`);
  }

  // ---------------------------------------------------------------------------
  // Execution Plan
  // ---------------------------------------------------------------------------

  /**
   * Get an execution plan for an epic.
   * Analyzes features and their execution metadata to produce ordered phases.
   */
  async getExecutionPlan(epicId: string): Promise<ExecutionPlan> {
    // Fetch all features for the epic
    const featuresResult = await this.listFeatures({ epicId, limit: 100 });
    const features = featuresResult.data;

    // Parse dependencies and build execution items
    const items: ExecutionItem[] = features.map((f) => ({
      type: "feature" as const,
      id: f.id,
      identifier: f.identifier,
      title: f.title,
      description: f.description,
      statusId: f.statusId,
      executionOrder: f.executionOrder,
      canParallelize: f.canParallelize,
      parallelGroup: f.parallelGroup,
      dependencies: f.dependencies ? (JSON.parse(f.dependencies) as string[]) : [],
      estimatedComplexity: f.estimatedComplexity,
    }));

    // Build execution phases
    const phases = this.buildExecutionPhases(items);

    return {
      epicId,
      phases,
      totalItems: items.length,
    };
  }

  /**
   * Build execution phases from items using topological sort.
   */
  private buildExecutionPhases(items: ExecutionItem[]): ExecutionPhase[] {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const completed = new Set<string>();
    const phases: ExecutionPhase[] = [];

    // Sort items by executionOrder first (nulls at end)
    const sortedItems = [...items].sort((a, b) => {
      if (a.executionOrder === null && b.executionOrder === null) return 0;
      if (a.executionOrder === null) return 1;
      if (b.executionOrder === null) return -1;
      return a.executionOrder - b.executionOrder;
    });

    let remaining = new Set(sortedItems.map((i) => i.id));
    let phaseOrder = 1;

    while (remaining.size > 0) {
      // Find items whose dependencies are all satisfied
      const ready: ExecutionItem[] = [];
      for (const id of remaining) {
        const item = itemMap.get(id)!;
        const deps = item.dependencies;
        const depsResolved = deps.every((depId) => completed.has(depId) || !itemMap.has(depId));
        if (depsResolved) {
          ready.push(item);
        }
      }

      if (ready.length === 0) {
        // Circular dependency or all remaining have unsatisfied deps
        // Add remaining items to a final phase
        const remainingItems = [...remaining].map((id) => itemMap.get(id)!);
        phases.push({
          order: phaseOrder,
          items: remainingItems,
          canRunInParallel: false,
          estimatedComplexity: this.aggregateComplexity(remainingItems),
        });
        break;
      }

      // Group ready items by parallelGroup
      const parallelGroups = new Map<string | null, ExecutionItem[]>();
      for (const item of ready) {
        const group = item.canParallelize ? (item.parallelGroup ?? "default") : null;
        if (!parallelGroups.has(group)) {
          parallelGroups.set(group, []);
        }
        parallelGroups.get(group)!.push(item);
      }

      // Create phases for each group
      for (const [group, groupItems] of parallelGroups) {
        const canParallel = group !== null && groupItems.every((i) => i.canParallelize);
        phases.push({
          order: phaseOrder,
          items: groupItems,
          canRunInParallel: canParallel,
          estimatedComplexity: this.aggregateComplexity(groupItems),
        });

        for (const item of groupItems) {
          completed.add(item.id);
          remaining.delete(item.id);
        }
      }

      phaseOrder++;
    }

    return phases;
  }

  private aggregateComplexity(items: ExecutionItem[]): EstimatedComplexity | null {
    const complexities = items
      .map((i) => i.estimatedComplexity)
      .filter((c): c is EstimatedComplexity => c !== null);

    if (complexities.length === 0) return null;

    const order: EstimatedComplexity[] = ["trivial", "simple", "moderate", "complex"];
    const maxIndex = Math.max(...complexities.map((c) => order.indexOf(c)));
    return order[maxIndex] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  /**
   * Start a new session for an epic.
   */
  async startSession(input: StartSessionInput): Promise<StartSessionResponse> {
    const response = await this.request<{ data: StartSessionResponse }>(
      "POST",
      "/sessions/start",
      input
    );
    return response.data;
  }

  /**
   * End the active session for an epic.
   */
  async endSession(epicId: string, handoff: SessionHandoff): Promise<Session> {
    const response = await this.request<{ data: Session }>(
      "POST",
      `/sessions/${epicId}/end`,
      handoff
    );
    return response.data;
  }

  /**
   * Get the active session for an epic.
   */
  async getActiveSession(epicId: string): Promise<Session | null> {
    try {
      const response = await this.request<{ data: Session }>(
        "GET",
        `/sessions/${epicId}/active`
      );
      return response.data;
    } catch (error) {
      if (error instanceof SpecTreeAPIError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Progress Tracking
  // ---------------------------------------------------------------------------

  /**
   * Start work on a feature or task.
   */
  async startWork(
    type: "feature" | "task",
    id: string,
    input?: StartWorkInput
  ): Promise<ProgressResponse> {
    const basePath = type === "feature" ? "/features" : "/tasks";
    const response = await this.request<{ data: ProgressResponse }>(
      "POST",
      `${basePath}/${id}/progress/start`,
      input ?? {}
    );
    return response.data;
  }

  /**
   * Complete work on a feature or task.
   */
  async completeWork(
    type: "feature" | "task",
    id: string,
    input?: CompleteWorkInput
  ): Promise<ProgressResponse> {
    const basePath = type === "feature" ? "/features" : "/tasks";
    const response = await this.request<{ data: ProgressResponse }>(
      "POST",
      `${basePath}/${id}/progress/complete`,
      input ?? {}
    );
    return response.data;
  }

  /**
   * Log progress on a feature or task without changing status.
   */
  async logProgress(
    type: "feature" | "task",
    id: string,
    input: LogProgressInput
  ): Promise<ProgressResponse> {
    const basePath = type === "feature" ? "/features" : "/tasks";
    const response = await this.request<{ data: ProgressResponse }>(
      "POST",
      `${basePath}/${id}/progress/log`,
      input
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Code Context
  // ---------------------------------------------------------------------------

  /**
   * Link a file to a feature or task.
   */
  async linkCodeFile(
    type: "feature" | "task",
    id: string,
    filePath: string
  ): Promise<void> {
    const basePath = type === "feature" ? "/features" : "/tasks";
    await this.request("POST", `${basePath}/${id}/code-context/files`, { filePath });
  }

  /**
   * Get code context for a feature or task.
   */
  async getCodeContext(
    type: "feature" | "task",
    id: string
  ): Promise<CodeContextResponse> {
    const basePath = type === "feature" ? "/features" : "/tasks";
    const response = await this.request<{ data: CodeContextResponse }>(
      "GET",
      `${basePath}/${id}/code-context`
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Decisions
  // ---------------------------------------------------------------------------

  /**
   * Log a decision with its rationale.
   */
  async logDecision(input: CreateDecisionInput): Promise<Decision> {
    const response = await this.request<{ data: Decision }>(
      "POST",
      "/decisions",
      input
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Structured Descriptions
  // ---------------------------------------------------------------------------

  /**
   * Set the structured description for a feature or task.
   */
  async setStructuredDescription(
    type: "feature" | "task",
    id: string,
    structuredDesc: StructuredDescription
  ): Promise<void> {
    const basePath = type === "feature" ? "/features" : "/tasks";
    await this.request("PUT", `${basePath}/${id}/structured-desc`, structuredDesc);
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  /**
   * List all available templates.
   */
  async listTemplates(): Promise<Template[]> {
    const response = await this.request<{ data: Template[] }>("GET", "/templates");
    return response.data;
  }

  /**
   * Get a template by ID or name.
   */
  async getTemplate(idOrName: string): Promise<TemplateWithStructure> {
    const response = await this.request<{ data: TemplateWithStructure }>(
      "GET",
      `/templates/${encodeURIComponent(idOrName)}`
    );
    return response.data;
  }

  /**
   * Preview what will be created from a template.
   */
  async previewTemplate(
    templateIdOrName: string,
    epicName: string,
    variables?: Record<string, string>
  ): Promise<TemplatePreview> {
    const body: { epicName: string; variables?: Record<string, string> } = { epicName };
    if (variables && Object.keys(variables).length > 0) {
      body.variables = variables;
    }
    const response = await this.request<{ data: TemplatePreview }>(
      "POST",
      `/templates/${encodeURIComponent(templateIdOrName)}/preview`,
      body
    );
    return response.data;
  }

  /**
   * Create a full epic/feature/task structure from a template.
   */
  async createFromTemplate(
    templateIdOrName: string,
    epicName: string,
    teamId: string,
    options?: {
      variables?: Record<string, string>;
      epicDescription?: string;
      epicIcon?: string;
      epicColor?: string;
    }
  ): Promise<CreateFromTemplateResult> {
    const body: {
      epicName: string;
      teamId: string;
      variables?: Record<string, string>;
      epicDescription?: string;
      epicIcon?: string;
      epicColor?: string;
    } = { epicName, teamId };
    if (options?.variables && Object.keys(options.variables).length > 0) {
      body.variables = options.variables;
    }
    if (options?.epicDescription) body.epicDescription = options.epicDescription;
    if (options?.epicIcon) body.epicIcon = options.epicIcon;
    if (options?.epicColor) body.epicColor = options.epicColor;

    const response = await this.request<{ data: CreateFromTemplateResult }>(
      "POST",
      `/templates/${encodeURIComponent(templateIdOrName)}/create`,
      body
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Progress Summary
  // ---------------------------------------------------------------------------

  /**
   * Get progress summary for an epic.
   */
  async getProgressSummary(epicId: string): Promise<{
    epic: { id: string; name: string; description: string | null };
    totalFeatures: number;
    completedFeatures: number;
    inProgressFeatures: number;
    blockedFeatures: number;
    totalTasks: number;
    completedTasks: number;
    overallProgress: number;
  }> {
    const response = await this.request<{ data: unknown }>(
      "GET",
      `/epics/${epicId}/progress-summary`
    );
    return response.data as {
      epic: { id: string; name: string; description: string | null };
      totalFeatures: number;
      completedFeatures: number;
      inProgressFeatures: number;
      blockedFeatures: number;
      totalTasks: number;
      completedTasks: number;
      overallProgress: number;
    };
  }

  // ---------------------------------------------------------------------------
  // AI Context and Notes
  // ---------------------------------------------------------------------------

  /**
   * Get AI context for a feature or task.
   */
  async getAiContext(
    type: "feature" | "task",
    id: string
  ): Promise<AiContext> {
    const endpoint =
      type === "feature"
        ? `/features/${id}/ai-context`
        : `/tasks/${id}/ai-context`;
    const response = await this.request<{ data: AiContext }>("GET", endpoint);
    return response.data;
  }

  /**
   * Append an AI note to a feature or task.
   */
  async appendAiNote(
    type: "feature" | "task",
    id: string,
    input: AppendAiNoteInput
  ): Promise<AiNote> {
    const endpoint =
      type === "feature"
        ? `/features/${id}/ai-notes`
        : `/tasks/${id}/ai-notes`;
    const response = await this.request<{ data: AiNote }>("POST", endpoint, input);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  /**
   * List all validation checks for a task.
   */
  async listValidations(taskId: string): Promise<ValidationCheck[]> {
    const response = await this.request<{ data: ValidationCheck[] }>(
      "GET",
      `/tasks/${taskId}/validations`
    );
    return response.data;
  }

  /**
   * Run a single validation check.
   */
  async runValidation(
    taskId: string,
    checkId: string,
    options?: { workingDirectory?: string }
  ): Promise<ValidationResult> {
    const body: { workingDirectory?: string } = {};
    if (options?.workingDirectory) body.workingDirectory = options.workingDirectory;
    const response = await this.request<{ data: ValidationResult }>(
      "POST",
      `/tasks/${taskId}/validations/${checkId}/run`,
      Object.keys(body).length > 0 ? body : undefined
    );
    return response.data;
  }

  /**
   * Run all validation checks for a task.
   */
  async runAllValidations(
    taskId: string,
    options?: { workingDirectory?: string; stopOnFailure?: boolean }
  ): Promise<RunAllValidationsResult> {
    const body: { workingDirectory?: string; stopOnFailure?: boolean } = {};
    if (options?.workingDirectory) body.workingDirectory = options.workingDirectory;
    if (options?.stopOnFailure !== undefined) body.stopOnFailure = options.stopOnFailure;
    const response = await this.request<{ data: RunAllValidationsResult }>(
      "POST",
      `/tasks/${taskId}/validations/run-all`,
      Object.keys(body).length > 0 ? body : undefined
    );
    return response.data;
  }

  /**
   * Add a validation check to a task.
   */
  async addValidation(
    taskId: string,
    input: AddValidationInput
  ): Promise<ValidationCheck> {
    const response = await this.request<{ data: ValidationCheck }>(
      "POST",
      `/tasks/${taskId}/validations`,
      input
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Report Blocker
  // ---------------------------------------------------------------------------

  /**
   * Report that a feature or task is blocked.
   */
  async reportBlocker(
    type: "feature" | "task",
    id: string,
    input: ReportBlockerInput
  ): Promise<Feature | Task> {
    const endpoint =
      type === "feature"
        ? `/features/${id}/report-blocker`
        : `/tasks/${id}/report-blocker`;
    const response = await this.request<{ data: Feature | Task }>("POST", endpoint, input);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Structured Description
  // ---------------------------------------------------------------------------

  /**
   * Get structured description for a feature or task.
   */
  async getStructuredDescription(
    type: "feature" | "task",
    id: string
  ): Promise<StructuredDescription | null> {
    const endpoint =
      type === "feature"
        ? `/features/${id}/structured-desc`
        : `/tasks/${id}/structured-desc`;
    const response = await this.request<{ data: StructuredDescription | null }>("GET", endpoint);
    return response.data;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new SpecTree client instance.
 */
export function createSpecTreeClient(options: SpecTreeClientOptions): SpecTreeClient {
  return new SpecTreeClient(options);
}
