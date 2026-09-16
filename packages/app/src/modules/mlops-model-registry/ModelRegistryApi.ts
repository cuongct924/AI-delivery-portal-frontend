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

export interface ModelRegistryApi {
  listModels(): Promise<ModelSummary[]>;
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
    const baseUrl = await this.discoveryApi.getBaseUrl('mlops-model-registry');
    const response = await this.fetchApi.fetch(`${baseUrl}/models`);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to list models (${response.status}): ${body || response.statusText}`,
      );
    }
    return (await response.json()) as ModelSummary[];
  }
}
