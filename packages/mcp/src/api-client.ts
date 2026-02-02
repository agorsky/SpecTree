/**
 * HTTP API Client for SpecTree MCP
 *
 * This module provides a type-safe HTTP client for communicating with the SpecTree API.
 * It replaces direct Prisma database calls with authenticated HTTP requests.
 *
 * Features:
 * - Bearer token authentication (API tokens with st_ prefix)
 * - Automatic retry with exponential backoff for network/server errors
 * - Type-safe request/response handling
 * - Comprehensive error handling
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

/** API Error class for handling HTTP errors */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Pagination metadata returned by list endpoints */
export interface PaginationMeta {
  cursor: string | null;
  hasMore: boolean;
}

/** Team information included in responses */
export interface Team {
  id: string;
  name: string;
  key: string;
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

export interface ListEpicsParams {
  team?: string | undefined;
  includeArchived?: boolean | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface ListEpicsResponse {
  data: Epic[];
  meta: PaginationMeta;
}

export interface CreateEpicData {
  name: string;
  teamId: string;
  description?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
}

// -----------------------------------------------------------------------------
// Feature Types
// -----------------------------------------------------------------------------

/** Valid values for estimated complexity */
export type EstimatedComplexity = "trivial" | "simple" | "moderate" | "complex";

export interface Feature {
  id: string;
  epicId: string;
  identifier: string;
  title: string;
  description: string | null;
  statusId: string | null;
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
  tasks?: Task[];
  _count?: { tasks: number };
}

export interface ListFeaturesParams {
  epic?: string | undefined;
  epicId?: string | undefined;
  status?: string | undefined;
  statusId?: string | undefined;
  statusCategory?: string | undefined;
  assignee?: string | undefined;
  assigneeId?: string | undefined;
  query?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface ListFeaturesResponse {
  data: Feature[];
  meta: PaginationMeta;
}

export interface CreateFeatureData {
  title: string;
  epicId: string;
  description?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  // Execution metadata
  executionOrder?: number | undefined;
  canParallelize?: boolean | undefined;
  parallelGroup?: string | undefined;
  dependencies?: string[] | undefined;
  estimatedComplexity?: EstimatedComplexity | undefined;
}

export interface UpdateFeatureData {
  title?: string | undefined;
  description?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  // Execution metadata
  executionOrder?: number | undefined;
  canParallelize?: boolean | undefined;
  parallelGroup?: string | undefined;
  dependencies?: string[] | undefined;
  estimatedComplexity?: EstimatedComplexity | undefined;
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
  assigneeId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Execution metadata
  executionOrder: number | null;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: string | null; // JSON array of task IDs
  estimatedComplexity: EstimatedComplexity | null;
}

export interface ListTasksParams {
  feature?: string | undefined;
  featureId?: string | undefined;
  epicId?: string | undefined;
  status?: string | undefined;
  statusId?: string | undefined;
  statusCategory?: string | undefined;
  assignee?: string | undefined;
  assigneeId?: string | undefined;
  query?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface ListTasksResponse {
  data: Task[];
  meta: PaginationMeta;
}

export interface CreateTaskData {
  title: string;
  featureId: string;
  description?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  // Execution metadata
  executionOrder?: number | undefined;
  canParallelize?: boolean | undefined;
  parallelGroup?: string | undefined;
  dependencies?: string[] | undefined;
  estimatedComplexity?: EstimatedComplexity | undefined;
}

export interface UpdateTaskData {
  title?: string | undefined;
  description?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  // Execution metadata
  executionOrder?: number | undefined;
  canParallelize?: boolean | undefined;
  parallelGroup?: string | undefined;
  dependencies?: string[] | undefined;
  estimatedComplexity?: EstimatedComplexity | undefined;
}

// -----------------------------------------------------------------------------
// Status Types
// -----------------------------------------------------------------------------

export interface Status {
  id: string;
  name: string;
  category: string;
  color: string | null;
  position: number;
  teamId: string | null;
  personalScopeId?: string | null;
}

export interface ListStatusesResponse {
  data: Status[];
}

// -----------------------------------------------------------------------------
// Personal Scope Types
// -----------------------------------------------------------------------------

/** Personal scope information */
export interface PersonalScope {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** Personal epic (extends Epic but has personalScopeId instead of teamId) */
export interface PersonalEpic {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isArchived: boolean;
  personalScopeId: string;
  teamId: null;
  createdAt: string;
  updatedAt: string;
  _count?: { features: number };
}

export interface ListPersonalEpicsParams {
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface ListPersonalEpicsResponse {
  data: PersonalEpic[];
  meta: PaginationMeta;
}

export interface CreatePersonalEpicData {
  name: string;
  description?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
}

// Backwards compatibility aliases (API still uses /me/projects endpoints)
export type PersonalProject = PersonalEpic;
export type ListPersonalProjectsParams = ListPersonalEpicsParams;
export type ListPersonalProjectsResponse = ListPersonalEpicsResponse;
export type CreatePersonalProjectData = CreatePersonalEpicData;

export interface PersonalStatus {
  id: string;
  name: string;
  category: string;
  color: string | null;
  position: number;
  personalScopeId: string;
  teamId: null;
}

export interface ListPersonalStatusesResponse {
  data: PersonalStatus[];
}

// -----------------------------------------------------------------------------
// Search Types
// -----------------------------------------------------------------------------

export interface SearchParams {
  query?: string | undefined;
  epic?: string | undefined;
  status?: string | undefined;
  statusCategory?: string | undefined;
  assignee?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  type?: "feature" | "task" | "all" | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface SearchResultItem {
  type: "feature" | "task";
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  statusId: string | null;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  epicId?: string;
  featureId?: string;
}

export interface SearchResponse {
  results: SearchResultItem[];
  meta: {
    total: number;
    cursor: string | null;
    hasMore: boolean;
  };
}

// -----------------------------------------------------------------------------
// Execution Plan Types
// -----------------------------------------------------------------------------

/** Item with parsed execution metadata */
export interface ExecutionItem {
  type: "feature" | "task";
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  statusId: string | null;
  executionOrder: number | null;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: string[];
  estimatedComplexity: EstimatedComplexity | null;
}

/** A phase in the execution plan */
export interface ExecutionPhase {
  order: number;
  items: ExecutionItem[];
  canRunInParallel: boolean;
  estimatedComplexity: EstimatedComplexity | null;
}

/** Execution plan response */
export interface ExecutionPlanResponse {
  epicId: string;
  phases: ExecutionPhase[];
  totalItems: number;
}

// -----------------------------------------------------------------------------
// Reorder Types
// -----------------------------------------------------------------------------

export interface ReorderParams {
  afterId?: string | undefined;
  beforeId?: string | undefined;
}

// =============================================================================
// API Client Configuration
// =============================================================================

interface ApiClientConfig {
  baseUrl: string;
  token: string;
}

let clientConfig: ApiClientConfig | null = null;

/**
 * Initialize the API client with configuration.
 * Must be called before using getApiClient().
 */
export function initializeApiClient(config: ApiClientConfig): void {
  if (!config.token) {
    throw new Error("API_TOKEN is required for API client initialization");
  }
  clientConfig = config;
}

/**
 * Get the configured API client instance.
 * Throws if not initialized.
 */
export function getApiClient(): ApiClient {
  if (!clientConfig) {
    // Try to initialize from environment variables
    const token = process.env.API_TOKEN;
    const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";

    if (!token) {
      throw new Error(
        "API client not initialized. Call initializeApiClient() or set API_TOKEN environment variable."
      );
    }

    clientConfig = { baseUrl, token };
  }

  return new ApiClient(clientConfig.baseUrl, clientConfig.token);
}

// =============================================================================
// API Client Implementation
// =============================================================================

/** Maximum number of retry attempts for failed requests */
const MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential backoff */
const BASE_RETRY_DELAY = 1000;

/** Network error codes that should trigger a retry */
const RETRYABLE_ERROR_CODES = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"];

export class ApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.token = token;
  }

  // ---------------------------------------------------------------------------
  // Private Request Method with Retry Logic
  // ---------------------------------------------------------------------------

  /**
   * Make an HTTP request with automatic retry for transient failures.
   *
   * Retry behavior:
   * - Retries on network errors (ECONNREFUSED, ETIMEDOUT, etc.)
   * - Retries on 5xx server errors
   * - Does NOT retry on 4xx client errors
   * - Uses exponential backoff: 1s, 2s, 4s
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            "User-Agent": "SpecTree-MCP/1.0",
          },
        };

        if (body) {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);

        // Handle non-2xx responses
        if (!response.ok) {
          let responseBody: unknown;
          try {
            responseBody = await response.json();
          } catch {
            responseBody = await response.text();
          }

          // Don't retry 4xx errors (client errors)
          if (response.status >= 400 && response.status < 500) {
            const message =
              typeof responseBody === "object" && responseBody !== null && "message" in responseBody
                ? (responseBody as { message: string }).message
                : `HTTP ${String(response.status)}`;
            throw new ApiError(response.status, responseBody, message);
          }

          // Retry 5xx errors
          if (response.status >= 500) {
            lastError = new ApiError(
              response.status,
              responseBody,
              `Server error: HTTP ${String(response.status)}`
            );
            await this.delay(BASE_RETRY_DELAY * Math.pow(2, attempt));
            continue;
          }
        }

        // Parse successful response
        const data = (await response.json()) as T;
        return data;
      } catch (error) {
        // Handle network errors
        if (error instanceof TypeError || this.isNetworkError(error)) {
          lastError = error instanceof Error ? error : new Error(String(error));
          await this.delay(BASE_RETRY_DELAY * Math.pow(2, attempt));
          continue;
        }

        // Re-throw ApiError (don't retry 4xx)
        if (error instanceof ApiError) {
          throw error;
        }

        // Re-throw unexpected errors
        throw error;
      }
    }

    // All retries exhausted
    throw lastError ?? new Error(`Request failed after ${String(MAX_RETRIES)} attempts`);
  }

  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      const code = (error as NodeJS.ErrnoException).code;
      return code !== undefined && RETRYABLE_ERROR_CODES.includes(code);
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Query String Builder
  // ---------------------------------------------------------------------------

  private buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, typeof value === "string" ? value : String(value));
      }
    }
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
  }

  // ---------------------------------------------------------------------------
  // Epic Methods
  // ---------------------------------------------------------------------------

  async listEpics(params?: ListEpicsParams): Promise<ListEpicsResponse> {
    const query = this.buildQueryString({
      teamId: params?.team,
      includeArchived: params?.includeArchived,
      limit: params?.limit,
      cursor: params?.cursor,
    });
    return this.request<ListEpicsResponse>("GET", `/api/v1/epics${query}`);
  }

  async getEpic(idOrName: string): Promise<{ data: Epic }> {
    return this.request<{ data: Epic }>("GET", `/api/v1/epics/${encodeURIComponent(idOrName)}`);
  }

  async createEpic(data: CreateEpicData): Promise<{ data: Epic }> {
    return this.request<{ data: Epic }>("POST", "/api/v1/epics", data);
  }

  async updateEpic(
    id: string,
    data: Partial<Omit<CreateEpicData, "teamId">>
  ): Promise<{ data: Epic }> {
    return this.request<{ data: Epic }>("PUT", `/api/v1/epics/${encodeURIComponent(id)}`, data);
  }

  async reorderEpic(id: string, params: ReorderParams): Promise<{ data: Epic }> {
    return this.request<{ data: Epic }>(
      "PUT",
      `/api/v1/epics/${encodeURIComponent(id)}/reorder`,
      params
    );
  }

  async archiveEpic(id: string): Promise<{ data: Epic }> {
    return this.request<{ data: Epic }>("POST", `/api/v1/epics/${encodeURIComponent(id)}/archive`);
  }

  async unarchiveEpic(id: string): Promise<{ data: Epic }> {
    return this.request<{ data: Epic }>("POST", `/api/v1/epics/${encodeURIComponent(id)}/unarchive`);
  }

  // ---------------------------------------------------------------------------
  // Feature Methods
  // ---------------------------------------------------------------------------

  async listFeatures(params?: ListFeaturesParams): Promise<ListFeaturesResponse> {
    const query = this.buildQueryString({
      epicId: params?.epicId ?? params?.epic,
      statusId: params?.statusId,
      status: params?.status,
      statusCategory: params?.statusCategory,
      assigneeId: params?.assigneeId,
      assignee: params?.assignee,
      query: params?.query,
      createdAt: params?.createdAt,
      updatedAt: params?.updatedAt,
      limit: params?.limit,
      cursor: params?.cursor,
    });
    return this.request<ListFeaturesResponse>("GET", `/api/v1/features${query}`);
  }

  async getFeature(idOrIdentifier: string): Promise<{ data: Feature }> {
    return this.request<{ data: Feature }>(
      "GET",
      `/api/v1/features/${encodeURIComponent(idOrIdentifier)}`
    );
  }

  async createFeature(data: CreateFeatureData): Promise<{ data: Feature }> {
    return this.request<{ data: Feature }>("POST", "/api/v1/features", data);
  }

  async updateFeature(idOrIdentifier: string, data: UpdateFeatureData): Promise<{ data: Feature }> {
    return this.request<{ data: Feature }>(
      "PUT",
      `/api/v1/features/${encodeURIComponent(idOrIdentifier)}`,
      data
    );
  }

  async reorderFeature(id: string, params: ReorderParams): Promise<{ data: Feature }> {
    return this.request<{ data: Feature }>(
      "PUT",
      `/api/v1/features/${encodeURIComponent(id)}/reorder`,
      params
    );
  }

  // ---------------------------------------------------------------------------
  // Task Methods
  // ---------------------------------------------------------------------------

  async listTasks(params?: ListTasksParams): Promise<ListTasksResponse> {
    const query = this.buildQueryString({
      featureId: params?.featureId ?? params?.feature,
      epicId: params?.epicId,
      statusId: params?.statusId,
      status: params?.status,
      statusCategory: params?.statusCategory,
      assigneeId: params?.assigneeId,
      assignee: params?.assignee,
      query: params?.query,
      createdAt: params?.createdAt,
      updatedAt: params?.updatedAt,
      limit: params?.limit,
      cursor: params?.cursor,
    });
    return this.request<ListTasksResponse>("GET", `/api/v1/tasks${query}`);
  }

  async getTask(idOrIdentifier: string): Promise<{ data: Task }> {
    return this.request<{ data: Task }>("GET", `/api/v1/tasks/${encodeURIComponent(idOrIdentifier)}`);
  }

  async createTask(data: CreateTaskData): Promise<{ data: Task }> {
    return this.request<{ data: Task }>("POST", "/api/v1/tasks", data);
  }

  async updateTask(idOrIdentifier: string, data: UpdateTaskData): Promise<{ data: Task }> {
    return this.request<{ data: Task }>(
      "PUT",
      `/api/v1/tasks/${encodeURIComponent(idOrIdentifier)}`,
      data
    );
  }

  async reorderTask(id: string, params: ReorderParams): Promise<{ data: Task }> {
    return this.request<{ data: Task }>(
      "PUT",
      `/api/v1/tasks/${encodeURIComponent(id)}/reorder`,
      params
    );
  }

  // ---------------------------------------------------------------------------
  // Status Methods
  // ---------------------------------------------------------------------------

  async listStatuses(teamId: string): Promise<ListStatusesResponse> {
    const query = this.buildQueryString({ teamId });
    return this.request<ListStatusesResponse>("GET", `/api/v1/statuses${query}`);
  }

  async getStatus(id: string): Promise<{ data: Status }> {
    return this.request<{ data: Status }>("GET", `/api/v1/statuses/${encodeURIComponent(id)}`);
  }

  /**
   * Resolve a status name or UUID to a status UUID.
   * If the input is already a UUID, it is returned as-is (after validation).
   * If the input is a name, it looks up the status by name within the team.
   *
   * @param statusNameOrId - The status name (e.g., "Done") or UUID
   * @param teamId - The team ID to scope the search (required for name lookup)
   * @returns The status UUID
   * @throws Error if status is not found
   */
  async resolveStatusId(statusNameOrId: string, teamId: string): Promise<string> {
    // UUID regex pattern
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (UUID_REGEX.test(statusNameOrId)) {
      // Already a UUID - validate it exists
      try {
        await this.getStatus(statusNameOrId);
        return statusNameOrId;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          throw new Error(`Status with id '${statusNameOrId}' not found`);
        }
        throw error;
      }
    }

    // Look up by name in the team
    const { data: statuses } = await this.listStatuses(teamId);
    const status = statuses.find(
      (s) => s.name.toLowerCase() === statusNameOrId.toLowerCase()
    );

    if (!status) {
      throw new Error(
        `Status '${statusNameOrId}' not found in team. Available statuses: ${statuses.map((s) => s.name).join(", ")}`
      );
    }

    return status.id;
  }

  // ---------------------------------------------------------------------------
  // Team Methods (for resolution helpers)
  // ---------------------------------------------------------------------------

  async getTeam(idOrNameOrKey: string): Promise<{ data: Team } | null> {
    try {
      return await this.request<{ data: Team }>(
        "GET",
        `/api/v1/teams/${encodeURIComponent(idOrNameOrKey)}`
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Personal Scope Methods
  // ---------------------------------------------------------------------------

  /**
   * Get the current user's personal scope.
   * Creates the personal scope if it doesn't exist (lazy initialization).
   */
  async getPersonalScope(): Promise<{ data: PersonalScope }> {
    return this.request<{ data: PersonalScope }>("GET", "/api/v1/me/scope");
  }

  /**
   * List epics in the current user's personal scope.
   * (API endpoint is still /me/projects for backwards compatibility)
   */
  async listPersonalEpics(params?: ListPersonalEpicsParams): Promise<ListPersonalEpicsResponse> {
    const query = this.buildQueryString({
      limit: params?.limit,
      cursor: params?.cursor,
    });
    return this.request<ListPersonalEpicsResponse>("GET", `/api/v1/me/projects${query}`);
  }

  /**
   * Create a new epic in the current user's personal scope.
   * (API endpoint is still /me/projects for backwards compatibility)
   */
  async createPersonalEpic(data: CreatePersonalEpicData): Promise<{ data: PersonalEpic }> {
    return this.request<{ data: PersonalEpic }>("POST", "/api/v1/me/projects", data);
  }

  // Backwards compatibility aliases
  async listPersonalProjects(params?: ListPersonalProjectsParams): Promise<ListPersonalProjectsResponse> {
    return this.listPersonalEpics(params);
  }

  async createPersonalProject(data: CreatePersonalProjectData): Promise<{ data: PersonalProject }> {
    return this.createPersonalEpic(data);
  }

  /**
   * List statuses in the current user's personal scope.
   */
  async listPersonalStatuses(): Promise<ListPersonalStatusesResponse> {
    return this.request<ListPersonalStatusesResponse>("GET", "/api/v1/me/statuses");
  }

  /**
   * Resolve a status name or UUID to a status UUID within the personal scope.
   */
  async resolvePersonalStatusId(statusNameOrId: string): Promise<string> {
    // UUID regex pattern
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (UUID_REGEX.test(statusNameOrId)) {
      // Already a UUID - validate it exists
      try {
        await this.getStatus(statusNameOrId);
        return statusNameOrId;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          throw new Error(`Status with id '${statusNameOrId}' not found`);
        }
        throw error;
      }
    }

    // Look up by name in the personal scope
    const { data: statuses } = await this.listPersonalStatuses();
    const status = statuses.find(
      (s) => s.name.toLowerCase() === statusNameOrId.toLowerCase()
    );

    if (!status) {
      throw new Error(
        `Status '${statusNameOrId}' not found in personal scope. Available statuses: ${statuses.map((s) => s.name).join(", ")}`
      );
    }

    return status.id;
  }

  // ---------------------------------------------------------------------------
  // Search Method
  // ---------------------------------------------------------------------------

  /**
   * Search for features and tasks with various filters.
   *
   * Note: This is a client-side implementation since the API doesn't have
   * a dedicated search endpoint. It combines results from features and tasks
   * list endpoints.
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    const searchType = params.type ?? "all";
    const limit = params.limit ?? 50;
    const results: SearchResultItem[] = [];

    let featureCursor: string | null = null;
    let taskCursor: string | null = null;
    let hasMoreFeatures = false;
    let hasMoreTasks = false;

    // Parse cursor if provided
    if (params.cursor) {
      if (params.cursor.startsWith("feature:")) {
        featureCursor = params.cursor.slice(8) || null;
      } else if (params.cursor.startsWith("task:")) {
        taskCursor = params.cursor.slice(5) || null;
      } else if (params.cursor.startsWith("combined:")) {
        const parts = params.cursor.slice(9).split("|");
        featureCursor = parts[0] && parts[0] !== "null" ? parts[0] : null;
        taskCursor = parts[1] && parts[1] !== "null" ? parts[1] : null;
      }
    }

    // Search features if requested
    if (searchType === "feature" || searchType === "all") {
      const featureParams: ListFeaturesParams = {
        limit,
      };
      if (params.epic) featureParams.epic = params.epic;
      if (params.status) featureParams.status = params.status;
      if (params.statusCategory) featureParams.statusCategory = params.statusCategory;
      if (params.assignee) featureParams.assignee = params.assignee;
      if (params.query) featureParams.query = params.query;
      if (params.createdAt) featureParams.createdAt = params.createdAt;
      if (params.updatedAt) featureParams.updatedAt = params.updatedAt;
      if (featureCursor) featureParams.cursor = featureCursor;

      const featureResult = await this.listFeatures(featureParams);

      hasMoreFeatures = featureResult.meta.hasMore;
      featureCursor = featureResult.meta.cursor;

      for (const feature of featureResult.data) {
        results.push({
          type: "feature",
          id: feature.id,
          identifier: feature.identifier,
          title: feature.title,
          description: feature.description,
          statusId: feature.statusId,
          assigneeId: feature.assigneeId,
          createdAt: feature.createdAt,
          updatedAt: feature.updatedAt,
          epicId: feature.epicId,
        });
      }
    }

    // Search tasks if requested
    if (searchType === "task" || searchType === "all") {
      const taskParams: ListTasksParams = {
        limit,
      };
      if (params.epic) taskParams.epicId = params.epic;
      if (params.status) taskParams.status = params.status;
      if (params.statusCategory) taskParams.statusCategory = params.statusCategory;
      if (params.assignee) taskParams.assignee = params.assignee;
      if (params.query) taskParams.query = params.query;
      if (params.createdAt) taskParams.createdAt = params.createdAt;
      if (params.updatedAt) taskParams.updatedAt = params.updatedAt;
      if (taskCursor) taskParams.cursor = taskCursor;

      const taskResult = await this.listTasks(taskParams);

      hasMoreTasks = taskResult.meta.hasMore;
      taskCursor = taskResult.meta.cursor;

      for (const task of taskResult.data) {
        results.push({
          type: "task",
          id: task.id,
          identifier: task.identifier,
          title: task.title,
          description: task.description,
          statusId: task.statusId,
          assigneeId: task.assigneeId,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          featureId: task.featureId,
        });
      }
    }

    // Sort combined results by createdAt (newest first)
    if (searchType === "all") {
      results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Trim to limit
      if (results.length > limit) {
        results.length = limit;
      }
    }

    // Build pagination cursor
    let nextCursor: string | null = null;
    const hasMore =
      searchType === "all"
        ? hasMoreFeatures || hasMoreTasks
        : searchType === "feature"
          ? hasMoreFeatures
          : hasMoreTasks;

    if (hasMore) {
      if (searchType === "feature") {
        nextCursor = featureCursor ? `feature:${featureCursor}` : null;
      } else if (searchType === "task") {
        nextCursor = taskCursor ? `task:${taskCursor}` : null;
      } else {
        nextCursor = `combined:${featureCursor ?? "null"}|${taskCursor ?? "null"}`;
      }
    }

    return {
      results,
      meta: {
        total: results.length,
        cursor: nextCursor,
        hasMore,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Execution Plan Method
  // ---------------------------------------------------------------------------

  /**
   * Get an execution plan for an epic.
   * Analyzes features and their tasks to produce an ordered execution plan
   * with phases that respect dependencies and parallel groups.
   */
  async getExecutionPlan(epicId: string): Promise<ExecutionPlanResponse> {
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
      dependencies: f.dependencies ? JSON.parse(f.dependencies) as string[] : [],
      estimatedComplexity: f.estimatedComplexity,
    }));

    // Build dependency graph and perform topological sort
    const phases = this.buildExecutionPhases(items);

    return {
      epicId,
      phases,
      totalItems: items.length,
    };
  }

  /**
   * Build execution phases from items using topological sort.
   * Items with no dependencies or whose dependencies are satisfied go into earlier phases.
   */
  private buildExecutionPhases(items: ExecutionItem[]): ExecutionPhase[] {
    // Create a map for quick lookup
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

    let phaseOrder = 1;
    let remaining = sortedItems.filter((item) => !completed.has(item.id));

    while (remaining.length > 0) {
      // Find items whose dependencies are all completed
      const ready = remaining.filter((item) =>
        item.dependencies.every((depId) => completed.has(depId) || !itemMap.has(depId))
      );

      if (ready.length === 0) {
        // Circular dependency or missing dependency - add remaining items
        ready.push(...remaining);
      }

      // Group ready items by parallelGroup
      const parallelGroups = new Map<string | null, ExecutionItem[]>();
      for (const item of ready) {
        const group = item.canParallelize ? (item.parallelGroup ?? "__parallel__") : null;
        if (!parallelGroups.has(group)) {
          parallelGroups.set(group, []);
        }
        parallelGroups.get(group)!.push(item);
      }

      // Create phases for each group
      for (const [groupKey, groupItems] of parallelGroups) {
        const canRunInParallel = groupKey !== null && groupItems.length > 1;
        
        // Determine overall complexity (use highest complexity in group)
        const complexityOrder = ["trivial", "simple", "moderate", "complex"];
        let maxComplexity: EstimatedComplexity | null = null;
        for (const item of groupItems) {
          if (item.estimatedComplexity) {
            if (!maxComplexity || 
                complexityOrder.indexOf(item.estimatedComplexity) > complexityOrder.indexOf(maxComplexity)) {
              maxComplexity = item.estimatedComplexity;
            }
          }
        }

        phases.push({
          order: phaseOrder++,
          items: groupItems,
          canRunInParallel,
          estimatedComplexity: maxComplexity,
        });

        // Mark items as completed
        for (const item of groupItems) {
          completed.add(item.id);
        }
      }

      remaining = sortedItems.filter((item) => !completed.has(item.id));
    }

    return phases;
  }
}
