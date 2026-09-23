import type { CostItem, CostRecommendationItem } from '../../types';
import type {
  CostScope,
  CostScopeLevel,
  CostScopeSelection,
  CostRow,
  CostSummary,
  CostSeriesPoint,
  CostInsightsData,
  CostStage,
  CostStageFilter,
  CostDimension,
  CostBudget,
  CostAnomaly,
  ForecastData,
  ForecastPoint,
} from './types';

/** Derive the scope level from a single scope's selection depth. */
export function deriveLevel(scope: CostScope): CostScopeLevel {
  if (scope.component) return 'component';
  if (scope.project) return 'project';
  return 'namespace';
}

/**
 * Flatten a selection to the deepest populated tier: one {@link CostScope} per
 * selected item, plus the `level` the table's rows sit at. A single selection
 * drills into its children (one project shows its components).
 */
export function expandSelection(selection: CostScopeSelection): {
  level: CostScopeLevel;
  scopes: CostScope[];
} {
  const componentScopes = selection.components.map(c => ({
    namespace: c.namespace,
    project: c.project,
    component: c.name,
  }));
  if (componentScopes.length > 0) {
    return {
      level: componentScopes.length === 1 ? 'component' : 'project',
      scopes: componentScopes,
    };
  }
  const projectScopes = selection.projects.map(p => ({
    namespace: p.namespace,
    project: p.name,
  }));
  if (projectScopes.length > 0) {
    return {
      level: projectScopes.length === 1 ? 'project' : 'namespace',
      scopes: projectScopes,
    };
  }
  return {
    level: 'namespace',
    scopes: selection.namespaces.map(namespace => ({ namespace })),
  };
}

/** The field a cost item is grouped by at the given level (infra dimension). */
function infraDimensionOf(item: CostItem, level: CostScopeLevel): string {
  switch (level) {
    case 'namespace':
      return item.project;
    case 'project':
      return item.component;
    case 'component':
    default:
      return item.environment;
  }
}

/**
 * The field a cost item is grouped by. `infra` keeps the level-based grouping;
 * the AI dimensions re-key rows by artifact/team/domain, each falling back to a
 * sensible infra field when the observer payload doesn't carry it yet.
 */
export function dimensionOf(
  item: CostItem,
  level: CostScopeLevel,
  dimension: CostDimension = 'infra',
): string {
  // `||` (not `??`) so an empty-string attribution field — which the observer
  // emits for an untagged item — still falls back to the infra field.
  switch (dimension) {
    case 'artifact':
      return item.artifact || item.component;
    case 'team':
      return item.team || item.project;
    case 'domain':
      return item.businessDomain || item.project;
    case 'infra':
    default:
      return infraDimensionOf(item, level);
  }
}

/** The lifecycle stage a cost item belongs to; absent means `run`. */
export function stageOf(item: CostItem): CostStage {
  return item.stage ?? 'run';
}

/** Keep only the items in the selected stage (`all` keeps everything). */
export function filterByStage(
  items: CostItem[],
  stage: CostStageFilter,
): CostItem[] {
  return stage === 'all' ? items : items.filter(i => stageOf(i) === stage);
}

const itemTotal = (item: CostItem): number =>
  (item.cpuCost ?? 0) +
  (item.memoryCost ?? 0) +
  (item.gpuCost ?? 0) +
  (item.tokenCost ?? 0);

/** Per-stage cost totals, for the summary's Build/Gate/Run breakdown. */
export function stageTotals(items: CostItem[]): Record<CostStage, number> {
  const totals: Record<CostStage, number> = { build: 0, gate: 0, run: 0 };
  for (const item of items) totals[stageOf(item)] += itemTotal(item);
  return totals;
}

/**
 * Cost-weighted average efficiency across items. Efficiency of a bigger spend
 * counts more; returns 0 when there is no spend to weight by.
 */
function weightedEfficiency(items: CostItem[]): number {
  let weightSum = 0;
  let effSum = 0;
  for (const item of items) {
    const weight = itemTotal(item);
    weightSum += weight;
    effSum += (item.efficiency ?? 0) * weight;
  }
  return weightSum > 0 ? effSum / weightSum : 0;
}

/** Sum of every cost component (cpu + memory + gpu + token) across items. */
export function totalCost(items: CostItem[]): number {
  return items.reduce((sum, item) => sum + itemTotal(item), 0);
}

/**
 * Flag spend spikes against each dimension's own recent baseline. A bucket is
 * anomalous when its total exceeds `threshold`× the median bucket for that
 * dimension. Client-side and dependency-free, so the dashboard surfaces
 * anomalies even before the observer ships a dedicated anomaly API.
 */
export function detectAnomalies(
  items: CostItem[],
  level: CostScopeLevel,
  dimension: CostDimension = 'infra',
  threshold = 2,
): CostAnomaly[] {
  const byDim = groupBy(items, item => dimensionOf(item, level, dimension));
  const anomalies: CostAnomaly[] = [];
  for (const [dim, dimItems] of byDim) {
    const byBucket = groupBy(dimItems, item => item.startTime);
    const buckets = [...byBucket.entries()].map(([ts, bucketItems]) => ({
      ts,
      total: totalCost(bucketItems),
      stage: stageOf(bucketItems[0]),
    }));
    // A baseline needs a few buckets to be meaningful.
    if (buckets.length < 3) continue;
    const sorted = buckets.map(b => b.total).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median <= 0) continue;
    for (const b of buckets) {
      if (b.total > median * threshold) {
        anomalies.push({
          id: `${dim}:${b.ts}`,
          dimension: dim,
          stage: b.stage,
          observed: b.total,
          expected: median,
          deltaPct: ((b.total - median) / median) * 100,
          detectedAt: b.ts,
        });
      }
    }
  }
  return anomalies.sort((a, b) => b.deltaPct - a.deltaPct);
}

/**
 * Cost per 1,000 inferences / tokens, computed only from the items that carry
 * the matching usage counter. A scope with no usage simply omits the metric.
 */
export function computeUnitEconomics(items: CostItem[]): {
  costPer1kInference?: number;
  costPer1kToken?: number;
} {
  let inferenceCost = 0;
  let inferences = 0;
  let tokenCost = 0;
  let tokens = 0;
  for (const item of items) {
    const total = itemTotal(item);
    if (item.usage?.inferences) {
      inferenceCost += total;
      inferences += item.usage.inferences;
    }
    if (item.usage?.tokens) {
      tokenCost += total;
      tokens += item.usage.tokens;
    }
  }
  const out: { costPer1kInference?: number; costPer1kToken?: number } = {};
  if (inferences > 0) out.costPer1kInference = (inferenceCost / inferences) * 1000;
  if (tokens > 0) out.costPer1kToken = (tokenCost / tokens) * 1000;
  return out;
}

/** Percent change from `previous` to `current`; null when previous is 0/unknown. */
export function percentChange(
  current: number,
  previous: number | undefined,
): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Cost totals keyed by dimension value (used for deltas and per-dim saving). */
function totalsByDimension(
  items: CostItem[],
  level: CostScopeLevel,
  dimension: CostDimension = 'infra',
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    const dim = dimensionOf(item, level, dimension);
    totals.set(dim, (totals.get(dim) ?? 0) + itemTotal(item));
  }
  return totals;
}

/** The dimension value a recommendation is grouped by at the given level. */
function recDimensionOf(
  rec: CostRecommendationItem,
  level: CostScopeLevel,
): string {
  switch (level) {
    case 'namespace':
      return rec.project;
    case 'project':
      return rec.component;
    case 'component':
    default:
      return rec.environment;
  }
}

const recTotal = (rec: CostRecommendationItem): number =>
  (rec.recommendation.cpuCost ?? 0) + (rec.recommendation.memoryCost ?? 0);

/**
 * Recommended (post-optimization) totals keyed by dimension value. At the
 * component level, environments in `staleEnvs` are skipped (their recommendation
 * is withheld).
 */
function recommendedTotalsByDimension(
  recommendations: CostRecommendationItem[],
  level: CostScopeLevel,
  staleEnvs: Map<string, string>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const rec of recommendations) {
    if (level === 'component' && staleEnvs.has(rec.environment)) continue;
    const dim = recDimensionOf(rec, level);
    totals.set(dim, (totals.get(dim) ?? 0) + recTotal(rec));
  }
  return totals;
}

/**
 * Aggregate the flat, multi-environment cost items into one row per dimension
 * value. At the component level, attaches the right-sizing recommendation
 * ("Cost After Optimizing") keyed by environment.
 */
export function aggregateRows(
  currentItems: CostItem[],
  previousItems: CostItem[],
  level: CostScopeLevel,
  recommendations: CostRecommendationItem[] = [],
  staleRecommendationEnvs: Map<string, string> = new Map(),
  dimension: CostDimension = 'infra',
): CostRow[] {
  const prevTotals = totalsByDimension(previousItems, level, dimension);
  const recTotals = recommendedTotalsByDimension(
    recommendations,
    level,
    staleRecommendationEnvs,
  );
  const grouped = groupBy(currentItems, item =>
    dimensionOf(item, level, dimension),
  );

  // Recommendations are only meaningful at the component level, where rows are
  // environments. Sum the recommended cost per environment.
  const recByEnv = new Map<string, CostRecommendationItem[]>();
  if (level === 'component') {
    for (const rec of recommendations) {
      const bucket = recByEnv.get(rec.environment);
      if (bucket) bucket.push(rec);
      else recByEnv.set(rec.environment, [rec]);
    }
  }

  const rows: CostRow[] = [];
  for (const [key, items] of grouped) {
    const cpuCost = items.reduce((s, i) => s + (i.cpuCost ?? 0), 0);
    const memoryCost = items.reduce((s, i) => s + (i.memoryCost ?? 0), 0);
    const total = cpuCost + memoryCost;

    const recommendationStale =
      level === 'component' && staleRecommendationEnvs.has(key);
    const recommendationStaleSince = recommendationStale
      ? staleRecommendationEnvs.get(key)
      : undefined;

    let recommendation: CostRow['recommendation'];
    if (level === 'component' && !recommendationStale) {
      const recs = recByEnv.get(key);
      if (recs && recs.length > 0) {
        const recCpu = recs.reduce(
          (s, r) => s + (r.recommendation.cpuCost ?? 0),
          0,
        );
        const recMem = recs.reduce(
          (s, r) => s + (r.recommendation.memoryCost ?? 0),
          0,
        );
        // Resource strings only make sense for a single component/env pair;
        // surface the first recommendation's request/limit values (and its
        // current values, for the confirm-diff dialog).
        const first = recs[0].recommendation;
        const firstCurrent = recs[0].current;
        recommendation = {
          cpuRequest: first.cpuRequest,
          cpuLimit: first.cpuLimit,
          memoryRequest: first.memoryRequest,
          memoryLimit: first.memoryLimit,
          cpuCost: recCpu,
          memoryCost: recMem,
          total: recCpu + recMem,
          current: {
            cpuRequest: firstCurrent.cpuRequest,
            cpuLimit: firstCurrent.cpuLimit,
            memoryRequest: firstCurrent.memoryRequest,
            memoryLimit: firstCurrent.memoryLimit,
          },
        };
      }
    }

    const recDimTotal = recTotals.get(key);
    const saving =
      recDimTotal !== undefined ? Math.max(0, total - recDimTotal) : undefined;

    rows.push({
      key,
      label: key,
      cpuCost,
      memoryCost,
      total,
      efficiency: weightedEfficiency(items),
      saving,
      deltaPct: percentChange(total, prevTotals.get(key)),
      stageCost: stageTotals(items),
      recommendation,
      recommendationStale,
      recommendationStaleSince,
    });
  }

  return rows.sort((a, b) => b.total - a.total);
}

/** Overall summary (total + delta + efficiency + saving). */
export function computeSummary(
  currentItems: CostItem[],
  previousItems: CostItem[],
  recommendations: CostRecommendationItem[],
  level: CostScopeLevel,
  staleRecommendationEnvs: Map<string, string>,
  dimension: CostDimension = 'infra',
): CostSummary {
  const total = totalCost(currentItems);
  const prevTotal = totalCost(previousItems);
  // Only dimensions with a (non-stale) recommendation contribute saving, each
  // clamped at its own cost so unrelated spend isn't counted as reclaimable.
  const currentTotals = totalsByDimension(currentItems, level, dimension);
  const recTotals = recommendedTotalsByDimension(
    recommendations,
    level,
    staleRecommendationEnvs,
  );
  let totalSaving = 0;
  for (const [dim, recDimTotal] of recTotals) {
    totalSaving += Math.max(0, (currentTotals.get(dim) ?? 0) - recDimTotal);
  }
  const stages = stageTotals(currentItems);
  // Share of spend that carries an attribution dimension, so the scorecard can
  // flag untagged spend (the framework's "everyone owns their usage").
  const attributedCost = totalCost(
    currentItems.filter(i => i.artifact || i.team || i.businessDomain),
  );
  return {
    totalCost: total,
    deltaPct: percentChange(total, prevTotal || undefined),
    efficiency: weightedEfficiency(currentItems),
    totalSaving,
    buildCost: stages.build,
    gateCost: stages.gate,
    runCost: stages.run,
    attributionCoverage: total > 0 ? attributedCost / total : 1,
  };
}

/**
 * Build stacked-bar series: one point per time bucket (item.startTime), with a
 * cost total for each dimension value in that bucket (summed across
 * environments). Returns the points ordered by time plus the distinct
 * dimension values used as stack keys.
 */
export function buildSeries(
  items: CostItem[],
  level: CostScopeLevel,
  dimension: CostDimension = 'infra',
): { series: CostSeriesPoint[]; seriesKeys: string[] } {
  // Normalise to the parsed instant so equivalent timestamps in different
  // textual forms (across per-environment responses) collapse into one bucket.
  const bucketKey = (startTime: string): string => {
    const t = new Date(startTime).getTime();
    return Number.isNaN(t) ? startTime : new Date(t).toISOString();
  };
  const byBucket = groupBy(items, item => bucketKey(item.startTime));
  const seriesKeys = new Set<string>();

  const series: CostSeriesPoint[] = [...byBucket.entries()]
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([timestamp, bucketItems]) => {
      const point: CostSeriesPoint = { timestamp };
      for (const item of bucketItems) {
        const dim = dimensionOf(item, level, dimension);
        seriesKeys.add(dim);
        point[dim] = ((point[dim] as number) ?? 0) + itemTotal(item);
      }
      return point;
    });

  return {
    series: fillMissingBuckets(series),
    seriesKeys: [...seriesKeys].sort(),
  };
}

/**
 * The cost API can omit empty buckets, which then collapse together on the
 * chart and hide the gap. Infer the interval from the smallest gap between
 * buckets and insert empty points for every skipped interval.
 */
function fillMissingBuckets(series: CostSeriesPoint[]): CostSeriesPoint[] {
  if (series.length < 2) return series;

  const times = series.map(p => new Date(p.timestamp).getTime());
  if (times.some(t => Number.isNaN(t))) return series;

  let interval = Infinity;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap > 0 && gap < interval) interval = gap;
  }
  if (!Number.isFinite(interval) || interval <= 0) return series;

  const MAX_POINTS = 2000;

  const filled: CostSeriesPoint[] = [series[0]];
  for (let i = 1; i < series.length; i++) {
    const prev = times[i - 1];
    const curr = times[i];
    const steps = Math.round((curr - prev) / interval);
    for (let s = 1; s < steps && filled.length < MAX_POINTS; s++) {
      filled.push({
        timestamp: new Date(prev + s * interval).toISOString(),
      });
    }
    filled.push(series[i]);
  }
  return filled;
}

/**
 * Accumulates the month-to-date costs into the actual-cost curve, then projects
 * month-end spend from the average rate so far — at the current rate and if the
 * recommendations are applied (`savingFraction` cuts only the remaining spend).
 */
export function buildForecast(params: {
  mtdItems: CostItem[];
  savingFraction: number;
  monthStart: Date;
  now: Date;
}): ForecastData | null {
  const { mtdItems, savingFraction, monthStart, now } = params;
  const monthStartMs = monthStart.getTime();
  const nowMs = now.getTime();
  // Last minute of the month, so the chart ends on its final day at 23:59
  const monthEnd = new Date(
    new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 60 * 1000,
  );
  const elapsedMs = nowMs - monthStartMs;
  const remainingMs = monthEnd.getTime() - nowMs;
  if (!(elapsedMs > 0) || !(remainingMs > 0)) return null;

  const byBucket = groupBy(mtdItems, item => {
    const t = new Date(item.startTime).getTime();
    return Number.isNaN(t) ? item.startTime : new Date(t).toISOString();
  });
  const buckets = [...byBucket.entries()]
    .map(([ts, items]) => ({
      ms: new Date(ts).getTime(),
      total: totalCost(items),
    }))
    .filter(b => Number.isFinite(b.ms) && b.ms >= monthStartMs && b.ms <= nowMs)
    .sort((a, b) => a.ms - b.ms);

  const points: ForecastPoint[] = [
    { timestamp: monthStart.toISOString(), actual: 0 },
  ];
  let cumulative = 0;
  for (const b of buckets) {
    cumulative += b.total;
    points.push({
      timestamp: new Date(b.ms).toISOString(),
      actual: cumulative,
    });
  }
  const actualMTD = cumulative;

  const rate = actualMTD / elapsedMs;
  const atCurrentTotal = actualMTD + rate * remainingMs;
  const ifAppliedTotal = actualMTD + rate * (1 - savingFraction) * remainingMs;

  // Fork at "now" so the actual curve and both projections join.
  points.push({
    timestamp: now.toISOString(),
    actual: actualMTD,
    forecast: actualMTD,
    ifApplied: actualMTD,
  });
  points.push({
    timestamp: monthEnd.toISOString(),
    forecast: atCurrentTotal,
    ifApplied: ifAppliedTotal,
  });

  points.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return {
    points,
    atCurrentTotal,
    ifAppliedTotal,
    leftOnTable: Math.max(0, atCurrentTotal - ifAppliedTotal),
  };
}

/** Assemble everything the view needs from the raw multi-env responses. */
export function buildCostInsightsData(params: {
  level: CostScopeLevel;
  currentItems: CostItem[];
  /** Time-bucketed items for the graph's time-series; defaults to currentItems. */
  seriesItems?: CostItem[];
  previousItems: CostItem[];
  recommendations?: CostRecommendationItem[];
  /** Withheld-recommendation envs mapped to the binding's spec update time. */
  staleRecommendationEnvs?: Map<string, string>;
  /** Month-to-date time-bucketed costs (month start → now) for the forecast. */
  monthToDateItems?: CostItem[];
  /** Month-to-date recommendations (month start until now) for the "if applied" curve. */
  monthToDateRecommendations?: CostRecommendationItem[];
  /** Start of the current calendar month, for the forecast window. */
  monthStart: Date;
  now: Date;
  /** Active stage filter; `all` keeps every stage. */
  stage?: CostStageFilter;
  /** Active row dimension; `infra` keeps the level-based grouping. */
  dimension?: CostDimension;
  /** Budget the scope is measured against, surfaced on the forecast. */
  budget?: CostBudget | null;
  /** Spend anomalies flagged in the window. */
  anomalies?: CostAnomaly[];
}): CostInsightsData {
  const {
    level,
    currentItems,
    seriesItems,
    previousItems,
    recommendations = [],
    staleRecommendationEnvs = new Map<string, string>(),
    monthToDateItems = [],
    monthToDateRecommendations = [],
    monthStart,
    now,
    stage = 'all',
    dimension = 'infra',
    budget = null,
    anomalies = [],
  } = params;

  // Stage is a view filter: it narrows every downstream aggregate, so a
  // "Build" view shows only build spend in the summary, table and graph.
  const current = filterByStage(currentItems, stage);
  const previous = filterByStage(previousItems, stage);
  const seriesSource = filterByStage(seriesItems ?? currentItems, stage);
  const mtd = filterByStage(monthToDateItems, stage);

  const { series, seriesKeys } = buildSeries(seriesSource, level, dimension);
  const summary = computeSummary(
    current,
    previous,
    recommendations,
    level,
    staleRecommendationEnvs,
    dimension,
  );
  // Anomalies are detected client-side from the same series the graph shows,
  // unless the caller supplied its own (e.g. from a future observer API).
  const detectedAnomalies =
    anomalies.length > 0
      ? anomalies
      : detectAnomalies(seriesSource, level, dimension);
  const unitEconomics = computeUnitEconomics(current);
  // The "if applied" forecast uses a month-to-date saving fraction: recommendations
  // measured over month start to now vs the month-to-date cost, so the curve is
  // independent of the selected time range (which only drives the breakdown below).
  const mtdSummary = computeSummary(
    mtd,
    [],
    monthToDateRecommendations,
    level,
    staleRecommendationEnvs,
    dimension,
  );
  const savingFraction =
    mtdSummary.totalCost > 0
      ? mtdSummary.totalSaving / mtdSummary.totalCost
      : 0;
  const forecast = buildForecast({
    mtdItems: mtd,
    savingFraction,
    monthStart,
    now,
  });
  return {
    level,
    stage,
    dimension,
    summary: {
      ...summary,
      ...unitEconomics,
      forecastTotal: forecast?.atCurrentTotal,
      budget: budget?.amount ?? null,
      anomalyCount: detectedAnomalies.length,
    },
    rows: aggregateRows(
      current,
      previous,
      level,
      recommendations,
      staleRecommendationEnvs,
      dimension,
    ),
    series,
    seriesKeys,
    forecast,
    anomalies: detectedAnomalies,
    budget,
  };
}
