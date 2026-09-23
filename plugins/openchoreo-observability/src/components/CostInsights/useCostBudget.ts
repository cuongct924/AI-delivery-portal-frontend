import { useCallback, useState } from 'react';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

const STORAGE_KEY = 'openchoreo.costBudget';

/**
 * The scope's monthly budget: the configured default, overridable at runtime
 * from the Operate zone's "Set budget" action. The override is kept in
 * localStorage so it survives a reload without a backend write.
 */
export function useCostBudget(): {
  budget: number | undefined;
  setBudget: (value: number | undefined) => void;
} {
  const config = useApi(configApiRef);
  const configured = config.getOptionalNumber(
    'openchoreo.observability.costBudget',
  );
  const [override, setOverride] = useState<number | undefined>(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  });

  const setBudget = useCallback((value: number | undefined) => {
    if (value === undefined) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(value));
    setOverride(value);
  }, []);

  return { budget: override ?? configured, setBudget };
}
