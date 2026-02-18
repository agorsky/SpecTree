import axios, { type AxiosInstance } from 'axios';

export interface PackManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  files: string[];
  mcpConfig?: Record<string, unknown>;
}

export interface PackVersion {
  version: string;
  publishedAt: string;
}

export interface PackInfo {
  id: string;
  name: string;
  description: string;
  author: string;
  latestVersion: string;
  versions: PackVersion[];
}

export class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(registryUrl?: string, token?: string) {
    this.baseUrl = registryUrl ?? process.env.SPECTREE_REGISTRY_URL ?? 'http://localhost:3001';
    const authToken = token ?? process.env.SPECTREE_TOKEN;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers,
    });
  }

  // Encode pack name for URL path: scoped names like @scope/name
  // are left unencoded (@ and / are valid URL path chars), while
  // non-scoped names/UUIDs are encoded for safety.
  private encodePackName(packName: string): string {
    if (packName.startsWith('@') && packName.includes('/')) {
      return packName; // scoped: @scope/name → use as-is (two path segments)
    }
    return encodeURIComponent(packName);
  }

  async listPacks(): Promise<PackInfo[]> {
    const response = await this.client.get<{ data: PackInfo[] }>('/api/v1/skill-packs');
    return response.data.data;
  }

  async getPackManifest(packName: string, version?: string): Promise<PackManifest> {
    const url = version 
      ? `/api/v1/skill-packs/${this.encodePackName(packName)}/versions/${version}`
      : `/api/v1/skill-packs/${this.encodePackName(packName)}/latest`;
    const response = await this.client.get<PackManifest>(url);
    return response.data;
  }

  async downloadPackFiles(packName: string, version?: string): Promise<Buffer> {
    const url = version 
      ? `/api/v1/skill-packs/${this.encodePackName(packName)}/versions/${version}/download`
      : `/api/v1/skill-packs/${this.encodePackName(packName)}/download`;
    const response = await this.client.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  async publishPack(packData: unknown, token: string): Promise<PackInfo> {
    const response = await this.client.post<PackInfo>('/api/v1/skill-packs', packData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async checkPackExists(packName: string): Promise<boolean> {
    try {
      await this.client.head(`/api/v1/skill-packs/${this.encodePackName(packName)}`);
      return true;
    } catch {
      return false;
    }
  }

  async getPackVersions(packName: string): Promise<PackVersion[]> {
    const response = await this.client.get<{ versions: PackVersion[] }>(`/api/v1/skill-packs/${this.encodePackName(packName)}/versions`);
    return response.data.versions;
  }
}
