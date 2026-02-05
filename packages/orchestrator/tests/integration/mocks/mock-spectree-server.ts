/**
 * Mock SpecTree Server for Integration Tests
 *
 * Provides an in-memory mock server that simulates SpecTree API responses.
 * Features:
 * - In-memory data storage
 * - Configurable error injection
 * - State inspection for assertions
 */

import type {
  Epic,
  Feature,
  Task,
  Team,
  Status,
  Session,
  PaginationMeta,
  SessionStatus,
} from "../../../src/spectree/api-client.js";

// =============================================================================
// Types
// =============================================================================

export interface MockServerState {
  teams: Team[];
  epics: Epic[];
  features: Feature[];
  tasks: Task[];
  sessions: Session[];
  statuses: Status[];
}

export interface MockServerOptions {
  initialState?: Partial<MockServerState>;
}

export interface MockError {
  path: string;
  method?: string;
  statusCode: number;
  message: string;
  count?: number; // Number of times to return this error (default: unlimited)
}

// =============================================================================
// Default Mock Data
// =============================================================================

const defaultTeam: Team = {
  id: "team-123",
  name: "Engineering",
  key: "ENG",
};

const defaultStatuses: Status[] = [
  { id: "status-1", name: "Backlog", category: "backlog", color: "#6B7280" },
  { id: "status-2", name: "In Progress", category: "started", color: "#3B82F6" },
  { id: "status-3", name: "Done", category: "completed", color: "#10B981" },
];

// =============================================================================
// Mock SpecTree Server
// =============================================================================

export class MockSpecTreeServer {
  private state: MockServerState;
  private errors: Map<string, MockError> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private idCounter = 1;

  constructor(options?: MockServerOptions) {
    this.state = {
      teams: options?.initialState?.teams ?? [defaultTeam],
      epics: options?.initialState?.epics ?? [],
      features: options?.initialState?.features ?? [],
      tasks: options?.initialState?.tasks ?? [],
      sessions: options?.initialState?.sessions ?? [],
      statuses: options?.initialState?.statuses ?? defaultStatuses,
    };
  }

  // ---------------------------------------------------------------------------
  // Error Injection
  // ---------------------------------------------------------------------------

  /**
   * Set an error to be returned for a specific path.
   * @param path - API path pattern (e.g., "/epics", "/epics/:id")
   * @param statusCode - HTTP status code to return
   * @param message - Error message
   * @param options - Additional options like method filter or count
   */
  setError(
    path: string,
    statusCode: number,
    message = "Mock error",
    options?: { method?: string; count?: number }
  ): void {
    const key = this.getErrorKey(path, options?.method);
    this.errors.set(key, {
      path,
      method: options?.method,
      statusCode,
      message,
      count: options?.count,
    });
    this.errorCounts.set(key, 0);
  }

  /**
   * Clear all injected errors.
   */
  clearErrors(): void {
    this.errors.clear();
    this.errorCounts.clear();
  }

  /**
   * Check if an error should be returned for a request.
   */
  private checkError(path: string, method: string): MockError | null {
    // Check for exact path + method match
    const exactKey = this.getErrorKey(path, method);
    let error = this.errors.get(exactKey);

    if (!error) {
      // Check for path-only match
      const pathKey = this.getErrorKey(path);
      error = this.errors.get(pathKey);
    }

    if (!error) {
      return null;
    }

    const key = error.method ? exactKey : this.getErrorKey(path);
    const count = this.errorCounts.get(key) ?? 0;

    if (error.count !== undefined && count >= error.count) {
      return null;
    }

    this.errorCounts.set(key, count + 1);
    return error;
  }

  private getErrorKey(path: string, method?: string): string {
    return method ? `${method}:${path}` : path;
  }

  // ---------------------------------------------------------------------------
  // State Access (for assertions)
  // ---------------------------------------------------------------------------

  get teams(): Team[] {
    return [...this.state.teams];
  }

  get epics(): Epic[] {
    return [...this.state.epics];
  }

  get features(): Feature[] {
    return [...this.state.features];
  }

  get tasks(): Task[] {
    return [...this.state.tasks];
  }

  get sessions(): Session[] {
    return [...this.state.sessions];
  }

  /**
   * Reset all state to initial values.
   */
  reset(options?: MockServerOptions): void {
    this.state = {
      teams: options?.initialState?.teams ?? [defaultTeam],
      epics: options?.initialState?.epics ?? [],
      features: options?.initialState?.features ?? [],
      tasks: options?.initialState?.tasks ?? [],
      sessions: options?.initialState?.sessions ?? [],
      statuses: options?.initialState?.statuses ?? defaultStatuses,
    };
    this.clearErrors();
    this.idCounter = 1;
  }

  // ---------------------------------------------------------------------------
  // ID Generation
  // ---------------------------------------------------------------------------

  private generateId(prefix: string): string {
    return `${prefix}-${this.idCounter++}`;
  }

  private generateIdentifier(teamKey: string): string {
    const count = this.state.features.length + this.state.tasks.length + 1;
    return `${teamKey}-${count}`;
  }

  // ---------------------------------------------------------------------------
  // Mock Fetch Handler
  // ---------------------------------------------------------------------------

  /**
   * Create a mock fetch function that handles SpecTree API requests.
   */
  createMockFetch(): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      // Parse the URL to get the path and query params
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace("/api/v1", "");
      const searchParams = urlObj.searchParams;

      // Check for injected errors
      const error = this.checkError(path, method);
      if (error) {
        return this.createErrorResponse(error.statusCode, error.message);
      }

      // Route the request
      return this.routeRequest(path, method, init?.body, searchParams);
    };
  }

  private async routeRequest(
    path: string,
    method: string,
    body?: BodyInit | null,
    searchParams?: URLSearchParams
  ): Promise<Response> {
    const parsedBody = body ? JSON.parse(body.toString()) : undefined;

    // Team routes
    if (path === "/teams" && method === "GET") {
      return this.handleListTeams();
    }
    if (path.match(/^\/teams\/[^/]+$/) && method === "GET") {
      const id = path.split("/")[2]!;
      return this.handleGetTeam(id);
    }

    // Epic routes
    if (path === "/epics" && method === "GET") {
      return this.handleListEpics();
    }
    if (path === "/epics" && method === "POST") {
      return this.handleCreateEpic(parsedBody);
    }
    if (path.match(/^\/epics\/[^/]+$/) && method === "GET") {
      const id = path.split("/")[2]!;
      return this.handleGetEpic(id);
    }
    if (path.match(/^\/epics\/[^/]+$/) && method === "PUT") {
      const id = path.split("/")[2]!;
      return this.handleUpdateEpic(id, parsedBody);
    }
    if (path.match(/^\/epics\/[^/]+\/progress-summary$/) && method === "GET") {
      const id = path.split("/")[2]!;
      return this.handleGetProgressSummary(id);
    }

    // Feature routes
    if (path === "/features" && method === "GET") {
      return this.handleListFeatures(searchParams);
    }
    if (path === "/features" && method === "POST") {
      return this.handleCreateFeature(parsedBody);
    }
    if (path.match(/^\/features\/[^/]+$/) && method === "GET") {
      const id = path.split("/")[2]!;
      return this.handleGetFeature(id);
    }
    if (path.match(/^\/features\/[^/]+$/) && method === "PUT") {
      const id = path.split("/")[2]!;
      return this.handleUpdateFeature(id, parsedBody);
    }
    if (path.match(/^\/features\/[^/]+\/progress\/start$/) && method === "POST") {
      const id = path.split("/")[2]!;
      return this.handleStartWork("feature", id);
    }
    if (path.match(/^\/features\/[^/]+\/progress\/complete$/) && method === "POST") {
      const id = path.split("/")[2]!;
      return this.handleCompleteWork("feature", id);
    }

    // Task routes
    if (path === "/tasks" && method === "GET") {
      return this.handleListTasks();
    }
    if (path === "/tasks" && method === "POST") {
      return this.handleCreateTask(parsedBody);
    }
    if (path.match(/^\/tasks\/[^/]+$/) && method === "GET") {
      const id = path.split("/")[2]!;
      return this.handleGetTask(id);
    }
    if (path.match(/^\/tasks\/[^/]+$/) && method === "PUT") {
      const id = path.split("/")[2]!;
      return this.handleUpdateTask(id, parsedBody);
    }
    if (path.match(/^\/tasks\/[^/]+\/progress\/start$/) && method === "POST") {
      const id = path.split("/")[2]!;
      return this.handleStartWork("task", id);
    }
    if (path.match(/^\/tasks\/[^/]+\/progress\/complete$/) && method === "POST") {
      const id = path.split("/")[2]!;
      return this.handleCompleteWork("task", id);
    }

    // Session routes
    if (path === "/sessions/start" && method === "POST") {
      return this.handleStartSession(parsedBody);
    }
    if (path.match(/^\/sessions\/[^/]+\/end$/) && method === "POST") {
      const epicId = path.split("/")[2]!;
      return this.handleEndSession(epicId, parsedBody);
    }
    if (path.match(/^\/sessions\/[^/]+\/active$/) && method === "GET") {
      const epicId = path.split("/")[2]!;
      return this.handleGetActiveSession(epicId);
    }

    return this.createErrorResponse(404, `Not found: ${path}`);
  }

  // ---------------------------------------------------------------------------
  // Team Handlers
  // ---------------------------------------------------------------------------

  private handleListTeams(): Response {
    return this.createSuccessResponse({
      data: this.state.teams,
      meta: { cursor: null, hasMore: false } as PaginationMeta,
    });
  }

  private handleGetTeam(idOrKey: string): Response {
    const team = this.state.teams.find(
      (t) => t.id === idOrKey || t.key === idOrKey || t.name === idOrKey
    );
    if (!team) {
      return this.createErrorResponse(404, "Team not found");
    }
    return this.createSuccessResponse({ data: team });
  }

  // ---------------------------------------------------------------------------
  // Epic Handlers
  // ---------------------------------------------------------------------------

  private handleListEpics(): Response {
    return this.createSuccessResponse({
      data: this.state.epics,
      meta: { cursor: null, hasMore: false } as PaginationMeta,
    });
  }

  private handleCreateEpic(body: {
    name: string;
    teamId: string;
    description?: string;
  }): Response {
    const epic: Epic = {
      id: this.generateId("epic"),
      name: body.name,
      description: body.description ?? null,
      icon: null,
      color: "#3B82F6",
      sortOrder: this.state.epics.length,
      isArchived: false,
      teamId: body.teamId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { features: 0 },
    };
    this.state.epics.push(epic);
    return this.createSuccessResponse({ data: epic }, 201);
  }

  private handleGetEpic(id: string): Response {
    const epic = this.state.epics.find((e) => e.id === id);
    if (!epic) {
      return this.createErrorResponse(404, "Epic not found");
    }
    return this.createSuccessResponse({ data: epic });
  }

  private handleUpdateEpic(
    id: string,
    body: { name?: string; description?: string }
  ): Response {
    const epic = this.state.epics.find((e) => e.id === id);
    if (!epic) {
      return this.createErrorResponse(404, "Epic not found");
    }
    if (body.name !== undefined) epic.name = body.name;
    if (body.description !== undefined) epic.description = body.description;
    epic.updatedAt = new Date().toISOString();
    return this.createSuccessResponse({ data: epic });
  }

  private handleGetProgressSummary(epicId: string): Response {
    const epic = this.state.epics.find((e) => e.id === epicId);
    if (!epic) {
      return this.createErrorResponse(404, "Epic not found");
    }

    const features = this.state.features.filter((f) => f.epicId === epicId);
    const tasks = this.state.tasks.filter((t) =>
      features.some((f) => f.id === t.featureId)
    );

    const completedFeatures = features.filter((f) => f.statusId === "status-3").length;
    const inProgressFeatures = features.filter((f) => f.statusId === "status-2").length;
    const completedTasks = tasks.filter((t) => t.statusId === "status-3").length;

    return this.createSuccessResponse({
      data: {
        epic: { id: epic.id, name: epic.name, description: epic.description },
        totalFeatures: features.length,
        completedFeatures,
        inProgressFeatures,
        blockedFeatures: 0,
        totalTasks: tasks.length,
        completedTasks,
        overallProgress: features.length > 0 ? (completedFeatures / features.length) * 100 : 0,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Feature Handlers
  // ---------------------------------------------------------------------------

  private handleListFeatures(searchParams?: URLSearchParams): Response {
    let features = this.state.features;
    
    // Filter by epicId if provided
    const epicId = searchParams?.get("epicId");
    if (epicId) {
      features = features.filter((f) => f.epicId === epicId);
    }
    
    return this.createSuccessResponse({
      data: features,
      meta: { cursor: null, hasMore: false } as PaginationMeta,
    });
  }

  private handleCreateFeature(body: {
    title: string;
    epicId: string;
    description?: string;
    executionOrder?: number;
    canParallelize?: boolean;
    parallelGroup?: string;
  }): Response {
    const team = this.state.teams[0]!;
    const feature: Feature = {
      id: this.generateId("feature"),
      epicId: body.epicId,
      identifier: this.generateIdentifier(team.key),
      title: body.title,
      description: body.description ?? null,
      statusId: "status-1",
      assigneeId: null,
      sortOrder: this.state.features.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: body.executionOrder ?? null,
      canParallelize: body.canParallelize ?? false,
      parallelGroup: body.parallelGroup ?? null,
      dependencies: null,
      estimatedComplexity: null,
    };
    this.state.features.push(feature);
    return this.createSuccessResponse({ data: feature }, 201);
  }

  private handleGetFeature(id: string): Response {
    const feature = this.state.features.find((f) => f.id === id);
    if (!feature) {
      return this.createErrorResponse(404, "Feature not found");
    }
    return this.createSuccessResponse({ data: feature });
  }

  private handleUpdateFeature(
    id: string,
    body: { title?: string; statusId?: string }
  ): Response {
    const feature = this.state.features.find((f) => f.id === id);
    if (!feature) {
      return this.createErrorResponse(404, "Feature not found");
    }
    if (body.title !== undefined) feature.title = body.title;
    if (body.statusId !== undefined) feature.statusId = body.statusId;
    feature.updatedAt = new Date().toISOString();
    return this.createSuccessResponse({ data: feature });
  }

  // ---------------------------------------------------------------------------
  // Task Handlers
  // ---------------------------------------------------------------------------

  private handleListTasks(): Response {
    return this.createSuccessResponse({
      data: this.state.tasks,
      meta: { cursor: null, hasMore: false } as PaginationMeta,
    });
  }

  private handleCreateTask(body: {
    title: string;
    featureId: string;
    description?: string;
  }): Response {
    const team = this.state.teams[0]!;
    const task: Task = {
      id: this.generateId("task"),
      featureId: body.featureId,
      identifier: this.generateIdentifier(team.key),
      title: body.title,
      description: body.description ?? null,
      statusId: "status-1",
      assigneeId: null,
      sortOrder: this.state.tasks.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: null,
      canParallelize: false,
      parallelGroup: null,
      dependencies: null,
      estimatedComplexity: null,
    };
    this.state.tasks.push(task);
    return this.createSuccessResponse({ data: task }, 201);
  }

  private handleGetTask(id: string): Response {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task) {
      return this.createErrorResponse(404, "Task not found");
    }
    return this.createSuccessResponse({ data: task });
  }

  private handleUpdateTask(
    id: string,
    body: { title?: string; statusId?: string }
  ): Response {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task) {
      return this.createErrorResponse(404, "Task not found");
    }
    if (body.title !== undefined) task.title = body.title;
    if (body.statusId !== undefined) task.statusId = body.statusId;
    task.updatedAt = new Date().toISOString();
    return this.createSuccessResponse({ data: task });
  }

  // ---------------------------------------------------------------------------
  // Progress Handlers
  // ---------------------------------------------------------------------------

  private handleStartWork(type: "feature" | "task", id: string): Response {
    const items = type === "feature" ? this.state.features : this.state.tasks;
    const item = items.find((i) => i.id === id);
    if (!item) {
      return this.createErrorResponse(404, `${type} not found`);
    }

    item.statusId = "status-2"; // In Progress
    item.updatedAt = new Date().toISOString();

    return this.createSuccessResponse({
      data: {
        id: item.id,
        identifier: item.identifier,
        status: "In Progress",
        startedAt: new Date().toISOString(),
        completedAt: null,
        percentComplete: 0,
      },
    });
  }

  private handleCompleteWork(type: "feature" | "task", id: string): Response {
    const items = type === "feature" ? this.state.features : this.state.tasks;
    const item = items.find((i) => i.id === id);
    if (!item) {
      return this.createErrorResponse(404, `${type} not found`);
    }

    item.statusId = "status-3"; // Done
    item.updatedAt = new Date().toISOString();

    return this.createSuccessResponse({
      data: {
        id: item.id,
        identifier: item.identifier,
        status: "Done",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        percentComplete: 100,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Session Handlers
  // ---------------------------------------------------------------------------

  private handleStartSession(body: { epicId: string }): Response {
    const epic = this.state.epics.find((e) => e.id === body.epicId);
    if (!epic) {
      return this.createErrorResponse(404, "Epic not found");
    }

    // End any active session
    const activeSession = this.state.sessions.find(
      (s) => s.epicId === body.epicId && s.status === "active"
    );
    if (activeSession) {
      activeSession.status = "completed" as SessionStatus;
      activeSession.endedAt = new Date().toISOString();
    }

    const session: Session = {
      id: this.generateId("session"),
      epicId: body.epicId,
      externalId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: "active" as SessionStatus,
      itemsWorkedOn: [],
      summary: null,
      nextSteps: null,
      blockers: null,
      decisions: null,
      contextBlob: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.sessions.push(session);

    const features = this.state.features.filter((f) => f.epicId === body.epicId);

    return this.createSuccessResponse(
      {
        data: {
          session,
          previousSession: activeSession ?? null,
          epicProgress: {
            totalFeatures: features.length,
            completedFeatures: features.filter((f) => f.statusId === "status-3").length,
            inProgressFeatures: features.filter((f) => f.statusId === "status-2").length,
            totalTasks: 0,
            completedTasks: 0,
          },
        },
      },
      201
    );
  }

  private handleEndSession(
    epicId: string,
    body: { summary?: string; nextSteps?: string[] }
  ): Response {
    const session = this.state.sessions.find(
      (s) => s.epicId === epicId && s.status === "active"
    );
    if (!session) {
      return this.createErrorResponse(404, "No active session for this epic");
    }

    session.status = "completed" as SessionStatus;
    session.endedAt = new Date().toISOString();
    session.summary = body.summary ?? null;
    session.nextSteps = body.nextSteps ?? null;
    session.updatedAt = new Date().toISOString();

    return this.createSuccessResponse({ data: session });
  }

  private handleGetActiveSession(epicId: string): Response {
    const session = this.state.sessions.find(
      (s) => s.epicId === epicId && s.status === "active"
    );
    if (!session) {
      return this.createErrorResponse(404, "No active session");
    }
    return this.createSuccessResponse({ data: session });
  }

  // ---------------------------------------------------------------------------
  // Response Helpers
  // ---------------------------------------------------------------------------

  private createSuccessResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  private createErrorResponse(status: number, message: string): Response {
    return new Response(JSON.stringify({ message, error: message }), {
      status,
      ok: false,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Start a mock SpecTree server for testing.
 */
export function startMockSpecTreeServer(
  options?: MockServerOptions
): MockSpecTreeServer {
  return new MockSpecTreeServer(options);
}

/**
 * Create mock initial state with a test epic and features.
 */
export function createTestState(): Partial<MockServerState> {
  const team: Team = {
    id: "team-test",
    name: "Test Team",
    key: "TEST",
  };

  const epic: Epic = {
    id: "epic-test",
    name: "Test Epic",
    description: "An epic for testing",
    icon: null,
    color: "#3B82F6",
    sortOrder: 0,
    isArchived: false,
    teamId: team.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { features: 2 },
  };

  const features: Feature[] = [
    {
      id: "feature-1",
      epicId: epic.id,
      identifier: "TEST-1",
      title: "First Feature",
      description: "The first feature",
      statusId: "status-1",
      assigneeId: null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 1,
      canParallelize: true,
      parallelGroup: "phase-1",
      dependencies: null,
      estimatedComplexity: "simple",
    },
    {
      id: "feature-2",
      epicId: epic.id,
      identifier: "TEST-2",
      title: "Second Feature",
      description: "The second feature",
      statusId: "status-1",
      assigneeId: null,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 1,
      canParallelize: true,
      parallelGroup: "phase-1",
      dependencies: null,
      estimatedComplexity: "simple",
    },
  ];

  return {
    teams: [team],
    epics: [epic],
    features,
    tasks: [],
    sessions: [],
  };
}
