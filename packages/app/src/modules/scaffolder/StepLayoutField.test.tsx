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
