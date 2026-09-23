import { FC, lazy, Suspense, useCallback, useMemo, useState } from 'react';
import {
  Link as RouterLink,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { useApp } from '@backstage/core-plugin-api';
import { Page, Content, Header } from '@backstage/core-components';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { Box, Typography, makeStyles } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  PageLoader,
  RefreshOverlay,
} from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { TimeRangeFilter } from '@openchoreo/backstage-plugin-react';
import { parseUrlTimeRange, writeUrlTimeRange } from '../../utils/urlTimeRange';
import { CostInsightsScopeFilters } from './CostInsightsScopeFilters';
import {
  componentValue,
  projectValue,
  useResolvedScopeSelection,
} from './useCostScopeOptions';
import { expandSelection } from './costAggregation';
import {
  CostInsightsFilters,
  DEFAULT_GRANULARITY,
} from './CostInsightsFilters';
import { CostInsightsTable } from './CostInsightsTable';
import { CostInsightsGraphs } from './CostInsightsGraphs';
import { CostSummaryCards } from './CostSummaryCards';
import { CostActionPanel } from './CostActionPanel';
import { CostLifecycleWaterfall } from './CostLifecycleWaterfall';
import { CostBudgetDialog } from './CostBudgetDialog';
import { CostRateOptimization } from './CostRateOptimization';
import { CostSavingCard } from './CostSavingCard';
import { CostScorecard } from './CostScorecard';
import { useCostBudget } from './useCostBudget';
import { CostVarianceCard } from './CostVarianceCard';
import { CostZone } from './CostZone';
import { ForecastDivergenceChart } from './ForecastDivergenceChart';
import { useNamespaceEnvironments } from './useNamespaceEnvironments';
import { useDimensionTitles } from './useDimensionTitles';
import { useCostInsights } from './useCostInsights';
import {
  COST_DIMENSIONS,
  COST_STAGES,
  DEFAULT_COST_DIMENSION,
  DEFAULT_COST_STAGE,
  type CostComponentRef,
  type CostDimension,
  type CostInsightsData,
  type CostProjectRef,
  type CostScope,
  type CostScopeSelection,
  type CostStageFilter,
} from './types';

// Cost Analysis is a heavier feature (report views, FinOps chat). Load it lazily
// so it only enters the bundle when the Cost Analysis tab is opened.
const CostAnalysisPage = lazy(() =>
  import('../CostAnalysis').then(m => ({ default: m.CostAnalysisPage })),
);

const COST_DEFAULT_TIME_RANGE = '24h';
const COST_INSIGHTS_PATH = '/cost-insights';

// The catalog kind each table row maps to, so we reuse the app's registered
// kind icons (same symbols the catalog shows).
const LEVEL_KIND: Record<string, string> = {
  namespace: 'system', // rows are projects (Project = System)
  project: 'component',
  component: 'environment',
};

const useStyles = makeStyles(theme => ({
  section: { marginTop: theme.spacing(2) },
  // One line for every filter: scope (namespace/project/component) + stage +
  // group-by + environments + refresh.
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 0),
  },
  timeRangeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  },
  analysisContent: { marginTop: theme.spacing(3) },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tab: {
    padding: theme.spacing(1.5, 1),
    fontSize: 14,
    fontWeight: 500,
    color: theme.palette.text.secondary,
    textDecoration: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    '&:hover': { color: theme.palette.text.primary },
  },
  tabActive: {
    color: theme.palette.primary.main,
    borderBottomColor: theme.palette.primary.main,
    fontWeight: 600,
  },
}));

// The API's component-scoped "not enabled" message is wrong for this
// platform-level feature.
function friendlyCostError(message: string): string {
  return /observability is not enabled/i.test(message)
    ? 'Cost Insights have not been enabled'
    : message;
}

/**
 * Parse the multi-select scope from the URL. Reads the plural params
 * (`namespaces`/`projects`/`components`) and falls back to the legacy singular
 * params (`namespace`/`project`/`component`) so existing deep links still land
 * on the right scope. An empty tier means every item in it.
 */
function parseSelection(params: URLSearchParams): CostScopeSelection {
  const nsRaw = params.get('namespaces');
  const legacyNs = params.get('namespace');
  let namespaces: string[];
  if (nsRaw !== null) namespaces = nsRaw.split(',').filter(Boolean);
  else if (legacyNs) namespaces = [legacyNs];
  else namespaces = [];

  const projRaw = params.get('projects');
  const legacyProj = params.get('project');
  let projects: CostProjectRef[];
  if (projRaw !== null) {
    projects = projRaw
      .split(',')
      .filter(Boolean)
      .map(v => {
        const [namespace, name] = v.split('/');
        return { namespace, name };
      });
  } else if (legacyProj && namespaces.length > 0) {
    projects = [{ namespace: namespaces[0], name: legacyProj }];
  } else {
    projects = [];
  }

  const compRaw = params.get('components');
  const legacyComp = params.get('component');
  let components: CostComponentRef[];
  if (compRaw !== null) {
    components = compRaw
      .split(',')
      .filter(Boolean)
      .map(v => {
        const [namespace, project, name] = v.split('/');
        return { namespace, project, name };
      });
  } else if (legacyComp && projects.length > 0) {
    components = [
      {
        namespace: projects[0].namespace,
        project: projects[0].name,
        name: legacyComp,
      },
    ];
  } else {
    components = [];
  }

  return { namespaces, projects, components };
}

function writeSelection(params: URLSearchParams, sel: CostScopeSelection) {
  // Drop the legacy singular params so the plural ones are the single source.
  params.delete('namespace');
  params.delete('project');
  params.delete('component');
  if (sel.namespaces.length) {
    params.set('namespaces', sel.namespaces.join(','));
  } else {
    params.delete('namespaces');
  }
  if (sel.projects.length) {
    params.set('projects', sel.projects.map(projectValue).join(','));
  } else {
    params.delete('projects');
  }
  if (sel.components.length) {
    params.set('components', sel.components.map(componentValue).join(','));
  } else {
    params.delete('components');
  }
}

// Reads the multi-select cost scope + a generic param updater from the URL,
// shared by the page header, the filters, and both tabs.
function useCostSelection() {
  const [searchParams, setSearchParams] = useSearchParams();

  const selection = useMemo(() => parseSelection(searchParams), [searchParams]);

  const update = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutator(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setSelection = useCallback(
    (next: CostScopeSelection) => {
      update(params => {
        const namespacesChanged =
          next.namespaces.length !== selection.namespaces.length ||
          next.namespaces.some(n => !selection.namespaces.includes(n));
        writeSelection(params, next);
        // Environments belong to a namespace, so reset the selection when the
        // namespace set changes (the previous names may not all exist now).
        if (namespacesChanged) params.delete('envs');
      });
    },
    [update, selection.namespaces],
  );

  return { selection, setSelection, update, searchParams };
}

interface InsightsTabProps {
  data: CostInsightsData | undefined;
  loading: boolean;
  isRefetching: boolean;
  error: string | null;
  scopeLoading: boolean;
  envsLoading: boolean;
  envsError: string | null;
  selectedEnvironments: string[];
  noScope: boolean;
  noEnvironments: boolean;
  timeRange: string;
  customStartTime?: string;
  customEndTime?: string;
  onTimeRangeChange: (next: {
    timeRange: string;
    customStartTime?: string;
    customEndTime?: string;
  }) => void;
  granularity: string;
  onGranularityChange: (next: string) => void;
  titles: Record<string, string>;
  optimizeScope?: CostScope;
  scopes: CostScope[];
  stage: CostStageFilter;
  onSetBudget: () => void;
  refresh: () => void;
}

// The "Insights" tab: cost table/graph views. All state lives on the page so
// the filter row can sit on one line above the tab bar.
const CostInsightsInsightsTab: FC<InsightsTabProps> = ({
  data,
  loading,
  isRefetching,
  error,
  scopeLoading,
  envsLoading,
  envsError,
  selectedEnvironments,
  noScope,
  noEnvironments,
  timeRange,
  customStartTime,
  customEndTime,
  onTimeRangeChange,
  granularity,
  onGranularityChange,
  titles,
  optimizeScope,
  scopes,
  stage,
  onSetBudget,
  refresh,
}) => {
  const classes = useStyles();
  const app = useApp();

  return (
    <>
      {noScope && (
        <Box className={classes.section}>
          <Alert severity="info">
            No namespaces found to show cost insights for.
          </Alert>
        </Box>
      )}

      {envsError && (
        <Box className={classes.section}>
          <Alert severity="error">{friendlyCostError(envsError)}</Alert>
        </Box>
      )}

      {noEnvironments && (
        <Box className={classes.section}>
          <Alert severity="info">
            No environments found for the selected namespaces.
          </Alert>
        </Box>
      )}

      {!noScope &&
        !noEnvironments &&
        selectedEnvironments.length === 0 &&
        !envsLoading && (
          <Box className={classes.section}>
            <Alert severity="info">
              Select one or more environments to view cost insights.
            </Alert>
          </Box>
        )}

      {error && (
        <Box className={classes.section}>
          <Alert severity="error">{friendlyCostError(error)}</Alert>
        </Box>
      )}

      {(loading || scopeLoading) && <PageLoader />}

      {!loading && data && (
        <Box position="relative">
          <RefreshOverlay active={isRefetching} label="Refreshing cost data" />

          <CostZone
            id="cost-inform"
            step="Inform"
            title="Visibility"
            subtitle="What are we spending, and on what?"
          >
            <Box className={classes.section}>
              <CostSummaryCards summary={data.summary} />
            </Box>
            <Box className={classes.section}>
              <CostLifecycleWaterfall summary={data.summary} />
            </Box>
            {/* Forecast covers the whole month, so it sits above the time range. */}
            <Box className={classes.section}>
              <ForecastDivergenceChart
                forecast={data.forecast}
                budget={data.budget?.amount ?? null}
              />
            </Box>
            {/* Planning & estimating is an Inform capability, so the estimate
                vs actual sits with the forecast, not down in Operate. */}
            <Box className={classes.section}>
              <CostVarianceCard
                timeRange={timeRange}
                customStartTime={customStartTime}
                customEndTime={customEndTime}
              />
            </Box>
            <Box className={`${classes.section} ${classes.timeRangeRow}`}>
              <Typography variant="body2" color="textSecondary">
                Time range for everything below
              </Typography>
              <TimeRangeFilter
                value={timeRange}
                customStartTime={customStartTime}
                customEndTime={customEndTime}
                onChange={onTimeRangeChange}
              />
            </Box>
            <Box className={classes.section}>
              <CostInsightsGraphs
                data={data}
                granularity={granularity}
                onGranularityChange={onGranularityChange}
              />
            </Box>
            {/* Cost allocation is Reporting & Analytics — an Inform capability. */}
            <Box className={classes.section}>
              <CostInsightsTable
                level={data.level}
                rows={data.rows}
                icon={app.getSystemIcon(`kind:${LEVEL_KIND[data.level]}`)}
                titles={titles}
                scope={optimizeScope}
                onOptimized={refresh}
                singleComponent={
                  data.level === 'component' && scopes.length === 1
                }
                stage={stage}
                mode="allocation"
              />
            </Box>
          </CostZone>

          <CostZone
            id="cost-optimize"
            step="Optimize"
            title="Right-sizing"
            subtitle="What can we improve?"
          >
            <Box className={classes.section}>
              <CostSavingCard totalSaving={data.summary.totalSaving} />
            </Box>
            <Box className={classes.section}>
              <CostInsightsTable
                level={data.level}
                rows={data.recommendationRows}
                icon={app.getSystemIcon(`kind:${LEVEL_KIND[data.level]}`)}
                titles={titles}
                scope={optimizeScope}
                onOptimized={refresh}
                singleComponent={
                  data.level === 'component' && scopes.length === 1
                }
                stage={stage}
                mode="recommendation"
              />
            </Box>
            <Box className={classes.section}>
              <CostRateOptimization
                timeRange={timeRange}
                customStartTime={customStartTime}
                customEndTime={customEndTime}
              />
            </Box>
          </CostZone>

          <CostZone
            id="cost-operate"
            step="Operate"
            title="Action needed"
            subtitle="What needs a decision now?"
          >
            <Box className={classes.section}>
              <CostScorecard summary={data.summary} onSetBudget={onSetBudget} />
            </Box>
            <Box className={classes.section}>
              <CostActionPanel
                anomalies={data.anomalies ?? []}
                budget={data.budget ?? null}
                forecastTotal={data.summary.forecastTotal ?? null}
                totalSaving={data.summary.totalSaving}
              />
            </Box>
          </CostZone>
        </Box>
      )}

      {!loading && !data && !error && !noScope && !noEnvironments && (
        <Box className={classes.section}>
          <Typography color="textSecondary">
            Select a scope and environments to view cost insights.
          </Typography>
        </Box>
      )}
    </>
  );
};

// The "Cost Analysis" tab (FinOps reports). It reads its project/namespace from
// entity context, so we synthesize a System entity from the single selected
// project; it's only available when exactly one project is in scope.
const CostAnalysisTab = () => {
  const classes = useStyles();
  const { selection } = useCostSelection();
  const { resolved } = useResolvedScopeSelection(selection);

  const project =
    resolved.projects.length === 1 ? resolved.projects[0] : undefined;

  const syntheticEntity: Entity | undefined = useMemo(
    () =>
      project
        ? {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'System',
            metadata: {
              name: project.name,
              // OpenChoreo catalog entities live in the default catalog namespace.
              namespace: 'default',
              annotations: {
                [CHOREO_ANNOTATIONS.NAMESPACE]: project.namespace,
              },
            },
            spec: {},
          }
        : undefined,
    [project],
  );

  if (!syntheticEntity) {
    return (
      <Box className={classes.section}>
        <Alert severity="info">
          Select a single project to view its cost analysis reports.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className={classes.analysisContent}>
      <EntityProvider entity={syntheticEntity}>
        <Suspense fallback={<PageLoader />}>
          <CostAnalysisPage />
        </Suspense>
      </EntityProvider>
    </Box>
  );
};

const CostInsightsTabBar = () => {
  const classes = useStyles();
  const location = useLocation();
  const analysisPath = `${COST_INSIGHTS_PATH}/cost-analysis`;
  const onCostAnalysis =
    location.pathname === analysisPath ||
    location.pathname.startsWith(`${analysisPath}/`);
  const tabClass = (active: boolean) =>
    active ? `${classes.tab} ${classes.tabActive}` : classes.tab;

  return (
    <Box className={classes.tabBar} role="tablist">
      <RouterLink
        to={{ pathname: COST_INSIGHTS_PATH, search: location.search }}
        className={tabClass(!onCostAnalysis)}
        role="tab"
        aria-selected={!onCostAnalysis}
      >
        Insights
      </RouterLink>
      <RouterLink
        to={{
          pathname: analysisPath,
          search: location.search,
        }}
        className={tabClass(onCostAnalysis)}
        role="tab"
        aria-selected={onCostAnalysis}
      >
        Analysis Reports
      </RouterLink>
    </Box>
  );
};

export const CostInsightsPage = () => {
  const classes = useStyles();
  // Optional monthly budget for the scope, so the forecast can show burn
  // against it. Absent means the budget cards stay hidden.
  const { budget, setBudget } = useCostBudget();
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const location = useLocation();
  const { selection, setSelection, update, searchParams } = useCostSelection();
  const onInsightsTab = !location.pathname.startsWith(
    `${COST_INSIGHTS_PATH}/cost-analysis`,
  );

  // Resolved against the catalog so the scope matches what the dropdowns show.
  const { resolved, loading: scopeLoading } =
    useResolvedScopeSelection(selection);
  const { level, scopes: resolvedScopes } = expandSelection(resolved);
  // A half-resolved selection would query the parent scope and be superseded
  // the moment a child tier's options land, so hold until the scope settles.
  const scopes = scopeLoading ? [] : resolvedScopes;
  // Raw dimension name to catalog title, so rows read "GCP Microservice Demo".
  const titles = useDimensionTitles(level, scopes);

  const granularity = searchParams.get('granularity') || DEFAULT_GRANULARITY;
  const stageParam = searchParams.get('stage');
  const stage: CostStageFilter =
    stageParam && (COST_STAGES as string[]).includes(stageParam)
      ? (stageParam as CostStageFilter)
      : DEFAULT_COST_STAGE;
  const dimensionParam = searchParams.get('dimension');
  const dimension: CostDimension =
    dimensionParam && (COST_DIMENSIONS as string[]).includes(dimensionParam)
      ? (dimensionParam as CostDimension)
      : DEFAULT_COST_DIMENSION;
  const { timeRange, customStartTime, customEndTime } = parseUrlTimeRange(
    searchParams,
    COST_DEFAULT_TIME_RANGE,
  );
  // `null` means the param is absent (default to all environments); a present
  // value — even empty — is an explicit user selection we must preserve.
  const envsRaw = searchParams.get('envs');
  const envsParam = useMemo(
    () => (envsRaw === null ? null : envsRaw.split(',').filter(Boolean)),
    [envsRaw],
  );

  // --- Environments across the selected namespaces ---
  const {
    environments,
    loading: envsLoading,
    error: envsError,
  } = useNamespaceEnvironments(resolved.namespaces);

  // Default to every environment until the user narrows the selection, so the
  // page shows aggregated data immediately.
  const allEnvNames = useMemo(
    () => environments.map(e => e.name),
    [environments],
  );
  // Absent param means default to all; a present selection (including an explicit
  // empty one) is honored as-is.
  const selectedEnvironments = envsParam === null ? allEnvNames : envsParam;

  const onEnvironmentsChange = useCallback(
    (names: string[]) => {
      update(params => {
        // An explicit "all selected" is stored as absent (the default), so the
        // URL stays clean and keeps meaning "all". Selecting none serializes an
        // explicit empty value so it survives a reload and the "select
        // environments" alert can render.
        const isAll = names.length > 0 && names.length === allEnvNames.length;
        if (isAll) params.delete('envs');
        else params.set('envs', names.join(','));
      });
    },
    [update, allEnvNames.length],
  );

  const onTimeRangeChange = useCallback(
    (next: {
      timeRange: string;
      customStartTime?: string;
      customEndTime?: string;
    }) =>
      update(params =>
        writeUrlTimeRange(params, next, COST_DEFAULT_TIME_RANGE),
      ),
    [update],
  );

  const onGranularityChange = useCallback(
    (next: string) =>
      update(params => {
        if (next === DEFAULT_GRANULARITY) params.delete('granularity');
        else params.set('granularity', next);
      }),
    [update],
  );

  const onStageChange = useCallback(
    (next: CostStageFilter) =>
      update(params => {
        if (next === DEFAULT_COST_STAGE) params.delete('stage');
        else params.set('stage', next);
      }),
    [update],
  );

  const onDimensionChange = useCallback(
    (next: CostDimension) =>
      update(params => {
        if (next === DEFAULT_COST_DIMENSION) params.delete('dimension');
        else params.set('dimension', next);
      }),
    [update],
  );

  // --- Cost data ---
  const { data, loading, isRefetching, error, refresh } = useCostInsights({
    scopes,
    level,
    environments: selectedEnvironments,
    timeRange,
    customStartTime,
    customEndTime,
    granularity,
    stage,
    dimension,
    budget,
  });

  // Optimize/Apply acts on a single ReleaseBinding, so it's only offered when
  // exactly one component is in scope.
  const optimizeScope =
    level === 'component' && scopes.length === 1 ? scopes[0] : undefined;

  const noScope = !scopeLoading && scopes.length === 0;
  const noEnvironments =
    !noScope && !envsLoading && !envsError && environments.length === 0;

  return (
    <Page themeId="tool">
      <Header title="Cost Insights" />
      <Content>
        <Box className={classes.filterRow}>
          <CostInsightsScopeFilters
            selection={selection}
            onChange={setSelection}
          />
          {onInsightsTab && (
            <CostInsightsFilters
              environments={environments}
              environmentsLoading={envsLoading}
              selectedEnvironments={selectedEnvironments}
              onEnvironmentsChange={onEnvironmentsChange}
              stage={stage}
              onStageChange={onStageChange}
              dimension={dimension}
              onDimensionChange={onDimensionChange}
              onRefresh={refresh}
              refreshing={loading || isRefetching}
              disabled={noScope}
            />
          )}
        </Box>
        <CostInsightsTabBar />
        <Routes>
          <Route
            index
            element={
              <CostInsightsInsightsTab
                data={data}
                loading={loading}
                isRefetching={isRefetching}
                error={error}
                scopeLoading={scopeLoading}
                envsLoading={envsLoading}
                envsError={envsError}
                selectedEnvironments={selectedEnvironments}
                noScope={noScope}
                noEnvironments={noEnvironments}
                timeRange={timeRange}
                customStartTime={customStartTime}
                customEndTime={customEndTime}
                onTimeRangeChange={onTimeRangeChange}
                granularity={granularity}
                onGranularityChange={onGranularityChange}
                titles={titles}
                optimizeScope={optimizeScope}
                scopes={scopes}
                stage={stage}
                onSetBudget={() => setBudgetDialogOpen(true)}
                refresh={refresh}
              />
            }
          />
          <Route path="cost-analysis/*" element={<CostAnalysisTab />} />
        </Routes>
        <CostBudgetDialog
          open={budgetDialogOpen}
          initial={budget}
          onClose={() => setBudgetDialogOpen(false)}
          onSave={setBudget}
        />
      </Content>
    </Page>
  );
};
