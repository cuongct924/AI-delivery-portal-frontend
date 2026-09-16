import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { createRouter } from './router';

const DEFAULT_BASE_URL = 'http://localhost:8000';

/**
 * mlops-model-registry — thin Backstage backend plugin that forwards
 * GET /models to orchestration-api, so the Model Registry Catalog tab
 * (packages/app/src/modules/mlops-model-registry) can show real MLflow
 * data without needing CORS on orchestration-api or a frontend-exposed
 * config value. Same "thin forwarder, business logic stays in
 * orchestration-api" shape as
 * @openchoreo/backstage-plugin-openchoreo-portal-assistant-backend and
 * packages/backend/src/actions/mlopsActions.ts (CLAUDE.md's rule in the
 * AI-delivery-portal backend repo: business logic never lives in the
 * Portal frontend).
 */
export const mlopsModelRegistryBackendPlugin = createBackendPlugin({
  pluginId: 'mlops-model-registry',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        const baseUrl =
          config.getOptionalString('orchestrationApi.baseUrl') ?? DEFAULT_BASE_URL;

        httpRouter.use(await createRouter({ logger, baseUrl }));

        // Same rationale as openchoreo-portal-assistant-backend's own
        // addAuthPolicy: orchestration-api owns real authn/z for this
        // data (get_current_user dependency in routers/models.py); this
        // is read-only Catalog-tab data, so a second gate at the
        // Backstage layer would be redundant.
        httpRouter.addAuthPolicy({
          path: '/models',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
