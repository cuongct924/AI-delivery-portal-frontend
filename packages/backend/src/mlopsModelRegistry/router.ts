import { LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';

/** Mirrors services/orchestration-api/routers/models.py's ModelSummary
 * (Pydantic) response_model for GET /models — kept minimal (no version
 * history, no per-metric typing) since this route is a pass-through, not
 * a transform. */
export interface ModelSummary {
  readonly name: string;
  readonly version: string;
  readonly metrics: Record<string, number>;
  readonly tags: Record<string, string>;
}

export interface RouterOptions {
  logger: LoggerService;
  /** Base URL of orchestration-api, e.g. http://localhost:8000 —
   * config key `orchestrationApi.baseUrl`, same one
   * packages/backend/src/actions/mlopsActions.ts already reads. */
  baseUrl: string;
}

export async function createRouter(options: RouterOptions): Promise<express.Router> {
  const { logger, baseUrl } = options;
  const router = Router();
  router.use(express.json());

  // GET /models — every registered model's latest version + metrics/tags.
  // Read-only pass-through of orchestration-api's own GET /models
  // (routers/models.py) — no caching, no transform: this route exists
  // only so the browser doesn't need direct network access to
  // orchestration-api (which has no CORS headers) or a CORS-exempt
  // config value exposed to the frontend.
  router.get('/models', async (_req, res) => {
    const upstreamUrl = `${baseUrl}/models`;
    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl);
    } catch (error) {
      logger.error(`Failed to reach orchestration-api at ${upstreamUrl}`, error as Error);
      res.status(502).json({ error: `Could not reach orchestration-api at ${baseUrl}` });
      return;
    }

    if (!upstreamResponse.ok) {
      const body = await upstreamResponse.text();
      logger.warn(
        `orchestration-api GET /models returned ${upstreamResponse.status}: ${body}`,
      );
      res.status(upstreamResponse.status).json({ error: body || upstreamResponse.statusText });
      return;
    }

    const models = (await upstreamResponse.json()) as ModelSummary[];
    res.json(models);
  });

  return router;
}
