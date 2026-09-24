/**
 * Shared HTTP client plumbing for the `services/orchestration-api` Custom
 * Scaffolder Actions, split between mlopsActions.ts (ML) and
 * llmOpsActions.ts (LLMOps: RAG + prompts + LLM serving). Business logic
 * stays in orchestration-api (CLAUDE.md); these actions only translate
 * Scaffolder input/output.
 */

import { setTimeout as sleep } from 'node:timers/promises';
import { Config } from '@backstage/config';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

const DEFAULT_BASE_URL = 'http://localhost:8000';

export interface ActionDeps {
  readonly config: Config;
  /**
   * Absent in tests that don't wire it — falls back to no Authorization
   * header, same as before this was added (matches orchestration-api's
   * own AUTH_ENABLED=false dev-bypass).
   */
  readonly tokenService?: OpenChoreoTokenService;
}

export function getBaseUrl(config: Config): string {
  return (
    config.getOptionalString('orchestrationApi.baseUrl') ?? DEFAULT_BASE_URL
  );
}

/**
 * Every orchestration-api route but `/models/register` requires a Bearer
 * token (`Depends(get_current_user)`). Scaffolder actions run purely
 * server-side with no per-request end-user Thunder token available (unlike
 * the frontend's direct-mode calls, which get one via `oauthApi` — see
 * PerchAgentApi.ts) — a service identity via client_credentials is the
 * right shape here, same as `ClientCredentialsProvider`'s own doc comment
 * ("background tasks that don't have a user context").
 */
export async function authHeaders(
  tokenService: OpenChoreoTokenService | undefined,
): Promise<Record<string, string>> {
  if (!tokenService?.hasServiceCredentials()) {
    return {};
  }
  const token = await tokenService.getServiceToken();
  return { Authorization: `Bearer ${token}` };
}

export async function postJson<T>(
  url: string,
  body: unknown,
  tokenService?: OpenChoreoTokenService,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders(tokenService)),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `POST ${url} failed with ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

/** Human-readable message for a caught `unknown` — `fetch` rejects with a bare `TypeError: fetch failed` whose `.cause` carries the real reason. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    return cause instanceof Error
      ? `${error.message} (${cause.message})`
      : error.message;
  }
  return String(error);
}

/**
 * `fetch` that retries transient network-level failures — undici's
 * `TypeError: fetch failed` (connection refused/reset, DNS blip, a dropped
 * keep-alive socket, or orchestration-api restarting mid-run). HTTP error
 * statuses are NOT retried here; callers decide what a 4xx/5xx means. Used
 * for the one-shot calls around a long training run so a single blip
 * doesn't fail an otherwise-healthy task.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 3, delayMs = 1_000 }: { retries?: number; delayMs?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(delayMs);
    }
  }
  throw lastError;
}
