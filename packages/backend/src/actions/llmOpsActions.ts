/**
 * Custom Scaffolder Actions that call `services/orchestration-api`'s
 * LLMOps surface — "Serving LLM" and the LLMOps Lifecycle (RAG
 * ingest/evaluate/activate, prompt draft/evaluate/activate) golden paths —
 * see examples/templates/. Split out of mlopsActions.ts, which keeps the
 * ML-only golden paths (Train->Track->Register, Register->Deploy). Business
 * logic stays in orchestration-api (CLAUDE.md); these actions only
 * translate Scaffolder input/output.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  ActionDeps,
  authHeaders,
  getBaseUrl,
  postJson,
} from './actionsHttpClient';

/** Response body of `POST {baseUrl}/llm-deploy/prepare`. */
interface PrepareLlmDeployResponse {
  readonly file_name: string;
  readonly content: string;
  readonly deployed: boolean;
}

/** Response body of `POST {baseUrl}/rag/ingest`. */
interface RagIngestResponse {
  readonly collection: string;
  readonly index_version: string;
  readonly chunks_ingested: number;
}

/** Response body of `POST {baseUrl}/rag/evaluate`. */
interface RagEvaluateResponse {
  readonly passed: boolean;
  readonly pass_rate: number;
  readonly results: Record<string, unknown>[];
  readonly total_tokens: number;
  readonly total_cost_usd: number | null;
}

/** Response body of `POST {baseUrl}/rag/activate`. */
interface RagActivateResponse {
  readonly collection: string;
  readonly environment: string;
  readonly active_version: string;
}

/** Response body of `POST {baseUrl}/prompts`. */
interface DraftPromptResponse {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly persona: string;
  readonly content: string;
}

/** Response body of `POST {baseUrl}/prompts/{name}/evaluate`. */
interface EvaluatePromptResponse {
  readonly passed: boolean;
  readonly pass_rate: number;
  readonly results: Record<string, unknown>[];
  readonly total_tokens: number;
  readonly total_cost_usd: number | null;
}

/** Response body of `POST {baseUrl}/prompts/{name}/activate`. */
interface ActivatePromptResponse {
  readonly name: string;
  readonly environment: string;
  readonly active_version: string;
}

/** Response body of `POST {baseUrl}/eval-sets`. */
interface DraftEvalSetResponse {
  readonly name: string;
  readonly version: string;
  readonly questions: string[];
}

/** Response body of `GET {baseUrl}/eval-sets/{name}/latest`. */
interface EvalSetVersionResponse {
  readonly name: string;
  readonly version: string;
  readonly questions: string[];
}

/**
 * `orchestration:prepare-llm-deploy-manifest` — renders the KServe
 * InferenceService manifest for a self-hosted LLM (vLLM, referenced by
 * HuggingFace Hub id — not an MLflow-registered artifact) and writes it
 * into the Scaffolder workspace, same shape as
 * `orchestration:prepare-deploy-manifest` but a separate endpoint since
 * that one hardcodes the MLflow Model Registry URI formula.
 */
export function createPrepareLlmDeployManifestAction({
  config,
  tokenService,
}: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:prepare-llm-deploy-manifest',
    description:
      'Renders the KServe InferenceService manifest for a self-hosted LLM and writes it into the workspace.',
    schema: {
      input: {
        modelName: z =>
          z.string({ description: 'Name to deploy the LLM under' }),
        huggingFaceModelId: z =>
          z.string({
            description:
              'HuggingFace Hub model id, e.g. "meta-llama/Llama-3.1-8B-Instruct"',
          }),
        runtime: z =>
          z
            .string({
              description: '"vllm" (default) — see llm_serving/registry.py',
            })
            .optional(),
        gpuType: z =>
          z.enum(['L4', 'L40S', 'A100', 'H100', 'H200', 'B200'], {
            description: 'GPU type to request',
          }),
        gpuCount: z =>
          z
            .enum(['1', '2', '4', '8'], {
              description: 'GPU count — also used as tensor-parallel-size',
            })
            .optional(),
        quantization: z =>
          z
            .enum(['none', 'fp8', 'int8', 'int4-awq'], {
              description:
                'Not every gpuType supports every value — see llm_serving/registry.py',
            })
            .optional(),
        maxContextLength: z =>
          z.number({ description: 'Max context length in tokens' }).optional(),
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
        environment: z =>
          z
            .enum(['dev', 'staging', 'prod'], {
              description:
                'Target environment — instant only allowed on dev (backend guardrail)',
            })
            .optional(),
        hfTokenSecretRef: z =>
          z
            .string({
              description:
                'K8s Secret name holding the HF token, never the token itself — required when the model is gated',
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
      } = await postJson<PrepareLlmDeployResponse>(
        `${baseUrl}/llm-deploy/prepare`,
        {
          model_name: ctx.input.modelName,
          huggingface_model_id: ctx.input.huggingFaceModelId,
          runtime: ctx.input.runtime,
          gpu_type: ctx.input.gpuType,
          gpu_count: ctx.input.gpuCount
            ? Number(ctx.input.gpuCount)
            : undefined,
          quantization: ctx.input.quantization,
          max_context_length: ctx.input.maxContextLength,
          traffic_strategy: ctx.input.trafficStrategy,
          traffic_percent: ctx.input.trafficPercent,
          release_strategy: ctx.input.releaseStrategy,
          environment: ctx.input.environment,
          hf_token_secret_ref: ctx.input.hfTokenSecretRef,
        },
        tokenService,
      );
      const absolutePath = path.join(ctx.workspacePath, fileName);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf-8');
      ctx.logger.info(
        deployed
          ? `Deployed LLM "${ctx.input.modelName}" directly (releaseStrategy=instant)`
          : `Wrote LLM deploy manifest to "${fileName}"`,
      );
      ctx.output('filePath', fileName);
      ctx.output('deployed', deployed);
    },
  });
}

/**
 * `orchestration:rag-ingest` — chunks and embeds documents into a Qdrant
 * collection, registering a new (inactive) RAG index version.
 */
export function createRagIngestAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:rag-ingest',
    description:
      'Chunks and embeds documents into a Qdrant collection, registering a new (inactive) RAG index version.',
    schema: {
      input: {
        collection: z => z.string({ description: 'Qdrant collection name' }),
        sourcePaths: z =>
          z.array(z.string(), {
            description:
              'Repo-relative paths to ingest, e.g. ["docs/playbook-ai-delivery-portal.md"]',
          }),
        chunkSize: z =>
          z.number({ description: 'Characters per chunk' }).optional(),
        chunkOverlap: z =>
          z
            .number({
              description: 'Character overlap between consecutive chunks',
            })
            .optional(),
      },
      output: {
        indexVersion: z =>
          z.string({
            description: 'Newly registered RAG index version — not active yet',
          }),
        chunksIngested: z =>
          z.number({ description: 'Number of chunks embedded and upserted' }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<RagIngestResponse>(
        `${baseUrl}/rag/ingest`,
        {
          collection: ctx.input.collection,
          source_paths: ctx.input.sourcePaths,
          chunk_size: ctx.input.chunkSize,
          chunk_overlap: ctx.input.chunkOverlap,
        },
        tokenService,
      );
      ctx.logger.info(
        `Ingested ${result.chunks_ingested} chunks into "${result.collection}" as version ${result.index_version}`,
      );
      ctx.output('indexVersion', result.index_version);
      ctx.output('chunksIngested', result.chunks_ingested);
    },
  });
}

/**
 * `orchestration:rag-evaluate` — runs the LLM-as-judge Evaluate Gate
 * against a RAG index version and reports the pass rate.
 */
export function createRagEvaluateAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:rag-evaluate',
    description:
      'Runs the LLM-as-judge Evaluate Gate against a RAG index version and reports the pass rate.',
    schema: {
      input: {
        collection: z => z.string({ description: 'Qdrant collection name' }),
        indexVersion: z =>
          z.string({ description: 'RAG index version to evaluate' }),
        evalCases: z =>
          z.array(z.string(), {
            description: 'Questions to run through the LLM judge',
          }),
        model: z =>
          z
            .string({
              description:
                'model_name registered in litellm-config.yaml — including a self-hosted model deployed via the Serving LLM Golden Path. Defaults to "claude-sonnet-5"',
            })
            .optional(),
      },
      output: {
        passed: z => z.boolean({ description: 'True when pass_rate >= 0.8' }),
        passRate: z =>
          z.number({
            description: 'Fraction of eval_cases that passed the gate',
          }),
        totalTokens: z =>
          z.number({
            description:
              "Total tokens across all eval_cases' answer-generation calls",
          }),
        totalCostUsd: z =>
          z
            .number({
              description:
                'Total cost in USD — null when the model has no cost entry in litellm-config.yaml (e.g. a self-hosted model)',
            })
            .nullable(),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<RagEvaluateResponse>(
        `${baseUrl}/rag/evaluate`,
        {
          collection: ctx.input.collection,
          index_version: ctx.input.indexVersion,
          eval_cases: ctx.input.evalCases.map(question => ({ question })),
          model: ctx.input.model,
        },
        tokenService,
      );
      ctx.logger.info(
        `RAG evaluate: passed=${result.passed} pass_rate=${result.pass_rate} total_tokens=${result.total_tokens} total_cost_usd=${result.total_cost_usd}`,
      );
      ctx.output('passed', result.passed);
      ctx.output('passRate', result.pass_rate);
      ctx.output('totalTokens', result.total_tokens);
      ctx.output('totalCostUsd', result.total_cost_usd);
    },
  });
}

/**
 * `orchestration:rag-activate` — activates a RAG index version;
 * routers/chat.py starts retrieving from it immediately.
 */
export function createRagActivateAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:rag-activate',
    description: 'Activates a RAG index version for use by the chat endpoint.',
    schema: {
      input: {
        collection: z => z.string({ description: 'Qdrant collection name' }),
        indexVersion: z =>
          z.string({ description: 'RAG index version to activate' }),
        environment: z =>
          z
            .string({
              description:
                '"development" | "staging" | "production" — tracked independently; defaults to "production", the environment chat.py actually reads from',
            })
            .optional(),
        isRollback: z =>
          z
            .boolean({
              description:
                'True for a rollback to a previously-active version — skips no server-side check, only tags the DORA deployment event as "rollback" instead of "deploy"',
            })
            .optional(),
      },
      output: {
        activeVersion: z =>
          z.string({
            description: 'The version now active for this collection',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<RagActivateResponse>(
        `${baseUrl}/rag/activate`,
        {
          collection: ctx.input.collection,
          index_version: ctx.input.indexVersion,
          environment: ctx.input.environment,
          is_rollback: ctx.input.isRollback,
        },
        tokenService,
      );
      ctx.logger.info(
        `Activated RAG index "${result.collection}" version ${result.active_version} (${result.environment})`,
      );
      ctx.output('activeVersion', result.active_version);
    },
  });
}

/**
 * `orchestration:draft-prompt` — registers a new (inactive) prompt version.
 */
export function createDraftPromptAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:draft-prompt',
    description: 'Registers a new (inactive) prompt version.',
    schema: {
      input: {
        name: z => z.string({ description: 'Persona key, e.g. "mlops"' }),
        persona: z =>
          z.string({ description: 'Display name, e.g. "MLOps Assistant"' }),
        content: z => z.string({ description: 'System prompt content' }),
      },
      output: {
        version: z =>
          z.string({
            description: 'Newly registered prompt version — not active yet',
          }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<DraftPromptResponse>(
        `${baseUrl}/prompts`,
        {
          name: ctx.input.name,
          persona: ctx.input.persona,
          content: ctx.input.content,
        },
        tokenService,
      );
      ctx.logger.info(
        `Drafted prompt "${result.name}" version ${result.version}`,
      );
      ctx.output('version', result.version);
    },
  });
}

/**
 * `orchestration:evaluate-prompt` — runs the LLM-as-judge Evaluate Gate
 * against a prompt version and reports the pass rate.
 */
export function createEvaluatePromptAction({
  config,
  tokenService,
}: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:evaluate-prompt',
    description:
      'Runs the LLM-as-judge Evaluate Gate against a prompt version and reports the pass rate.',
    schema: {
      input: {
        name: z => z.string({ description: 'Persona key' }),
        version: z => z.string({ description: 'Prompt version to evaluate' }),
        evalCases: z =>
          z.array(z.string(), {
            description: 'Questions to run through the LLM judge',
          }),
        model: z =>
          z
            .string({
              description:
                'model_name registered in litellm-config.yaml — including a self-hosted model deployed via the Serving LLM Golden Path. Defaults to "claude-sonnet-5"',
            })
            .optional(),
      },
      output: {
        passed: z => z.boolean({ description: 'True when pass_rate >= 0.8' }),
        passRate: z =>
          z.number({
            description: 'Fraction of eval_cases that passed the gate',
          }),
        totalTokens: z =>
          z.number({
            description:
              "Total tokens across all eval_cases' answer-generation calls",
          }),
        totalCostUsd: z =>
          z
            .number({
              description:
                'Total cost in USD — null when the model has no cost entry in litellm-config.yaml (e.g. a self-hosted model)',
            })
            .nullable(),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<EvaluatePromptResponse>(
        `${baseUrl}/prompts/${encodeURIComponent(ctx.input.name)}/evaluate`,
        {
          version: ctx.input.version,
          eval_cases: ctx.input.evalCases.map(question => ({ question })),
          model: ctx.input.model,
        },
        tokenService,
      );
      ctx.logger.info(
        `Prompt evaluate: passed=${result.passed} pass_rate=${result.pass_rate} total_tokens=${result.total_tokens} total_cost_usd=${result.total_cost_usd}`,
      );
      ctx.output('passed', result.passed);
      ctx.output('passRate', result.pass_rate);
      ctx.output('totalTokens', result.total_tokens);
      ctx.output('totalCostUsd', result.total_cost_usd);
    },
  });
}

/**
 * `orchestration:activate-prompt` — activates a prompt version;
 * routers/chat.py starts using it immediately.
 */
export function createActivatePromptAction({
  config,
  tokenService,
}: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:activate-prompt',
    description: 'Activates a prompt version for use by the chat endpoint.',
    schema: {
      input: {
        name: z => z.string({ description: 'Persona key' }),
        version: z => z.string({ description: 'Prompt version to activate' }),
        environment: z =>
          z
            .string({
              description:
                '"development" | "staging" | "production" — tracked independently; defaults to "production", the environment chat.py actually reads from',
            })
            .optional(),
        isRollback: z =>
          z
            .boolean({
              description:
                'True for a rollback to a previously-active version — skips no server-side check, only tags the DORA deployment event as "rollback" instead of "deploy"',
            })
            .optional(),
      },
      output: {
        activeVersion: z =>
          z.string({ description: 'The version now active for this persona' }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<ActivatePromptResponse>(
        `${baseUrl}/prompts/${encodeURIComponent(ctx.input.name)}/activate`,
        {
          version: ctx.input.version,
          environment: ctx.input.environment,
          is_rollback: ctx.input.isRollback,
        },
        tokenService,
      );
      ctx.logger.info(
        `Activated prompt "${result.name}" version ${result.active_version} (${result.environment})`,
      );
      ctx.output('activeVersion', result.active_version);
    },
  });
}

/**
 * `orchestration:draft-eval-set` — registers a new version of a named,
 * reusable set of eval questions (see routers/eval_sets.py), so two
 * versions of a prompt/RAG index are graded against the same benchmark
 * instead of whatever questions happened to be typed into that run's form.
 */
export function createDraftEvalSetAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:draft-eval-set',
    description: 'Registers a new version of a named, reusable eval-case set.',
    schema: {
      input: {
        name: z => z.string({ description: 'Eval-set name' }),
        questions: z =>
          z.array(z.string(), { description: 'Questions to run through the LLM judge' }),
      },
      output: {
        version: z =>
          z.string({ description: 'Newly registered eval-set version' }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<DraftEvalSetResponse>(
        `${baseUrl}/eval-sets`,
        { name: ctx.input.name, questions: ctx.input.questions },
        tokenService,
      );
      ctx.logger.info(
        `Drafted eval-set "${result.name}" version ${result.version}`,
      );
      ctx.output('version', result.version);
    },
  });
}

/**
 * `orchestration:fetch-eval-set` — fetches the latest version of a named
 * eval-set's questions, for llm-evaluate-activate to feed into
 * evaluate-prompt/rag-evaluate instead of a freshly-typed `evalCases` list.
 */
export function createFetchEvalSetAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:fetch-eval-set',
    description: "Fetches a named eval-set's latest version of questions.",
    schema: {
      input: {
        name: z => z.string({ description: 'Eval-set name' }),
      },
      output: {
        version: z => z.string({ description: "The fetched version's number" }),
        questions: z =>
          z.array(z.string(), { description: "The eval-set's questions" }),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const url = `${baseUrl}/eval-sets/${encodeURIComponent(ctx.input.name)}/latest`;
      const response = await fetch(url, {
        headers: await authHeaders(tokenService),
      });
      if (!response.ok) {
        throw new Error(
          `GET eval-set failed with ${response.status}: ${await response.text()}`,
        );
      }
      const result = (await response.json()) as EvalSetVersionResponse;
      ctx.logger.info(
        `Fetched eval-set "${result.name}" version ${result.version} (${result.questions.length} questions)`,
      );
      ctx.output('version', result.version);
      ctx.output('questions', result.questions);
    },
  });
}
