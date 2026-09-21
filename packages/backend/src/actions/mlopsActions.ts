/**
 * Custom Scaffolder Actions that call `services/orchestration-api` — the
 * HTTP surface Golden Path #1 (Train->Track->Register), #2
 * (Register->Deploy), and "Setup Model Monitoring" drive. Business logic
 * stays in orchestration-api (CLAUDE.md); these actions only translate
 * Scaffolder input/output and, for training, poll the workflow status until
 * it finishes. LLMOps golden paths (Serving LLM, RAG, prompts) live in
 * llmOpsActions.ts.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { ActionDeps, authHeaders, getBaseUrl, postJson } from './actionsHttpClient';

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/** Terminal phases reported by Argo Workflows (routers/models.py `WorkflowStatusResponse`). */
type TerminalPhase = 'Succeeded' | 'Failed' | 'Error';

const TERMINAL_PHASES: ReadonlySet<TerminalPhase> = new Set([
  'Succeeded',
  'Failed',
  'Error',
]);

/** Response body of `POST {baseUrl}/trigger-training`. */
interface TriggerTrainingResponse {
  readonly workflow_name: string;
}

/** Response body of `POST {baseUrl}/setup-monitoring`. */
interface SetupMonitoringResponse {
  readonly cron_workflow_name: string;
}

/** Response body of `GET {baseUrl}/trigger-training/{workflowName}/status`. */
interface WorkflowStatusResponse {
  readonly name: string;
  readonly phase: string | null;
  readonly message: string | null;
}

/** Response body of `GET {baseUrl}/models/{name}/latest-version`. */
interface LatestVersionResponse {
  readonly name: string;
  readonly version: string;
}

/** Response body of `POST {baseUrl}/models/register`. */
interface RegisterModelResponse {
  readonly name: string;
  readonly version: string;
}

/** Response body of `POST {baseUrl}/datasets/enrich-features`. */
interface EnrichDatasetFeaturesResponse {
  readonly dataset_uri: string;
}

/** One entry of `POST {baseUrl}/datasets/validate`'s response array. */
interface CheckResultItem {
  readonly check_name: string;
  readonly severity: 'blocking' | 'warning' | 'info';
  readonly message: string;
  readonly details: Record<string, unknown>;
}

/** Response body of `GET {baseUrl}/models/{name}/{version}/summary`. */
interface ModelVersionSummaryResponse {
  readonly name: string;
  readonly version: string;
  readonly task_type: string | null;
  readonly metrics: Record<string, number>;
  readonly tags: Record<string, string>;
}

/** Response body of `POST {baseUrl}/policy-check`. */
interface PolicyCheckResponse {
  readonly passed: boolean;
  readonly metrics: Record<string, number>;
  readonly thresholds: Record<string, number>;
}

/** Response body of `POST {baseUrl}/deploy-model/prepare`. */
interface PrepareDeployResponse {
  readonly file_name: string;
  readonly content: string;
  readonly deployed: boolean;
}

/** Response body of `POST {baseUrl}/deploy-model/record`. */
interface RecordDeployResponse {
  readonly model_name: string;
  readonly model_version: string;
  readonly pr_url: string;
}

/** Response body of `POST {baseUrl}/models/{name}/promote`. */
interface PromoteResponse {
  readonly project: string;
  readonly component: string;
  readonly environments: Record<string, string | null>;
  readonly prod_pending_approval: boolean;
}

interface TriggerTrainingActionDeps extends ActionDeps {
  /** Overridable for tests — production callers rely on the defaults below. */
  readonly pollIntervalMs?: number;
  readonly pollTimeoutMs?: number;
}

function enrichReactiveRetrainRequest(
  requestJson: string | undefined,
  monitoringType: 'data-drift' | 'performance-degradation',
): string | undefined {
  if (!requestJson) return undefined;

  let request: unknown;
  try {
    request = JSON.parse(requestJson);
  } catch {
    throw new Error(
      'Retrain request JSON must be valid JSON when auto-retrain is enabled',
    );
  }
  if (
    typeof request !== 'object' ||
    request === null ||
    Array.isArray(request)
  ) {
    throw new Error(
      'Retrain request JSON must be a JSON object when auto-retrain is enabled',
    );
  }

  return JSON.stringify({
    ...(request as Record<string, unknown>),
    trigger_type: 'reactive',
    trigger_reason:
      monitoringType === 'performance-degradation'
        ? 'performance_degradation'
        : 'data_drift_exceeded',
  });
}

/**
 * `orchestration:trigger-training` — starts the train/fine-tune Argo
 * Workflow and polls it until it reaches a terminal phase.
 */
export function createTriggerTrainingAction({
  config,
  tokenService,
  pollIntervalMs = POLL_INTERVAL_MS,
  pollTimeoutMs = POLL_TIMEOUT_MS,
}: TriggerTrainingActionDeps) {
  return createTemplateAction({
    id: 'orchestration:trigger-training',
    description:
      'Triggers the train (or fine-tune) Argo Workflow and waits for it to finish.',
    schema: {
      input: {
        modelName: z =>
          z.string({ description: 'Name to register the trained model under' }),
        datasetUri: z =>
          z.string({ description: 'URI of the training dataset' }),
        taskType: z =>
          z.string({
            description: 'classification, regression, or clustering',
          }),
        architecture: z =>
          z
            .string({
              description:
                '"sklearn" (default), "mlp", or "lstm" — see dl_architecture_registry.py',
            })
            .optional(),
        algorithm: z =>
          z
            .string({
              description:
                'Registry key, e.g. "XGBClassifier" — required when architecture is "sklearn"',
            })
            .optional(),
        targetColumn: z =>
          z
            .string({
              description:
                'Label column — required unless taskType is clustering',
            })
            .optional(),
        idColumns: z =>
          z
            .array(z.string(), {
              description:
                'Columns to exclude as identifiers, e.g. transaction_id',
            })
            .optional(),
        timeColumn: z =>
          z
            .string({
              description:
                'Date/time column — when set, training always uses TimeSeriesSplit to avoid future leakage',
            })
            .optional(),
        baseModelUri: z =>
          z
            .string({
              description:
                'Base model URI — when set, fine-tunes instead of training from scratch',
            })
            .optional(),
        hiddenLayers: z =>
          z
            .array(z.number(), {
              description:
                'Hidden layer sizes, e.g. [64, 32] — architecture=mlp',
            })
            .optional(),
        dropout: z =>
          z
            .number({ description: 'Dropout rate — architecture=mlp' })
            .optional(),
        sequenceLength: z =>
          z
            .number({
              description: 'Sliding-window length — architecture=lstm',
            })
            .optional(),
        numLayers: z =>
          z
            .number({ description: 'LSTM layer count — architecture=lstm' })
            .optional(),
        hiddenSize: z =>
          z
            .number({ description: 'LSTM hidden size — architecture=lstm' })
            .optional(),
        learningRate: z =>
          z
            .number({
              description: 'Optimizer learning rate — architecture=mlp/lstm',
            })
            .optional(),
        epochs: z =>
          z
            .number({ description: 'Training epochs — architecture=mlp/lstm' })
            .optional(),
        batchSize: z =>
          z
            .number({ description: 'Batch size — architecture=mlp/lstm' })
            .optional(),
        optimizer: z =>
          z
            .string({
              description:
                '"adam" (default) or "sgd" — architecture=mlp/lstm/nlp/cv',
            })
            .optional(),
        codeRepoUrl: z =>
          z
            .string({
              description: 'Git repo URL to clone — algorithm="custom" (BYOC)',
            })
            .optional(),
        entrypointPath: z =>
          z
            .string({
              description:
                'Path, relative to the repo root, to the file defining train() — algorithm="custom"',
            })
            .optional(),
        customConfig: z =>
          z
            .string({
              description:
                'JSON object of hyperparameters passed to train()\'s config arg — algorithm="custom"',
            })
            .optional(),
        searchStrategy: z =>
          z
            .string({
              description: '"fixed" (default), "grid", "random", or "bayesian"',
            })
            .optional(),
        numTrials: z =>
          z
            .number({
              description: 'Trial budget — searchStrategy=random/bayesian',
            })
            .optional(),
        searchSpaceJson: z =>
          z
            .string({
              description:
                'JSON object mapping hyperparameter name to {choices:[...]} or {low,high} — searchStrategy!=fixed',
            })
            .optional(),
        objectiveMetric: z =>
          z
            .string({
              description:
                'Metric name to optimize across trials — searchStrategy!=fixed',
            })
            .optional(),
        objectiveDirection: z =>
          z
            .string({
              description:
                '"maximize" (default) or "minimize" — searchStrategy!=fixed',
            })
            .optional(),
        textColumn: z =>
          z
            .string({
              description:
                'Column containing the text to classify — architecture="nlp"',
            })
            .optional(),
        baseModelName: z =>
          z
            .string({
              description:
                'HuggingFace Hub model id to fine-tune — architecture="nlp"',
            })
            .optional(),
      },
      output: {
        workflowName: z =>
          z.string({ description: 'Name of the Argo Workflow that ran' }),
        phase: z =>
          z.string({ description: 'Terminal phase the workflow finished in' }),
        modelVersion: z =>
          z.string({
            description:
              'MLflow model version the register-step registered — resolved after the workflow succeeds',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const { workflow_name: workflowName } =
        await postJson<TriggerTrainingResponse>(
          `${baseUrl}/trigger-training`,
          {
            model_name: ctx.input.modelName,
            dataset_uri: ctx.input.datasetUri,
            task_type: ctx.input.taskType,
            architecture: ctx.input.architecture,
            algorithm: ctx.input.algorithm,
            target_column: ctx.input.targetColumn,
            id_columns: ctx.input.idColumns,
            time_column: ctx.input.timeColumn,
            base_model_uri: ctx.input.baseModelUri,
            hidden_layers: ctx.input.hiddenLayers,
            dropout: ctx.input.dropout,
            sequence_length: ctx.input.sequenceLength,
            num_layers: ctx.input.numLayers,
            hidden_size: ctx.input.hiddenSize,
            learning_rate: ctx.input.learningRate,
            epochs: ctx.input.epochs,
            batch_size: ctx.input.batchSize,
            optimizer: ctx.input.optimizer,
            code_repo_url: ctx.input.codeRepoUrl,
            entrypoint_path: ctx.input.entrypointPath,
            custom_config: ctx.input.customConfig,
            search_strategy: ctx.input.searchStrategy,
            num_trials: ctx.input.numTrials,
            search_space_json: ctx.input.searchSpaceJson,
            objective_metric: ctx.input.objectiveMetric,
            objective_direction: ctx.input.objectiveDirection,
            text_column: ctx.input.textColumn,
            base_model_name: ctx.input.baseModelName,
          },
          tokenService,
        );
      ctx.logger.info(`Triggered training workflow "${workflowName}"`);

      const deadline = Date.now() + pollTimeoutMs;
      let status: WorkflowStatusResponse;
      let lastLoggedPhase: string | null | undefined;
      for (;;) {
        const response = await fetch(
          `${baseUrl}/trigger-training/${workflowName}/status`,
          { headers: await authHeaders(tokenService) },
        );
        if (!response.ok) {
          throw new Error(
            `GET workflow status failed with ${
              response.status
            }: ${await response.text()}`,
          );
        }
        status = (await response.json()) as WorkflowStatusResponse;
        // Only log on a phase transition, not every poll.
        if (status.phase !== lastLoggedPhase) {
          ctx.logger.info(
            `Workflow "${workflowName}" phase: ${status.phase ?? 'unknown'}`,
          );
          lastLoggedPhase = status.phase;
        }
        if (
          status.phase !== null &&
          TERMINAL_PHASES.has(status.phase as TerminalPhase)
        ) {
          break;
        }
        if (Date.now() >= deadline) {
          throw new Error(
            `Timed out after ${
              pollTimeoutMs / 1000
            }s waiting for workflow "${workflowName}" to finish`,
          );
        }
        await sleep(pollIntervalMs);
      }

      const finalPhase = status.phase;
      if (finalPhase !== 'Succeeded') {
        throw new Error(
          `Workflow "${workflowName}" ended in phase "${finalPhase}": ${
            status.message ?? 'no message'
          }`,
        );
      }

      // register-step registers async — fetch the resulting version now.
      const latestVersionResponse = await fetch(
        `${baseUrl}/models/${encodeURIComponent(
          ctx.input.modelName,
        )}/latest-version`,
        { headers: await authHeaders(tokenService) },
      );
      if (!latestVersionResponse.ok) {
        throw new Error(
          `GET latest model version failed with ${
            latestVersionResponse.status
          }: ${await latestVersionResponse.text()}`,
        );
      }
      const { version: modelVersion } =
        (await latestVersionResponse.json()) as LatestVersionResponse;

      ctx.output('workflowName', workflowName);
      ctx.output('phase', finalPhase);
      ctx.output('modelVersion', modelVersion);
    },
  });
}

/**
 * `orchestration:validate-dataset` — runs the Data Quality checks
 * (services/orchestration-api/data_quality/) before training starts, and
 * fails fast (no Argo compute spent) if any check comes back blocking.
 */
export function createValidateDatasetAction({
  config,
  tokenService,
}: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:validate-dataset',
    description:
      'Runs data quality checks against the dataset and fails the step on any blocking result.',
    schema: {
      input: {
        datasetUri: z =>
          z.string({ description: 'URI of the dataset to validate' }),
        taskType: z =>
          z.string({
            description: 'classification, regression, or clustering',
          }),
        targetColumn: z =>
          z
            .string({
              description:
                'Label column — required unless taskType is clustering',
            })
            .optional(),
        timeColumn: z =>
          z
            .string({ description: 'Date/time column, if the data is ordered' })
            .optional(),
      },
      output: {
        results: z =>
          z.array(
            z.object({
              checkName: z.string(),
              severity: z.enum(['blocking', 'warning', 'info']),
              message: z.string(),
            }),
            {
              description:
                'One entry per check that ran, grouped by severity in the log',
            },
          ),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const results = await postJson<CheckResultItem[]>(
        `${baseUrl}/datasets/validate`,
        {
          dataset_uri: ctx.input.datasetUri,
          task_type: ctx.input.taskType,
          target_column: ctx.input.targetColumn,
          time_column: ctx.input.timeColumn,
        },
        tokenService,
      );

      for (const result of results) {
        ctx.logger.info(
          `[${result.severity}] ${result.check_name}: ${result.message}`,
        );
      }

      const blocking = results.filter(r => r.severity === 'blocking');
      if (blocking.length > 0) {
        const summary = blocking
          .map(r => `${r.check_name}: ${r.message}`)
          .join('; ');
        throw new Error(`Dataset validation failed (blocking): ${summary}`);
      }

      ctx.output(
        'results',
        results.map(r => ({
          checkName: r.check_name,
          severity: r.severity,
          message: r.message,
        })),
      );
    },
  });
}

/**
 * `orchestration:enrich-dataset-features` — merges precomputed Feast
 * features into a training dataset before it's handed to
 * `orchestration:trigger-training`. Opt-in — most Golden Path #1 runs skip
 * this step entirely.
 */
export function createEnrichDatasetFeaturesAction({
  config,
  tokenService,
}: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:enrich-dataset-features',
    description: "Merges precomputed Feast features into a dataset's rows.",
    schema: {
      input: {
        datasetUri: z =>
          z.string({ description: 'URI of the dataset to enrich' }),
        entityIdColumn: z =>
          z.string({
            description:
              'Column identifying each row for the Feast lookup, e.g. "transaction_id"',
          }),
        featureNames: z =>
          z.array(z.string(), {
            description:
              'Feast "<feature_view>:<feature>" references, e.g. "transaction_features:amount"',
          }),
      },
      output: {
        datasetUri: z =>
          z.string({
            description:
              'URI of the enriched dataset, with feature columns merged in',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<EnrichDatasetFeaturesResponse>(
        `${baseUrl}/datasets/enrich-features`,
        {
          dataset_uri: ctx.input.datasetUri,
          entity_id_column: ctx.input.entityIdColumn,
          feature_names: ctx.input.featureNames,
        },
        tokenService,
      );
      ctx.output('datasetUri', result.dataset_uri);
    },
  });
}

/**
 * `orchestration:register-model` — registers an existing MLflow run's
 * logged model into the Model Registry. Reuses `POST /models/register`
 * unchanged, the same endpoint the Golden Path #1/#3 Argo Workflow's
 * register-step calls — this is the entry point for a model trained
 * outside any Golden Path (e.g. interactively in AI Notebook).
 */
export function createRegisterModelAction({
  config,
  tokenService,
}: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:register-model',
    description:
      "Registers an existing MLflow run's logged model into the Model Registry.",
    schema: {
      input: {
        modelName: z =>
          z.string({ description: 'Name to register the model under' }),
        artifactUri: z =>
          z.string({
            description:
              'Logged model URI, e.g. "runs:/<run_id>/<artifact_path>" — printed as model_info.model_uri by mlflow.<flavor>.log_model()',
          }),
        taskType: z =>
          z.string({
            description: 'classification, regression, or clustering',
          }),
        datasetVersion: z =>
          z
            .string({
              description:
                'Dataset version — a DVC digest if available, otherwise any free-text identifier',
            })
            .optional(),
      },
      output: {
        modelName: z => z.string({ description: 'Registered model name' }),
        modelVersion: z =>
          z.string({
            description:
              'MLflow version number assigned to the new registration',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<RegisterModelResponse>(
        `${baseUrl}/models/register`,
        {
          name: ctx.input.modelName,
          artifact_uri: ctx.input.artifactUri,
          task_type: ctx.input.taskType,
          dataset_version: ctx.input.datasetVersion,
        },
        tokenService,
      );
      ctx.logger.info(
        `Registered "${result.name}" as version ${result.version}`,
      );
      ctx.output('modelName', result.name);
      ctx.output('modelVersion', result.version);
    },
  });
}

/**
 * `orchestration:model-summary` — fetches a registered model version's
 * task type, metrics, and tags for display mid-template.
 */
export function createModelSummaryAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:model-summary',
    description:
      'Fetches a registered model version — task type, metrics, and tags.',
    schema: {
      input: {
        modelName: z => z.string({ description: 'Registered model name' }),
        modelVersion: z =>
          z.string({ description: 'Registered model version' }),
      },
      output: {
        taskType: z =>
          z
            .string({ description: 'Task type tag set at register time' })
            .nullable(),
        metrics: z =>
          z.record(z.number(), { description: 'Logged training metrics' }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const response = await fetch(
        `${baseUrl}/models/${encodeURIComponent(
          ctx.input.modelName,
        )}/${encodeURIComponent(ctx.input.modelVersion)}/summary`,
        { headers: await authHeaders(tokenService) },
      );
      if (!response.ok) {
        throw new Error(
          `GET model version summary failed with ${
            response.status
          }: ${await response.text()}`,
        );
      }
      const summary = (await response.json()) as ModelVersionSummaryResponse;

      ctx.output('taskType', summary.task_type);
      ctx.output('metrics', summary.metrics);
    },
  });
}

/**
 * `orchestration:policy-check` — runs the Evaluate Gate (direct metric
 * thresholds, no LLM call) against a registered model version and fails
 * the step on rejection.
 */
export function createPolicyCheckAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:policy-check',
    description:
      'Runs the Evaluate Gate (metric thresholds) against a registered model version.',
    schema: {
      input: {
        modelName: z => z.string({ description: 'Registered model name' }),
        modelVersion: z =>
          z.string({ description: 'Registered model version' }),
      },
      output: {
        passed: z =>
          z.boolean({
            description: 'Whether the model passed the Evaluate Gate',
          }),
        metrics: z =>
          z.record(z.number(), {
            description: 'Model metrics compared against thresholds',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<PolicyCheckResponse>(
        `${baseUrl}/policy-check`,
        {
          model_name: ctx.input.modelName,
          model_version: ctx.input.modelVersion,
        },
        tokenService,
      );
      if (result.passed !== true) {
        const summary = Object.entries(result.metrics)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ');
        throw new Error(
          `Evaluate Gate rejected ${ctx.input.modelName}:${ctx.input.modelVersion} — metrics below threshold (${summary})`,
        );
      }
      ctx.output('passed', result.passed);
      ctx.output('metrics', result.metrics);
    },
  });
}

/**
 * `orchestration:prepare-deploy-manifest` — fetches the rendered
 * InferenceService manifest and writes it into the Scaffolder workspace so
 * a later `publish:github:pull-request` step can commit it.
 */
export function createPrepareDeployManifestAction({
  config,
  tokenService,
}: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:prepare-deploy-manifest',
    description:
      'Renders the KServe InferenceService manifest for a model version and writes it into the workspace.',
    schema: {
      input: {
        modelName: z => z.string({ description: 'Registered model name' }),
        modelVersion: z =>
          z.string({ description: 'Registered model version' }),
        trafficStrategy: z =>
          z
            .enum(['direct', 'canary', 'ab', 'blue-green'], {
              description:
                'How traffic moves to the new version — canary/ab/blue-green require a prior deploy',
            })
            .optional(),
        trafficPercent: z =>
          z
            .number({
              description: 'Required unless trafficStrategy is direct/unset',
            })
            .optional(),
        releaseStrategy: z =>
          z
            .enum(['pr-gated', 'instant'], {
              description:
                'pr-gated (default) opens a PR; instant deploys directly, no PR',
            })
            .optional(),
        action: z =>
          z
            .enum(['deploy', 'rollback'], {
              description:
                'rollback overrides trafficStrategy/trafficPercent/releaseStrategy server-side (instant, 100% cutover, no PR) — this template only sends the other 3 fields at all when action=deploy',
            })
            .optional(),
        enablePredictionLogging: z =>
          z
            .boolean({
              description:
                'Tags the model version so a future drift-monitoring Golden Path knows this deploy opted in — does not itself intercept traffic, see IPredictionLogAdapter',
            })
            .optional(),
      },
      output: {
        filePath: z =>
          z.string({
            description: 'Workspace-relative path the manifest was written to',
          }),
        deployed: z =>
          z.boolean({
            description:
              'True when releaseStrategy=instant already deployed it — no PR to publish',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const {
        file_name: fileName,
        content,
        deployed,
      } = await postJson<PrepareDeployResponse>(
        `${baseUrl}/deploy-model/prepare`,
        {
          model_name: ctx.input.modelName,
          model_version: ctx.input.modelVersion,
          traffic_strategy: ctx.input.trafficStrategy,
          traffic_percent: ctx.input.trafficPercent,
          release_strategy: ctx.input.releaseStrategy,
          action: ctx.input.action,
          enable_prediction_logging: ctx.input.enablePredictionLogging,
        },
        tokenService,
      );
      const absolutePath = path.join(ctx.workspacePath, fileName);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf-8');
      ctx.logger.info(
        deployed
          ? `Deployed "${ctx.input.modelName}:${ctx.input.modelVersion}" directly (releaseStrategy=instant)`
          : `Wrote deploy manifest to "${fileName}"`,
      );
      ctx.output('filePath', fileName);
      ctx.output('deployed', deployed);
    },
  });
}

/**
 * `orchestration:record-deploy` — records the deploy PR URL as an MLflow
 * model version tag so the Dashboard can read it back later.
 */
export function createRecordDeployAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:record-deploy',
    description:
      'Records the deploy pull request URL against the model version.',
    schema: {
      input: {
        modelName: z => z.string({ description: 'Registered model name' }),
        modelVersion: z =>
          z.string({ description: 'Registered model version' }),
        prUrl: z =>
          z
            .string({
              description:
                'URL of the deploy pull request — omitted for an instant release',
            })
            .optional(),
      },
      output: {
        recorded: z =>
          z.boolean({
            description:
              'Always true on success — an HTTP error throws instead',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      await postJson<RecordDeployResponse>(
        `${baseUrl}/deploy-model/record`,
        {
          model_name: ctx.input.modelName,
          model_version: ctx.input.modelVersion,
          pr_url: ctx.input.prUrl,
        },
        tokenService,
      );
      ctx.output('recorded', true);
    },
  });
}

/**
 * `orchestration:promote-model` — the *only* real path that reaches
 * OpenChoreoPromotionAdapter.promote() (adapters/openchoreo_promotion_adapter.py):
 * a Dev running this Golden Path template themselves. That's the whole
 * "manual approval" gate for a staging/prod promotion — no agent/MCP tool
 * calls this action or the endpoint behind it.
 */
export function createPromoteModelAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:promote-model',
    description:
      'Promotes the model currently bound in the source environment to the next one.',
    schema: {
      input: {
        modelName: z => z.string({ description: 'Registered model name' }),
        targetEnvironment: z =>
          z.enum(['staging', 'production'], {
            description:
              'staging promotes from development; production promotes from staging',
          }),
      },
      output: {
        environments: z =>
          z.record(z.string(), z.string().nullable(), {
            description:
              'Release bound in each environment after the promotion',
          }),
        prodPendingApproval: z =>
          z.boolean({
            description: 'True when staging is ahead of production',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const { environments, prod_pending_approval: prodPendingApproval } =
        await postJson<PromoteResponse>(
          `${baseUrl}/models/${ctx.input.modelName}/promote`,
          { target_environment: ctx.input.targetEnvironment },
          tokenService,
        );
      ctx.logger.info(
        `Promoted "${ctx.input.modelName}" to ${ctx.input.targetEnvironment}`,
      );
      ctx.output('environments', environments);
      ctx.output('prodPendingApproval', prodPendingApproval);
    },
  });
}

/**
 * `orchestration:rollback-promotion` — the staging/prod counterpart to
 * action=rollback (which only ever touches dev). Undoes the last
 * promote()/rollback-promotion() for one environment via
 * adapters/openchoreo_promotion_adapter.py's annotation-based one-level
 * undo — see that module's docstring.
 */
export function createRollbackPromotionAction({
  config,
  tokenService,
}: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:rollback-promotion',
    description:
      'Undoes the last promotion for one environment, moving it back to what was bound there before.',
    schema: {
      input: {
        modelName: z => z.string({ description: 'Registered model name' }),
        environment: z =>
          z.enum(['staging', 'production'], {
            description: 'Which environment to roll back',
          }),
      },
      output: {
        environments: z =>
          z.record(z.string(), z.string().nullable(), {
            description: 'Release bound in each environment after the rollback',
          }),
        prodPendingApproval: z =>
          z.boolean({
            description: 'True when staging is ahead of production',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const { environments, prod_pending_approval: prodPendingApproval } =
        await postJson<PromoteResponse>(
          `${baseUrl}/models/${ctx.input.modelName}/promote-rollback`,
          { environment: ctx.input.environment },
          tokenService,
        );
      ctx.logger.info(
        `Rolled back "${ctx.input.modelName}"'s promotion in ${ctx.input.environment}`,
      );
      ctx.output('environments', environments);
      ctx.output('prodPendingApproval', prodPendingApproval);
    },
  });
}

/**
 * `orchestration:setup-monitoring` — registers a periodic Argo CronWorkflow.
 * Unlike every other action here, this doesn't poll a workflow to
 * completion — Setup just registers the schedule and returns.
 */
export function createSetupMonitoringAction({
  config,
  tokenService,
}: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:setup-monitoring',
    description:
      'Registers a periodic Argo CronWorkflow that checks the model for data drift.',
    schema: {
      input: {
        modelName: z => z.string({ description: 'Registered model name' }),
        modelVersion: z =>
          z.string({ description: 'Registered model version' }),
        referenceDataUri: z =>
          z.string({
            description:
              'file:// CSV path — normally the dataset the model was trained on',
          }),
        productionDataSource: z =>
          z.enum(['managed-prediction-log', 'custom-uri'], {
            description:
              'Use the platform-managed prediction log or provide a custom URI',
          }),
        productionDataUri: z =>
          z
            .string({
              description:
                'file:// CSV path with recent production input data to compare against it',
            })
            .optional(),
        schedule: z =>
          z.string({
            description: 'Cron expression, e.g. "0 0 * * *" for daily',
          }),
        monitoringType: z =>
          z.enum(['data-drift', 'performance-degradation'], {
            description:
              'Whether to monitor input distribution or labeled model performance',
          }),
        driftThreshold: z =>
          z
            .number({
              description:
                'Share of columns (0-1) Evidently must flag as drifted to count as drift',
            })
            .optional(),
        groundTruthDataUri: z =>
          z
            .string({
              description:
                'file:// CSV path containing delayed labels aligned with production predictions — required for performance-degradation',
            })
            .optional(),
        groundTruthDataSource: z =>
          z
            .enum(['managed-label-log', 'custom-uri'], {
              description:
                'Use the managed delayed-label stream or provide a custom URI',
            })
            .optional(),
        metricName: z =>
          z
            .string({
              description:
                'Metric to monitor when monitoringType=performance-degradation, e.g. f1_score or accuracy',
            })
            .optional(),
        minMetricThreshold: z =>
          z
            .number({
              description:
                'Minimum acceptable performance metric when monitoringType=performance-degradation',
            })
            .optional(),
        onDriftDetected: z =>
          z
            .string({ description: '"alert-only" (default) or "auto-retrain"' })
            .optional(),
        retrainRequestJson: z =>
          z
            .string({
              description:
                'JSON body to POST to /trigger-training — required when onDriftDetected="auto-retrain"',
            })
            .optional(),
      },
      output: {
        cronWorkflowName: z =>
          z.string({ description: 'Name of the registered CronWorkflow' }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const retrainRequestJson =
        ctx.input.onDriftDetected === 'auto-retrain'
          ? enrichReactiveRetrainRequest(
              ctx.input.retrainRequestJson,
              ctx.input.monitoringType,
            )
          : undefined;
      const { cron_workflow_name: cronWorkflowName } =
        await postJson<SetupMonitoringResponse>(
          `${baseUrl}/setup-monitoring`,
          {
            model_name: ctx.input.modelName,
            model_version: ctx.input.modelVersion,
            reference_data_uri: ctx.input.referenceDataUri,
            production_data_source: ctx.input.productionDataSource,
            production_data_uri: ctx.input.productionDataUri,
            schedule: ctx.input.schedule,
            monitoring_type: ctx.input.monitoringType,
            drift_threshold: ctx.input.driftThreshold,
            ground_truth_data_uri: ctx.input.groundTruthDataUri,
            ground_truth_data_source: ctx.input.groundTruthDataSource,
            metric_name: ctx.input.metricName,
            min_metric_threshold: ctx.input.minMetricThreshold,
            on_drift_detected: ctx.input.onDriftDetected,
            retrain_request_json: retrainRequestJson,
            failure_webhook_url: config.getOptionalString(
              'mlops.monitoring.failureWebhookUrl',
            ),
          },
          tokenService,
        );
      ctx.logger.info(
        `Registered monitoring CronWorkflow "${cronWorkflowName}"`,
      );
      ctx.output('cronWorkflowName', cronWorkflowName);
    },
  });
}

