import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { OpenChoreoTemplateOutputs } from './OpenChoreoTemplateOutputs';

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useRouteRef: () => () => '/mock-route',
}));

const renderOutputs = (output: Record<string, unknown>) =>
  renderInTestApp(
    <TestApiProvider
      apis={[[scaffolderApiRef, { getTask: async () => ({} as any) }]]}
    >
      <OpenChoreoTemplateOutputs output={output as any} />
    </TestApiProvider>,
  );

describe('OpenChoreoTemplateOutputs cost card', () => {
  it('renders the cost recap from output.cost', async () => {
    await renderOutputs({
      costGoldenPath: 'evaluate-deploy-model',
      costStage: 'run',
      costEstimated: 12.5,
      costLevel: 'warn',
      costBudget: 10,
      costReasons: 'over budget',
    });

    expect(await screen.findByText('Estimated run cost')).toBeInTheDocument();
    expect((await screen.findAllByText(/12\.50/)).length).toBeGreaterThan(0);
    expect(await screen.findByText('Near budget')).toBeInTheDocument();
    expect(await screen.findByText('• over budget')).toBeInTheDocument();
  });

  it('renders nothing when output.cost is absent', async () => {
    await renderOutputs({});

    expect(screen.queryByText(/Estimated .* cost/)).not.toBeInTheDocument();
  });

  it('renders nothing when the estimate step was skipped (empty values)', async () => {
    await renderOutputs({
      costGoldenPath: 'evaluate-deploy-model',
      costStage: 'run',
      costEstimated: '',
      costLevel: '',
      costBudget: '',
      costReasons: '',
    });

    expect(screen.queryByText(/Estimated .* cost/)).not.toBeInTheDocument();
  });
});

describe('OpenChoreoTemplateOutputs security card', () => {
  it('renders the security posture from output.securityScore', async () => {
    await renderOutputs({ securityScore: 100, securityPassed: true });

    expect(await screen.findByText('Security posture')).toBeInTheDocument();
    expect(await screen.findByText('100/100')).toBeInTheDocument();
    expect(await screen.findByText('All controls enforced')).toBeInTheDocument();
  });

  it('renders a blocked posture when the scan failed', async () => {
    await renderOutputs({ securityScore: 40, securityPassed: false });

    expect(await screen.findByText('40/100')).toBeInTheDocument();
    expect(await screen.findByText('Blocked')).toBeInTheDocument();
  });

  it('renders nothing when the scan step was skipped', async () => {
    await renderOutputs({});

    expect(screen.queryByText('Security posture')).not.toBeInTheDocument();
  });
});
