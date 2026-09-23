import type { CostResourceProfile } from '../../types';

/**
 * The scope level is derived from how deep the breadcrumb selection goes:
 * - `namespace`: rows are projects
 * - `project`:   rows are components
 * - `component`: rows are environments (with right-sizing recommendations)
 */
export type CostScopeLevel = 'namespace' | 'project' | 'component';

/**
 * The lifecycle stage a cost belongs to. AI artifacts have all three; a plain
 * software service only ever has `run` (its infra cost), so the same page
 * renders fewer columns for it instead of needing a separate view.
 * - `build`: one-time cost to produce a version (train, RAG ingest, eval-set draft)
 * - `gate`:  cost of the Evaluate Gate run (LLM-as-judge tokens)
 * - `run`:   recurring cost to operate a version (serving, monitoring, tokens)
 */
export type CostStage = 'build' | 'gate' | 'run';

/** `all` is the unfiltered view; the summary then breaks down by stage. */
export type CostStageFilter = CostStage | 'all';

/**
 * What the table rows are grouped by. `infra` keeps the original
 * namespace/project/component/environment grouping; the others re-key rows by
 * the AI artifact, owning team, or business domain the cost is attributed to.
 */
export type CostDimension = 'artifact' | 'team' | 'domain' | 'infra';

export const COST_STAGES: CostStage[] = ['build', 'gate', 'run'];

export const COST_STAGE_LABELS: Record<CostStageFilter, string> = {
  all: 'All stages',
  build: 'Build',
  gate: 'Gate',
  run: 'Run',
};

export const COST_DIMENSIONS: CostDimension[] = [
  'artifact',
  'team',
  'domain',
  'infra',
];

export const COST_DIMENSION_LABELS: Record<CostDimension, string> = {
  artifact: 'Artifact',
  team: 'Team',
  domain: 'Domain',
  infra: 'Infrastructure',
};

export const DEFAULT_COST_STAGE: CostStageFilter = 'all';
// Artifact-first by default: cost follows the model/prompt/RAG index a golden
// path produced, not the K8s topology — the whole point of the AI cost model.
export const DEFAULT_COST_DIMENSION: CostDimension = 'artifact';

/** A spend spike the platform flags against its own recent baseline. */
export interface CostAnomaly {
  id: string;
  /** Dimension value the anomaly was detected on (artifact/team/domain name). */
  dimension: string;
  stage: CostStage;
  observed: number;
  expected: number;
  /** Signed percent over the expected baseline. */
  deltaPct: number;
  /** Severity band from the delta: low <50%, medium <150%, high beyond. */
  severity: 'low' | 'medium' | 'high';
  detectedAt: string;
}

/** A budget the scope is measured against, for the forecast burn line. */
export interface CostBudget {
  amount: number;
  period: 'month';
  /** Human label of what the budget covers (team/domain/artifact). */
  scope: string;
}

export interface CostScope {
  namespace?: string;
  project?: string;
  component?: string;
}

/** A project (System) qualified by the namespace it belongs to. */
export interface CostProjectRef {
  namespace: string;
  name: string;
}

/** A component qualified by its namespace + project. */
export interface CostComponentRef {
  namespace: string;
  project: string;
  name: string;
}

/**
 * The multi-select scope driving the page: independent Namespace / Project /
 * Component selections. The deepest populated tier decides what the table shows;
 * costs are aggregated across every selected item at that tier.
 */
export interface CostScopeSelection {
  namespaces: string[];
  projects: CostProjectRef[];
  components: CostComponentRef[];
}

/** The four resource quantity strings (K8s notation) for a workload. */
export type CostResourceQuantities = Pick<
  CostResourceProfile,
  'cpuRequest' | 'cpuLimit' | 'memoryRequest' | 'memoryLimit'
>;

/** Recommendation ("Cost After Optimizing") shown only at the component level. */
export interface CostRowRecommendation extends CostResourceProfile {
  total: number;
  /** Current (pre-optimization) resource values, for the confirm-diff dialog. */
  current?: CostResourceQuantities;
}

export interface CostRow {
  /** Dimension value: project / component / environment name. */
  key: string;
  label: string;
  cpuCost: number;
  memoryCost: number;
  total: number;
  /** Cost-weighted average efficiency in 0..1. */
  efficiency: number;
  /** Reclaimable spend (current total − recommended total), clamped ≥ 0. */
  saving?: number;
  /** Percent change vs the previous equal-length window (null if unknown). */
  deltaPct: number | null;
  /**
   * Evaluate Gate quality score in 0..1, when the artifact has one. Drives the
   * cost/quality Pareto view; absent for plain infra rows.
   */
  quality?: number;
  /** Per-stage cost split, so the table can show Build/Gate/Run columns. */
  stageCost?: Record<CostStage, number>;
  recommendation?: CostRowRecommendation;
  /**
   * True when the environment's ReleaseBinding was updated after the selected
   * window's start, so recommendations derived from that window's usage would be
   * based on the pre-change spec and are therefore withheld.
   */
  recommendationStale?: boolean;
  /** ISO spec update time of the binding, shown in the withheld-recommendation notice. */
  recommendationStaleSince?: string;
}

export interface CostSummary {
  totalCost: number;
  deltaPct: number | null;
  efficiency: number;
  /** Aggregate reclaimable spend across the scope. */
  totalSaving: number;
  /** One-time cost to produce versions (train / RAG ingest / eval-set draft). */
  buildCost?: number;
  /** Evaluate Gate cost (LLM-as-judge tokens). */
  gateCost?: number;
  /** Recurring cost to operate versions (serving / monitoring / tokens). */
  runCost?: number;
  /** Projected month-end spend at the current rate. */
  forecastTotal?: number;
  /** Monthly budget for the scope, when one is set. */
  budget?: number | null;
  /** Number of spend anomalies flagged in the window. */
  anomalyCount?: number;
  /** Cost per 1,000 inferences, when usage is known. */
  costPer1kInference?: number;
  /** Cost per 1,000 tokens, when usage is known. */
  costPer1kToken?: number;
  /**
   * Share of spend carrying artifact/team/domain attribution (0..1). Drives the
   * scorecard's attribution check; 1 when there is no spend to attribute.
   */
  attributionCoverage?: number;
  /** Cost-weighted average GPU utilization (0..1), when GPU items are present. */
  gpuUtilization?: number;
}

/** One stacked-bar time bucket: `{ timestamp, [dimensionValue]: cost }`. */
export type CostSeriesPoint = {
  timestamp: string;
} & Record<string, number | string>;

/**
 * One point on the current-cost-and-forecast chart. `actual` is the accumulated
 * spend so far this calendar month (month start till today); `forecast`/`ifApplied`
 * are the two projections from today to month end (they share today's value with
 * `actual` so the areas/lines join).
 */
export interface ForecastPoint {
  timestamp: string;
  actual?: number;
  forecast?: number;
  ifApplied?: number;
}

export interface ForecastData {
  points: ForecastPoint[];
  /** Projected month-end spend at the current rate. */
  atCurrentTotal: number;
  /** Projected month-end spend with recommendations applied. */
  ifAppliedTotal: number;
  /** Gap between the projections (the cost of doing nothing). */
  leftOnTable: number;
}

export interface CostInsightsData {
  level: CostScopeLevel;
  /** Active stage filter; `all` means the summary breaks down by stage. */
  stage?: CostStageFilter;
  /** Active row dimension; `infra` keeps the level-based grouping. */
  dimension?: CostDimension;
  summary: CostSummary;
  rows: CostRow[];
  series: CostSeriesPoint[];
  /** Distinct dimension values used as stack keys in the graph. */
  seriesKeys: string[];
  /** Forecast-divergence chart data; null when the window can't be projected. */
  forecast: ForecastData | null;
  /** Spend anomalies flagged in the window. */
  anomalies?: CostAnomaly[];
  /** Budget the scope is measured against, when one is set. */
  budget?: CostBudget | null;
}
