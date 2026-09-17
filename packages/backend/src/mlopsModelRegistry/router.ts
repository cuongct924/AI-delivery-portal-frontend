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

/** Mirrors DeployStatusResponse (routers/models.py). */
export interface DeployStatus {
  readonly deployed: boolean;
  readonly ready: boolean;
  readonly liveVersion: string | null;
  readonly trafficPercent: number | null;
  readonly prUrl: string | null;
}

/** Mirrors ModelVersionSummaryResponse (routers/models.py). */
export interface ModelVersionSummary {
  readonly name: string;
  readonly version: string;
  readonly taskType: string | null;
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

  // Read-only pass-through to orchestration-api — no caching, no
  // transform beyond snake_case -> camelCase key renaming: this route
  // exists only so the browser doesn't need direct network access to
  // orchestration-api (which has no CORS headers) or a CORS-exempt
  // config value exposed to the frontend.
  async function proxyGet(upstreamPath: string): Promise<
    { ok: true; body: unknown } | { ok: false; status: number; body: unknown }
  > {
    const upstreamUrl = `${baseUrl}${upstreamPath}`;
    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl);
    } catch (error) {
      logger.error(`Failed to reach orchestration-api at ${upstreamUrl}`, error as Error);
      return { ok: false, status: 502, body: { error: `Could not reach orchestration-api at ${baseUrl}` } };
    }

    const text = await upstreamResponse.text();
    const body = text ? JSON.parse(text) : null;
    if (!upstreamResponse.ok) {
      logger.warn(`orchestration-api GET ${upstreamPath} returned ${upstreamResponse.status}: ${text}`);
      return { ok: false, status: upstreamResponse.status, body: body ?? { error: upstreamResponse.statusText } };
    }
    return { ok: true, body };
  }

  // GET /models — every registered model's latest version + metrics/tags.
  router.get('/models', async (_req, res) => {
    const result = await proxyGet('/models');
    res.status(result.ok ? 200 : result.status).json(result.body);
  });

  // GET /models/:name/deploy-status — what's actually live right now
  // (version, traffic split, Ready, most recent PR), for the Model
  // Registry's "Deploy status" — so a Dev sees the current state before
  // opening Evaluate & Deploy Model, instead of guessing a strategy and
  // getting rejected by the backend's own prior-deploy check.
  router.get('/models/:name/deploy-status', async (req, res) => {
    const result = await proxyGet(`/models/${encodeURIComponent(req.params.name)}/deploy-status`);
    if (!result.ok) {
      res.status(result.status).json(result.body);
      return;
    }
    const raw = result.body as {
      deployed: boolean;
      ready: boolean;
      live_version: string | null;
      traffic_percent: number | null;
      pr_url: string | null;
    };
    const status: DeployStatus = {
      deployed: raw.deployed,
      ready: raw.ready,
      liveVersion: raw.live_version,
      trafficPercent: raw.traffic_percent,
      prUrl: raw.pr_url,
    };
    res.json(status);
  });

  // GET /models/:name/:version/summary — metrics/tags for one specific
  // version, for the traffic-split field's "current vs new version"
  // comparison (no live cluster state needed for this one, just MLflow).
  router.get('/models/:name/:version/summary', async (req, res) => {
    const result = await proxyGet(
      `/models/${encodeURIComponent(req.params.name)}/${encodeURIComponent(req.params.version)}/summary`,
    );
    if (!result.ok) {
      res.status(result.status).json(result.body);
      return;
    }
    const raw = result.body as {
      name: string;
      version: string;
      task_type: string | null;
      metrics: Record<string, number>;
      tags: Record<string, string>;
    };
    const summary: ModelVersionSummary = {
      name: raw.name,
      version: raw.version,
      taskType: raw.task_type,
      metrics: raw.metrics,
      tags: raw.tags,
    };
    res.json(summary);
  });

  return router;
}
