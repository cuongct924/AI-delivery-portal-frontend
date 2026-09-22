import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ConfigReader } from '@backstage/config';
import {
  createConfirmPromotionAction,
  createModelSummaryAction,
  createPolicyCheckAction,
  createPrepareDeployManifestAction,
  createPromoteModelAction,
  createRecordDeployAction,
  createRegisterModelAction,
  createRollbackPromotionAction,
  createSetupMonitoringAction,
  createTriggerTrainingAction,
  createValidateDatasetAction,
} from './mlopsActions';
import { createMockContext, mockFetchResponses } from './actionsTestUtils';

const BASE_URL = 'http://orchestration-api.test';
const config = new ConfigReader({ orchestrationApi: { baseUrl: BASE_URL } });
const monitoringConfig = new ConfigReader({
  orchestrationApi: { baseUrl: BASE_URL },
  mlops: {
    monitoring: {
      failureWebhookUrl: 'http://portal.test/api/monitoring/failures',
    },
  },
});

describe('orchestration:trigger-training', () => {
  it('polls until Succeeded and outputs the final phase and model version', async () => {
    mockFetchResponses([
      { ok: true, body: { workflow_name: 'wf-1' } },
      { ok: true, body: { name: 'wf-1', phase: 'Running', message: null } },
      { ok: true, body: { name: 'wf-1', phase: 'Succeeded', message: null } },
      { ok: true, body: { name: 'fraud-detection', version: '3' } },
    ]);
    const action = createTriggerTrainingAction({ config, pollIntervalMs: 1 });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        datasetUri: 'file:///data.csv',
        taskType: 'classification',
        algorithm: 'LogisticRegression',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.workflowName).toBe('wf-1');
    expect(outputs.phase).toBe('Succeeded');
    expect(outputs.modelVersion).toBe('3');
  });

  it("sends the Scaffolder task's id as the Idempotency-Key header", async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { workflow_name: 'wf-1' } },
      { ok: true, body: { name: 'wf-1', phase: 'Succeeded', message: null } },
      { ok: true, body: { name: 'fraud-detection', version: '3' } },
    ]);
    const action = createTriggerTrainingAction({ config, pollIntervalMs: 1 });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        datasetUri: 'file:///data.csv',
        taskType: 'classification',
        algorithm: 'LogisticRegression',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/trigger-training`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'test-task' }),
      }),
    );
  });

  it('throws with the status message when the workflow fails', async () => {
    mockFetchResponses([
      { ok: true, body: { workflow_name: 'wf-2' } },
      {
        ok: true,
        body: {
          name: 'wf-2',
          phase: 'Failed',
          message: 'training script exited 1',
        },
      },
    ]);
    const action = createTriggerTrainingAction({ config, pollIntervalMs: 1 });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        datasetUri: 'file:///data.csv',
        taskType: 'classification',
        algorithm: 'LogisticRegression',
      },
      '/tmp/workspace',
    );

    await expect(action.handler(ctx)).rejects.toThrow(
      'training script exited 1',
    );
  });

  it('throws a timeout error when no terminal phase is reached in time', async () => {
    const fetchMock = jest.fn();
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ workflow_name: 'wf-3' }),
      text: async () => '',
    }));
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ name: 'wf-3', phase: 'Running', message: null }),
      text: async () => '',
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const action = createTriggerTrainingAction({
      config,
      pollIntervalMs: 1,
      pollTimeoutMs: 5,
    });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        datasetUri: 'file:///data.csv',
        taskType: 'classification',
        algorithm: 'LogisticRegression',
      },
      '/tmp/workspace',
    );

    await expect(action.handler(ctx)).rejects.toThrow(/Timed out/);
  });

  it('forwards architecture and DL hyperparameters to the orchestration API', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { workflow_name: 'wf-4' } },
      { ok: true, body: { name: 'wf-4', phase: 'Succeeded', message: null } },
      { ok: true, body: { name: 'sensor-forecast', version: '1' } },
    ]);
    const action = createTriggerTrainingAction({ config, pollIntervalMs: 1 });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'sensor-forecast',
        datasetUri: 'file:///sensor.csv',
        taskType: 'regression',
        architecture: 'lstm',
        targetColumn: 'target',
        timeColumn: 'timestamp',
        sequenceLength: 10,
        numLayers: 2,
        hiddenSize: 32,
        learningRate: 0.001,
        epochs: 20,
        batchSize: 16,
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(requestInit.body as string)).toEqual({
      model_name: 'sensor-forecast',
      dataset_uri: 'file:///sensor.csv',
      task_type: 'regression',
      architecture: 'lstm',
      target_column: 'target',
      time_column: 'timestamp',
      sequence_length: 10,
      num_layers: 2,
      hidden_size: 32,
      learning_rate: 0.001,
      epochs: 20,
      batch_size: 16,
    });
  });

  it('forwards optimizer to the orchestration API when set', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { workflow_name: 'wf-opt' } },
      { ok: true, body: { name: 'wf-opt', phase: 'Succeeded', message: null } },
      { ok: true, body: { name: 'sensor-forecast', version: '1' } },
    ]);
    const action = createTriggerTrainingAction({ config, pollIntervalMs: 1 });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'sensor-forecast',
        datasetUri: 'file:///sensor.csv',
        taskType: 'regression',
        architecture: 'mlp',
        targetColumn: 'target',
        hiddenLayers: [8],
        dropout: 0,
        learningRate: 0.01,
        epochs: 5,
        batchSize: 16,
        optimizer: 'sgd',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);
    expect(body.optimizer).toBe('sgd');
  });

  it('forwards BYOC fields to the orchestration API when algorithm is custom', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { workflow_name: 'wf-5' } },
      { ok: true, body: { name: 'wf-5', phase: 'Succeeded', message: null } },
      { ok: true, body: { name: 'custom-model', version: '1' } },
    ]);
    const action = createTriggerTrainingAction({ config, pollIntervalMs: 1 });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'custom-model',
        datasetUri: 'file:///fraud.csv',
        taskType: 'classification',
        algorithm: 'custom',
        targetColumn: 'is_fraud',
        codeRepoUrl: 'https://github.com/dev/my-training-code',
        entrypointPath: 'my_train.py',
        customConfig: '{"lr": 0.01}',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(requestInit.body as string)).toEqual({
      model_name: 'custom-model',
      dataset_uri: 'file:///fraud.csv',
      task_type: 'classification',
      algorithm: 'custom',
      target_column: 'is_fraud',
      code_repo_url: 'https://github.com/dev/my-training-code',
      entrypoint_path: 'my_train.py',
      custom_config: '{"lr": 0.01}',
    });
  });

  it('forwards HPO fields to the orchestration API when searchStrategy is not fixed', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { workflow_name: 'wf-6' } },
      { ok: true, body: { name: 'wf-6', phase: 'Succeeded', message: null } },
      { ok: true, body: { name: 'sensor-forecast', version: '1' } },
    ]);
    const action = createTriggerTrainingAction({ config, pollIntervalMs: 1 });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'sensor-forecast',
        datasetUri: 'file:///sensor.csv',
        taskType: 'regression',
        architecture: 'mlp',
        targetColumn: 'target',
        searchStrategy: 'bayesian',
        numTrials: 20,
        searchSpaceJson: '{"learning_rate": {"low": 0.0001, "high": 0.1}}',
        objectiveMetric: 'r2',
        objectiveDirection: 'maximize',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);
    expect(body.search_strategy).toBe('bayesian');
    expect(body.num_trials).toBe(20);
    expect(body.search_space_json).toBe(
      '{"learning_rate": {"low": 0.0001, "high": 0.1}}',
    );
    expect(body.objective_metric).toBe('r2');
    expect(body.objective_direction).toBe('maximize');
  });

  it('forwards NLP fields to the orchestration API when architecture is nlp', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { workflow_name: 'wf-7' } },
      { ok: true, body: { name: 'wf-7', phase: 'Succeeded', message: null } },
      { ok: true, body: { name: 'review-sentiment', version: '1' } },
    ]);
    const action = createTriggerTrainingAction({ config, pollIntervalMs: 1 });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'review-sentiment',
        datasetUri: 'file:///reviews.csv',
        taskType: 'classification',
        architecture: 'nlp',
        targetColumn: 'sentiment',
        textColumn: 'review',
        baseModelName: 'distilbert-base-uncased',
        learningRate: 5e-5,
        epochs: 3,
        batchSize: 16,
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);
    expect(body.text_column).toBe('review');
    expect(body.base_model_name).toBe('distilbert-base-uncased');
  });
});

describe('orchestration:validate-dataset', () => {
  it('outputs results and does not throw when nothing is blocking', async () => {
    mockFetchResponses([
      {
        ok: true,
        body: [
          {
            check_name: 'check_missing_values',
            severity: 'info',
            message: 'clean',
            details: {},
          },
          {
            check_name: 'check_class_imbalance',
            severity: 'warning',
            message: 'minority class is 3%',
            details: {},
          },
        ],
      },
    ]);
    const action = createValidateDatasetAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        datasetUri: 'file:///data.csv',
        taskType: 'classification',
        targetColumn: 'is_fraud',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.results).toEqual([
      { checkName: 'check_missing_values', severity: 'info', message: 'clean' },
      {
        checkName: 'check_class_imbalance',
        severity: 'warning',
        message: 'minority class is 3%',
      },
    ]);
  });

  it('throws with the blocking checks summary when any check is blocking', async () => {
    mockFetchResponses([
      {
        ok: true,
        body: [
          {
            check_name: 'check_missing_values',
            severity: 'blocking',
            message: "target column 'is_fraud' has 2 missing value(s)",
            details: {},
          },
        ],
      },
    ]);
    const action = createValidateDatasetAction({ config });
    const { ctx } = createMockContext<typeof action>(
      {
        datasetUri: 'file:///data.csv',
        taskType: 'classification',
        targetColumn: 'is_fraud',
      },
      '/tmp/workspace',
    );

    await expect(action.handler(ctx)).rejects.toThrow('check_missing_values');
  });
});

describe('orchestration:register-model', () => {
  it('posts the artifact URI and outputs the registered name/version', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { name: 'churn-classifier', version: '1' } },
    ]);
    const action = createRegisterModelAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        modelName: 'churn-classifier',
        artifactUri: 'runs:/abc123/churn-classifier',
        taskType: 'classification',
        datasetVersion: 'churn-2026-08-27',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.modelName).toBe('churn-classifier');
    expect(outputs.modelVersion).toBe('1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/models/register`,
      expect.objectContaining({
        body: JSON.stringify({
          name: 'churn-classifier',
          artifact_uri: 'runs:/abc123/churn-classifier',
          task_type: 'classification',
          dataset_version: 'churn-2026-08-27',
        }),
      }),
    );
  });

  it('omits datasetVersion when not provided', async () => {
    mockFetchResponses([
      { ok: true, body: { name: 'churn-classifier', version: '2' } },
    ]);
    const action = createRegisterModelAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        modelName: 'churn-classifier',
        artifactUri: 'runs:/def456/churn-classifier',
        taskType: 'classification',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.modelVersion).toBe('2');
  });
});

describe('orchestration:model-summary', () => {
  it('outputs the task type and metrics', async () => {
    mockFetchResponses([
      {
        ok: true,
        body: {
          name: 'fraud-detection',
          version: '3',
          task_type: 'classification',
          metrics: { accuracy: 0.92 },
          tags: { task_type: 'classification' },
        },
      },
    ]);
    const action = createModelSummaryAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { modelName: 'fraud-detection', modelVersion: '3' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.taskType).toBe('classification');
    expect(outputs.metrics).toEqual({ accuracy: 0.92 });
  });
});

describe('orchestration:policy-check', () => {
  it('outputs passed=true and the metrics when the gate passes', async () => {
    mockFetchResponses([
      {
        ok: true,
        body: {
          passed: true,
          metrics: { accuracy: 0.92, precision: 0.85, recall: 0.8 },
          thresholds: {
            min_accuracy: 0.7,
            min_precision: 0.6,
            min_recall: 0.6,
          },
        },
      },
    ]);
    const action = createPolicyCheckAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { modelName: 'fraud-detection', modelVersion: '3' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.passed).toBe(true);
    expect(outputs.metrics).toEqual({
      accuracy: 0.92,
      precision: 0.85,
      recall: 0.8,
    });
  });

  it('throws with the metrics summary when the gate rejects the model', async () => {
    mockFetchResponses([
      {
        ok: true,
        body: {
          passed: false,
          metrics: { accuracy: 0.4, precision: 0.3, recall: 0.3 },
          thresholds: {
            min_accuracy: 0.7,
            min_precision: 0.6,
            min_recall: 0.6,
          },
        },
      },
    ]);
    const action = createPolicyCheckAction({ config });
    const { ctx } = createMockContext<typeof action>(
      { modelName: 'fraud-detection', modelVersion: '3' },
      '/tmp/workspace',
    );

    await expect(action.handler(ctx)).rejects.toThrow('accuracy=0.4');
  });
});

describe('orchestration:setup-monitoring', () => {
  it('forwards performance degradation monitoring settings', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { cron_workflow_name: 'monitoring-cron-1' } },
    ]);
    const action = createSetupMonitoringAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        modelVersion: '3',
        referenceDataUri: 'file:///data/reference.csv',
        productionDataSource: 'managed-prediction-log',
        schedule: '0 * * * *',
        monitoringType: 'performance-degradation',
        groundTruthDataSource: 'managed-label-log',
        groundTruthDataUri: 'file:///data/ground-truth.csv',
        metricName: 'f1_score',
        minMetricThreshold: 0.85,
        onDriftDetected: 'alert-only',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(requestInit.body as string)).toEqual({
      model_name: 'fraud-detection',
      model_version: '3',
      reference_data_uri: 'file:///data/reference.csv',
      production_data_source: 'managed-prediction-log',
      schedule: '0 * * * *',
      monitoring_type: 'performance-degradation',
      ground_truth_data_source: 'managed-label-log',
      ground_truth_data_uri: 'file:///data/ground-truth.csv',
      metric_name: 'f1_score',
      min_metric_threshold: 0.85,
      on_drift_detected: 'alert-only',
    });
    expect(outputs.cronWorkflowName).toBe('monitoring-cron-1');
  });

  it('adds reactive metadata to auto-retrain requests', async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { cron_workflow_name: 'monitoring-cron-2' } },
    ]);
    const action = createSetupMonitoringAction({ config: monitoringConfig });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        modelVersion: '3',
        referenceDataUri: 'file:///data/reference.csv',
        productionDataSource: 'managed-prediction-log',
        schedule: '0 0 * * *',
        monitoringType: 'data-drift',
        driftThreshold: 0.5,
        onDriftDetected: 'auto-retrain',
        retrainRequestJson: '{"model_name":"fraud-detection"}',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);
    expect(JSON.parse(body.retrain_request_json)).toEqual({
      model_name: 'fraud-detection',
      trigger_type: 'reactive',
      trigger_reason: 'data_drift_exceeded',
    });
    expect(body.failure_webhook_url).toBe(
      'http://portal.test/api/monitoring/failures',
    );
  });
});

describe('orchestration:prepare-deploy-manifest', () => {
  it('writes the rendered manifest into the workspace and outputs its path', async () => {
    const workspacePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mlops-actions-test-'),
    );
    const fileName =
      'infra/environments/dev/inference-services/mlops-team/fraud-detection/3.yaml';
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
    const action = createPrepareDeployManifestAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { modelName: 'fraud-detection', modelVersion: '3' },
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
      `${BASE_URL}/deploy-model/prepare`,
      expect.objectContaining({
        body: JSON.stringify({
          model_name: 'fraud-detection',
          model_version: '3',
          traffic_strategy: undefined,
          traffic_percent: undefined,
          release_strategy: undefined,
        }),
      }),
    );

    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('forwards the traffic/release strategy fields and outputs deployed=true for instant', async () => {
    const workspacePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mlops-actions-test-'),
    );
    const fileName =
      'infra/environments/dev/inference-services/mlops-team/fraud-detection/4.yaml';
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
    const action = createPrepareDeployManifestAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        modelVersion: '4',
        trafficStrategy: 'canary',
        trafficPercent: 10,
        releaseStrategy: 'instant',
      },
      workspacePath,
    );

    await action.handler(ctx);

    expect(outputs.deployed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/deploy-model/prepare`,
      expect.objectContaining({
        body: JSON.stringify({
          model_name: 'fraud-detection',
          model_version: '4',
          traffic_strategy: 'canary',
          traffic_percent: 10,
          release_strategy: 'instant',
        }),
      }),
    );

    await fs.rm(workspacePath, { recursive: true, force: true });
  });
});

describe('orchestration:record-deploy', () => {
  it('posts the PR URL and outputs recorded=true', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          model_name: 'fraud-detection',
          model_version: '3',
          pr_url: 'https://github.com/org/repo/pull/1',
        },
      },
    ]);
    const action = createRecordDeployAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        modelVersion: '3',
        prUrl: 'https://github.com/org/repo/pull/1',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.recorded).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/deploy-model/record`,
      expect.objectContaining({
        body: JSON.stringify({
          model_name: 'fraud-detection',
          model_version: '3',
          pr_url: 'https://github.com/org/repo/pull/1',
        }),
      }),
    );
  });

  it('omits prUrl for an instant release with no PR', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          model_name: 'fraud-detection',
          model_version: '5',
          pr_url: null,
        },
      },
    ]);
    const action = createRecordDeployAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { modelName: 'fraud-detection', modelVersion: '5' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.recorded).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/deploy-model/record`,
      expect.objectContaining({
        body: JSON.stringify({
          model_name: 'fraud-detection',
          model_version: '5',
          pr_url: undefined,
        }),
      }),
    );
  });
});

describe('orchestration:promote-model', () => {
  it('writes the rendered manifest into the workspace and outputs environment/projectRelease', async () => {
    const workspacePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mlops-actions-test-'),
    );
    const fileName =
      'infra/openchoreo/namespaces/default/projects/telco-fraud-detection/projectreleasebinding-staging.yaml';
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          file_name: fileName,
          content: 'kind: ProjectReleaseBinding\n',
          environment: 'staging',
          project_release: 'telco-fraud-detection-rel-1',
        },
      },
    ]);
    const action = createPromoteModelAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { modelName: 'fraud-detection', targetEnvironment: 'staging' },
      workspacePath,
    );

    await action.handler(ctx);

    expect(outputs.filePath).toBe(fileName);
    expect(outputs.environment).toBe('staging');
    expect(outputs.projectRelease).toBe('telco-fraud-detection-rel-1');
    const written = await fs.readFile(
      path.join(workspacePath, fileName),
      'utf-8',
    );
    expect(written).toBe('kind: ProjectReleaseBinding\n');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/models/fraud-detection/promote`,
      expect.objectContaining({
        body: JSON.stringify({ target_environment: 'staging' }),
      }),
    );

    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('propagates the error orchestration-api raises for an invalid promotion', async () => {
    mockFetchResponses([
      { ok: false, body: "nothing to promote — 'staging' has no release yet" },
    ]);
    const action = createPromoteModelAction({ config });
    const { ctx } = createMockContext<typeof action>(
      { modelName: 'fraud-detection', targetEnvironment: 'production' },
      '/tmp/workspace',
    );

    await expect(action.handler(ctx)).rejects.toThrow(/nothing to promote/);
  });
});

describe('orchestration:rollback-promotion', () => {
  it('writes the rendered manifest into the workspace and outputs environment/projectRelease', async () => {
    const workspacePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mlops-actions-test-'),
    );
    const fileName =
      'infra/openchoreo/namespaces/default/projects/telco-fraud-detection/projectreleasebinding-staging.yaml';
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          file_name: fileName,
          content: 'kind: ProjectReleaseBinding\n',
          environment: 'staging',
          project_release: 'telco-fraud-detection-rel-1',
        },
      },
    ]);
    const action = createRollbackPromotionAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      { modelName: 'fraud-detection', environment: 'staging' },
      workspacePath,
    );

    await action.handler(ctx);

    expect(outputs.filePath).toBe(fileName);
    expect(outputs.environment).toBe('staging');
    expect(outputs.projectRelease).toBe('telco-fraud-detection-rel-1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/models/fraud-detection/promote-rollback`,
      expect.objectContaining({
        body: JSON.stringify({ environment: 'staging' }),
      }),
    );

    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('propagates the error orchestration-api raises when nothing to roll back to', async () => {
    mockFetchResponses([{ ok: false, body: 'no prior release recorded' }]);
    const action = createRollbackPromotionAction({ config });
    const { ctx } = createMockContext<typeof action>(
      { modelName: 'fraud-detection', environment: 'staging' },
      '/tmp/workspace',
    );

    await expect(action.handler(ctx)).rejects.toThrow(
      /no prior release recorded/,
    );
  });
});

describe('orchestration:confirm-promotion', () => {
  it('posts environment/projectRelease and outputs the resulting environments map', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          project: 'telco-fraud-detection',
          component: 'serving',
          environments: {
            development: 'rel-1',
            staging: 'rel-1',
            production: null,
          },
          prod_pending_approval: true,
        },
      },
    ]);
    const action = createConfirmPromotionAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        environment: 'staging',
        projectRelease: 'telco-fraud-detection-rel-1',
        eventType: 'deploy',
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.environments).toEqual({
      development: 'rel-1',
      staging: 'rel-1',
      production: null,
    });
    expect(outputs.prodPendingApproval).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/models/fraud-detection/promote/confirm`,
      expect.objectContaining({
        body: JSON.stringify({
          environment: 'staging',
          project_release: 'telco-fraud-detection-rel-1',
          event_type: 'deploy',
        }),
        headers: expect.objectContaining({ 'Idempotency-Key': 'test-task' }),
      }),
    );
  });

  it('propagates the error orchestration-api raises for an invalid confirmation', async () => {
    mockFetchResponses([{ ok: false, body: 'no prior release recorded' }]);
    const action = createConfirmPromotionAction({ config });
    const { ctx } = createMockContext<typeof action>(
      {
        modelName: 'fraud-detection',
        environment: 'staging',
        projectRelease: 'telco-fraud-detection-rel-1',
      },
      '/tmp/workspace',
    );

    await expect(action.handler(ctx)).rejects.toThrow(
      /no prior release recorded/,
    );
  });
});
