import { useState } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import {
  configApiRef,
  createApiRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

const openChoreoAuthApiRef = createApiRef<{
  getAccessToken: () => Promise<string>;
}>({ id: 'test.openchoreo.auth' });

jest.mock('@openchoreo/backstage-plugin', () => ({
  get openChoreoAuthApiRef() {
    return openChoreoAuthApiRef;
  },
}));

import { StepLayout } from './StepLayoutField';

const fetchMock = jest.fn();

async function renderStep() {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <StepLayout
        schema={
          {
            type: 'object',
            properties: {
              evalSetName: { type: 'string', title: 'Eval set name' },
            },
          } as any
        }
        uiSchema={
          {
            'ui:options': {
              groups: [
                {
                  title: 'Evaluation',
                  fields: [{ name: 'evalSetName', evalSetNamePicker: true }],
                },
              ],
            },
          } as any
        }
        formData={{}}
        onChange={jest.fn()}
        idSchema={{} as any}
        registry={
          {
            fields: {
              SchemaField: () => <div data-testid="plain-field" />,
            },
          } as any
        }
        errorSchema={{} as any}
        name="step"
        required={false}
        disabled={false}
        readonly={false}
        rawErrors={[]}
        onBlur={jest.fn()}
        onFocus={jest.fn()}
      />
    </TestApiProvider>,
  );
  // Flush the eval-set fetch inside act() so its state update doesn't land
  // during a later waitFor (which runs with IS_REACT_ACT_ENVIRONMENT off).
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout evalSetNamePicker', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/eval-sets')) {
        return {
          ok: true,
          json: async () => ({ names: ['idp-basics', 'support-eval'] }),
        };
      }
      return { ok: true, json: async () => ({ names: [] }) };
    });
  });

  it('renders a dropdown of registered eval sets instead of a free-text field', async () => {
    await renderStep();

    const select = await screen.findByRole('button');
    await userEvent.click(select);

    expect(await screen.findByText('idp-basics')).toBeInTheDocument();
    expect(screen.getByText('support-eval')).toBeInTheDocument();
    expect(screen.queryByTestId('plain-field')).not.toBeInTheDocument();
  });

  it('falls back to the plain field when no eval sets are registered', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ names: [] }),
    }));

    await renderStep();

    await waitFor(() => {
      expect(screen.getByTestId('plain-field')).toBeInTheDocument();
    });
  });
});

/** Stateful wrapper so typing into the free-solo combobox actually sticks. */
function PromptNameComboStep() {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  return (
    <StepLayout
      schema={
        {
          type: 'object',
          properties: {
            promptName: { type: 'string', title: 'Persona key' },
          },
        } as any
      }
      uiSchema={
        {
          'ui:options': {
            groups: [
              {
                title: 'Prompt',
                fields: [{ name: 'promptName', promptNameCombo: true }],
              },
            ],
          },
        } as any
      }
      formData={formData}
      onChange={next => setFormData(next ?? {})}
      idSchema={{} as any}
      registry={
        {
          fields: {
            SchemaField: () => <div data-testid="plain-field" />,
          },
        } as any
      }
      errorSchema={{} as any}
      name="step"
      required={false}
      disabled={false}
      readonly={false}
      rawErrors={[]}
      onBlur={jest.fn()}
      onFocus={jest.fn()}
    />
  );
}

async function renderComboStep() {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <PromptNameComboStep />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout promptNameCombo', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/prompts')) {
        return {
          ok: true,
          json: async () => ({ names: ['mlops', 'support'] }),
        };
      }
      return { ok: true, json: async () => ({ names: [] }) };
    });
  });

  it('offers existing personas as suggestions', async () => {
    await renderComboStep();

    const input = screen.getByRole('textbox');
    await userEvent.click(input);

    expect(await screen.findByText('mlops')).toBeInTheDocument();
    expect(screen.getByText('support')).toBeInTheDocument();
  });

  it('still allows typing a brand-new persona key (free-solo)', async () => {
    await renderComboStep();

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'new-persona');

    expect(input).toHaveValue('new-persona');
  });
});

/** Stateful wrapper so typing into the free-solo combobox actually sticks. */
function EvalSetNameComboStep() {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  return (
    <StepLayout
      schema={
        {
          type: 'object',
          properties: {
            evalSetName: { type: 'string', title: 'Eval-set name' },
          },
        } as any
      }
      uiSchema={
        {
          'ui:options': {
            groups: [
              {
                title: 'Eval Set',
                fields: [{ name: 'evalSetName', evalSetNameCombo: true }],
              },
            ],
          },
        } as any
      }
      formData={formData}
      onChange={next => setFormData(next ?? {})}
      idSchema={{} as any}
      registry={
        {
          fields: {
            SchemaField: () => <div data-testid="plain-field" />,
          },
        } as any
      }
      errorSchema={{} as any}
      name="step"
      required={false}
      disabled={false}
      readonly={false}
      rawErrors={[]}
      onBlur={jest.fn()}
      onFocus={jest.fn()}
    />
  );
}

async function renderEvalSetComboStep() {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <EvalSetNameComboStep />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout evalSetNameCombo', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/eval-sets')) {
        return {
          ok: true,
          json: async () => ({ names: ['idp-qna-eval', 'support-eval'] }),
        };
      }
      return { ok: true, json: async () => ({ names: [] }) };
    });
  });

  it('offers existing eval sets as suggestions', async () => {
    await renderEvalSetComboStep();

    const input = screen.getByRole('textbox');
    await userEvent.click(input);

    expect(await screen.findByText('idp-qna-eval')).toBeInTheDocument();
    expect(screen.getByText('support-eval')).toBeInTheDocument();
  });

  it('still allows typing a brand-new eval-set name (free-solo)', async () => {
    await renderEvalSetComboStep();

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'new-eval-set');

    expect(input).toHaveValue('new-eval-set');
  });
});

const S3_DATASET = {
  name: 'bucket/data.csv',
  uri: 'file:///mnt/data/bucket/data.csv',
  size_bytes: 10,
  source: 's3',
};

async function renderDatasetStep() {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <StepLayout
        schema={
          {
            type: 'object',
            properties: {
              dataSource: { type: 'string', title: 'Data source' },
              datasetUri: { type: 'string', title: 'Dataset name' },
            },
          } as any
        }
        uiSchema={
          {
            'ui:options': {
              groups: [
                {
                  title: 'Dataset & Task',
                  fields: [
                    { name: 'dataSource', dataSourcePicker: true },
                    {
                      name: 'datasetUri',
                      datasetPicker: true,
                      datasetPreview: true,
                    },
                  ],
                },
              ],
            },
          } as any
        }
        formData={{ dataSource: 's3', datasetUri: S3_DATASET.uri }}
        onChange={jest.fn()}
        idSchema={{} as any}
        registry={
          {
            fields: {
              SchemaField: () => <div data-testid="plain-field" />,
            },
          } as any
        }
        errorSchema={{} as any}
        name="step"
        required={false}
        disabled={false}
        readonly={false}
        rawErrors={[]}
        onBlur={jest.fn()}
        onFocus={jest.fn()}
      />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout dataset preview source', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/datasets/preview')) {
        return {
          ok: true,
          json: async () => ({ columns: ['a'], rows: [{ a: 1 }] }),
        };
      }
      if (url.includes('/datasets')) {
        return { ok: true, json: async () => ({ datasets: [S3_DATASET] }) };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  it('shows a loading placeholder while the dataset list is in flight', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/datasets')) return new Promise(() => {});
      return { ok: true, json: async () => ({}) };
    });

    await renderDatasetStep();

    expect(await screen.findByText('Loading datasets…')).toBeInTheDocument();
  });

  it('shows a loading line naming MinIO/S3 while the preview is in flight', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/datasets/preview')) return new Promise(() => {});
      if (url.includes('/datasets')) {
        return { ok: true, json: async () => ({ datasets: [S3_DATASET] }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    await renderDatasetStep();

    expect(
      await screen.findByText(/Loading data from MinIO\/S3/),
    ).toBeInTheDocument();
  });

  it('shows skeleton rows while the preview is in flight', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/datasets/preview')) return new Promise(() => {});
      if (url.includes('/datasets')) {
        return { ok: true, json: async () => ({ datasets: [S3_DATASET] }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    await renderDatasetStep();

    expect(await screen.findByTestId('preview-skeleton')).toBeInTheDocument();
  });

  it('labels the loaded preview with the dataset source', async () => {
    await renderDatasetStep();

    expect(await screen.findByText(/from MinIO\/S3/)).toBeInTheDocument();
  });

  it('says the preview is unavailable when the read fails', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/datasets/preview')) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (url.includes('/datasets')) {
        return { ok: true, json: async () => ({ datasets: [S3_DATASET] }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    await renderDatasetStep();

    expect(
      await screen.findByText(/Preview unavailable for this dataset/),
    ).toBeInTheDocument();
  });
});

async function renderFeastEntityStep() {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <StepLayout
        schema={
          {
            type: 'object',
            properties: {
              datasetUri: { type: 'string', title: 'Dataset name' },
              entityIdColumn: { type: 'string', title: 'Entity id column' },
            },
          } as any
        }
        uiSchema={
          {
            'ui:options': {
              groups: [
                {
                  title: 'Feature enrichment',
                  fields: [
                    { name: 'datasetUri', datasetPicker: true },
                    {
                      name: 'entityIdColumn',
                      columnPicker: 'single',
                      feastEntityMatch: true,
                    },
                  ],
                },
              ],
            },
          } as any
        }
        formData={{ datasetUri: S3_DATASET.uri, entityIdColumn: 'sqft' }}
        onChange={jest.fn()}
        idSchema={{} as any}
        registry={
          {
            fields: {
              SchemaField: () => <div data-testid="plain-field" />,
            },
          } as any
        }
        errorSchema={{} as any}
        name="step"
        required={false}
        disabled={false}
        readonly={false}
        rawErrors={[]}
        onBlur={jest.fn()}
        onFocus={jest.fn()}
      />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout feastEntityMatch', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/datasets/feast-entity-match')) {
        return {
          ok: true,
          json: async () => ({
            matched: 0,
            total: 25,
            sample_unmatched: ['1450'],
          }),
        };
      }
      if (url.includes('/datasets/columns')) {
        return { ok: true, json: async () => ({ columns: ['sqft', 'price'] }) };
      }
      if (url.includes('/datasets')) {
        return { ok: true, json: async () => ({ datasets: [S3_DATASET] }) };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  it('warns when no entity id matches the Feature Store', async () => {
    await renderFeastEntityStep();

    expect(
      await screen.findByText(/No entity ids match the Feature Store/),
    ).toBeInTheDocument();
  });
});

/** Stateful wrapper so picking a model name cascades into the version dropdown. */
function ModelPickerStep() {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  return (
    <StepLayout
      schema={
        {
          type: 'object',
          properties: {
            modelName: { type: 'string', title: 'Model name' },
            modelVersion: { type: 'string', title: 'Model version' },
          },
        } as any
      }
      uiSchema={
        {
          'ui:options': {
            groups: [
              {
                title: 'Model',
                fields: [
                  { name: 'modelName', modelNamePicker: true },
                  { name: 'modelVersion', modelVersionPicker: true },
                ],
              },
            ],
          },
        } as any
      }
      formData={formData}
      onChange={next => setFormData(next ?? {})}
      idSchema={{} as any}
      registry={
        {
          fields: {
            SchemaField: () => <div data-testid="plain-field" />,
          },
        } as any
      }
      errorSchema={{} as any}
      name="step"
      required={false}
      disabled={false}
      readonly={false}
      rawErrors={[]}
      onBlur={jest.fn()}
      onFocus={jest.fn()}
    />
  );
}

async function renderModelPickerStep() {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <ModelPickerStep />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout modelNamePicker version cascade', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/versions')) {
        return { ok: true, json: async () => ({ versions: ['1', '2'] }) };
      }
      if (url.includes('/models')) {
        return {
          ok: true,
          json: async () => [{ name: 'fraud-detection', version: '2' }],
        };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  it('offers registered models as a dropdown instead of a free-text field', async () => {
    await renderModelPickerStep();

    const select = screen.getByRole('button');
    await userEvent.click(select);

    expect(await screen.findByText('fraud-detection')).toBeInTheDocument();
  });

  it('shows a loading placeholder while the model list is in flight', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/models')) return new Promise(() => {});
      return { ok: true, json: async () => ({}) };
    });

    await renderModelPickerStep();

    expect(await screen.findByText('Loading models…')).toBeInTheDocument();
  });
});

/**
 * Stable mock SchemaField rendering a real input. Hoisted to module scope so
 * React keeps the same component type across renders — an inline arrow would
 * unmount the input after every keystroke and typing would stall.
 */
function MockTextInput(props: any) {
  return (
    <input
      data-testid={`input-${props.name}`}
      value={props.formData ?? ''}
      disabled={props.uiSchema?.['ui:disabled'] === true}
      onChange={e => props.onChange(e.target.value)}
    />
  );
}

/** Stateful wrapper with a real input as SchemaField, so typing sticks. */
function StatefulFieldsStep({
  fields,
  initial = {},
}: {
  fields: any[];
  initial?: Record<string, unknown>;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>(initial);
  return (
    <StepLayout
      schema={
        {
          type: 'object',
          properties: {
            huggingFaceModelId: { type: 'string', title: 'HF model id' },
            modelName: { type: 'string', title: 'Model name' },
            modelPreset: { type: 'string', title: 'Model preset' },
            gpuType: { type: 'string', title: 'GPU type' },
            gpuCount: { type: 'number', title: 'GPU count' },
            quantization: { type: 'string', title: 'Quantization' },
            maxContextLength: { type: 'number', title: 'Max context length' },
            modelVersion: { type: 'string', title: 'Model version' },
            environment: { type: 'string', title: 'Environment' },
            releaseStrategy: { type: 'string', title: 'Release strategy' },
            referenceDataUri: { type: 'string', title: 'Reference data' },
            hfTokenSecretRef: { type: 'string', title: 'HF token secret' },
            speculativeDecoding: { type: 'string', title: 'Speculative' },
            metricNames: {
              type: 'array',
              title: 'Performance metrics',
              items: {
                oneOf: [
                  { const: 'f1_score', title: 'F1-score' },
                  { const: 'recall', title: 'Recall' },
                ],
              },
            },
          },
        } as any
      }
      uiSchema={
        {
          'ui:options': {
            groups: [{ title: 'Model', fields }],
          },
        } as any
      }
      formData={formData}
      onChange={next => setFormData(next ?? {})}
      idSchema={{} as any}
      registry={
        {
          fields: { SchemaField: MockTextInput },
        } as any
      }
      errorSchema={{} as any}
      name="step"
      required={false}
      disabled={false}
      readonly={false}
      rawErrors={[]}
      onBlur={jest.fn()}
      onFocus={jest.fn()}
    />
  );
}

/** Builds a decodable (unsigned) JWT with the given payload. */
function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.sig`;
}

async function renderFieldsStep(
  fields: any[],
  options: {
    authEnabled?: boolean;
    token?: string;
    initial?: Record<string, unknown>;
  } = {},
) {
  const { authEnabled = false, token = 'token', initial } = options;
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => authEnabled }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => token }],
      ]}
    >
      <StatefulFieldsStep fields={fields} initial={initial} />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout huggingFaceModelPicker', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/llm-deploy/search-models')) {
        return {
          ok: true,
          json: async () => ({
            model_ids: ['meta-llama/Llama-3.1-8B-Instruct'],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
  });

  it('offers real HuggingFace ids as suggestions', async () => {
    await renderFieldsStep([
      { name: 'huggingFaceModelId', huggingFaceModelPicker: true },
    ]);

    const input = screen.getByLabelText(/HF model id/);
    await userEvent.click(input);

    expect(
      await screen.findByText('meta-llama/Llama-3.1-8B-Instruct'),
    ).toBeInTheDocument();
  });

  it('still allows typing an id the search does not surface (free-solo)', async () => {
    await renderFieldsStep([
      { name: 'huggingFaceModelId', huggingFaceModelPicker: true },
    ]);

    const input = screen.getByLabelText(/HF model id/);
    await userEvent.type(input, 'my-org/my-model');

    expect(input).toHaveValue('my-org/my-model');
  });
});

describe('StepLayout autoFillModelName', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: false,
      json: async () => ({}),
    }));
  });

  it('derives modelName from the picked HF id', async () => {
    await renderFieldsStep([
      { name: 'huggingFaceModelId', autoFillModelName: true },
      { name: 'modelName' },
    ]);

    const input = screen.getByTestId('input-huggingFaceModelId');
    await userEvent.type(input, 'meta-llama/Llama-3.1-8B-Instruct');

    await waitFor(() => {
      expect(screen.getByTestId('input-modelName')).toHaveValue(
        'llama-3.1-8b-instruct',
      );
    });
  });
});

describe('StepLayout modelPresetPicker', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: false,
      json: async () => ({}),
    }));
  });

  it('fills the model id, name and a fitting compute profile from a preset', async () => {
    await renderFieldsStep([
      { name: 'modelPreset', modelPresetPicker: true },
      { name: 'huggingFaceModelId', autoFillModelName: true },
      { name: 'modelName' },
      { name: 'gpuType' },
      { name: 'gpuCount' },
      { name: 'quantization' },
      { name: 'maxContextLength' },
    ]);

    const select = await screen.findByRole('button');
    await userEvent.click(select);
    await userEvent.click(
      await screen.findByText(
        'Llama 3.1 70B Instruct (Meta) — A100 x4, int4-awq',
      ),
    );

    await waitFor(() => {
      expect(screen.getByTestId('input-huggingFaceModelId')).toHaveValue(
        'meta-llama/Llama-3.1-70B-Instruct',
      );
      expect(screen.getByTestId('input-modelName')).toHaveValue(
        'llama-3.1-70b-instruct',
      );
      expect(screen.getByTestId('input-gpuType')).toHaveValue('A100');
      expect(screen.getByTestId('input-gpuCount')).toHaveValue('4');
      expect(screen.getByTestId('input-quantization')).toHaveValue('int4-awq');
      expect(screen.getByTestId('input-maxContextLength')).toHaveValue('8192');
    });
  });

  it('leaves the fields untouched when Custom is picked', async () => {
    await renderFieldsStep([
      { name: 'modelPreset', modelPresetPicker: true },
      { name: 'huggingFaceModelId' },
    ]);

    const select = await screen.findByRole('button');
    await userEvent.click(select);
    // The closed select already shows the Custom label, so the open menu
    // renders a second copy — click the menu item (the last match).
    const customOptions = await screen.findAllByText(
      'Custom model (type a HuggingFace id)',
    );
    await userEvent.click(customOptions[customOptions.length - 1]);

    await waitFor(() => {
      expect(screen.getByTestId('input-huggingFaceModelId')).toHaveValue('');
    });
  });

  it('flips back to Custom when the HF id is hand-edited', async () => {
    await renderFieldsStep([
      { name: 'modelPreset', modelPresetPicker: true },
      { name: 'huggingFaceModelId', autoFillModelName: true },
      { name: 'modelName' },
    ]);

    const select = await screen.findByRole('button');
    await userEvent.click(select);
    await userEvent.click(
      await screen.findByText('Llama 3.1 8B Instruct (Meta) — L4 x1'),
    );

    const hfInput = screen.getByTestId('input-huggingFaceModelId');
    await userEvent.clear(hfInput);
    await userEvent.type(hfInput, 'my-org/my-model');

    await waitFor(() => {
      expect(screen.getByTestId('input-modelName')).toHaveValue('my-model');
    });
    expect(screen.getByRole('button')).toHaveTextContent('Custom model');
  });
});

describe('StepLayout releaseEligibilityPanel', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: false,
      json: async () => ({}),
    }));
  });

  it('falls back to pr-gated and warns when the user lacks llm-ops-admin', async () => {
    await renderFieldsStep(
      [
        { name: 'environment' },
        { name: 'releaseStrategy', releaseEligibilityPanel: true },
      ],
      {
        authEnabled: true,
        token: fakeJwt({ sub: 'alice', roles: ['developer'] }),
        initial: { environment: 'dev', releaseStrategy: 'instant' },
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId('input-releaseStrategy')).toHaveValue(
        'pr-gated',
      );
    });
    expect(screen.getByText(/Instant needs a role/)).toBeInTheDocument();
  });

  it('keeps instant and confirms availability when the user has the role', async () => {
    await renderFieldsStep(
      [
        { name: 'environment' },
        { name: 'releaseStrategy', releaseEligibilityPanel: true },
      ],
      {
        authEnabled: true,
        token: fakeJwt({ sub: 'bob', roles: ['llm-ops-admin'] }),
        initial: { environment: 'dev', releaseStrategy: 'instant' },
      },
    );

    await waitFor(() => {
      expect(screen.getByText(/Instant available/)).toBeInTheDocument();
    });
    expect(screen.getByTestId('input-releaseStrategy')).toHaveValue('instant');
  });

  it('renders nothing outside environment=dev', async () => {
    await renderFieldsStep(
      [
        { name: 'environment' },
        { name: 'releaseStrategy', releaseEligibilityPanel: true },
      ],
      {
        authEnabled: true,
        token: fakeJwt({ sub: 'alice', roles: [] }),
        initial: { environment: 'prod', releaseStrategy: 'pr-gated' },
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId('input-releaseStrategy')).toHaveValue(
        'pr-gated',
      );
    });
    expect(screen.queryByText(/Instant/)).not.toBeInTheDocument();
  });
});

describe('StepLayout secretPicker', () => {
  it('renders a dropdown of real Secret names', async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/secrets')) {
        return { ok: true, json: async () => ({ names: ['hf-token'] }) };
      }
      return { ok: true, json: async () => ({ names: [] }) };
    });
    await renderFieldsStep([{ name: 'hfTokenSecretRef', secretPicker: true }]);

    const select = await screen.findByRole('button');
    await userEvent.click(select);

    expect(await screen.findByText('hf-token')).toBeInTheDocument();
  });

  it('falls back to the plain field when no Secrets are listed', async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ names: [] }),
    }));
    await renderFieldsStep([{ name: 'hfTokenSecretRef', secretPicker: true }]);

    await waitFor(() => {
      expect(screen.getByTestId('input-hfTokenSecretRef')).toBeInTheDocument();
    });
  });
});

describe('StepLayout disabled', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({}),
    }));
  });

  it('renders roadmap fields greyed out instead of editable', async () => {
    await renderFieldsStep([{ name: 'speculativeDecoding', disabled: true }]);

    expect(screen.getByTestId('input-speculativeDecoding')).toBeDisabled();
  });
});

describe('StepLayout multiSelect', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: false,
      json: async () => ({}),
    }));
  });

  it('renders a multi-select of the schema options and keeps several selected', async () => {
    await renderFieldsStep([{ name: 'metricNames', multiSelect: true }]);

    const select = await screen.findByRole('button');
    await userEvent.click(select);
    await userEvent.click(await screen.findByText('F1-score'));
    await userEvent.click(screen.getByText('Recall'));

    // Both picks stay selected (chips), i.e. the field holds an array.
    expect(screen.getAllByText('F1-score').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recall').length).toBeGreaterThan(0);
  });
});

/** Stateful wrapper for the task-type-bound metrics table. */
function TaskTypeMetricsStep() {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  return (
    <StepLayout
      schema={
        {
          type: 'object',
          properties: {
            modelName: { type: 'string', title: 'Model name' },
            modelVersion: { type: 'string', title: 'Model version' },
            taskType: { type: 'string', title: 'Task type' },
            metricNames: {
              type: 'array',
              title: 'Performance metrics',
              items: {
                oneOf: [
                  { const: 'f1_score', title: 'F1-score', 'x-threshold': 0.85 },
                  { const: 'accuracy', title: 'Accuracy', 'x-threshold': 0.9 },
                  { const: 'rmse', title: 'RMSE', 'x-threshold': 1.0 },
                  { const: 'mae', title: 'MAE', 'x-threshold': 1.0 },
                ],
              },
            },
            metricThresholds: { type: 'object' },
            retrainAlgorithm: {
              type: 'string',
              title: 'Retrain algorithm',
              oneOf: [
                {
                  const: 'LogisticRegression',
                  title: 'Logistic Regression',
                  'x-task-type': 'classification',
                },
                {
                  const: 'LinearRegression',
                  title: 'Linear Regression',
                  'x-task-type': 'regression',
                },
              ],
            },
          },
        } as any
      }
      uiSchema={
        {
          'ui:options': {
            groups: [
              {
                title: 'Model',
                fields: [
                  { name: 'modelName', modelNamePicker: true },
                  { name: 'modelVersion', modelVersionPicker: true },
                  { name: 'taskType', readOnlyDisplay: true },
                  { name: 'metricNames', taskTypeMetrics: true },
                  { name: 'metricThresholds', hidden: true },
                  { name: 'retrainAlgorithm', taskTypeOptions: true },
                ],
              },
            ],
          },
        } as any
      }
      formData={formData}
      onChange={next => setFormData(next ?? {})}
      idSchema={{} as any}
      registry={
        {
          fields: { SchemaField: MockTextInput },
        } as any
      }
      errorSchema={{} as any}
      name="step"
      required={false}
      disabled={false}
      readonly={false}
      rawErrors={[]}
      onBlur={jest.fn()}
      onFocus={jest.fn()}
    />
  );
}

async function renderTaskTypeMetricsStep() {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <TaskTypeMetricsStep />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

function mockTaskTypeSummary(taskType: string) {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/summary')) {
      return {
        ok: true,
        json: async () => ({
          name: 'm',
          version: '2',
          task_type: taskType,
          metrics: {},
          tags: {},
        }),
      };
    }
    // Empty pickers so modelName/modelVersion fall back to plain inputs.
    return { ok: false, json: async () => ({}) };
  });
}

async function pickModelForTaskType() {
  await userEvent.type(screen.getByTestId('input-modelName'), 'm');
  await userEvent.type(screen.getByTestId('input-modelVersion'), '2');
}

describe('StepLayout taskTypeMetrics', () => {
  it('shows only classification metrics for a classification model', async () => {
    mockTaskTypeSummary('classification');
    await renderTaskTypeMetricsStep();
    await pickModelForTaskType();

    await waitFor(
      () => {
        expect(screen.queryByText('RMSE')).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.getByText('F1-score')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.queryByText('MAE')).not.toBeInTheDocument();
  });

  it('shows only regression metrics for a regression model', async () => {
    mockTaskTypeSummary('regression');
    await renderTaskTypeMetricsStep();
    await pickModelForTaskType();

    await waitFor(
      () => {
        expect(screen.queryByText('F1-score')).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.getByText('RMSE')).toBeInTheDocument();
    expect(screen.getByText('MAE')).toBeInTheDocument();
  });

  it('seeds the first applicable metric with its schema threshold', async () => {
    mockTaskTypeSummary('classification');
    await renderTaskTypeMetricsStep();
    await pickModelForTaskType();

    const threshold = await screen.findByDisplayValue(
      '0.85',
      {},
      { timeout: 5000 },
    );
    expect(threshold).toBeInTheDocument();
  });

  it('filters the retrain algorithm to the model task type', async () => {
    mockTaskTypeSummary('regression');
    await renderTaskTypeMetricsStep();
    await pickModelForTaskType();

    await waitFor(
      () => {
        expect(screen.queryByText('F1-score')).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    await userEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('Linear Regression')).toBeInTheDocument();
    expect(screen.queryByText('Logistic Regression')).not.toBeInTheDocument();
  });
});

const LINEAGE_URI =
  'file:///mnt/data/classification-telco-fraud-detection/telco-fraud-detection-sample.csv';

function mockMonitoringFetches(summary: unknown) {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/summary')) {
      return { ok: true, json: async () => summary };
    }
    if (url.includes('/datasets')) {
      // Deliberately NOT the lineage URI: the lock must not depend on
      // picker membership (e.g. enriched files with no .dvc sibling).
      return {
        ok: true,
        json: async () => ({
          datasets: [
            {
              name: 'other.csv',
              uri: 'file:///mnt/data/other.csv',
              size_bytes: 1,
              source: 'local',
            },
          ],
        }),
      };
    }
    // Empty pickers everywhere else so every field falls back to its
    // plain-text input, which the test can type into directly.
    return { ok: false, json: async () => ({}) };
  });
}

const MONITORING_FIELDS = [
  { name: 'modelName', modelNamePicker: true },
  { name: 'modelVersion', modelVersionPicker: true },
  { name: 'referenceDataUri', datasetPicker: true },
];

async function pickModel() {
  await userEvent.type(screen.getByTestId('input-modelName'), 'm');
  await userEvent.type(screen.getByTestId('input-modelVersion'), '2');
}

describe('StepLayout reference data binding', () => {
  it('locks reference data to the model version training data', async () => {
    mockMonitoringFetches({
      name: 'm',
      version: '2',
      task_type: 'classification',
      metrics: {},
      tags: {},
      dataset_uri: LINEAGE_URI,
    });
    await renderFieldsStep(MONITORING_FIELDS);
    await pickModel();

    expect(
      await screen.findByText(/Attached from m:2/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue(LINEAGE_URI)).toBeDisabled();
  });

  it('falls back to the picker when the version has no lineage', async () => {
    mockMonitoringFetches({
      name: 'm',
      version: '2',
      task_type: 'classification',
      metrics: {},
      tags: {},
      dataset_uri: null,
    });
    await renderFieldsStep(MONITORING_FIELDS);
    await pickModel();

    await waitFor(
      () => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.queryByText(/Attached from/)).not.toBeInTheDocument();
  });
});

/** Stateful wrapper exposing the two new LLMOps DevEx fields. */
function StatefulChoiceStep({ onChange }: { onChange?: (v: unknown) => void }) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  return (
    <StepLayout
      schema={
        {
          type: 'object',
          properties: {
            artifactKind: {
              type: 'string',
              title: 'Artifact kind',
              oneOf: [
                { const: 'prompt', title: 'Prompt' },
                { const: 'rag-index', title: 'RAG Index' },
              ],
              'x-cards': [
                {
                  value: 'prompt',
                  label: 'Prompt',
                  caption: 'Draft a system prompt',
                  icon: 'bolt',
                },
                {
                  value: 'rag-index',
                  label: 'RAG Index',
                  caption: 'Ingest documents',
                  icon: 'list',
                },
              ],
            },
            sourcePaths: {
              type: 'array',
              title: 'Source document paths',
              items: { type: 'string' },
            },
          },
        } as any
      }
      uiSchema={
        {
          'ui:options': {
            groups: [
              {
                title: 'Artifact',
                fields: [{ name: 'artifactKind', choiceCards: true }],
              },
              {
                title: 'Sources',
                fields: [{ name: 'sourcePaths', sourcePathsPicker: true }],
              },
            ],
          },
        } as any
      }
      formData={formData}
      onChange={next => {
        setFormData(next ?? {});
        onChange?.(next);
      }}
      idSchema={{} as any}
      registry={
        {
          fields: { SchemaField: () => <div data-testid="plain-field" /> },
        } as any
      }
      errorSchema={{} as any}
      name="step"
      required={false}
      disabled={false}
      readonly={false}
      rawErrors={[]}
      onBlur={jest.fn()}
      onFocus={jest.fn()}
    />
  );
}

async function renderChoiceStep(onChange?: (v: unknown) => void) {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <StatefulChoiceStep onChange={onChange} />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout choiceCards', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ sources: [] }),
    }));
  });

  it('renders schema x-cards with captions and selects on click', async () => {
    const onChange = jest.fn();
    await renderChoiceStep(onChange);

    expect(screen.getByText('Draft a system prompt')).toBeInTheDocument();
    expect(screen.getByText('Ingest documents')).toBeInTheDocument();

    await userEvent.click(screen.getByText('RAG Index'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ artifactKind: 'rag-index' }),
    );
  });
});

describe('StepLayout sourcePathsPicker', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/rag/sources')) {
        return {
          ok: true,
          json: async () => ({
            sources: ['docs/architecture-overview.md', 'docs/glossary.md'],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  it('renders a multi-select of real source docs instead of a free-text field', async () => {
    await renderChoiceStep();

    const select = await screen.findByRole('button');
    await userEvent.click(select);

    expect(
      await screen.findByText('docs/architecture-overview.md'),
    ).toBeInTheDocument();
    expect(screen.getByText('docs/glossary.md')).toBeInTheDocument();
  });

  it('falls back to the plain field when no sources are listed', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ sources: [] }),
    }));
    await renderChoiceStep();

    await waitFor(() => {
      expect(screen.getByTestId('plain-field')).toBeInTheDocument();
    });
  });
});

async function renderCostStep(formData: Record<string, unknown>) {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <StepLayout
        schema={
          {
            type: 'object',
            properties: {
              modelName: { type: 'string', title: 'Model name' },
              costEstimate: { type: 'string', title: 'Cost estimate' },
            },
          } as any
        }
        uiSchema={
          {
            'ui:options': {
              groups: [
                {
                  title: 'Cost estimate',
                  fields: [
                    {
                      name: 'costEstimate',
                      costEstimate: {
                        goldenPath: 'evaluate-deploy-model',
                        stage: 'run',
                        artifactFields: ['modelName'],
                        paramFields: ['deployStrategy'],
                        when: { action: 'deploy' },
                      },
                    },
                  ],
                },
              ],
            },
          } as any
        }
        formData={formData}
        onChange={jest.fn()}
        idSchema={{} as any}
        registry={
          {
            fields: {
              SchemaField: () => <div data-testid="plain-field" />,
            },
          } as any
        }
        errorSchema={{} as any}
        name="step"
        required={false}
        disabled={false}
        readonly={false}
        rawErrors={[]}
        onBlur={jest.fn()}
        onFocus={jest.fn()}
      />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout costEstimate', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/costs/estimate')) {
        return {
          ok: true,
          json: async () => ({
            estimated_cost: 12.5,
            currency: 'USD',
            breakdown: { gpu: 12.5 },
          }),
        };
      }
      if (url.includes('/costs/check')) {
        return {
          ok: true,
          json: async () => ({
            allow: true,
            level: 'warn',
            estimated_cost: 12.5,
            budget: 10,
            reasons: ['over budget'],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  it('shows the estimate, budget status and reasons once the artifact is set', async () => {
    await renderCostStep({ modelName: 'fraud-detection', action: 'deploy' });

    expect(await screen.findByText('Estimated run cost')).toBeInTheDocument();
    expect((await screen.findAllByText(/12\.50/)).length).toBeGreaterThan(0);
    expect(await screen.findByText('Near budget')).toBeInTheDocument();
    expect(await screen.findByText('• over budget')).toBeInTheDocument();
  });

  it('renders nothing when the when condition does not match', async () => {
    await renderCostStep({ modelName: 'fraud-detection', action: 'rollback' });

    expect(screen.queryByText('Estimated run cost')).not.toBeInTheDocument();
  });

  it('fails quiet when the estimate request errors', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/costs/estimate')) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    });

    await renderCostStep({ modelName: 'fraud-detection', action: 'deploy' });

    expect(
      await screen.findByText('Cost estimate unavailable right now.'),
    ).toBeInTheDocument();
  });
});

async function renderSecurityStep(formData: Record<string, unknown>) {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <StepLayout
        schema={
          {
            type: 'object',
            properties: {
              modelName: { type: 'string', title: 'Model name' },
              securityScan: { type: 'string', title: 'Security scan' },
            },
          } as any
        }
        uiSchema={
          {
            'ui:options': {
              groups: [
                {
                  title: 'Security',
                  fields: [
                    {
                      name: 'securityScan',
                      securityScan: {
                        goldenPath: 'llm-serve-deploy',
                        stage: 'run',
                        artifactFields: ['modelName'],
                        paramFields: ['inputGuardrails'],
                        when: { action: 'deploy' },
                      },
                    },
                  ],
                },
              ],
            },
          } as any
        }
        formData={formData}
        onChange={jest.fn()}
        idSchema={{} as any}
        registry={
          {
            fields: {
              SchemaField: () => <div data-testid="plain-field" />,
            },
          } as any
        }
        errorSchema={{} as any}
        name="step"
        required={false}
        disabled={false}
        readonly={false}
        rawErrors={[]}
        onBlur={jest.fn()}
        onFocus={jest.fn()}
      />
    </TestApiProvider>,
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result;
}

describe('StepLayout securityScan', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/security/scan')) {
        return {
          ok: true,
          json: async () => ({
            passed: false,
            score: 40,
            findings: [
              {
                control: 'audit-logging',
                pillar: 'inference-audit',
                severity: 'blocking',
                message: 'Inference audit trail: record every inference.',
              },
            ],
            controls: [
              {
                id: 'audit-logging',
                pillar: 'inference-audit',
                label: 'Inference audit trail',
                status: 'missing',
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  it('shows the posture score and blocking findings once the artifact is set', async () => {
    await renderSecurityStep({ modelName: 'llama-3-8b', action: 'deploy' });

    expect(await screen.findByText('Security posture')).toBeInTheDocument();
    expect(await screen.findByText('40/100')).toBeInTheDocument();
    expect(
      await screen.findByText(/Inference audit trail: record every inference/),
    ).toBeInTheDocument();
  });

  it('renders nothing when the when condition does not match', async () => {
    await renderSecurityStep({ modelName: 'llama-3-8b', action: 'rollback' });

    expect(screen.queryByText('Security posture')).not.toBeInTheDocument();
  });

  it('fails quiet when the scan request errors', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/security/scan')) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    });

    await renderSecurityStep({ modelName: 'llama-3-8b', action: 'deploy' });

    expect(
      await screen.findByText('Security scan unavailable right now.'),
    ).toBeInTheDocument();
  });
});

describe('StepLayout step description', () => {
  async function renderWithDescription(description?: string) {
    return renderInTestApp(
      <TestApiProvider
        apis={[
          [configApiRef, { getOptionalBoolean: () => false }],
          [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
          [fetchApiRef, { fetch: fetchMock }],
          [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
        ]}
      >
        <StepLayout
          schema={
            {
              type: 'object',
              description,
              properties: {
                modelName: { type: 'string', title: 'Model name' },
              },
            } as any
          }
          uiSchema={
            {
              'ui:options': {
                groups: [{ title: 'Model', fields: ['modelName'] }],
              },
            } as any
          }
          formData={{}}
          onChange={jest.fn()}
          idSchema={{} as any}
          registry={
            {
              fields: { SchemaField: () => <div data-testid="plain-field" /> },
            } as any
          }
          errorSchema={{} as any}
          name="step"
          required={false}
          disabled={false}
          readonly={false}
          rawErrors={[]}
          onBlur={jest.fn()}
          onFocus={jest.fn()}
        />
      </TestApiProvider>,
    );
  }

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ names: [] }),
    }));
  });

  it('renders the step description as guidance above the groups', async () => {
    await renderWithDescription('Pick a model to deploy.');

    expect(
      await screen.findByText('Pick a model to deploy.'),
    ).toBeInTheDocument();
  });

  it('renders no description line when the step has none', async () => {
    await renderWithDescription(undefined);

    expect(
      screen.queryByText('Pick a model to deploy.'),
    ).not.toBeInTheDocument();
  });
});
