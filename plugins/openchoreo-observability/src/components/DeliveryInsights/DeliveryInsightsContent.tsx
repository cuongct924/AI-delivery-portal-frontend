import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Grid,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import RefreshIcon from '@material-ui/icons/Refresh';
import { Alert } from '@material-ui/lab';
import { Progress } from '@backstage/core-components';
import {
  DoraDeployment,
  DoraGranularity,
  DoraSearchScope,
  DoraWorkloadType,
} from '../../types';
import { useDoraInsights } from './useDoraInsights';
import { InsightsLevel, useDoraBreakdown } from './useDoraBreakdown';
import { useLatestDoraDeployment } from './useLatestDoraDeployment';
import { useDoraWorkloadBreakdown } from './useDoraWorkloadBreakdown';
import { DoraMetricTile } from './DoraMetricTile';
import { DoraTrendChart } from './DoraTrendChart';
import { DoraBreakdownTable } from './DoraBreakdownTable';
import { DoraEnvironmentCards } from './DoraEnvironmentCards';
import { ScopeFilters, type ScopeSelection } from '../ScopeFilters';
import { useNamespaceEnvironments } from '../CostInsights/useNamespaceEnvironments';
import {
  INSIGHTS_TIME_RANGES,
  WORKLOAD_TYPE_COLORS,
  WORKLOAD_TYPE_LABELS,
  buildWaterfallData,
  changeTypeMix,
  deploymentsPerWeek,
  deploymentVersionLabel,
  DEVOPS_ACCENT_COLOR,
  DoraWorkloadTypeFilter,
  failureRate,
  fillSeriesGaps,
  formatDurationMs,
  dataAvailabilityWarning,
  formatPercent,
  granularitiesForRange,
  isAiWorkload,
  leadTimeP50Ms,
  recoveryStrategyMix,
  resolveGranularity,
  measuredRates,
  nullUnmeasuredRates,
  workloadTypeCounts,
} from './utils';

type DoraLens = 'devops' | 'mlops';
type LensCardId = 'freq' | 'lead' | 'cfr' | 'mttr' | 'rework';
const WORKLOAD_TYPE_OPTIONS: DoraWorkloadTypeFilter[] = [
  'all',
  'service',
  'ml_model',
  'llm_app',
];
const NO_WORKLOAD_DATA_SUB =
  'No workload-classified deployments in this window yet.';

const GRANULARITY_LABELS: Record<DoraGranularity, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const CHART_COLORS = {
  deployments: '#1f77b4',
  leadTimeP50: '#2ca02c',
  leadTimeP75: '#66bb6a',
  leadTimeP95: '#98df8a',
  cfr: '#d62728',
  mttr: '#9467bd',
  reworkRate: '#e377c2',
  leadTimePhase: '#ff7f0e',
};

const useStyles = makeStyles(theme => ({
  filterBar: {
    flexWrap: 'wrap',
    rowGap: theme.spacing(1.5),
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(2),
  },
  filterDivider: {
    height: 32,
    alignSelf: 'center',
  },
  panel: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: theme.spacing(2, 2.25),
  },
  panelDim: {
    opacity: 0.5,
    pointerEvents: 'none',
  },
  compareRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    margin: theme.spacing(1.5, 0),
  },
  verCard: {
    flex: 1,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    padding: theme.spacing(1, 1.5),
    background: theme.palette.action.hover,
  },
  verCardCurrent: {
    borderColor: DEVOPS_ACCENT_COLOR,
  },
  metricDiff: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing(1.25),
  },
  diffTile: {
    background: theme.palette.action.hover,
    borderRadius: 9,
    padding: theme.spacing(1, 1.25),
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    background: theme.palette.action.hover,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  workloadGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing(2),
  },
  workloadCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    padding: theme.spacing(1.5, 1.75),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  workloadCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12.5,
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  workloadCardDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flex: 'none',
  },
  workloadCardValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  },
  workloadCardValue: {
    fontSize: 26,
    fontWeight: 700,
    fontFamily:
      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontVariantNumeric: 'tabular-nums',
  },
  workloadCardShare: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  workloadCardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11.5,
    color: theme.palette.text.secondary,
  },
}));

/**
 * The API reports a missing observer URL as a component-scoped error, but an
 * observability plane is platform-level: it is not something a namespace or a
 * project enables, it is either deployed or it is not. Nothing is broken
 * either -- the page just has no data source yet -- so say that once, plainly,
 * rather than repeating the API's scope-specific phrasing in red.
 */
const NOT_ENABLED_NOTICE =
  'No delivery metrics. Observability plane is not enabled.';

function isNotEnabled(error: string | null): boolean {
  return error !== null && /observability is not enabled/i.test(error);
}

const BREAKDOWN_LABELS: Record<
  InsightsLevel,
  { child: string; title: string }
> = {
  domain: { child: 'Project', title: 'Delivery performance by project' },
  system: { child: 'Component', title: 'Delivery performance by component' },
  component: {
    child: 'Environment',
    title: 'Delivery performance by environment',
  },
};

export interface DeliveryInsightsContentProps {
  /** Resolved query scope; null while the scope is still being resolved. */
  scope: DoraSearchScope | null;
  /** Scope level driving breakdown labels and sections; null while loading. */
  level: InsightsLevel | null;
  /** Scope selection lives in the filter bar, so the page owns the state. */
  onScopeChange: (next: ScopeSelection) => void;
  /** Trailing window length in days (see `INSIGHTS_TIME_RANGES`). */
  rangeDays: number;
  granularity: DoraGranularity;
  /** Environment name, or '' for all environments. */
  envFilter: string;
  workloadType: DoraWorkloadTypeFilter;
  onRangeDaysChange: (days: number) => void;
  onGranularityChange: (granularity: DoraGranularity) => void;
  onEnvFilterChange: (environment: string) => void;
  onWorkloadTypeChange: (workloadType: DoraWorkloadTypeFilter) => void;
  /**
   * Drill into a breakdown row one level down (a project or component). Absent
   * at component level, where rows are environments and apply as a filter.
   */
  onDrill?: (childName: string) => void;
}

/**
 * The Delivery Insights (DORA metrics) surface, per the Insights wireframe:
 * filter bar (range / granularity / environment), four KPI tiles with rating +
 * delta + sparkline, four trend charts, a one-level-down breakdown table, a
 * and a per-environment section. Serves the namespace, project, and component
 * levels — scope/level are the only differences between them.
 *
 * Fully controlled: the hosting page owns the filter state so it can keep it in
 * the URL, making a given view bookmarkable.
 */
export const DeliveryInsightsContent = ({
  scope,
  level,
  onScopeChange,
  rangeDays,
  granularity,
  envFilter,
  workloadType,
  onRangeDaysChange,
  onGranularityChange,
  onEnvFilterChange,
  onWorkloadTypeChange,
  onDrill,
}: DeliveryInsightsContentProps) => {
  const classes = useStyles();
  // The environment filter narrows the headline tiles/charts, and the
  // project/component breakdown children inherit it. The per-environment cards
  // below do not: they scope each card explicitly, so they stay a comparison
  // across environments whatever the filter says.
  const effectiveScope = useMemo((): DoraSearchScope | null => {
    if (!scope) {
      return null;
    }
    return envFilter ? { ...scope, environment: envFilter } : scope;
  }, [scope, envFilter]);

  const breakdown = useDoraBreakdown(
    level,
    level === 'component' ? scope : effectiveScope,
    rangeDays,
    granularity,
  );

  // Every request here is scoped to one environment, so none is made until the
  // filter holds one this namespace actually has. Without that the page opens
  // on an unscoped request -- and makes another after each namespace change,
  // which clears the filter -- asking for figures aggregated across
  // observability planes that no observer answers for, only to replace them a
  // moment later once the filter settles.
  const environmentReady =
    Boolean(envFilter) && breakdown.environments.includes(envFilter);

  const { data, loading, error, refetch } = useDoraInsights(
    environmentReady ? effectiveScope : null,
    rangeDays,
    granularity,
  );

  // Lead-time phase breakdown lives on individual deployment records, not the
  // aggregate summary — fetch the most recent one to drive the waterfall chart.
  const latestDeployment = useLatestDoraDeployment(
    environmentReady ? effectiveScope : null,
    rangeDays,
  );
  const waterfallData = useMemo(
    () => buildWaterfallData(latestDeployment?.leadTimeBreakdown),
    [latestDeployment],
  );

  const aiWorkloadSelected = isAiWorkload(workloadType);
  const lensLocked = !aiWorkloadSelected;

  const [lensByCard, setLensByCard] = useState<Record<LensCardId, DoraLens>>({
    freq: 'devops',
    lead: 'devops',
    cfr: 'devops',
    mttr: 'devops',
    rework: 'devops',
  });
  useEffect(() => {
    const next: DoraLens = aiWorkloadSelected ? 'mlops' : 'devops';
    setLensByCard({
      freq: next,
      lead: next,
      cfr: next,
      mttr: next,
      rework: next,
    });
  }, [aiWorkloadSelected]);
  const lensFor = (card: LensCardId): DoraLens =>
    lensLocked ? 'devops' : lensByCard[card];
  const lensControlFor = (card: LensCardId) => ({
    active: lensFor(card),
    locked: lensLocked,
    onChange: (next: DoraLens) =>
      setLensByCard(prev => ({ ...prev, [card]: next })),
  });

  const { deployments: allWorkloadDeployments } = useDoraWorkloadBreakdown(
    environmentReady ? effectiveScope : null,
    rangeDays,
  );
  const workloadDeployments = useMemo(
    () =>
      aiWorkloadSelected
        ? allWorkloadDeployments.filter(d => d.workloadType === workloadType)
        : [],
    [allWorkloadDeployments, aiWorkloadSelected, workloadType],
  );
  const workloadCounts = useMemo(
    () => workloadTypeCounts(allWorkloadDeployments),
    [allWorkloadDeployments],
  );
  const workloadStats = useMemo(() => {
    const totalCount = Object.values(workloadCounts).reduce((a, b) => a + b, 0);
    const stats: Record<
      DoraWorkloadType,
      { count: number; sharePct: number; failRate: number | null; leadP50: number | null }
    > = {
      service: { count: 0, sharePct: 0, failRate: null, leadP50: null },
      ml_model: { count: 0, sharePct: 0, failRate: null, leadP50: null },
      llm_app: { count: 0, sharePct: 0, failRate: null, leadP50: null },
    };
    (['service', 'ml_model', 'llm_app'] as const).forEach(wl => {
      const forType = allWorkloadDeployments.filter(d => d.workloadType === wl);
      stats[wl] = {
        count: workloadCounts[wl],
        sharePct: totalCount > 0 ? Math.round((workloadCounts[wl] / totalCount) * 100) : 0,
        failRate: failureRate(forType),
        leadP50: leadTimeP50Ms(forType),
      };
    });
    return stats;
  }, [allWorkloadDeployments, workloadCounts]);
  const workloadChangeMix = useMemo(
    () => (lensLocked ? [] : changeTypeMix(workloadDeployments)),
    [lensLocked, workloadDeployments],
  );
  const workloadRecoveryMix = useMemo(
    () => (lensLocked ? [] : recoveryStrategyMix(workloadDeployments)),
    [lensLocked, workloadDeployments],
  );
  const workloadFreqPerWeek = deploymentsPerWeek(workloadDeployments, rangeDays);
  const workloadLeadP50 = leadTimeP50Ms(workloadDeployments);
  const workloadFailRate = failureRate(workloadDeployments);

  const currentDeployment = workloadDeployments[0] ?? null;
  const baselineOptions = useMemo(() => {
    const seen = new Map<string, DoraDeployment>();
    for (const deployment of workloadDeployments.slice(1)) {
      const label = deploymentVersionLabel(deployment);
      if (!seen.has(label)) {
        seen.set(label, deployment);
      }
    }
    return Array.from(seen.entries());
  }, [workloadDeployments]);

  const [baselineEnabled, setBaselineEnabled] = useState(false);
  const [baselineVersion, setBaselineVersion] = useState('');
  useEffect(() => {
    if (!baselineOptions.some(([label]) => label === baselineVersion)) {
      setBaselineVersion(baselineOptions[0]?.[0] ?? '');
    }
  }, [baselineOptions, baselineVersion]);
  const baselineDeployment =
    baselineOptions.find(([label]) => label === baselineVersion)?.[1] ?? null;
  const showBaselinePanel =
    baselineEnabled && aiWorkloadSelected && currentDeployment && baselineDeployment;

  const deploymentInfoByName = useMemo(() => {
    if (level === 'component') {
      return new Map<string, { workloadType: DoraWorkloadType | null | undefined; version: string }>();
    }
    const latestByName = new Map<string, DoraDeployment>();
    for (const deployment of allWorkloadDeployments) {
      const key =
        level === 'domain' ? deployment.projectName : deployment.componentName;
      const existing = latestByName.get(key);
      if (!existing || deployment.deployedAt > existing.deployedAt) {
        latestByName.set(key, deployment);
      }
    }
    const result = new Map<
      string,
      { workloadType: DoraWorkloadType | null | undefined; version: string }
    >();
    latestByName.forEach((deployment, key) => {
      result.set(key, {
        workloadType: deployment.workloadType,
        version: deploymentVersionLabel(deployment),
      });
    });
    return result;
  }, [allWorkloadDeployments, level]);

  // The breakdown knows which environments have data, but only by name. The
  // catalog holds the display name, which is what every other filter shows
  // (logs, metrics, cost), so look it up and fall back to the name.
  const { environments: catalogEnvironments } = useNamespaceEnvironments(
    scope?.namespace,
  );
  const environmentLabel = useMemo(() => {
    const byName = new Map(
      catalogEnvironments.map(env => [env.name, env.displayName || env.name]),
    );
    return (name: string) => byName.get(name) ?? name;
  }, [catalogEnvironments]);

  // The breakdown issues its own metric requests, so a refresh has to reload
  // both or the table and env cards keep showing an older snapshot than the
  // tiles and charts.
  const refetchBreakdown = breakdown.refetch;
  const refreshAll = useCallback(() => {
    refetch();
    refetchBreakdown();
  }, [refetch, refetchBreakdown]);

  // `leadTime`/`mttr` only include buckets that had data; align them to the
  // zero-filled deployment-frequency buckets so missing periods render as gaps
  // instead of the line bridging across them.
  const buckets = data?.series?.deploymentFrequency;
  const leadTimeSeries = useMemo(
    () =>
      fillSeriesGaps(buckets, data?.series?.leadTime, [
        'p50Ms',
        'p75Ms',
        'p95Ms',
      ]),
    [buckets, data?.series?.leadTime],
  );
  const mttrSeries = useMemo(
    () => fillSeriesGaps(buckets, data?.series?.mttr, ['meanMs']),
    [buckets, data?.series?.mttr],
  );
  // Every query is scoped to one environment. A namespace's environments can sit
  // on different observability planes, and no single observer answers for all of
  // them, so there is no combined view to offer -- settle on the first available
  // rather than leaving an unscoped state that cannot be served.
  useEffect(() => {
    if (!envFilter && breakdown.environments.length > 0) {
      onEnvFilterChange(breakdown.environments[0]);
    }
  }, [envFilter, breakdown.environments, onEnvFilterChange]);

  const granularityOptions = useMemo(
    () => granularitiesForRange(rangeDays),
    [rangeDays],
  );
  // Changing the range can strand the granularity on a value it no longer
  // offers, which would leave the control showing a selection that is not in
  // its own list. Move it to the nearest one that fits.
  useEffect(() => {
    const resolved = resolveGranularity(rangeDays, granularity);
    if (resolved !== granularity) {
      onGranularityChange(resolved);
    }
  }, [rangeDays, granularity, onGranularityChange]);

  const configWarning = dataAvailabilityWarning(data?.dataAvailability);
  const notEnabled = isNotEnabled(error);
  // The banner above already explains a missing observability plane, so don't
  // repeat it in red under the breakdown; fall through to its empty state.
  const breakdownError = isNotEnabled(breakdown.error) ? null : breakdown.error;
  const cfrSeries = useMemo(
    () => nullUnmeasuredRates(data?.series?.changeFailureRate),
    [data?.series?.changeFailureRate],
  );
  const cfrSparkData = useMemo(
    () => measuredRates(data?.series?.changeFailureRate),
    [data?.series?.changeFailureRate],
  );
  const reworkSeries = useMemo(
    () => nullUnmeasuredRates(data?.series?.reworkRate),
    [data?.series?.reworkRate],
  );
  const reworkSparkData = useMemo(
    () => measuredRates(data?.series?.reworkRate),
    [data?.series?.reworkRate],
  );

  if (!scope || !level) {
    return <Progress />;
  }

  const summary = data?.summary;
  const series = data?.series;
  const frequency = summary?.deploymentFrequency;
  const leadTime = summary?.leadTime;
  const cfr = summary?.changeFailureRate;
  const mttr = summary?.mttr;
  const cmpLabel = `vs prev ${
    INSIGHTS_TIME_RANGES.find(r => r.days === rangeDays)?.label ?? ''
  }`;
  const labels = BREAKDOWN_LABELS[level];

  const workloadCopy = (mlModelText: string, llmText: string) =>
    workloadType === 'ml_model' ? mlModelText : llmText;

  const freqLens = lensFor('freq');
  const freqIsMlops = freqLens === 'mlops';
  const freqNoData = freqIsMlops && workloadDeployments.length === 0;
  let freqValue: string;
  let freqSub: string | undefined;
  if (freqIsMlops) {
    freqValue = freqNoData ? '—' : `${workloadFreqPerWeek.toFixed(1)}/wk`;
    freqSub = freqNoData
      ? NO_WORKLOAD_DATA_SUB
      : workloadCopy(
          'model weight promotions to serving',
          'prompt, RAG-index & fine-tune releases',
        );
  } else {
    freqValue = frequency ? `${frequency.perDay.toFixed(2)}/day` : '—';
    freqSub = frequency
      ? `${frequency.total} deployments · ${cmpLabel}`
      : undefined;
  }

  const leadLens = lensFor('lead');
  const leadIsMlops = leadLens === 'mlops';
  const leadNoData = leadIsMlops && workloadLeadP50 === null;
  const leadValue = leadIsMlops
    ? formatDurationMs(workloadLeadP50)
    : formatDurationMs(leadTime?.p50Ms);
  let leadSub: string | undefined;
  if (leadIsMlops) {
    leadSub = leadNoData
      ? NO_WORKLOAD_DATA_SUB
      : workloadCopy(
          'data prep → train → eval → serving (p50)',
          'prompt/RAG change → live (p50)',
        );
  } else {
    leadSub = leadTime
      ? `p50, commit→deploy · ${Math.round(leadTime.coverage * 100)}% commit coverage`
      : undefined;
  }

  const cfrLens = lensFor('cfr');
  const cfrIsMlops = cfrLens === 'mlops';
  const cfrMlopsRate = cfr?.semanticCfr ?? workloadFailRate;
  const cfrNoData = cfrIsMlops && cfrMlopsRate === null;
  let cfrValue: string;
  let cfrSub: string | undefined;
  if (cfrIsMlops) {
    cfrValue = cfrNoData ? '—' : formatPercent(cfrMlopsRate);
    cfrSub = cfrNoData
      ? NO_WORKLOAD_DATA_SUB
      : 'accuracy drop, drift or guardrail-block';
  } else {
    cfrValue = cfr && cfr.total > 0 ? formatPercent(cfr.rate) : '—';
    cfrSub = cfr ? `${cfr.failed} of ${cfr.total} failed` : undefined;
  }
  const cfrSemanticDriven =
    cfrIsMlops &&
    (cfr?.semanticCfr ?? 0) > (cfr?.infraCfr ?? 0) &&
    (cfr?.semanticCfr ?? 0) > 0;

  const mttrLens = lensFor('mttr');
  const mttrIsMlops = mttrLens === 'mlops';
  const mttrSubFallback = mttr
    ? `incident → restore · ${mttr.recoveries} recoveries`
    : undefined;
  const mttrSub = mttrIsMlops
    ? workloadCopy(
        'rollback to prior model version or retrain re-run',
        'prompt rollback or guardrail patch',
      )
    : mttrSubFallback;

  const reworkLens = lensFor('rework');
  const reworkIsMlops = reworkLens === 'mlops';
  const reworkSummary = summary?.reworkRate;
  const reworkValue =
    reworkSummary && reworkSummary.total > 0
      ? formatPercent(reworkSummary.rate)
      : '—';
  const reworkSubFallback = reworkSummary
    ? `${reworkSummary.reworked} of ${reworkSummary.total} needed rework`
    : 'Awaiting reworkCount/reworkWindowMs from the observer';
  const reworkSub = reworkIsMlops
    ? workloadCopy(
        'retraining re-run within 24h of eval regression',
        'prompt or RAG-index patched again within 24h',
      )
    : reworkSubFallback;

  return (
    <Box>
      <Box
        display="flex"
        alignItems="center"
        className={classes.filterBar}
        style={{ gap: 12 }}
        mb={2}
      >
        <ScopeFilters
          scope={scope ?? {}}
          onScopeChange={onScopeChange}
          queryKeyPrefix="insights-scope"
        />
        <TextField
          select
          size="small"
          variant="outlined"
          label="Workload type"
          value={workloadType}
          onChange={event =>
            onWorkloadTypeChange(event.target.value as DoraWorkloadTypeFilter)
          }
          style={{ minWidth: 160 }}
        >
          {WORKLOAD_TYPE_OPTIONS.map(option => (
            <MenuItem key={option} value={option}>
              {WORKLOAD_TYPE_LABELS[option]}
            </MenuItem>
          ))}
        </TextField>

        <Divider orientation="vertical" flexItem className={classes.filterDivider} />

        <TextField
          select
          size="small"
          variant="outlined"
          label="Time range"
          value={rangeDays}
          onChange={event => onRangeDaysChange(Number(event.target.value))}
          // Sized to the label rather than the value: "90d" is narrower than
          // "Time range", and an outlined label that does not fit wraps.
          style={{ minWidth: 130 }}
        >
          {INSIGHTS_TIME_RANGES.map(option => (
            <MenuItem key={option.days} value={option.days}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          variant="outlined"
          label="Granularity"
          value={granularity}
          onChange={event =>
            onGranularityChange(event.target.value as DoraGranularity)
          }
          style={{ minWidth: 130 }}
        >
          {granularityOptions.map(option => (
            <MenuItem key={option} value={option}>
              {GRANULARITY_LABELS[option]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          variant="outlined"
          label="Environment"
          value={envFilter}
          onChange={event => onEnvFilterChange(event.target.value)}
          style={{ minWidth: 160 }}
        >
          {breakdown.environments.map(env => (
            <MenuItem key={env} value={env}>
              {environmentLabel(env)}
            </MenuItem>
          ))}
        </TextField>

        <Box flexGrow={1} />

        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={refreshAll}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Box mb={2}>
          {notEnabled ? (
            <Alert severity="info">{NOT_ENABLED_NOTICE}</Alert>
          ) : (
            <Alert severity="error">{error}</Alert>
          )}
        </Box>
      )}

      {!error && configWarning && (
        <Box mb={2}>
          <Alert severity="info">{configWarning}</Alert>
        </Box>
      )}

      {loading && !data ? (
        <Progress />
      ) : (
        <>
          <Box className={classes.metricsGrid}>
            <DoraMetricTile
              title="Deployment Frequency"
              value={freqValue}
              classification={frequency?.classification ?? 'Unknown'}
              deltaPct={frequency?.deltaPct ?? null}
              positiveDeltaIsGood
              subText={freqSub}
              sparkData={series?.deploymentFrequency?.map(p => p.count)}
              lens={lensControlFor('freq')}
              breakdown={freqIsMlops ? workloadChangeMix : undefined}
            />
            <DoraMetricTile
              title="Lead Time for Changes"
              value={leadValue}
              classification={leadTime?.classification ?? 'Unknown'}
              deltaPct={leadTime?.deltaPct ?? null}
              positiveDeltaIsGood={false}
              subText={leadSub}
              sparkData={series?.leadTime?.map(p => p.p50Ms)}
              lens={lensControlFor('lead')}
              breakdown={leadIsMlops ? workloadChangeMix : undefined}
            />
            <DoraMetricTile
              title="Change Failure Rate"
              value={cfrValue}
              classification={cfr?.classification ?? 'Unknown'}
              deltaPct={cfr?.deltaPct ?? null}
              positiveDeltaIsGood={false}
              subText={cfrSub}
              sparkData={cfrSparkData}
              secondaryBadge={
                cfrSemanticDriven
                  ? { label: 'Semantic-driven', tone: 'warning' }
                  : undefined
              }
              lens={lensControlFor('cfr')}
              breakdown={cfrIsMlops ? workloadChangeMix : undefined}
            />
            <DoraMetricTile
              title="Mean Time to Recovery"
              value={formatDurationMs(mttr?.meanMs)}
              classification={mttr?.classification ?? 'Unknown'}
              deltaPct={mttr?.deltaPct ?? null}
              positiveDeltaIsGood={false}
              subText={mttrSub}
              sparkData={series?.mttr?.map(p => p.meanMs)}
              lens={lensControlFor('mttr')}
              breakdown={mttrIsMlops ? workloadRecoveryMix : undefined}
            />
            <DoraMetricTile
              title="Deployment Rework Rate"
              value={reworkValue}
              classification={reworkSummary?.classification ?? 'Unknown'}
              deltaPct={reworkSummary?.deltaPct ?? null}
              positiveDeltaIsGood={false}
              subText={reworkSub}
              sparkData={reworkSparkData}
              lens={lensControlFor('rework')}
            />
          </Box>

          <Box mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <DoraTrendChart
                  title="Deployment Frequency"
                  granularity={granularity}
                  data={series?.deploymentFrequency ?? []}
                  series={[
                    {
                      dataKey: 'count',
                      label: 'Deployments',
                      color: CHART_COLORS.deployments,
                    },
                  ]}
                  variant="bar"
                  valueFormatter={value => `${value}`}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DoraTrendChart
                  title="Lead Time for Changes"
                  granularity={granularity}
                  data={leadTimeSeries}
                  series={[
                    {
                      dataKey: 'p50Ms',
                      label: 'p50',
                      color: CHART_COLORS.leadTimeP50,
                    },
                    {
                      dataKey: 'p75Ms',
                      label: 'p75',
                      color: CHART_COLORS.leadTimeP75,
                    },
                    {
                      dataKey: 'p95Ms',
                      label: 'p95',
                      color: CHART_COLORS.leadTimeP95,
                    },
                  ]}
                  variant="line"
                  valueFormatter={formatDurationMs}
                  emptyMessage="No deployments with commit provenance in the selected window"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DoraTrendChart
                  title="Change Failure Rate"
                  granularity={granularity}
                  data={cfrSeries}
                  series={[
                    {
                      dataKey: 'rate',
                      label: 'Failure rate',
                      color: CHART_COLORS.cfr,
                    },
                  ]}
                  variant="line"
                  valueFormatter={value => formatPercent(value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DoraTrendChart
                  title="Mean Time to Recovery"
                  granularity={granularity}
                  data={mttrSeries}
                  series={[
                    {
                      dataKey: 'meanMs',
                      label: 'MTTR',
                      color: CHART_COLORS.mttr,
                    },
                  ]}
                  variant="line"
                  valueFormatter={formatDurationMs}
                  emptyMessage="No recovery episodes in the selected window"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DoraTrendChart
                  title="Deployment Rework Rate"
                  granularity={granularity}
                  data={reworkSeries}
                  series={[
                    {
                      dataKey: 'rate',
                      label: 'Rework rate',
                      color: CHART_COLORS.reworkRate,
                    },
                  ]}
                  variant="line"
                  valueFormatter={value => formatPercent(value)}
                  emptyMessage="Awaiting reworkCount/reworkWindowMs from the observer"
                />
              </Grid>
              {waterfallData.length > 0 && (
                <Grid item xs={12} md={6}>
                  <DoraTrendChart
                    title="Lead Time Phase Breakdown"
                    granularity={granularity}
                    data={waterfallData}
                    series={[
                      {
                        dataKey: 'value',
                        label: 'Phase duration',
                        color: CHART_COLORS.leadTimePhase,
                      },
                    ]}
                    variant="waterfall"
                    valueFormatter={formatDurationMs}
                  />
                </Grid>
              )}
            </Grid>
          </Box>

          {aiWorkloadSelected && (
          <>
          <Box
            mt={3}
            mb={1.5}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            style={{ gap: 12 }}
          >
            <Typography variant="subtitle1" style={{ fontWeight: 650 }}>
              Version baseline comparison
            </Typography>
            <Box display="flex" alignItems="center" style={{ gap: 8 }}>
              <Typography variant="caption" color="textSecondary" noWrap>
                Compare to baseline
              </Typography>
              <Switch
                size="small"
                color="primary"
                checked={baselineEnabled}
                onChange={event => setBaselineEnabled(event.target.checked)}
              />
              {baselineEnabled && (
                <TextField
                  select
                  size="small"
                  variant="outlined"
                  value={baselineVersion}
                  onChange={event => setBaselineVersion(event.target.value)}
                  disabled={baselineOptions.length === 0}
                  style={{ minWidth: 140 }}
                >
                  {baselineOptions.map(([label]) => (
                    <MenuItem key={label} value={label}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Box>
          </Box>
          <Box
            className={`${classes.panel} ${
              showBaselinePanel ? '' : classes.panelDim
            }`}
          >
            <Typography variant="caption" color="textSecondary">
              Model quality, not delivery process — kept separate from the
              DORA cards above on purpose.
            </Typography>
            {currentDeployment && baselineDeployment ? (
              <>
                <Box className={classes.compareRow}>
                  <Box className={`${classes.verCard} ${classes.verCardCurrent}`}>
                    <Typography variant="caption" color="textSecondary">
                      CURRENT
                    </Typography>
                    <Typography variant="body2" style={{ fontWeight: 600 }}>
                      {deploymentVersionLabel(currentDeployment)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary">
                    ⇄
                  </Typography>
                  <Box className={classes.verCard}>
                    <Typography variant="caption" color="textSecondary">
                      BASELINE
                    </Typography>
                    <Typography variant="body2" style={{ fontWeight: 600 }}>
                      {deploymentVersionLabel(baselineDeployment)}
                    </Typography>
                  </Box>
                </Box>
                <Box className={classes.metricDiff}>
                  <Box className={classes.diffTile}>
                    <Typography variant="caption" color="textSecondary">
                      Eval score
                    </Typography>
                    <Typography variant="body2" style={{ fontWeight: 700 }}>
                      {baselineDeployment.evalScore ?? '—'} →{' '}
                      {currentDeployment.evalScore ?? '—'}
                    </Typography>
                  </Box>
                  <Box className={classes.diffTile}>
                    <Typography variant="caption" color="textSecondary">
                      Drift score
                    </Typography>
                    <Typography variant="body2" style={{ fontWeight: 700 }}>
                      {baselineDeployment.driftScore ?? '—'} →{' '}
                      {currentDeployment.driftScore ?? '—'}
                    </Typography>
                  </Box>
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
                Turn on "Compare to baseline" and pick a version to compare.
              </Typography>
            )}
          </Box>
          </>
          )}

          <Box mt={3} mb={1.5}>
            <Typography variant="subtitle1" style={{ fontWeight: 650 }}>
              Deployments by workload type
            </Typography>
          </Box>
          <Box className={classes.panel}>
            <Box className={classes.workloadGrid}>
              {(['service', 'ml_model', 'llm_app'] as const).map(wl => {
                const stat = workloadStats[wl];
                const color = WORKLOAD_TYPE_COLORS[wl];
                return (
                  <Box key={wl} className={classes.workloadCard}>
                    <Box className={classes.workloadCardHeader}>
                      <Box
                        className={classes.workloadCardDot}
                        style={{ background: color }}
                      />
                      {WORKLOAD_TYPE_LABELS[wl]}
                    </Box>
                    <Box className={classes.workloadCardValueRow}>
                      <span className={classes.workloadCardValue}>
                        {stat.count}
                      </span>
                      <span className={classes.workloadCardShare}>
                        {stat.sharePct}% of deployments
                      </span>
                    </Box>
                    <Box className={classes.barTrack}>
                      <Box
                        className={classes.barFill}
                        style={{ width: `${stat.sharePct}%`, background: color }}
                      />
                    </Box>
                    <Box className={classes.workloadCardMeta}>
                      <span>Change failure rate</span>
                      <b>{formatPercent(stat.failRate)}</b>
                    </Box>
                    <Box className={classes.workloadCardMeta}>
                      <span>Lead time p50</span>
                      <b>{formatDurationMs(stat.leadP50)}</b>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ display: 'block', marginTop: 12 }}
            >
              {rangeDays}d window, current scope
            </Typography>
          </Box>


          <Box mt={3} mb={1.5}>
            <Typography variant="subtitle1" style={{ fontWeight: 650 }}>
              {labels.title}
            </Typography>
          </Box>
          <DoraBreakdownTable
            childLabel={labels.child}
            rows={breakdown.rows}
            loading={breakdown.loading}
            error={breakdownError}
            onDrill={level === 'component' ? undefined : onDrill}
            onSelectEnvironment={
              level === 'component' ? onEnvFilterChange : undefined
            }
            deploymentInfoByName={
              level === 'component' ? undefined : deploymentInfoByName
            }
          />

          {/* Not gated on the environment filter. These cards slice the current
              scope per environment, each with its own explicitly scoped query, so
              they stay a comparison across environments while the charts above
              show the one that is selected. */}
          {level !== 'component' && breakdown.envRows.length > 0 && (
            <>
              <Box mt={3} mb={1.5}>
                <Typography variant="subtitle1" style={{ fontWeight: 650 }}>
                  Delivery performance by environment
                </Typography>
              </Box>
              <DoraEnvironmentCards rows={breakdown.envRows} />
            </>
          )}

          {data && (
            <Box mt={2}>
              <Typography variant="caption" color="textSecondary">
                Window {new Date(data.window.startTime).toLocaleDateString()} –{' '}
                {new Date(data.window.endTime).toLocaleDateString()} · generated{' '}
                {new Date(data.window.generatedAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};
