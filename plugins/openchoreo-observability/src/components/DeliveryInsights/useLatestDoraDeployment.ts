import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../../api/ObservabilityApi';
import { DoraDeployment, DoraSearchScope } from '../../types';

/**
 * The most recent deployment in a scope's window, or null while loading, on
 * failure, or when the scope isn't ready yet. Lead-time phase breakdown lives
 * on individual deployment records, not the DORA summary/series, so the
 * waterfall chart needs one representative deployment rather than an
 * aggregate.
 */
export function useLatestDoraDeployment(
  scope: DoraSearchScope | null,
  rangeDays: number,
): DoraDeployment | null {
  const observabilityApi = useApi(observabilityApiRef);
  const [deployment, setDeployment] = useState<DoraDeployment | null>(null);

  const scopeKey = scope
    ? `${scope.namespace}/${scope.project ?? ''}/${scope.component ?? ''}/${
        scope.environment ?? ''
      }`
    : '';

  useEffect(() => {
    if (!scope) {
      setDeployment(null);
      return undefined;
    }
    let cancelled = false;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    observabilityApi
      .getDoraDeployments(scope, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        limit: 1,
        sortOrder: 'desc',
      })
      .then(response => {
        if (!cancelled) {
          setDeployment(response.deployments[0] ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeployment(null);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, rangeDays, observabilityApi]);

  return deployment;
}
