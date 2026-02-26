import axios, { type AxiosInstance, type AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  cursor: string | null;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SingleResponse<T> {
  data: T;
}

// Teams
export interface Team {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// Epics
export interface Epic {
  id: string;
  name: string;
  description: string | null;
  teamId: string | null;
  personalScopeId: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  team?: { id: string; name: string; key: string } | null;
  _count?: { features: number };
}

export interface CreateEpicInput {
  name: string;
  teamId: string;
  description?: string;
}

// Epic Requests
export interface EpicRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  requestedById: string;
  personalScopeId: string | null;
  structuredDesc: StructuredDesc | null;
  createdAt: string;
  updatedAt: string;
  requestedBy?: { id: string; name: string | null; email: string };
}

export interface StructuredDesc {
  problemStatement: string;
  proposedSolution: string;
  impactAssessment: string;
  targetAudience?: string;
  successMetrics?: string;
  alternatives?: string;
  dependencies?: string;
  estimatedEffort?: string;
}

export interface CreateEpicRequestInput {
  title: string;
  description?: string;
  structuredDesc?: StructuredDesc;
}

export interface CreatePersonalEpicRequestInput {
  title: string;
  description?: string;
  structuredDesc?: StructuredDesc;
}

// Features
export interface Feature {
  id: string;
  title: string;
  identifier: string | null;
  description: string | null;
  epicId: string;
  statusId: string | null;
  assigneeId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  status?: { id: string; name: string; category: string; color: string | null } | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  _count?: { tasks: number };
}

// Tasks
export interface Task {
  id: string;
  title: string;
  identifier: string | null;
  description: string | null;
  featureId: string;
  statusId: string | null;
  assigneeId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  status?: { id: string; name: string; category: string; color: string | null } | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  feature?: { id: string; title: string; identifier: string | null };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class SpecTreeApiClient {
  private client: AxiosInstance;

  constructor(baseUrl?: string, token?: string) {
    const resolvedUrl = baseUrl ?? process.env.SPECTREE_API_URL ?? 'http://localhost:3001';
    const resolvedToken = token ?? process.env.SPECTREE_API_TOKEN;

    if (!resolvedToken) {
      throw new Error(
        'Authentication required. Set SPECTREE_API_TOKEN env var or use --token flag.\n' +
        'Tokens start with "st_".'
      );
    }

    this.client = axios.create({
      baseURL: `${resolvedUrl.replace(/\/+$/, '')}/api/v1`,
      headers: {
        Authorization: `Bearer ${resolvedToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  async listTeams(): Promise<PaginatedResponse<Team>> {
    const { data } = await this.request<PaginatedResponse<Team>>('GET', '/teams');
    return data;
  }

  // -------------------------------------------------------------------------
  // Epics
  // -------------------------------------------------------------------------

  async listEpics(params?: { teamId?: string }): Promise<PaginatedResponse<Epic>> {
    const { data } = await this.request<PaginatedResponse<Epic>>('GET', '/epics', params ? { params } : undefined);
    return data;
  }

  async getEpic(id: string): Promise<SingleResponse<Epic>> {
    const { data } = await this.request<SingleResponse<Epic>>('GET', `/epics/${encodeURIComponent(id)}`);
    return data;
  }

  async createEpic(input: CreateEpicInput): Promise<SingleResponse<Epic>> {
    const { data } = await this.request<SingleResponse<Epic>>('POST', '/epics', { data: input });
    return data;
  }

  // -------------------------------------------------------------------------
  // Epic Requests
  // -------------------------------------------------------------------------

  async listEpicRequests(params?: { status?: string }): Promise<PaginatedResponse<EpicRequest>> {
    const { data } = await this.request<PaginatedResponse<EpicRequest>>('GET', '/epic-requests', params ? { params } : undefined);
    return data;
  }

  async getEpicRequest(id: string): Promise<SingleResponse<EpicRequest>> {
    const { data } = await this.request<SingleResponse<EpicRequest>>('GET', `/epic-requests/${encodeURIComponent(id)}`);
    return data;
  }

  async createEpicRequest(input: CreateEpicRequestInput): Promise<SingleResponse<EpicRequest>> {
    const { data } = await this.request<SingleResponse<EpicRequest>>('POST', '/epic-requests', { data: input });
    return data;
  }

  async createPersonalEpicRequest(input: CreatePersonalEpicRequestInput): Promise<SingleResponse<EpicRequest>> {
    const { data } = await this.request<SingleResponse<EpicRequest>>('POST', '/me/epic-requests', { data: input });
    return data;
  }

  async approveEpicRequest(id: string): Promise<SingleResponse<EpicRequest>> {
    const { data } = await this.request<SingleResponse<EpicRequest>>('POST', `/epic-requests/${encodeURIComponent(id)}/approve`);
    return data;
  }

  async rejectEpicRequest(id: string, reason?: string): Promise<SingleResponse<EpicRequest>> {
    const body = reason ? { reason } : undefined;
    const { data } = await this.request<SingleResponse<EpicRequest>>('POST', `/epic-requests/${encodeURIComponent(id)}/reject`, { data: body });
    return data;
  }

  // -------------------------------------------------------------------------
  // Features
  // -------------------------------------------------------------------------

  async listFeatures(epicId: string, params?: { status?: string }): Promise<PaginatedResponse<Feature>> {
    const { data } = await this.request<PaginatedResponse<Feature>>('GET', '/features', {
      params: { epicId, ...params },
    });
    return data;
  }

  async getFeature(id: string): Promise<SingleResponse<Feature>> {
    const { data } = await this.request<SingleResponse<Feature>>('GET', `/features/${encodeURIComponent(id)}`);
    return data;
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------

  async listTasks(featureId: string, params?: { status?: string }): Promise<PaginatedResponse<Task>> {
    const { data } = await this.request<PaginatedResponse<Task>>('GET', '/tasks', {
      params: { featureId, ...params },
    });
    return data;
  }

  async getTask(id: string): Promise<SingleResponse<Task>> {
    const { data } = await this.request<SingleResponse<Task>>('GET', `/tasks/${encodeURIComponent(id)}`);
    return data;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async request<T>(
    method: string,
    url: string,
    options?: { params?: Record<string, string | undefined>; data?: unknown },
  ): Promise<{ data: T }> {
    try {
      const response = await this.client.request<T>({
        method,
        url,
        params: options?.params,
        data: options?.data,
      });
      return { data: response.data };
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; error?: string }>;
      if (axiosErr.response) {
        const status = axiosErr.response.status;
        const body = axiosErr.response.data;
        const msg = body?.message ?? body?.error ?? axiosErr.message;
        throw new Error(`API error (${String(status)}): ${msg}`);
      }
      if (axiosErr.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to SpecTree API. Is the server running?');
      }
      throw err;
    }
  }
}
