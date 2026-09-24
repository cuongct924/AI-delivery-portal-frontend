import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import {
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { openChoreoAuthApiRef } from '@openchoreo/backstage-plugin';
import type { ReviewStepProps } from '@backstage/plugin-scaffolder-react';
import { CustomReviewStep } from './CustomReviewStep';

const fetchMock = jest.fn();

const makeProps = (formData: Record<string, unknown>): ReviewStepProps =>
  ({
    formData,
    steps: [],
    handleBack: jest.fn(),
    handleCreate: jest.fn(),
    disableButtons: false,
  } as unknown as ReviewStepProps);

/** Render the review step with the APIs ReviewCostEstimate needs. */
function renderReview(formData: Record<string, unknown>) {
  return renderInTestApp(
    <TestApiProvider
      apis={[
        [configApiRef, { getOptionalBoolean: () => false }],
        [discoveryApiRef, { getBaseUrl: async () => 'http://proxy' }],
        [fetchApiRef, { fetch: fetchMock }],
        [openChoreoAuthApiRef, { getAccessToken: async () => 'token' }],
      ]}
    >
      <CustomReviewStep {...makeProps(formData)} />
    </TestApiProvider>,
  );
}

// Stub StructuredMetadataTable so we can read exactly what each review
// section forwards as its `metadata` prop.
jest.mock('@backstage/core-components', () => ({
  StructuredMetadataTable: (props: { metadata: Record<string, unknown> }) => (
    <div data-testid="smt" data-metadata={JSON.stringify(props.metadata)} />
  ),
}));

jest.mock('./styles', () => ({
  useStyles: () => ({
    reviewContent: 'reviewContent',
    sectionTitle: 'sectionTitle',
    footer: 'footer',
    promotionPathRow: 'promotionPathRow',
    envBox: 'envBox',
    arrow: 'arrow',
  }),
}));

const tables = () =>
  screen
    .getAllByTestId('smt')
    .map(el => JSON.parse(el.getAttribute('data-metadata') || '{}'));

describe('CustomReviewStep — Project (per-ProjectType) templates', () => {
  it('renders Project Metadata and Parameters sections from a project template', async () => {
    await renderReview({
      namespace_name: 'domain:default/default',
      project_name: 'web-app-demo',
      displayName: 'Web App Demo',
      description: 'A demo project',
      deployment_pipeline: 'default',
      parameters: { appName: 'my-app', replicas: 3 },
    });

    expect(screen.getByText('Project Metadata')).toBeInTheDocument();
    expect(screen.getByText('Parameters')).toBeInTheDocument();

    const all = tables();
    expect(all).toHaveLength(2);

    // Metadata table: namespace ref is shortened to its name.
    const meta = JSON.stringify(all[0]);
    expect(meta).toContain('default');
    expect(meta).toContain('web-app-demo');
    expect(meta).toContain('Web App Demo');

    // Parameters table: schema-driven values are flattened in.
    expect(JSON.stringify(all[1])).toContain('my-app');
  });

  it('omits the Parameters section for a type with no parameters', async () => {
    await renderReview({
      namespace_name: 'domain:default/default',
      project_name: 'minimal-demo',
      deployment_pipeline: 'default',
    });

    expect(screen.getByText('Project Metadata')).toBeInTheDocument();
    expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
    expect(tables()).toHaveLength(1);
  });

  it('renders the Auto Deploy toggle value as Yes/No', async () => {
    await renderReview({
      namespace_name: 'domain:default/default',
      project_name: 'minimal-demo',
      deployment_pipeline: 'default',
      auto_deploy: false,
    });

    expect(tables()[0]['Auto Deploy']).toBe('No');
  });
});

describe('CustomReviewStep — Notification Channel templates', () => {
  it('shows only webhook fields when type is webhook', async () => {
    await renderReview({
      channelConfig: {
        namespace_name: 'domain:default/default',
        channel_name: 'dev-webhook',
        environment: 'environment:default/development',
        isEnvDefault: false,
        type: 'webhook',
        webhookConfig: {
          url: 'https://hooks.example.com',
          headers: [],
          payloadTemplate: 'payload',
        },
      },
    });

    expect(
      screen.getByText('Notification Channel Details'),
    ).toBeInTheDocument();
    const meta = JSON.stringify(tables()[0]);
    expect(meta).toContain('https://hooks.example.com');
    expect(meta).not.toContain('Email Config');
  });

  it('shows only email fields when type is email', async () => {
    await renderReview({
      channelConfig: {
        namespace_name: 'domain:default/default',
        channel_name: 'dev-email',
        environment: 'environment:default/development',
        isEnvDefault: false,
        type: 'email',
        emailConfig: {
          from: 'alerts@example.com',
          to: ['team@example.com'],
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpUsernameSecretName: 'smtp-auth',
          smtpUsernameSecretKey: 'username',
          smtpPasswordSecretName: 'smtp-auth',
          smtpPasswordSecretKey: 'password',
          insecureSkipVerify: false,
          subjectTemplate: 'Alert',
          bodyTemplate: 'Body',
        },
      },
    });

    const meta = JSON.stringify(tables()[0]);
    expect(meta).toContain('alerts@example.com');
    expect(meta).not.toContain('Webhook Config');
  });
});

describe('CustomReviewStep — golden path cost estimate', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/costs/estimate')) {
        return {
          ok: true,
          json: async () => ({ estimated_cost: 12.5, currency: 'USD' }),
        };
      }
      if (url.includes('/costs/check')) {
        return {
          ok: true,
          json: async () => ({
            allow: true,
            level: 'warn',
            budget: 10,
            reasons: ['over budget'],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  it('shows the estimate recap for a golden path', async () => {
    await renderReview({
      costEstimate: 'evaluate-deploy-model',
      modelName: 'fraud-detection',
      action: 'deploy',
    });

    expect(await screen.findByText('Estimated cost')).toBeInTheDocument();
    expect((await screen.findAllByText(/12\.50/)).length).toBeGreaterThan(0);
    expect(await screen.findByText('Near budget')).toBeInTheDocument();
  });

  it('renders nothing for a non-golden-path template', async () => {
    await renderReview({ project_name: 'web-app-demo' });

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
  });
});
