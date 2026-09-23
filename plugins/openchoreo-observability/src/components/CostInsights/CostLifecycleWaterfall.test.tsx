import { render, screen } from '@testing-library/react';
import { CostLifecycleWaterfall } from './CostLifecycleWaterfall';
import type { CostSummary } from './types';

const summary = (over: Partial<CostSummary> = {}): CostSummary => ({
  totalCost: 100,
  deltaPct: null,
  efficiency: 0.5,
  totalSaving: 0,
  buildCost: 60,
  gateCost: 10,
  runCost: 30,
  ...over,
});

describe('CostLifecycleWaterfall', () => {
  it('renders each lifecycle stage with its amount and share', () => {
    render(<CostLifecycleWaterfall summary={summary()} />);
    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByText('Gate')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByText('USD 60.00')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('shows an empty note when there is no spend', () => {
    render(
      <CostLifecycleWaterfall
        summary={summary({ totalCost: 0, buildCost: 0, gateCost: 0, runCost: 0 })}
      />,
    );
    expect(
      screen.getByText('No spend in the selected window.'),
    ).toBeInTheDocument();
  });
});
