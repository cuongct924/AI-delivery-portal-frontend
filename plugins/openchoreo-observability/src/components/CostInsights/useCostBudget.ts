import { useCallback, useEffect, useState } from 'react';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

const STORAGE_KEY = 'openchoreo.costBudget';

function readOverride(storageKey: string): number | undefined {
  const raw = window.localStorage.getItem(storageKey);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The scope's monthly budget: the configured default, overridable at runtime
 * from the Operate zone's "Set budget" action. The override is kept in
 * localStorage, keyed by `scopeKey` so each scope (namespace/project/team)
 * keeps its own budget, and survives a reload without a backend write. An
 * empty `scopeKey` falls back to the single global key.
 */
export function useCostBudget(scopeKey = ''): {
  budget: number | undefined;
  setBudget: (value: number | undefined) => void;
} {
  const config = useApi(configApiRef);
  const configured = config.getOptionalNumber(
    'openchoreo.observability.costBudget',
  );
  const storageKey = scopeKey ? `${STORAGE_KEY}:${scopeKey}` : STORAGE_KEY;
  const [override, setOverride] = useState<number | undefined>(() =>
    readOverride(storageKey),
  );

  // Re-read when the scope changes, so switching scope shows that scope's
  // own budget instead of the previous one's.
  useEffect(() => {
    setOverride(readOverride(storageKey));
  }, [storageKey]);

  const setBudget = useCallback(
    (value: number | undefined) => {
      if (value === undefined) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, String(value));
      setOverride(value);
    },
    [storageKey],
  );

  return { budget: override ?? configured, setBudget };
}
