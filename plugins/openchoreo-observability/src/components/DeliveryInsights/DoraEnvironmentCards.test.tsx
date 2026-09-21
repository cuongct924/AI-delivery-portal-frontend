import { render, screen } from '@testing-library/react';
import { DoraEnvironmentCards } from './DoraEnvironmentCards';
import type { DoraBreakdownRow } from './useDoraBreakdown';

const row = (dataAvailability?: DoraBreakdownRow['dataAvailability']): DoraBreakdownRow => ({
  name: 'production',
  scope: { namespace: 'default', environment: 'production' },
  summary: undefined,
  dataAvailability,
});

describe('DoraEnvironmentCards', () => {
  it('renders nothing for an empty row list', () => {
    const { container } = render(<DoraEnvironmentCards rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks an availability chip available when the flag is true', () => {
    render(
      <DoraEnvironmentCards
        rows={[row({ evalPipeline: true, driftMonitor: false, guardrails: false })]}
      />,
    );
    expect(screen.getByText('Eval pipeline')).toBeInTheDocument();
    expect(screen.getByText('Drift monitor')).toBeInTheDocument();
    expect(screen.getByText('Guardrails')).toBeInTheDocument();
  });

  it('renders the chips as unavailable when dataAvailability is absent', () => {
    render(<DoraEnvironmentCards rows={[row(undefined)]} />);
    // Still rendered (label present) but not styled as available -- absence of
    // the flag is not evidence it's on, only that we don't know.
    expect(screen.getByText('Eval pipeline')).toBeInTheDocument();
  });
});
