import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../../api/ObservabilityApi';
import { DoraDeployment, DoraSearchScope } from '../../types';

const FETCH_LIMIT = 200;

export interface DoraWorkloadBreakdown {
  deployments: DoraDeployment[];
  loading: boolean;
}

export function useDoraWorkloadBreakdown(
  scope: DoraSearchScope | null,
  rangeDays: number,
): DoraWorkloadBreakdown {
  const observabilityApi = useApi(observabilityApiRef);
  const [deployments, setDeployments] = useState<DoraDeployment[]>([]);
  const [loading, setLoading] = useState(false);

  const scopeKey = scope
    ? `${scope.namespace}/${scope.project ?? ''}/${scope.component ?? ''}/${
        scope.environment ?? ''
      }`
    : '';

  useEffect(() => {
    if (!scope) {
      setDeployments([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const endTime = new Date();
    const startTime = new Date(
      endTime.getTime() - rangeDays * 24 * 60 * 60 * 1000,
    );

    observabilityApi
      .getDoraDeployments(scope, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        limit: FETCH_LIMIT,
        sortOrder: 'desc',
      })
      .then(response => {
        if (!cancelled) {
          setDeployments(response.deployments);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeployments([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, rangeDays, observabilityApi]);

  return { deployments, loading };
}
