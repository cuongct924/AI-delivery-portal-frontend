import { useCallback, useEffect, useState } from 'react';
import {
  useApi,
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { openChoreoAuthApiRef } from '@openchoreo/backstage-plugin';

export interface TrainingEfficiencyRow {
  artifact: string;
  build_cost: number;
  accuracy: number | null;
  cost_per_point: number | null;
}

/**
 * Training cost efficiency (build cost per accuracy point) from
 * orchestration-api's `/costs/training-efficiency`, via the Backstage proxy.
 */
export function useTrainingEfficiency(startTime: string, endTime: string) {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const configApi = useApi(configApiRef);
  const authApi = useApi(openChoreoAuthApiRef);
  const [rows, setRows] = useState<TrainingEfficiencyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const authEnabled =
      configApi.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;
    if (!authEnabled) return {};
    try {
      const token = await authApi.getAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }, [configApi, authApi]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(
          `${proxyUrl}/orchestration-api/costs/training-efficiency?start_time=${encodeURIComponent(
            startTime,
          )}&end_time=${encodeURIComponent(endTime)}`,
          { headers },
        ),
      )
      .then(res => (res.ok ? res.json() : { rows: [] }))
      .then((body: { rows?: TrainingEfficiencyRow[] }) => {
        if (!cancelled) setRows(body.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, getAuthHeaders, startTime, endTime]);

  return { rows, loading };
}
