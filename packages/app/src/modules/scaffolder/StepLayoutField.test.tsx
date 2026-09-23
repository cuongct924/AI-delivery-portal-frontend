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
function StatefulFieldsStep({ fields }: { fields: any[] }) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  return (
    <StepLayout
      schema={
        {
          type: 'object',
          properties: {
            huggingFaceModelId: { type: 'string', title: 'HF model id' },
            modelName: { type: 'string', title: 'Model name' },
            hfTokenSecretRef: { type: 'string', title: 'HF token secret' },
            speculativeDecoding: { type: 'string', title: 'Speculative' },
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

async function renderFieldsStep(fields: any[]) {
  const result = await renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <StatefulFieldsStep fields={fields} />
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
      expect(
        screen.getByTestId('input-hfTokenSecretRef'),
      ).toBeInTheDocument();
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
