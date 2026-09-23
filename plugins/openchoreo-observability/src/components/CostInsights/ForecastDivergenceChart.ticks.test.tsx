import { cloneElement } from 'react';
import { render } from '@testing-library/react';
import { ForecastDivergenceChart } from './ForecastDivergenceChart';
import type { ForecastData } from './types';

// Real recharts (unlike ForecastDivergenceChart.test.tsx, which mocks it) so
// the X-axis tick density is actually exercised. ResponsiveContainer reports
// 0 width in jsdom, so it's replaced with a fixed-size clone.
let WIDTH = 1200;
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ResponsiveContainer: ({ children }: any) =>
      cloneElement(children, { width: WIDTH, height: 300 }),
  };
});

const forecast: ForecastData = {
  points: Array.from({ length: 30 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return {
      timestamp: `2026-09-${day}T00:00:00.000Z`,
      actual: i * 3,
      forecast: i * 3,
      ifApplied: i * 2,
    };
  }),
  atCurrentTotal: 90,
  ifAppliedTotal: 70,
  leftOnTable: 20,
};

const dateTicks = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('text'))
    .map(t => t.textContent)
    .filter(t => t?.startsWith('Sep'));

describe('ForecastDivergenceChart x-axis ticks', () => {
  // A month-long axis has one point per day; without an explicit cap recharts
  // draws all 30 on a wide chart and the labels collide.
  it.each([850, 1200, 1700, 2000])(
    'caps the date ticks at 8 on a %ipx chart',
    width => {
      WIDTH = width;
      const { container } = render(
        <ForecastDivergenceChart forecast={forecast} />,
      );

      const ticks = dateTicks(container);
      expect(ticks.length).toBeLessThanOrEqual(8);
      // First and last day are always labelled.
      expect(ticks[0]).toBe('Sep 01');
      expect(ticks[ticks.length - 1]).toBe('Sep 30');
    },
  );
});
