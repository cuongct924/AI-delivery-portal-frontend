import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';
import { MlopsOverlayPanel } from './MlopsOverlayPanel';

const isMlopsComponent = (entity: Entity): boolean =>
  entity.kind.toLowerCase() === 'component';

const mlopsOverlayContent = EntityContentBlueprint.make({
  name: 'mlops-registry',
  params: {
    path: '/mlops-registry',
    title: 'Model Registry',
    filter: isMlopsComponent,
    loader: async () => <MlopsOverlayPanel />,
  },
});

export const mlopsOverlayModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [mlopsOverlayContent],
});
