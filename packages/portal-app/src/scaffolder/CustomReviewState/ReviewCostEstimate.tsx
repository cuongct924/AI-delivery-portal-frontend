import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Chip, Typography, makeStyles } from '@material-ui/core';
import {
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { openChoreoAuthApiRef } from '@openchoreo/backstage-plugin';

interface ReviewCostConfig {
  stage: 'build' | 'gate' | 'run';
  artifactFields: string[];
  paramFields?: string[];
  when?: Record<string, unknown>;
}

/**
 * Mirrors the per-template `costEstimate` ui:options in each
 * `templates/<name>/template.yaml` (the form-step panel's own config). Kept
 * in sync by hand so the Review step — which only has `formData` — can
 * resolve the same estimate the form panel already showed, right before
 * Create.
 */
const REVIEW_COST_CONFIG: Record<string, ReviewCostConfig> = {
  'train-track-register': {
    stage: 'build',
    artifactFields: ['modelName'],
    paramFields: ['epochs', 'numTrials'],
    when: { trainingMode: 'platform' },
  },
  'evaluate-deploy-model': {
    stage: 'run',
    artifactFields: ['modelName'],
    paramFields: ['deployStrategy', 'trafficPercent'],
    when: { action: 'deploy' },
  },
  'setup-model-monitoring': {
    stage: 'run',
    artifactFields: ['modelName'],
    paramFields: ['schedule'],
  },
  'llm-draft-ingest': {
    stage: 'build',
    artifactFields: [
      'newCollectionName',
      'collectionName',
      'evalSetName',
      'promptName',
    ],
    paramFields: ['artifactKind'],
  },
  'llm-evaluate-activate': {
    stage: 'gate',
    artifactFields: ['collectionName', 'promptName'],
    paramFields: ['artifactKind'],
    when: { action: 'evaluate-activate' },
  },
  'llm-serve-deploy': {
    stage: 'run',
    artifactFields: ['modelName'],
    paramFields: ['gpuType', 'gpuCount'],
  },
};

const useStyles = makeStyles(theme => ({
  root: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  title: { fontWeight: 600, fontSize: '0.85rem' },
  amount: { fontWeight: 700, fontSize: '1.1rem' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  },
  muted: { fontSize: '0.8rem', color: theme.palette.text.secondary },
  ok: { backgroundColor: '#2E7D32', color: '#FFF' },
  warn: { backgroundColor: '#F57C00', color: '#FFF' },
  fail: { backgroundColor: '#D32F2F', color: '#FFF' },
}));

type Level = 'ok' | 'warn' | 'fail';

interface ReviewCostState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  estimatedCost?: number;
  currency?: string;
  level?: Level;
  budget?: number | null;
  reasons?: string[];
  alternatives?: string[];
}

function matchesWhen(
  when: Record<string, unknown> | undefined,
  data: Record<string, unknown>,
): boolean {
  if (!when) return true;
  return Object.entries(when).every(([key, value]) => data[key] === value);
}

function firstNonEmptyString(
  fields: string[],
  data: Record<string, unknown>,
): string | undefined {
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

function buildParams(
  fields: string[] | undefined,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const field of fields ?? []) {
    const value = data[field];
    if (value !== undefined && value !== null && value !== '') {
      params[field] = value;
    }
  }
  return params;
}

function formatUsd(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function useAuthHeaders(): () => Promise<Record<string, string>> {
  const configApi = useApi(configApiRef);
  const authApi = useApi(openChoreoAuthApiRef);
  return useCallback(async (): Promise<Record<string, string>> => {
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
}

function useReviewCostEstimate(
  goldenPath: string | undefined,
  data: Record<string, unknown>,
): ReviewCostState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useAuthHeaders();
  // Keep the latest API handles in a ref so an unstable identity
  // (useApi/useCallback churn) can't re-fire the effect on every render —
  // the effect then only depends on the primitive payload values.
  const apisRef = useRef({ discoveryApi, fetch, getAuthHeaders });
  apisRef.current = { discoveryApi, fetch, getAuthHeaders };
  const [state, setState] = useState<ReviewCostState>({ status: 'idle' });

  const config = goldenPath ? REVIEW_COST_CONFIG[goldenPath] : undefined;
  const active = config ? matchesWhen(config.when, data) : false;
  const artifact = config
    ? firstNonEmptyString(config.artifactFields, data)
    : undefined;
  const params = config ? buildParams(config.paramFields, data) : {};
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!config || !goldenPath || !active || !artifact) {
      // Bail out with the same object when already idle, so an unstable
      // dependency can't drive a setState -> render -> effect loop.
      setState(prev => (prev.status === 'idle' ? prev : { status: 'idle' }));
      return undefined;
    }
    setState(prev =>
      prev.status === 'loading' ? prev : { status: 'loading' },
    );
    let cancelled = false;
    const timer = setTimeout(() => {
      const payload = {
        golden_path: goldenPath,
        stage: config.stage,
        artifact,
        params,
      };
      const jsonHeaders = (headers: Record<string, string>) => ({
        ...headers,
        'Content-Type': 'application/json',
      });
      const {
        discoveryApi: discovery,
        fetch: doFetch,
        getAuthHeaders: auth,
      } = apisRef.current;
      Promise.all([discovery.getBaseUrl('proxy'), auth()])
        .then(([proxyUrl, headers]) =>
          Promise.all([
            doFetch(`${proxyUrl}/orchestration-api/costs/estimate`, {
              method: 'POST',
              headers: jsonHeaders(headers),
              body: JSON.stringify(payload),
            }),
            doFetch(`${proxyUrl}/orchestration-api/costs/check`, {
              method: 'POST',
              headers: jsonHeaders(headers),
              body: JSON.stringify({ ...payload, mode: 'warn' }),
            }),
          ]),
        )
        .then(async ([estimateRes, checkRes]) => {
          if (!estimateRes.ok) throw new Error(`HTTP ${estimateRes.status}`);
          const estimateBody = (await estimateRes.json()) as Record<
            string,
            unknown
          >;
          const checkBody = checkRes.ok
            ? ((await checkRes.json()) as Record<string, unknown>)
            : {};
          if (cancelled) return;
          const rawCost = Number(estimateBody.estimated_cost);
          const rawBudget = Number(checkBody.budget);
          setState({
            status: 'ready',
            estimatedCost: Number.isFinite(rawCost) ? rawCost : 0,
            currency:
              typeof estimateBody.currency === 'string'
                ? estimateBody.currency
                : 'USD',
            level:
              checkBody.level === 'warn' || checkBody.level === 'fail'
                ? checkBody.level
                : 'ok',
            budget: Number.isFinite(rawBudget) ? rawBudget : null,
            reasons: Array.isArray(checkBody.reasons)
              ? checkBody.reasons.map(String)
              : [],
            alternatives: Array.isArray(checkBody.alternatives)
              ? checkBody.alternatives.map(String)
              : [],
          });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'error' });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldenPath, active, artifact, paramsKey]);

  return state;
}

const LEVEL_LABEL: Record<Level, string> = {
  ok: 'Within budget',
  warn: 'Near budget',
  fail: 'Over budget',
};

/**
 * Pre-flight cost recap on the Review step — the same estimate the form
 * panel showed, surfaced once more right above Create so the Dev confirms
 * the cost at the moment of running. Renders nothing for non-golden-path
 * templates or when the estimate doesn't apply to the chosen branch.
 */
export function ReviewCostEstimate({
  formData,
}: {
  formData: Record<string, unknown>;
}) {
  const classes = useStyles();
  const goldenPath =
    typeof formData.costEstimate === 'string'
      ? formData.costEstimate
      : undefined;
  const state = useReviewCostEstimate(goldenPath, formData);

  if (state.status === 'idle') return null;

  if (state.status === 'loading') {
    return (
      <Box className={classes.root}>
        <Typography className={classes.muted}>Estimating run cost…</Typography>
      </Box>
    );
  }
  if (state.status === 'error') {
    return (
      <Box className={classes.root}>
        <Typography className={classes.muted}>
          Cost estimate unavailable right now.
        </Typography>
      </Box>
    );
  }

  const currency = state.currency ?? 'USD';
  const level = state.level ?? 'ok';
  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography className={classes.title}>Estimated cost</Typography>
        <Typography className={classes.amount}>
          {formatUsd(state.estimatedCost ?? 0, currency)}
        </Typography>
      </Box>
      {state.budget !== null && state.budget !== undefined && (
        <Box className={classes.row}>
          <Chip
            label={LEVEL_LABEL[level]}
            size="small"
            className={classes[level]}
          />
          <Typography className={classes.muted}>
            Budget {formatUsd(state.budget, currency)}
          </Typography>
        </Box>
      )}
      {(state.reasons ?? []).map((reason, index) => (
        <Typography key={index} className={classes.muted}>
          • {reason}
        </Typography>
      ))}
      {(state.alternatives ?? []).length > 0 && (
        <Typography className={classes.muted} style={{ marginTop: 4 }}>
          Alternatives: {(state.alternatives ?? []).join('; ')}
        </Typography>
      )}
      <Typography className={classes.muted} style={{ marginTop: 8 }}>
        Pre-flight estimate — the actual cost may differ.
      </Typography>
    </Box>
  );
}
