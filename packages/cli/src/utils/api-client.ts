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

  constructor(registryUrl?: string) {
    this.baseUrl = registryUrl ?? process.env.SPECTREE_REGISTRY_URL ?? 'http://localhost:3001';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async listPacks(): Promise<PackInfo[]> {
    const response = await this.client.get<{ data: PackInfo[] }>('/api/packs');
    return response.data.data;
  }

  async getPackManifest(packName: string, version?: string): Promise<PackManifest> {
    const url = version 
      ? `/api/packs/${encodeURIComponent(packName)}/versions/${version}`
      : `/api/packs/${encodeURIComponent(packName)}/latest`;
    const response = await this.client.get<PackManifest>(url);
    return response.data;
  }

  async downloadPackFiles(packName: string, version?: string): Promise<Buffer> {
    const url = version 
      ? `/api/packs/${encodeURIComponent(packName)}/versions/${version}/download`
      : `/api/packs/${encodeURIComponent(packName)}/download`;
    const response = await this.client.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  async publishPack(packData: unknown, token: string): Promise<PackInfo> {
    const response = await this.client.post<PackInfo>('/api/packs', packData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async checkPackExists(packName: string): Promise<boolean> {
    try {
      await this.client.head(`/api/packs/${encodeURIComponent(packName)}`);
      return true;
    } catch {
      return false;
    }
  }

  async getPackVersions(packName: string): Promise<PackVersion[]> {
    const response = await this.client.get<{ versions: PackVersion[] }>(`/api/packs/${encodeURIComponent(packName)}/versions`);
    return response.data.versions;
  }
}
