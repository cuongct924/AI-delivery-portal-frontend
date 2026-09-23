import { useCallback, useEffect, useState } from 'react';
import {
  useApi,
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { openChoreoAuthApiRef } from '@openchoreo/backstage-plugin';

export interface RateSuggestion {
  id: string;
  title: string;
  detail: string;
  saving_pct: number;
  stage: string;
}

/**
 * Rate-optimization suggestions from orchestration-api's `/costs/rate-optimization`
 * (reached through the Backstage proxy). Returns `[]` on any failure.
 */
export function useRateOptimization(startTime: string, endTime: string) {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const configApi = useApi(configApiRef);
  const authApi = useApi(openChoreoAuthApiRef);
  const [suggestions, setSuggestions] = useState<RateSuggestion[]>([]);
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
          `${proxyUrl}/orchestration-api/costs/rate-optimization?start_time=${encodeURIComponent(
            startTime,
          )}&end_time=${encodeURIComponent(endTime)}`,
          { headers },
        ),
      )
      .then(res => (res.ok ? res.json() : { suggestions: [] }))
      .then((body: { suggestions?: RateSuggestion[] }) => {
        if (!cancelled) setSuggestions(body.suggestions ?? []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, getAuthHeaders, startTime, endTime]);

  return { suggestions, loading };
}
