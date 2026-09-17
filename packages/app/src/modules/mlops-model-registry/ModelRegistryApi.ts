import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

/** Mirrors packages/backend/src/mlopsModelRegistry/router.ts's ModelSummary
 * (itself a pass-through of services/orchestration-api/routers/models.py's
 * ModelSummary response_model). */
export interface ModelSummary {
  readonly name: string;
  readonly version: string;
  readonly metrics: Record<string, number>;
  readonly tags: Record<string, string>;
}

/** Mirrors packages/backend/src/mlopsModelRegistry/router.ts's DeployStatus. */
export interface DeployStatus {
  readonly deployed: boolean;
  readonly ready: boolean;
  readonly liveVersion: string | null;
  readonly trafficPercent: number | null;
  readonly prUrl: string | null;
}

/** Mirrors packages/backend/src/mlopsModelRegistry/router.ts's ModelVersionSummary. */
export interface ModelVersionSummary {
  readonly name: string;
  readonly version: string;
  readonly taskType: string | null;
  readonly metrics: Record<string, number>;
  readonly tags: Record<string, string>;
}

export interface ModelRegistryApi {
  listModels(): Promise<ModelSummary[]>;
  getDeployStatus(name: string): Promise<DeployStatus>;
  getVersionSummary(name: string, version: string): Promise<ModelVersionSummary>;
}

export const modelRegistryApiRef = createApiRef<ModelRegistryApi>({
  id: 'plugin.mlops-model-registry.api',
});

export class ModelRegistryClient implements ModelRegistryApi {
  constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  async listModels(): Promise<ModelSummary[]> {
    return this.get<ModelSummary[]>('/models');
  }

  async getDeployStatus(name: string): Promise<DeployStatus> {
    return this.get<DeployStatus>(`/models/${encodeURIComponent(name)}/deploy-status`);
  }

  async getVersionSummary(name: string, version: string): Promise<ModelVersionSummary> {
    return this.get<ModelVersionSummary>(
      `/models/${encodeURIComponent(name)}/${encodeURIComponent(version)}/summary`,
    );
  }

  private async get<T>(path: string): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('mlops-model-registry');
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Request to ${path} failed (${response.status}): ${body || response.statusText}`,
      );
    }
    return (await response.json()) as T;
  }
}
