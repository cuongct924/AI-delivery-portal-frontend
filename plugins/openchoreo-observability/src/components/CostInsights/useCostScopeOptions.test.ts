import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useCostProjectOptions } from './useCostScopeOptions';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return { ...actual, useApi: jest.fn() };
});

describe('useCostProjectOptions', () => {
  const getEntities = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getEntities });
  });

  it('offers only OpenChoreo projects, not hand-written Systems', async () => {
    getEntities.mockResolvedValueOnce({
      items: [
        {
          metadata: {
            name: 'default',
            title: 'Default Project',
            annotations: { 'openchoreo.io/project-id': 'default' },
          },
        },
        // A hand-written System with no OpenChoreo Project behind it.
        {
          metadata: { name: 'ai-delivery-portal', title: 'AI Delivery Portal' },
        },
      ],
    });

    const { result } = renderHook(() => useCostProjectOptions('default'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() =>
      expect(result.current.options).toEqual([
        { value: 'default/default', label: 'Default Project' },
      ]),
    );
  });
});
