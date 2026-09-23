import { render, screen } from '@testing-library/react';
import { CostScorecard, buildScorecardChecks } from './CostScorecard';
import type { CostSummary } from './types';

const summary = (over: Partial<CostSummary> = {}): CostSummary => ({
  totalCost: 100,
  deltaPct: null,
  efficiency: 0.5,
  totalSaving: 0,
  ...over,
});

describe('buildScorecardChecks', () => {
  it('passes budget when the forecast is within it', () => {
    const checks = buildScorecardChecks(
      summary({ budget: 500, forecastTotal: 300 }),
    );
    expect(checks.find(c => c.id === 'budget')?.status).toBe('pass');
  });

  it('fails budget when the forecast exceeds it', () => {
    const checks = buildScorecardChecks(
      summary({ budget: 100, forecastTotal: 300 }),
    );
    expect(checks.find(c => c.id === 'budget')?.status).toBe('fail');
  });

  it('warns on anomalies and reclaimable saving', () => {
    const checks = buildScorecardChecks(
      summary({ anomalyCount: 2, totalSaving: 40 }),
    );
    expect(checks.find(c => c.id === 'anomaly')?.status).toBe('warn');
    expect(checks.find(c => c.id === 'saving')?.status).toBe('warn');
  });

  it('fails attribution below half coverage', () => {
    const checks = buildScorecardChecks(summary({ attributionCoverage: 0.2 }));
    expect(checks.find(c => c.id === 'attribution')?.status).toBe('fail');
  });

  it('offers a CTA when action is needed', () => {
    const checks = buildScorecardChecks(summary({ totalSaving: 40 }));
    expect(checks.find(c => c.id === 'saving')?.cta?.label).toBe(
      'Apply recommendations',
    );
  });

  it('omits the CTA when a check passes', () => {
    const checks = buildScorecardChecks(
      summary({ totalSaving: 0, anomalyCount: 0, attributionCoverage: 1 }),
    );
    expect(checks.find(c => c.id === 'saving')?.cta).toBeUndefined();
  });
});

describe('CostScorecard', () => {
  it('renders every check', () => {
    render(<CostScorecard summary={summary({ attributionCoverage: 1 })} />);
    expect(screen.getByText('Budget adherence')).toBeInTheDocument();
    expect(screen.getByText('Spend anomalies')).toBeInTheDocument();
    expect(screen.getByText('Right-sizing')).toBeInTheDocument();
    expect(screen.getByText('Cost attribution')).toBeInTheDocument();
  });
});
