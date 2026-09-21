import { render, screen } from '@testing-library/react';
import { DoraMetricTile, DoraMetricTileProps } from './DoraMetricTile';

const renderTile = (props: Partial<DoraMetricTileProps>) =>
  render(
    <DoraMetricTile
      title="Deployment Frequency"
      value="1.14/day"
      classification="Elite"
      deltaPct={null}
      positiveDeltaIsGood
      {...props}
    />,
  );

describe('DoraMetricTile', () => {
  it('renders the classification chip alone when no secondary badge is given', () => {
    renderTile({});
    expect(screen.getByText('Elite')).toBeInTheDocument();
    expect(screen.queryByText('Semantic-driven')).not.toBeInTheDocument();
  });

  it('renders a secondary badge beside the classification chip', () => {
    renderTile({
      secondaryBadge: { label: 'Semantic-driven', tone: 'warning' },
    });
    expect(screen.getByText('Elite')).toBeInTheDocument();
    expect(screen.getByText('Semantic-driven')).toBeInTheDocument();
  });
});
