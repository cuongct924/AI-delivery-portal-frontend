import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ConfigReader } from '@backstage/config';
import {
  createActivatePromptAction,
  createDraftEvalSetAction,
  createDraftPromptAction,
  createEvaluatePromptAction,
  createFetchEvalSetAction,
  createPrepareLlmDeployManifestAction,
  createRagActivateAction,
  createRagEvaluateAction,
  createRagIngestAction,
} from './llmOpsActions';
import { createMockContext, mockFetchResponses } from './actionsTestUtils';

const BASE_URL = 'http://orchestration-api.test';
const config = new ConfigReader({ orchestrationApi: { baseUrl: BASE_URL } });

describe('orchestration:prepare-llm-deploy-manifest', () => {
  it('writes the rendered manifest into the workspace and outputs its path', async () => {
    const workspacePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'llmops-actions-test-'),
    );
    const fileName =
      'infra/environments/dev/inference-services/llmops-team/llama-3-8b/llm.yaml';
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          file_name: fileName,
          content: 'kind: InferenceService\n',
          deployed: false,
        },
      },
    ]);
    const action = createPrepareLlmDeployManifestAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        modelName: 'llama-3-8b',
        huggingFaceModelId: 'meta-llama/Llama-3.1-8B-Instruct',
        gpuType: 'H100',
      },
      workspacePath,
    );

    await action.handler(ctx);

    expect(outputs.filePath).toBe(fileName);
    expect(outputs.deployed).toBe(false);
    const written = await fs.readFile(
      path.join(workspacePath, fileName),
      'utf-8',
    );
    expect(written).toBe('kind: InferenceService\n');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/llm-deploy/prepare`,
      expect.objectContaining({
        body: JSON.stringify({
          model_name: 'llama-3-8b',
          huggingface_model_id: 'meta-llama/Llama-3.1-8B-Instruct',
          runtime: undefined,
          gpu_type: 'H100',
          gpu_count: undefined,
          quantization: undefined,
          max_context_length: undefined,
          traffic_strategy: undefined,
          traffic_percent: undefined,
          release_strategy: undefined,
        }),
      }),
    );

    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('converts gpuCount to a number and outputs deployed=true for instant', async () => {
    const workspacePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'llmops-actions-test-'),
    );
    const fileName =
      'infra/environments/dev/inference-services/llmops-team/llama-3-8b/llm.yaml';
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          file_name: fileName,
          content: 'kind: InferenceService\n',
          deployed: true,
        },
      },
    ]);
    const action = createPrepareLlmDeployManifestAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        modelName: 'llama-3-8b',
        huggingFaceModelId: 'meta-llama/Llama-3.1-8B-Instruct',
        gpuType: 'H100',
        gpuCount: '2',
        quantization: 'fp8',
        releaseStrategy: 'instant',
      },
      workspacePath,
    );

    await action.handler(ctx);

    expect(outputs.deployed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/llm-deploy/prepare`,
      expect.objectContaining({
        body: JSON.stringify({
          model_name: 'llama-3-8b',
          huggingface_model_id: 'meta-llama/Llama-3.1-8B-Instruct',
          runtime: undefined,
          gpu_type: 'H100',
          gpu_count: 2,
          quantization: 'fp8',
          max_context_length: undefined,
          traffic_strategy: undefined,
          traffic_percent: undefined,
          release_strategy: 'instant',
        }),
      }),
    );

    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('forwards environment and hfTokenSecretRef as snake_case', async () => {
    const workspacePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'llmops-actions-test-'),
    );
    const fileName =
      'infra/environments/dev/inference-services/llmops-team/llama-3-8b/llm.yaml';
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          file_name: fileName,
          content: 'kind: InferenceService\n',
          deployed: false,
        },
      },
    ]);
    const action = createPrepareLlmDeployManifestAction({ config });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'llama-3-8b',
        huggingFaceModelId: 'meta-llama/Llama-3.1-8B-Instruct',
        gpuType: 'H100',
        environment: 'dev',
        hfTokenSecretRef: 'hf-token-llmops',
      },
      workspacePath,
    );

    await action.handler(ctx);

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/llm-deploy/prepare`,
      expect.objectContaining({
        body: JSON.stringify({
          model_name: 'llama-3-8b',
          huggingface_model_id: 'meta-llama/Llama-3.1-8B-Instruct',
          runtime: undefined,
          gpu_type: 'H100',
          gpu_count: undefined,
          quantization: undefined,
          max_context_length: undefined,
          traffic_strategy: undefined,
          traffic_percent: undefined,
          release_strategy: undefined,
          environment: 'dev',
          hf_token_secret_ref: 'hf-token-llmops',
        }),
      }),
    );

    await fs.rm(workspacePath, { recursive: true, force: true });
  });
});

describe('orchestration:rag-ingest', () => {
  it('posts source paths and outputs the new index version', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          collection: 'smoke-test',
          index_version: '1',
          chunks_ingested: 4,
        },
      },
    ]);
    const action = createRagIngestAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        collection: 'smoke-test',
        sourcePaths: ['docs/playbook-ai-delivery-portal.md'],
        chunkSize: 800,
        chunkOverlap: 100,
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.indexVersion).toBe('1');
    expect(outputs.chunksIngested).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/rag/ingest`,
      expect.objectContaining({
        body: JSON.stringify({
          collection: 'smoke-test',
          source_paths: ['docs/playbook-ai-delivery-portal.md'],
          chunk_size: 800,
          chunk_overlap: 100,
        }),
      }),
    );
  });
});

describe('orchestration:rag-evaluate', () => {
  it('forwards evalCases and model', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          passed: true,
          pass_rate: 1,
          results: [],
          total_tokens: 120,
          total_cost_usd: 0.003,
        },
      },
    ]);
    const action = createRagEvaluateAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        collection: 'smoke-test',
        indexVersion: '1',
        evalCases: ['q1'],
        model: 'llama-3-8b-self-hosted',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.passed).toBe(true);
    expect(outputs.passRate).toBe(1);
    expect(outputs.totalTokens).toBe(120);
    expect(outputs.totalCostUsd).toBe(0.003);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/rag/evaluate`,
      expect.objectContaining({
        body: JSON.stringify({
          collection: 'smoke-test',
          index_version: '1',
          eval_cases: [{ question: 'q1' }],
          model: 'llama-3-8b-self-hosted',
        }),
      }),
    );
  });
});

describe('orchestration:rag-activate', () => {
  it('posts the collection/version and outputs activeVersion', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { collection: 'smoke-test', active_version: '1' } },
    ]);
    const action = createRagActivateAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { collection: 'smoke-test', indexVersion: '1' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.activeVersion).toBe('1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/rag/activate`,
      expect.objectContaining({
        body: JSON.stringify({ collection: 'smoke-test', index_version: '1' }),
      }),
    );
  });
});

describe('orchestration:rag-activate environment', () => {
  it('forwards environment', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: { collection: 'smoke-test', environment: 'staging', active_version: '1' },
      },
    ]);
    const action = createRagActivateAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { collection: 'smoke-test', indexVersion: '1', environment: 'staging' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.activeVersion).toBe('1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/rag/activate`,
      expect.objectContaining({
        body: JSON.stringify({
          collection: 'smoke-test',
          index_version: '1',
          environment: 'staging',
        }),
      }),
    );
  });
});

describe('orchestration:rag-activate rollback', () => {
  it('forwards isRollback as is_rollback', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { collection: 'smoke-test', active_version: '1' } },
    ]);
    const action = createRagActivateAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { collection: 'smoke-test', indexVersion: '1', isRollback: true },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.activeVersion).toBe('1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/rag/activate`,
      expect.objectContaining({
        body: JSON.stringify({
          collection: 'smoke-test',
          index_version: '1',
          is_rollback: true,
        }),
      }),
    );
  });
});

describe('orchestration:draft-prompt', () => {
  it('posts the draft and outputs the new version', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          id: 'rag-writer-v1',
          name: 'rag-writer',
          version: '1',
          persona: 'RAG Writer',
          content: 'sys',
        },
      },
    ]);
    const action = createDraftPromptAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { name: 'rag-writer', persona: 'RAG Writer', content: 'sys' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.version).toBe('1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/prompts`,
      expect.objectContaining({
        body: JSON.stringify({
          name: 'rag-writer',
          persona: 'RAG Writer',
          content: 'sys',
        }),
      }),
    );
  });
});

describe('orchestration:evaluate-prompt', () => {
  it('forwards evalCases, model, and calls the per-name endpoint', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          passed: false,
          pass_rate: 0.5,
          results: [],
          total_tokens: 80,
          total_cost_usd: null,
        },
      },
    ]);
    const action = createEvaluatePromptAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        name: 'mlops',
        version: '1',
        evalCases: ['q1', 'q2'],
        model: 'llama-3-8b-self-hosted',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.passed).toBe(false);
    expect(outputs.passRate).toBe(0.5);
    expect(outputs.totalTokens).toBe(80);
    expect(outputs.totalCostUsd).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/prompts/mlops/evaluate`,
      expect.objectContaining({
        body: JSON.stringify({
          version: '1',
          eval_cases: [{ question: 'q1' }, { question: 'q2' }],
          model: 'llama-3-8b-self-hosted',
        }),
      }),
    );
  });
});

describe('orchestration:activate-prompt', () => {
  it('calls the per-name activate endpoint and outputs activeVersion', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { name: 'mlops', active_version: '2' } },
    ]);
    const action = createActivatePromptAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { name: 'mlops', version: '2' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.activeVersion).toBe('2');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/prompts/mlops/activate`,
      expect.objectContaining({
        body: JSON.stringify({ version: '2' }),
      }),
    );
  });

  it('forwards isRollback as is_rollback', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { name: 'mlops', active_version: '1' } },
    ]);
    const action = createActivatePromptAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { name: 'mlops', version: '1', isRollback: true },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.activeVersion).toBe('1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/prompts/mlops/activate`,
      expect.objectContaining({
        body: JSON.stringify({ version: '1', is_rollback: true }),
      }),
    );
  });

  it('forwards environment', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { name: 'mlops', environment: 'staging', active_version: '1' } },
    ]);
    const action = createActivatePromptAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { name: 'mlops', version: '1', environment: 'staging' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.activeVersion).toBe('1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/prompts/mlops/activate`,
      expect.objectContaining({
        body: JSON.stringify({ version: '1', environment: 'staging' }),
      }),
    );
  });
});

describe('orchestration:draft-eval-set', () => {
  it('posts the name/questions and outputs the new version', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: { name: 'idp-basics', version: '1', questions: ['q1', 'q2'] },
      },
    ]);
    const action = createDraftEvalSetAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { name: 'idp-basics', questions: ['q1', 'q2'] },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.version).toBe('1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/eval-sets`,
      expect.objectContaining({
        body: JSON.stringify({ name: 'idp-basics', questions: ['q1', 'q2'] }),
      }),
    );
  });
});

describe('orchestration:fetch-eval-set', () => {
  it('fetches the latest version and outputs its questions', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: { name: 'idp-basics', version: '3', questions: ['q1', 'q2'] },
      },
    ]);
    const action = createFetchEvalSetAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { name: 'idp-basics' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.version).toBe('3');
    expect(outputs.questions).toEqual(['q1', 'q2']);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/eval-sets/idp-basics/latest`,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
