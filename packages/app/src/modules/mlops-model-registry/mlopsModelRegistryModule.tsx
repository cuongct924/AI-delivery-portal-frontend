import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';
import { modelRegistryApiRef, ModelRegistryClient } from './ModelRegistryApi';

const isComponentEntity = (entity: Entity): boolean =>
  entity.kind.toLowerCase() === 'component';

const modelRegistryApi = ApiBlueprint.make({
  name: 'model-registry-client',
  params: defineParams =>
    defineParams({
      api: modelRegistryApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new ModelRegistryClient(discoveryApi, fetchApi),
    }),
});

/**
 * Real Model Registry tab (MLflow, via
 * packages/backend/src/mlopsModelRegistry) — replaces the old
 * mlops-overlay module's hardcoded demo data. Same tab slot ("Model
 * Registry" on Component entities) so nothing in the sidebar/nav moves.
 */
const modelRegistryEntityContent = EntityContentBlueprint.make({
  name: 'mlops-model-registry',
  params: {
    path: '/mlops-registry',
    title: 'Model Registry',
    filter: isComponentEntity,
    loader: () =>
      import('./ModelRegistryPanel').then(m => <m.ModelRegistryPanel />),
  },
});

export const mlopsModelRegistryModule = createFrontendPlugin({
  pluginId: 'mlops-model-registry',
  extensions: [modelRegistryApi, modelRegistryEntityContent],
});
