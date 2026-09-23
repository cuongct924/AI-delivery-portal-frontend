/**
 * Custom Scaffolder Action for AI Notebook (JupyterHub) — the interactive
 * counterpart to Golden Path #1's declarative Argo training, driven by the
 * train-track-register template's `trainingMode=notebook` branch. Provisions
 * a per-user notebook server via orchestration-api's `POST /notebooks`
 * (routers/notebooks.py, backed by INotebookAdapter) and returns its URL.
 *
 * Kept separate from mlopsActions.ts: a notebook is long-running/interactive,
 * not a 1-shot workflow the action polls to completion.
 */

import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { ActionDeps, getBaseUrl, postJson } from './actionsHttpClient';

/** Response body of `POST {baseUrl}/notebooks`. */
interface CreateNotebookResponse {
  readonly notebook_id: string;
  readonly url: string | null;
  readonly active: boolean;
}

/**
 * `orchestration:create-notebook` — spawns a JupyterHub server for the
 * current user and returns the URL to open it.
 */
export function createNotebookAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:create-notebook',
    description:
      'Provisions an AI Notebook (JupyterHub) server and returns its URL.',
    schema: {
      input: {
        environment: z =>
          z.string({
            description:
              'Notebook environment/profile, e.g. "pytorch-cuda", "tensorflow-cuda", "sklearn-cpu"',
          }),
        cpuCores: z =>
          z.number({ description: 'CPU cores to allocate' }).optional(),
        ramGb: z =>
          z.number({ description: 'RAM to allocate, in GB' }).optional(),
        gpuType: z =>
          z
            .string({
              description: 'GPU type, e.g. "t4" — omit for CPU-only',
            })
            .optional(),
        gpuCount: z =>
          z
            .number({ description: 'Number of GPUs — ignored when CPU-only' })
            .optional(),
        storageGb: z =>
          z
            .number({
              description:
                'Persistent storage in GB — survives stop/start, holds the working environment',
            })
            .optional(),
        idleTimeoutMinutes: z =>
          z
            .number({
              description:
                'Auto-shutdown after this many idle minutes (0 = never)',
            })
            .optional(),
      },
      output: {
        notebookId: z =>
          z.string({ description: 'Identifier of the spawned notebook' }),
        notebookUrl: z =>
          z.string({ description: 'URL to open the notebook in a browser' }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<CreateNotebookResponse>(
        `${baseUrl}/notebooks`,
        {
          environment: ctx.input.environment,
          cpu_cores: ctx.input.cpuCores,
          ram_gb: ctx.input.ramGb,
          gpu_type: ctx.input.gpuType,
          gpu_count: ctx.input.gpuCount,
          storage_gb: ctx.input.storageGb,
          idle_timeout_minutes: ctx.input.idleTimeoutMinutes,
        },
        tokenService,
        // Same retry guard as trigger-training — a retried step must not
        // spawn a second server.
        { 'Idempotency-Key': ctx.task.id },
      );
      ctx.logger.info(
        `Spawned notebook "${result.notebook_id}" at ${result.url}`,
      );
      ctx.output('notebookId', result.notebook_id);
      ctx.output('notebookUrl', result.url ?? '');
    },
  });
}
