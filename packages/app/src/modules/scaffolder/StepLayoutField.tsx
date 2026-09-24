import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { trainingPresetUpdates } from './trainingPresets';
import {
  CUSTOM_MODEL_PRESET,
  llmServingPresetKeys,
  llmServingPresetLabel,
  llmServingPresetUpdates,
  matchesLlmServingPreset,
} from './llmServingPresets';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Box from '@material-ui/core/Box';
import Checkbox from '@material-ui/core/Checkbox';
import Chip from '@material-ui/core/Chip';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid, { GridSize } from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Autocomplete from '@material-ui/lab/Autocomplete';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AppsIcon from '@material-ui/icons/Apps';
import TuneIcon from '@material-ui/icons/Tune';
import FunctionsIcon from '@material-ui/icons/Functions';
import FilterListIcon from '@material-ui/icons/FilterList';
import FlashOnIcon from '@material-ui/icons/FlashOn';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import UndoIcon from '@material-ui/icons/Undo';
import AttachMoneyIcon from '@material-ui/icons/AttachMoney';
import SecurityIcon from '@material-ui/icons/Security';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CancelIcon from '@material-ui/icons/Cancel';
import StorageIcon from '@material-ui/icons/Storage';
import NotificationsIcon from '@material-ui/icons/Notifications';
import InfoIcon from '@material-ui/icons/Info';
import CategoryIcon from '@material-ui/icons/Category';
import DescriptionIcon from '@material-ui/icons/Description';
import LibraryBooksIcon from '@material-ui/icons/LibraryBooks';
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
import LaunchIcon from '@material-ui/icons/Launch';
import AssignmentIcon from '@material-ui/icons/Assignment';
import MemoryIcon from '@material-ui/icons/Memory';
import SpeedIcon from '@material-ui/icons/Speed';
import HistoryIcon from '@material-ui/icons/History';
import BuildIcon from '@material-ui/icons/Build';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import TableChartIcon from '@material-ui/icons/TableChart';
import LayersIcon from '@material-ui/icons/Layers';
import {
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { openChoreoAuthApiRef } from '@openchoreo/backstage-plugin';
import type { JSONSchema7 } from 'json-schema';
import { NEUTRAL, STATUS } from '../theme/colors';

/** One field placed inside a group — `width` is an MD-breakpoint span out of 12 (6 = half-width, side by side with another 6). */
interface GroupField {
  name: string;
  width?: GridSize;
  /**
   * Render the field disabled (greyed, not editable) — for roadmap fields
   * that exist in the schema but aren't wired server-side yet, so a Dev
   * can't pick a value that will fail at prepare time.
   */
  disabled?: boolean;
  /**
   * When this field changes, derive `modelName` from it (strip the org,
   * lowercase) so a Dev picking a HuggingFace model id doesn't retype the
   * name. The Dev can still edit modelName afterwards.
   */
  autoFillModelName?: boolean;
  /**
   * Autocomplete of real HuggingFace model ids (GET /llm-deploy/search-models)
   * instead of a free-text field — a Dev picks a real id instead of typing a
   * typo-prone one. Free-solo, so an id the search doesn't surface can still
   * be typed. Falls back to the plain field while loading/empty.
   */
  huggingFaceModelPicker?: boolean;
  /**
   * Dropdown of curated, verified model presets (llmServingPresets) instead of
   * a free-text field — picking one fills the sibling `huggingFaceModelId` +
   * `modelName` AND a compute profile that fits the model (gpuType/gpuCount/
   * quantization/maxContextLength), so a Dev doesn't have to know a 70B needs
   * 4x A100 with int4-awq. The `custom` sentinel leaves every field as-is for
   * a hand-typed model. Meant to sit right before a `huggingFaceModelPicker`
   * field; the picker flips back to `custom` if the id is hand-edited.
   */
  modelPresetPicker?: boolean;
  /**
   * Dropdown of K8s Secret names in the namespace (GET /secrets) instead of a
   * free-text field — a typo'd Secret name leaves the pod stuck pulling a
   * gated model. Falls back to the plain field while loading/empty.
   */
  secretPicker?: boolean;
  /**
   * Picker of the chosen dataset's own CSV header (GET /datasets/columns)
   * instead of a free-text/array input — 'single' for one column (e.g.
   * Target column), 'multi' for several (e.g. ID columns). Falls back to
   * the plain field with no dataset selected yet, mid-fetch, or on failure
   * (e.g. architecture=cv's dataset is a .zip, not a CSV).
   */
  columnPicker?: 'single' | 'multi';
  /** Picker of the object store's dataset listing (GET /datasets) instead of a free-text `file://` path. Falls back to the plain field while loading/empty. */
  datasetPicker?: boolean;
  /**
   * Read-only table of the chosen dataset's first rows (GET
   * /datasets/preview) below this field. Only meaningful alongside
   * `datasetPicker: true` on the same field; renders nothing without a
   * dataset selected, mid-fetch, or on failure.
   */
  datasetPreview?: boolean;
  /**
   * Dropdown of the distinct `source` values in the object store's dataset
   * listing (e.g. "local", "s3") instead of a free-text input — whatever
   * IObjectStorageAdapter is wired up shows here, no template change
   * needed. Meant to sit right before a `datasetPicker: true` field on the
   * same form: StepLayout scopes that field's options to whichever source
   * this one holds, and clears it on a source switch so a stale
   * cross-source selection never lingers.
   */
  dataSourcePicker?: boolean;
  /**
   * Live, color-coded data-quality panel (POST /datasets/validate) below
   * this field, using whatever `taskType`/`targetColumn`/`timeColumn` are
   * already in formData — the same checks `orchestration:validate-dataset`
   * runs at submit time, surfaced while the form is still being filled in.
   * Only meaningful alongside `datasetPicker: true`; renders nothing until
   * a dataset + task type are both set.
   */
  datasetValidation?: boolean;
  /** Dropdown of registered models (GET /models) instead of a free-text `models:/<name>/<version>` MLflow URI. Falls back to the plain field while loading/empty. */
  baseModelPicker?: boolean;
  /**
   * For a field that's resolved to a `const` (see renderField's own
   * const-skip comment): shows it anyway, as a disabled field displaying
   * the forced value, instead of the default silent skip. Opt-in per
   * field — most const fields (e.g. architecture) stay skipped; use this
   * only where hiding it would read as the choice having vanished rather
   * than having been made for the user (e.g. taskType once businessDomain
   * fully determines it).
   */
  lockedDisplay?: boolean;
  /** Multi-select of real `<feature_view>:<feature>` references (GET /features) instead of a free-text array — reuses ColumnPickerField's 'multi' mode against whatever the Feast repo actually has. Falls back to the plain field while loading/empty (e.g. Feast repo not `feast apply`-ed yet), same convention as datasetPicker/baseModelPicker. */
  featureNamesPicker?: boolean;
  /**
   * Live POST /datasets/feast-entity-match panel below this field — warns
   * when the chosen entity column shares no values with the Feast store, so
   * the enrichment would "succeed" with every feature silently NaN. Meant
   * for the Feature Enrichment panel's `entityIdColumn` field.
   */
  feastEntityMatch?: boolean;
  /** Per-hyperparameter Range/Choices table (SearchSpaceBuilderField) instead of a hand-typed JSON string — reads `architecture` from formData to know which DL hyperparameters apply (mlp vs lstm). */
  searchSpaceBuilder?: boolean;
  /**
   * Dropdown of registered model NAMES (GET /models) for the Evaluate &
   * Deploy Model template's `modelName` field, instead of a free-text
   * field a typo can silently break. Picking one auto-fills the sibling
   * `modelVersion` field with that model's latest known version (see the
   * modelName->modelVersion effect in StepLayout) — still freely editable
   * from there to target an older version on purpose. Falls back to the
   * plain field while loading/empty, same convention as baseModelPicker.
   */
  modelNamePicker?: boolean;
  /**
   * Replaces a plain enum `<select>` with a row of selectable cards (icon
   * + label + one-line caption per choice) — see ActionPickerField.
   * Built for Evaluate & Deploy Model's `action` field: 4 enum values with
   * genuinely different meanings (deploy/rollback/promote/promote-rollback)
   * read poorly as a dropdown + one dense paragraph underneath (a Dev has
   * to read all 4 explanations to find the one they want); a row of cards
   * lets them scan labels first and only read the 1-2 captions that look
   * relevant. Options are hardcoded to `action`'s own 4 values, same
   * "specific beats a speculative abstraction" call as
   * DeploySummaryPanel/ModelVersionCheckPanel's own hardcoded field names.
   */
  actionPicker?: boolean;
  /**
   * Dropdown of the sibling `modelName`'s ACTUALLY REGISTERED versions
   * (GET /models/{name}/versions) instead of a free-text version number —
   * removes the invalid-version class structurally, rather than only
   * catching it after the fact. Falls back to the plain field while
   * `modelName` is empty, loading, or has no known versions yet.
   */
  modelVersionPicker?: boolean;
  /**
   * Live GET /models/{name}/{version}/summary lookup below this field —
   * the frontend half of this session's policy-check 404 fix: instead of
   * only finding out a model:version doesn't exist after the whole
   * wizard submits and the training/deploy workflow fails, this surfaces
   * it (task_type + metrics if found, a clear "not found" if not) the
   * moment both `modelName` and this field have values. Redundant once
   * `modelVersionPicker` is also set (a version picked from the dropdown
   * already exists), but still useful there as a data-driven confirmation
   * — shows the version's real metrics before the user commits to it.
   * Advisory only — same non-blocking contract as datasetValidation
   * above, not a hard gate on "Next".
   */
  modelVersionCheck?: boolean;
  /**
   * Live comparison panel below this field: the sibling `modelVersion`'s
   * metrics (reuses useModelVersionCheck — see that hook) side by side
   * with whatever's *currently deployed* right now (GET
   * /models/{name}/deploy-status -> live_version -> GET
   * /models/{name}/{live_version}/summary). Meant for Evaluate & Deploy
   * Model's trafficPercent field — Canary/A-B ask the Dev to type a
   * percent with nothing to compare it against; this gives the same
   * accuracy/latency numbers a Dev would otherwise have to look up
   * separately before the number they type means anything. Renders
   * nothing extra when there's no prior deploy to compare against (a
   * first deploy has nothing to compare).
   */
  versionComparison?: boolean;
  /**
   * Live preview panel below this field: what's bound in each OpenChoreo
   * environment right now (GET /models/{name}/promotion-status), and which
   * release the sibling `targetEnvironment`'s current value would move
   * where. Meant for Evaluate & Deploy Model's action=promote branch — a
   * promotion has no prior manifest/version fields to show a
   * DeploySummaryPanel-style recap from, so this fetches the one piece of
   * state that makes "here's what you're about to approve" true before
   * submit, not just after.
   */
  promotionPreview?: boolean;
  /**
   * Replaces this field's own (never-edited) value with a computed,
   * one-sentence plain-language recap of the step's other fields (see
   * DeploySummaryPanel) — meant for a dedicated read-only property placed
   * last in the step, right before Backstage's own Review step. Ignores
   * whatever the field's own schema/value is; only its group placement
   * matters.
   */
  summaryField?: boolean;
  /**
   * Dropdown of drafted persona keys (GET /prompts) instead of a free-text
   * field — Evaluate & Activate Prompt / RAG Version's `promptName`, so a
   * Dev doesn't have to copy it by hand from Draft Prompt's own output
   * text. Falls back to the plain field while loading/empty, same
   * convention as modelNamePicker — including when the backend doesn't
   * expose GET /prompts yet (orchestration-api, a separate repo).
   */
  promptNamePicker?: boolean;
  /**
   * Free-solo combobox of drafted persona keys (GET /prompts) — Draft
   * Prompt's `promptName`, where the Dev either picks an existing persona to
   * add a version to or types a brand-new persona key to create one. Unlike
   * promptNamePicker (a strict select, right for Evaluate & Activate where
   * the persona must already exist), this still allows a value that isn't in
   * the list yet. Renders even while the list is empty/loading, since typing
   * a new key is always valid.
   */
  promptNameCombo?: boolean;
  /**
   * Dropdown of the sibling `promptName`'s actually-drafted versions (GET
   * /prompts/{name}/versions) instead of a free-text version number — same
   * "remove the invalid-value class structurally" reasoning as
   * modelVersionPicker. Falls back to the plain field while `promptName`
   * is empty, loading, or has no known versions yet.
   */
  promptVersionPicker?: boolean;
  /**
   * Dropdown of drafted RAG collection names (GET /rag/collections)
   * instead of a free-text field — the RAG-index equivalent of
   * promptNamePicker, for Evaluate & Activate Prompt / RAG Version's
   * `collectionName`. Same fallback contract.
   */
  ragCollectionPicker?: boolean;
  /**
   * Dropdown of the sibling `collectionName`'s actually-ingested index
   * versions (GET /rag/collections/{name}/versions) instead of a free-text
   * version number — the RAG-index equivalent of modelVersionPicker. Same
   * fallback contract.
   */
  ragIndexVersionPicker?: boolean;
  /**
   * Dropdown of model_names configured in litellm-config.yaml (GET
   * /llm-models) instead of a free-text field a typo can silently break —
   * Evaluate & Activate Prompt / RAG Version's `model` (LLM judge). Same
   * fallback contract as the pickers above.
   */
  llmModelPicker?: boolean;
  /**
   * Dropdown of registered eval-set names (GET /eval-sets) instead of a
   * free-text field — Evaluate & Activate Prompt / RAG Version's
   * `evalSetName`, so a Dev picks a set that actually exists instead of
   * typing a name that 404s the whole run at the fetch-eval-set step. Same
   * fallback contract as the pickers above: plain field while loading,
   * empty, or when nothing has been drafted yet.
   */
  evalSetNamePicker?: boolean;
  /**
   * Free-solo combobox of registered eval-set names (GET /eval-sets) — Draft
   * Eval Set's `evalSetName`, where the Dev either picks an existing set to
   * add a version to or types a brand-new name to create one. Unlike
   * evalSetNamePicker (a strict select, right for Evaluate & Activate where
   * the set must already exist), this still allows a value that isn't in the
   * list yet — so a typo like `idp-qna_eval` can't silently spawn a junk set
   * instead of versioning `idp-qna-eval`. Renders even while the list is
   * empty/loading, since typing a new name is always valid.
   */
  evalSetNameCombo?: boolean;
  /**
   * Multi-select of ingestable source docs (GET /rag/sources) instead of a
   * free-text array — Draft/Ingest's `sourcePaths`, so a Dev picks real
   * repo-relative paths (e.g. "docs/architecture-overview.md") instead of
   * typing one that 400s the whole ingest at the backend's file check. Same
   * fail-open contract as the pickers above: plain field while loading/empty.
   */
  sourcePathsPicker?: boolean;
  /**
   * Renders an enum/oneOf field as a row of selectable cards (icon + label +
   * one-line caption) instead of a plain `<select>` — same shape as
   * actionPicker, but generic: options come from the field's own schema
   * (`x-cards` when present, else `oneOf` const/title, else `enum`), so any
   * template can use it without a hardcoded option list. Built for the
   * LLMOps templates' `artifactKind`/`action` fields, where 2-3 choices with
   * genuinely different meanings read poorly as a dropdown + dense paragraph.
   */
  choiceCards?: boolean;
  /**
   * Renders an array field as a multi-select (checkbox dropdown + chips)
   * instead of RJSF's default array widget — options come from the field's
   * own schema (`items.oneOf`/`items.enum`, else the field's own
   * `oneOf`/`enum`), so any template can use it without a hardcoded list.
   * Built for Setup Model Monitoring's `metricNames`: monitoring a single
   * metric hides real regressions (e.g. high accuracy on imbalanced data
   * while recall collapses), so the Dev picks a set. Falls through to the
   * plain field when the schema carries no options.
   */
  multiSelect?: boolean;
  /**
   * Renders this array field as a task-type-aware metrics table instead of
   * a plain multi-select: reads the sibling modelName/modelVersion's
   * registry metadata (task_type) and shows only the metrics that apply
   * (classification: F1/accuracy/precision/recall; regression: RMSE/MAE/
   * R2), each with its own minimum-acceptable threshold. Writes this field
   * (the metric names) AND the sibling `metricThresholds` object together,
   * so a Dev can't pair a classification metric with a regression model.
   * Falls back to showing every schema option while the model's task_type
   * is still unknown. Built for Setup Model Monitoring's `metricNames`.
   */
  taskTypeMetrics?: boolean;
  /**
   * Filters this enum/oneOf field's options to the ones tagged for the
   * selected model's task_type (schema `x-task-type` on each option) — so a
   * regression model can't be paired with a classifier algorithm. Falls
   * back to every option while the task_type is unknown. Built for Setup
   * Model Monitoring's `retrainAlgorithm`.
   */
  taskTypeOptions?: boolean;
  /**
   * Skip rendering this field entirely — for a property whose value is
   * written by a sibling's own flag (e.g. `metricThresholds` under
   * `taskTypeMetrics`), so it doesn't also render as a raw object field.
   */
  hidden?: boolean;
  /**
   * Render a read-only TextField showing this field's (auto-bound) value —
   * for a value the platform fills from model metadata (e.g. `taskType`),
   * where an editable input would invite a value that disagrees with the
   * model. Unlike `lockedDisplay` (const-only), this works on any field.
   */
  readOnlyDisplay?: boolean;
  /**
   * Live GET /llm-deploy/validate-model lookup below this field — the
   * frontend half of llm-serve-deploy's gated-model guardrail: surfaces whether
   * the typed `huggingFaceModelId` exists and whether it is gated
   * (`is_gated=true` means the `hfTokenSecretRef` field becomes required
   * server-side). Advisory only — same non-blocking contract as
   * modelVersionCheck above, not a hard gate on "Next".
   */
  huggingFaceModelValidator?: boolean;
  /**
   * Live GET /llm-deploy/gpu-recommendation panel below this field — reads
   * the sibling `huggingFaceModelId`'s param count (via
   * useHuggingFaceModelInfo) plus this step's `quantization`/`gpuType` to
   * suggest a GPU type/count. Advisory only; never overwrites what the Dev
   * typed.
   */
  gpuRecommendationPanel?: boolean;
  /**
   * Live GET /llm-deploy/rollout-eligibility gate below this field — reports
   * whether `modelName` has a prior deploy (`has_prior_deploy`). Canary /
   * A-B / Blue-Green require one; without it the backend rejects the
   * submit, so this surfaces that before the whole wizard runs. Advisory
   * only, same fail-quiet contract as every other live panel here.
   */
  rolloutEligibilityGate?: boolean;
  /**
   * Live role gate below this field — release_strategy='instant' needs the
   * 'llm-ops-admin' role server-side (orchestration-api's own user_has_role
   * check). When the signed-in user lacks it, this warns AND StepLayout falls
   * the value back to pr-gated, so the run can't 403 at prepare time. Meant
   * for llm-serve-deploy's `releaseStrategy` field.
   */
  releaseEligibilityPanel?: boolean;
  /**
   * Live pre-flight FinOps panel below this field: calls
   * orchestration-api's POST /costs/estimate + /costs/check with the
   * golden path, lifecycle stage, artifact and path-specific params, so a
   * Dev sees the estimated cost and budget impact BEFORE running the
   * golden path — the same estimate the `orchestration:estimate-cost` /
   * `orchestration:cost-gate` steps compute at submit time, surfaced while
   * the form is still being filled in. Advisory only, same fail-quiet
   * contract as every other live panel here. Meant for a dedicated
   * read-only property placed last in the step, right before Review.
   */
  costEstimate?: CostEstimateOptions;
  /**
   * Live pre-flight security panel below this field: calls
   * orchestration-api's POST /security/scan with the golden path, lifecycle
   * stage, artifact and the chosen security controls, so a Dev sees the
   * posture (and any blocking finding) BEFORE running the golden path — the
   * same scan the `orchestration:security-scan` step runs at submit time.
   * Advisory only, same fail-quiet contract as every other live panel here.
   * Meant for a dedicated read-only property placed last in the step.
   */
  securityScan?: SecurityScanOptions;
}

/**
 * Config for the pre-flight cost panel. `artifactFields`/`paramFields` are
 * form field names read from the current formData (the first non-empty
 * artifact wins; params are forwarded as-is), so the panel never has to
 * know a path's shape beyond this config.
 */
interface CostEstimateOptions {
  /** Golden path name, e.g. `evaluate-deploy-model`. */
  goldenPath: string;
  /** Lifecycle stage the cost belongs to. */
  stage: 'build' | 'gate' | 'run';
  /** Form fields holding the artifact name; first non-empty wins. */
  artifactFields: string[];
  /** Form fields forwarded as path-specific estimate params. */
  paramFields?: string[];
  /** Only render when every entry matches the current formData value. */
  when?: Record<string, unknown>;
}

/**
 * Config for the pre-flight security panel. Same shape as
 * `CostEstimateOptions` — `paramFields` names the security control fields
 * whose current values are forwarded to the scan.
 */
interface SecurityScanOptions {
  /** Golden path name, e.g. `llm-serve-deploy`. */
  goldenPath: string;
  /** Lifecycle stage the scan belongs to. */
  stage: 'build' | 'gate' | 'run';
  /** Form fields holding the artifact name; first non-empty wins. */
  artifactFields: string[];
  /** Form fields forwarded as the scan's security control values. */
  paramFields?: string[];
  /** Only render when every entry matches the current formData value. */
  when?: Record<string, unknown>;
}

/**
 * A conditional child block (e.g. Search configuration under Hyperparameter
 * Search) — dashed
 * border + small caps label, rendered INSIDE its parent group, never as
 * its own top-level panel. Skipped entirely (no empty box) when none of
 * its fields exist in the current (branch-resolved) schema.
 */
interface SubPanel {
  title: string;
  fields: (string | GroupField)[];
}

type GroupEntry = string | GroupField | { subpanel: SubPanel };

const GROUP_ICONS = {
  apps: AppsIcon,
  tune: TuneIcon,
  function: FunctionsIcon,
  list: FilterListIcon,
  // "bolt"/"query_stats" were already used by templates/evaluate-deploy-model's
  // Action/Monitoring groups before these 2 entries existed — silently
  // rendering no icon (GROUP_ICONS[group.icon] === undefined) since
  // group.icon comes from YAML, not something tsc could catch. Fixed
  // while adding "trending_up" for the new Promotion group.
  bolt: FlashOnIcon,
  query_stats: ShowChartIcon,
  trending_up: TrendingUpIcon,
  undo: UndoIcon,
  attach_money: AttachMoneyIcon,
  security: SecurityIcon,
  // Added for the Golden Path templates' group headers — each maps to the
  // closest Material icon for the group's meaning (data, artifact kind,
  // prompt, RAG, eval, release, compute, ...). Keep this the single source
  // of truth: a group.icon not listed here renders no icon at all.
  storage: StorageIcon,
  notifications: NotificationsIcon,
  info: InfoIcon,
  category: CategoryIcon,
  description: DescriptionIcon,
  library_books: LibraryBooksIcon,
  checklist: PlaylistAddCheckIcon,
  launch: LaunchIcon,
  assignment: AssignmentIcon,
  memory: MemoryIcon,
  speed: SpeedIcon,
  history: HistoryIcon,
  build: BuildIcon,
  menu_book: MenuBookIcon,
  table_chart: TableChartIcon,
  layers: LayersIcon,
} as const;

interface StepLayoutGroup {
  title: string;
  icon?: keyof typeof GROUP_ICONS;
  /**
   * Semantic border/background — reuse these 3 everywhere, don't invent a
   * 4th without a genuinely new meaning:
   *   - "fixed" (default): solid border, white surface — always-there panel.
   *   - "optional": solid border, surface-1 (light gray) — off-by-default panel.
   * "conditional" isn't a group variant at all — it's a `subpanel` entry
   * (dashed border), because a conditional block is a CHILD of some other
   * group's decision, never its own top-level panel.
   */
  variant?: 'fixed' | 'optional';
  /** Closed-by-default Accordion instead of a plain Card. */
  collapsible?: boolean;
  /** A boolean field rendered as a compact checkbox in the header row (mockup's "☐ Enable"), instead of a full-width field in the grid below. */
  toggleField?: string;
  fields: GroupEntry[];
}

interface StepLayoutUiOptions {
  groups?: StepLayoutGroup[];
}

function isSubpanel(entry: GroupEntry): entry is { subpanel: SubPanel } {
  return typeof entry === 'object' && 'subpanel' in entry;
}

function normalizeField(field: string | GroupField): GroupField {
  return typeof field === 'string' ? { name: field } : field;
}

/** "meta-llama/Llama-3.1-8B-Instruct" -> "llama-3.1-8b-instruct". */
function deriveModelName(hfModelId: string): string {
  const last = hfModelId.split('/').pop() ?? hfModelId;
  return last.toLowerCase();
}

/** Mirrors renderField's own skip rules (missing / const-only) so a group's visibility check never disagrees with what it actually renders. */
function isRenderable(
  name: string,
  properties: Record<string, JSONSchema7>,
): boolean {
  const fieldSchema = properties[name];
  return Boolean(fieldSchema) && fieldSchema.const === undefined;
}

function hasAnyRenderable(
  entries: GroupEntry[],
  properties: Record<string, JSONSchema7>,
): boolean {
  return entries.some(entry =>
    isSubpanel(entry)
      ? hasAnyRenderable(entry.subpanel.fields, properties)
      : isRenderable(normalizeField(entry).name, properties),
  );
}

/**
 * Bearer header for orchestration-api's own protected endpoints —
 * AUTH_ENABLED=true there validates a real Thunder-issued JWT, which
 * Backstage's own session token doesn't satisfy, so it has to be fetched
 * and attached separately. Same token source as
 * packages/portal-app/src/scaffolder/openChoreoTokenDecorator.ts (which
 * injects it as a secret for scaffolder *actions*); this attaches it
 * directly to fetches made by *field extensions* while the form is still
 * being filled in, before that decorator ever runs. Resolves to `{}` when
 * openchoreo.features.auth.enabled is off or the token fetch fails — fail
 * open, since every caller already treats a 401/error response as "show
 * the plain field instead".
 */
function useOpenChoreoAuthHeaders(): () => Promise<HeadersInit> {
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

/**
 * Decodes a JWT payload's role/group claim without verifying the signature
 * (orchestration-api verifies it server-side). Returns null when the token
 * isn't a decodable JWT, so the caller can fail open rather than wrongly
 * deny a role. Mirrors orchestration-api's own `user_has_role` claim lookup
 * (`roles` then `groups`).
 */
function decodeJwtRoles(token: string): string[] | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(
      decodeURIComponent(
        atob(normalized)
          .split('')
          .map(c => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join(''),
      ),
    ) as Record<string, unknown>;
    const roles = json.roles ?? json.groups;
    return Array.isArray(roles) ? roles.map(String) : [];
  } catch {
    return null;
  }
}

type RoleCheckState =
  | { status: 'loading' }
  | { status: 'resolved'; hasRole: boolean };

/**
 * Whether the signed-in user carries `role` on their Thunder token — the
 * frontend half of orchestration-api's own `user_has_role` gate (e.g.
 * release_strategy='instant' needs 'llm-ops-admin'). Fails open: auth
 * disabled (the local-dev bypass user has every role server-side) or an
 * undecodable token both resolve to hasRole=true, so this can never block a
 * run the backend would have allowed.
 */
function useHasRole(role: string): RoleCheckState {
  const configApi = useApi(configApiRef);
  const authApi = useApi(openChoreoAuthApiRef);
  const [state, setState] = useState<RoleCheckState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    const authEnabled =
      configApi.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;
    if (!authEnabled) {
      setState({ status: 'resolved', hasRole: true });
      return undefined;
    }
    authApi
      .getAccessToken()
      .then(token => {
        if (cancelled) return;
        const roles = token ? decodeJwtRoles(token) : null;
        setState({
          status: 'resolved',
          hasRole: roles === null ? true : roles.includes(role),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'resolved', hasRole: true });
      });
    return () => {
      cancelled = true;
    };
  }, [configApi, authApi, role]);
  return state;
}

/**
 * Coerces any list-endpoint body to a string array — accepts a bare JSON
 * array (`["a","b"]`, like GET /models returns) as well as a wrapped object
 * (`{names:[...]}`, `{versions:[...]}`, `{columns:[...]}`, `{features:[...]}`,
 * `{datasets:[...]}`, `{models:[...]}`). A 200 with an unexpected shape (or
 * a proxy error page that still parses) degrades to `[]` instead of pushing
 * `undefined` into state and white-screening the whole wizard on the next
 * `something.length` read in renderField.
 */
function toStringList(body: unknown): string[] {
  if (Array.isArray(body)) return body.map(String);
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    for (const key of [
      'names',
      'versions',
      'columns',
      'features',
      'datasets',
      'models',
      'sources',
    ]) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).map(String);
    }
  }
  return [];
}

/**
 * `&source=<source>` for the dataset read endpoints, or '' when unknown. The
 * backend uses it to read an s3 dataset straight from MinIO/S3 (the realistic
 * path a dev should see the preview come from) instead of a same-named local
 * file — see read_dataset_bytes in the orchestration-api.
 */
function datasetSourceQuery(source: unknown): string {
  return typeof source === 'string' && source
    ? `&source=${encodeURIComponent(source)}`
    : '';
}

/**
 * Fetches the current dataset's column names via orchestration-api
 * (GET /datasets/columns) whenever `datasetUri` is a non-empty string.
 * Returns `[]` (never throws into the caller) while unset, loading, or on
 * failure — every call site treats an empty list as "show the plain field
 * instead", so this never blocks the form.
 */
function useDatasetColumns(datasetUri: unknown, source?: unknown): string[] {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    if (typeof datasetUri !== 'string' || !datasetUri) {
      setColumns([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(
          `${proxyUrl}/orchestration-api/datasets/columns?dataset_uri=${encodeURIComponent(
            datasetUri,
          )}${datasetSourceQuery(source)}`,
          {
            headers,
          },
        ),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        if (!cancelled) setColumns(toStringList(body));
      })
      .catch(() => {
        if (!cancelled) setColumns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, datasetUri, source, getAuthHeaders]);

  return columns;
}

interface DatasetInfo {
  name: string;
  uri: string;
  size_bytes: number;
  /** Which IObjectStorageAdapter this came from — "local" (data/ checked
   * out on disk) or "s3" (MinIO/S3 bucket); see
   * adapters/composite_object_storage_adapter.py in the orchestration-api
   * repo. Grouped under a heading in the picker so a user picking a
   * dataset can tell a fast local file apart from one that needs the
   * bucket. */
  source: string;
}

const DATASET_SOURCE_LABELS: Record<string, string> = {
  local: 'Local',
  s3: 'S3 / Object storage',
};

/** Groups datasets by `source`, preserving the backend's ordering of both
 * the sources themselves and the datasets within each. */
function groupDatasetsBySource(
  datasets: DatasetInfo[],
): [string, DatasetInfo[]][] {
  const order: string[] = [];
  const groups = new Map<string, DatasetInfo[]>();
  for (const dataset of datasets) {
    if (!groups.has(dataset.source)) {
      order.push(dataset.source);
      groups.set(dataset.source, []);
    }
    groups.get(dataset.source)!.push(dataset);
  }
  return order.map(source => [source, groups.get(source)!]);
}

/**
 * The one dataset (if any) that `source` + `architecture`'s required file
 * type + `useCase`'s own `data/<...>-<useCase>/` directory (see
 * data/README.md) all narrow down to — mirrors the datasetPicker branch's
 * own scoping in renderField below, kept as one function so the auto-select
 * effect and the picker's option list can never drift apart. Returns
 * `undefined` (never guesses) when useCase isn't set yet, or when the
 * narrowing lands on zero or more than one dataset — same fail-open
 * contract as the `matching.length > 0` guard in renderField.
 */
function findDatasetForUseCase(
  datasets: DatasetInfo[],
  dataSource: string,
  architecture: unknown,
  useCase: unknown,
): DatasetInfo | undefined {
  if (typeof useCase !== 'string' || useCase.length === 0) return undefined;
  const wantsZip = architecture === 'cv';
  const suffix = `-${useCase}`;
  const matches = datasets.filter(
    d =>
      d.source === dataSource &&
      (typeof architecture !== 'string' ||
        d.name.toLowerCase().endsWith('.zip') === wantsZip) &&
      (d.name.split('/')[0] ?? '').endsWith(suffix),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Fetches the object store's dataset listing (GET /datasets) once on
 * mount. Returns `[]` (never throws) while loading or on failure — every
 * call site treats an empty list as "show the plain `file://` text field
 * instead", same fallback contract as useDatasetColumns above.
 */
interface DatasetsState {
  datasets: DatasetInfo[];
  loading: boolean;
}

function useDatasets(): DatasetsState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<DatasetsState>({
    datasets: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ datasets: [], loading: true });
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(`${proxyUrl}/orchestration-api/datasets`, { headers }),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        // GET /datasets returns {datasets:[...]}; coerce defensively so a
        // shape change degrades to "show the plain text field" ([]) instead
        // of crashing groupDatasetsBySource/renderField on undefined.
        if (!cancelled) {
          const list =
            Array.isArray(body) || !body || typeof body !== 'object'
              ? []
              : (body as { datasets?: unknown }).datasets;
          setState({
            datasets: Array.isArray(list) ? (list as DatasetInfo[]) : [],
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ datasets: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, getAuthHeaders]);

  return state;
}

interface RegisteredModel {
  name: string;
  version: string;
}

interface ModelsState {
  models: RegisteredModel[];
  loading: boolean;
}

/**
 * Fetches registered models (GET /models — name + latest version) once on
 * mount, for the "Continue training from an existing model" picker and the
 * modelNamePicker dropdown. Returns `{models: [], loading: false}` (never
 * throws) on failure, `loading: true` while in flight, same fail-open
 * contract as useDatasets above.
 */
function useModels(): ModelsState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<ModelsState>({
    models: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ models: [], loading: true });
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(`${proxyUrl}/orchestration-api/models`, { headers }),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        // GET /models returns a bare array today; accept a wrapped
        // {models:[...]} too so either shape keeps the pickers working.
        if (!cancelled) {
          const list =
            Array.isArray(body) || !body || typeof body !== 'object'
              ? body
              : (body as { models?: unknown }).models;
          setState({
            models: Array.isArray(list) ? (list as RegisteredModel[]) : [],
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ models: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, getAuthHeaders]);

  return state;
}

/**
 * Fetches `<feature_view>:<feature>` references (GET /features) once on
 * mount, for the Feature Enrichment panel's Feature names picker — same
 * fail-open contract as useDatasets/useModels above: an unapplied Feast
 * repo returns `[]` server-side already, but this also covers the request
 * itself failing.
 */
function useAvailableFeatures(): string[] {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [features, setFeatures] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(`${proxyUrl}/orchestration-api/features`, { headers }),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        if (!cancelled) setFeatures(toStringList(body));
      })
      .catch(() => {
        if (!cancelled) setFeatures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, getAuthHeaders]);

  return features;
}

interface ModelVersionsState {
  versions: string[];
  loading: boolean;
}

/**
 * Fetches every ACTUALLY REGISTERED version of `modelName` (GET
 * /models/{name}/versions), newest first — for the Evaluate & Deploy Model
 * template's `modelVersionPicker` field, so the version dropdown can never
 * offer a version that doesn't exist. Re-fetches whenever `modelName`
 * changes; returns `{versions: [], loading: false}` (never throws) while
 * `modelName` is empty or on failure, `loading: true` mid-fetch, same
 * fail-open contract as useModels above.
 */
function useModelVersions(modelName: unknown): ModelVersionsState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<ModelVersionsState>({
    versions: [],
    loading: false,
  });

  useEffect(() => {
    if (typeof modelName !== 'string' || !modelName) {
      setState({ versions: [], loading: false });
      return undefined;
    }
    let cancelled = false;
    setState({ versions: [], loading: true });
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(
          `${proxyUrl}/orchestration-api/models/${encodeURIComponent(
            modelName,
          )}/versions`,
          {
            headers,
          },
        ),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        if (!cancelled) {
          setState({ versions: toStringList(body), loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ versions: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, modelName, getAuthHeaders]);

  return state;
}

/**
 * Shared "fetch a flat name list once on mount" hook for the Prompt/RAG
 * collection/LLM model pickers below — same fail-open contract as
 * useModels/useAvailableFeatures: `[]` while loading, on failure, or if
 * the endpoint doesn't exist yet. orchestration-api (a separate repo)
 * doesn't expose GET /prompts, GET /rag/collections, or GET /llm-models
 * yet — every picker built on this hook just falls back to its plain
 * field until it does, same as any other picker with nothing loaded.
 */
function useNameList(path: string): string[] {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(`${proxyUrl}/orchestration-api${path}`, { headers }),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        if (!cancelled) setNames(toStringList(body));
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, getAuthHeaders, path]);

  return names;
}

/** Drafted persona keys (GET /prompts) — see the promptNamePicker GroupField flag's own doc comment. */
function usePrompts(): string[] {
  return useNameList('/prompts');
}

/** Drafted RAG collection names (GET /rag/collections) — see the ragCollectionPicker GroupField flag's own doc comment. */
function useRagCollections(): string[] {
  return useNameList('/rag/collections');
}

/** Judge/serving model_names configured in litellm-config.yaml (GET /llm-models) — see the llmModelPicker GroupField flag's own doc comment. */
function useLlmModels(): string[] {
  return useNameList('/llm-models');
}

/** Registered eval-set names (GET /eval-sets) — see the evalSetNamePicker GroupField flag's own doc comment. */
function useEvalSets(): string[] {
  return useNameList('/eval-sets');
}

/** Ingestable source docs (GET /rag/sources) — see the sourcePathsPicker GroupField flag's own doc comment. */
function useRagSources(): string[] {
  return useNameList('/rag/sources');
}

/** K8s Secret names in the namespace (GET /secrets) — see the secretPicker GroupField flag's own doc comment. */
function useSecretNames(): string[] {
  return useNameList('/secrets');
}

interface HuggingFaceModelInfo {
  modelId: string;
  exists: boolean;
  isGated: boolean;
  paramCountBillion: number | null;
  /** Architecture hints feeding GET /llm-deploy/gpu-recommendation — the
   * backend falls back to generic 7B-class defaults when any of these is
   * null, so every field is optional here. */
  maxContextLength: number | null;
  numLayers: number | null;
  hiddenSize: number | null;
  numAttentionHeads: number | null;
  numKeyValueHeads: number | null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

type HuggingFaceModelInfoState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'found'; info: HuggingFaceModelInfo }
  | { status: 'not_found'; message: string };

/**
 * Live GET /llm-deploy/validate-model lookup — mirrors useModelVersionCheck's
 * own debounced, fail-quiet contract exactly. Only a clean 404 counts as
 * "not found"; any other failure folds back to 'empty' so the form never
 * blocks on a preview fetch. Field names are read defensively (is_gated /
 * isGated, param_count_billion / paramCountBillion) so a backend field rename
 * degrades to "unknown" instead of crashing.
 */
function useHuggingFaceModelInfo(modelId: unknown): HuggingFaceModelInfoState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<HuggingFaceModelInfoState>({
    status: 'empty',
  });

  useEffect(() => {
    if (typeof modelId !== 'string' || !modelId) {
      setState({ status: 'empty' });
      return undefined;
    }
    setState({ status: 'loading' });
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          fetch(
            `${proxyUrl}/orchestration-api/llm-deploy/validate-model?huggingface_model_id=${encodeURIComponent(
              modelId,
            )}`,
            { headers },
          ),
        )
        .then(async res => {
          if (res.status === 404) {
            const body = await res.json().catch(() => ({ detail: undefined }));
            if (!cancelled) {
              setState({
                status: 'not_found',
                message:
                  typeof (body as { detail?: unknown }).detail === 'string'
                    ? (body as { detail: string }).detail
                    : `HuggingFace model ${modelId} not found`,
              });
            }
            return;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = ((await res.json()) ?? {}) as Record<string, unknown>;
          if (cancelled) return;
          // The backend answers exists:false (200) for an unknown id instead
          // of 404 — surface that the same way as a clean 404 above.
          if (body.exists === false) {
            setState({
              status: 'not_found',
              message: `HuggingFace model ${modelId} not found`,
            });
            return;
          }
          const rawGated = body.is_gated ?? body.isGated ?? body.gated;
          const rawParams =
            body.param_count_billion ??
            body.paramCountBillion ??
            body.params_billion;
          setState({
            status: 'found',
            info: {
              modelId,
              exists: true,
              isGated: rawGated === true,
              paramCountBillion: toNullableNumber(rawParams),
              maxContextLength: toNullableNumber(body.max_context_length),
              numLayers: toNullableNumber(body.num_layers),
              hiddenSize: toNullableNumber(body.hidden_size),
              numAttentionHeads: toNullableNumber(body.num_attention_heads),
              numKeyValueHeads: toNullableNumber(body.num_key_value_heads),
            },
          });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'empty' });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [discoveryApi, fetch, modelId, getAuthHeaders]);

  return state;
}

/** Debounced GET /llm-deploy/search-models for the HF model id autocomplete. */
function useHuggingFaceSearch(query: string): string[] {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          fetch(
            `${proxyUrl}/orchestration-api/llm-deploy/search-models?q=${encodeURIComponent(
              query,
            )}`,
            { headers },
          ),
        )
        .then(res => (res.ok ? res.json() : { model_ids: [] }))
        .then((body: { model_ids?: string[] }) => {
          if (!cancelled) setIds(body.model_ids ?? []);
        })
        .catch(() => {
          if (!cancelled) setIds([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [discoveryApi, fetch, getAuthHeaders, query]);
  return ids;
}

interface GpuRecommendation {
  /** VRAM the weights + KV cache need, per the backend estimator. */
  vramNeededGb: number | null;
  /** Cheapest fitting gpuType/gpuCount — null when nothing fits at up to
   * 8-way tensor parallelism (backend `recommended: null`). */
  gpuType: string | null;
  gpuCount: number | null;
}

type GpuRecommendationState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'found'; recommendation: GpuRecommendation };

interface GpuArchHints {
  maxContextLength?: unknown;
  numLayers?: unknown;
  hiddenSize?: unknown;
  numAttentionHeads?: unknown;
  numKeyValueHeads?: unknown;
}

/**
 * Live GET /llm-deploy/gpu-recommendation lookup — same debounced, fail-quiet
 * contract as useHuggingFaceModelInfo above. Matches the real backend shape
 * (routers/llm_serving.py `GpuRecommendationResponse`): `param_count_billion`
 * is REQUIRED server-side (a 422 without it folds back to 'empty' here, same
 * as any other fetch failure), `recommended` carries the cheapest fitting
 * gpuType/gpuCount and is null when nothing fits. Architecture hints come
 * from GET /llm-deploy/validate-model when the caller has them; the backend
 * substitutes generic 7B-class defaults for whatever is missing. Advisory
 * only — the caller never writes the recommendation back into formData.
 */
function useGpuRecommendation(
  paramCountBillion: unknown,
  quantization: unknown,
  hints: GpuArchHints = {},
): GpuRecommendationState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<GpuRecommendationState>({
    status: 'empty',
  });
  const {
    maxContextLength,
    numLayers,
    hiddenSize,
    numAttentionHeads,
    numKeyValueHeads,
  } = hints;

  useEffect(() => {
    if (typeof paramCountBillion !== 'number') {
      setState({ status: 'empty' });
      return undefined;
    }
    setState({ status: 'loading' });
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      params.set('param_count_billion', String(paramCountBillion));
      if (typeof quantization === 'string' && quantization)
        params.set('quantization', quantization);
      const numericHint = (value: unknown, key: string) => {
        if (typeof value === 'number' && !Number.isNaN(value))
          params.set(key, String(value));
      };
      numericHint(maxContextLength, 'max_context_length');
      numericHint(numLayers, 'num_layers');
      numericHint(hiddenSize, 'hidden_size');
      numericHint(numAttentionHeads, 'num_attention_heads');
      numericHint(numKeyValueHeads, 'num_key_value_heads');
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          fetch(
            `${proxyUrl}/orchestration-api/llm-deploy/gpu-recommendation?${params.toString()}`,
            {
              headers,
            },
          ),
        )
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<Record<string, unknown>>;
        })
        .then(body => {
          if (cancelled) return;
          const safe = (body ?? {}) as Record<string, unknown>;
          const recommended =
            safe.recommended && typeof safe.recommended === 'object'
              ? (safe.recommended as Record<string, unknown>)
              : null;
          const rawCount = recommended?.gpu_count;
          setState({
            status: 'found',
            recommendation: {
              vramNeededGb: toNullableNumber(safe.vram_needed_gb),
              gpuType:
                recommended && typeof recommended.gpu_type === 'string'
                  ? recommended.gpu_type
                  : null,
              gpuCount:
                typeof rawCount === 'number'
                  ? rawCount
                  : Number(rawCount) || null,
            },
          });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'empty' });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    discoveryApi,
    fetch,
    paramCountBillion,
    quantization,
    maxContextLength,
    numLayers,
    hiddenSize,
    numAttentionHeads,
    numKeyValueHeads,
    getAuthHeaders,
  ]);

  return state;
}

type RolloutEligibilityState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'found'; hasPriorDeploy: boolean };

/**
 * Live GET /llm-deploy/rollout-eligibility lookup — reports whether `modelName`
 * already has a deploy to roll from. Same fail-quiet contract as the hooks
 * above: empty modelName / fetch failure renders nothing, the real gate stays
 * the backend's own rejection at submit time.
 */
function useRolloutEligibility(modelName: unknown): RolloutEligibilityState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<RolloutEligibilityState>({
    status: 'empty',
  });

  useEffect(() => {
    if (typeof modelName !== 'string' || !modelName) {
      setState({ status: 'empty' });
      return undefined;
    }
    setState({ status: 'loading' });
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          fetch(
            `${proxyUrl}/orchestration-api/llm-deploy/rollout-eligibility?model_name=${encodeURIComponent(
              modelName,
            )}`,
            { headers },
          ),
        )
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<Record<string, unknown>>;
        })
        .then(body => {
          if (cancelled) return;
          const safe = (body ?? {}) as Record<string, unknown>;
          const raw =
            safe.has_prior_deploy ?? safe.hasPriorDeploy ?? safe.eligible;
          setState({ status: 'found', hasPriorDeploy: raw === true });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'empty' });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [discoveryApi, fetch, modelName, getAuthHeaders]);

  return state;
}

/**
 * Shared "fetch a dependent version list once `name` is set" hook for
 * promptVersionPicker/ragIndexVersionPicker below — mirrors
 * useModelVersions' own shape and fail-open contract exactly, just
 * parameterized by which name the versions belong to.
 */
function useVersionList(basePath: string, name: unknown): string[] {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [versions, setVersions] = useState<string[]>([]);

  useEffect(() => {
    if (typeof name !== 'string' || !name) {
      setVersions([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(
          `${proxyUrl}/orchestration-api${basePath}/${encodeURIComponent(
            name,
          )}/versions`,
          {
            headers,
          },
        ),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        if (!cancelled) setVersions(toStringList(body));
      })
      .catch(() => {
        if (!cancelled) setVersions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, name, getAuthHeaders, basePath]);

  return versions;
}

/** Drafted versions of one persona (GET /prompts/{name}/versions) — see the promptVersionPicker GroupField flag's own doc comment. */
function usePromptVersions(promptName: unknown): string[] {
  return useVersionList('/prompts', promptName);
}

/** Ingested versions of one RAG collection (GET /rag/collections/{name}/versions) — see the ragIndexVersionPicker GroupField flag's own doc comment. */
function useRagIndexVersions(collectionName: unknown): string[] {
  return useVersionList('/rag/collections', collectionName);
}

interface DatasetPreview {
  columns: string[];
  rows: Record<string, unknown>[];
}

const DATASET_PREVIEW_ROW_LIMIT = 10;

interface DatasetPreviewState {
  preview: DatasetPreview | null;
  loading: boolean;
}

/**
 * Fetches the chosen dataset's first rows (GET /datasets/preview) whenever
 * `datasetUri` is a non-empty string. Returns `{preview: null, loading: false}`
 * (never throws) while unset, `loading: true` while the read is in flight (so
 * the caller can show "loading from MinIO/S3…"), and `preview: null` on
 * failure — same fail-open contract as useDatasetColumns/useDatasets: a
 * non-CSV dataset (architecture=cv's `.zip`) legitimately fails here, and the
 * caller just renders nothing.
 */
function useDatasetPreview(
  datasetUri: unknown,
  source?: unknown,
): DatasetPreviewState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<DatasetPreviewState>({
    preview: null,
    loading: false,
  });

  useEffect(() => {
    if (typeof datasetUri !== 'string' || !datasetUri) {
      setState({ preview: null, loading: false });
      return undefined;
    }
    let cancelled = false;
    setState({ preview: null, loading: true });
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(
          `${proxyUrl}/orchestration-api/datasets/preview?dataset_uri=${encodeURIComponent(
            datasetUri,
          )}&limit=${DATASET_PREVIEW_ROW_LIMIT}${datasetSourceQuery(source)}`,
          { headers },
        ),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: unknown) => {
        if (!cancelled) {
          const obj = (body ?? {}) as Partial<DatasetPreview>;
          setState({
            preview: {
              columns: Array.isArray(obj.columns)
                ? obj.columns.map(String)
                : [],
              rows: Array.isArray(obj.rows)
                ? (obj.rows as Record<string, unknown>[])
                : [],
            },
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ preview: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, datasetUri, source, getAuthHeaders]);

  return state;
}

/**
 * Human label for a dataset's source, shown while the preview loads so a dev
 * can see the rows are being pulled from MinIO/S3 (the realistic path) rather
 * than a local file.
 */
function datasetSourceLabel(source: unknown): string {
  return source === 's3' ? 'MinIO/S3' : 'local storage';
}

/**
 * Read-only table of a dataset's first rows, inside a collapsible Accordion
 * (same collapsible visual language as StepLayoutUiOptions groups) so it
 * doesn't permanently take up space once a user has seen it. Shows a
 * "loading from MinIO/S3…" line plus skeleton rows while the read is in
 * flight, a "preview unavailable" line if it resolves empty/failed, and
 * nothing at all before a dataset is picked. Re-expands whenever
 * `datasetUri` changes — picking a different dataset should show its data,
 * not stay collapsed on whatever the previous dataset left it at.
 */
function DatasetPreviewPanel({
  datasetUri,
  source,
}: {
  datasetUri: unknown;
  source?: unknown;
}): JSX.Element | null {
  const { preview, loading } = useDatasetPreview(datasetUri, source);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => setExpanded(true), [datasetUri]);
  const hasDataset = typeof datasetUri === 'string' && datasetUri.length > 0;
  if (loading) {
    return (
      <Accordion expanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <CircularProgress size={16} />
            <Typography
              variant="overline"
              style={{ color: NEUTRAL.textSecondary, fontWeight: 700 }}
            >
              Loading data from {datasetSourceLabel(source)}…
            </Typography>
          </Box>
        </AccordionSummary>
        {/* Skeleton rows so the panel keeps its shape (and the read is
            visibly in flight) instead of collapsing to a bare line — a
            local file resolves in milliseconds, so without this the
            spinner alone is easy to miss. */}
        <AccordionDetails>
          <Table size="small">
            <TableBody data-testid="preview-skeleton">
              {[0, 1, 2].map(row => (
                <TableRow key={row}>
                  {[0, 1, 2, 3].map(col => (
                    <TableCell key={col}>
                      <Box
                        style={{
                          height: 12,
                          borderRadius: 4,
                          backgroundColor: NEUTRAL.border,
                          width: col === 0 ? '55%' : '80%',
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionDetails>
      </Accordion>
    );
  }
  if (!preview || preview.rows.length === 0) {
    // A dataset is chosen but the read failed or came back empty (e.g. a
    // non-CSV .zip for Computer Vision) — say so instead of vanishing, so
    // "no preview" reads as a fact about the dataset, not a broken form.
    if (!hasDataset) return null;
    return (
      <Accordion expanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant="overline"
            style={{ color: NEUTRAL.textSecondary, fontWeight: 700 }}
          >
            Preview unavailable for this dataset
          </Typography>
        </AccordionSummary>
      </Accordion>
    );
  }
  return (
    <Accordion
      expanded={expanded}
      onChange={(_e, isExpanded) => setExpanded(isExpanded)}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant="overline"
          style={{ color: NEUTRAL.textSecondary, fontWeight: 700 }}
        >
          Data preview (first {preview.rows.length} rows)
        </Typography>
        <Typography
          variant="overline"
          style={{ color: NEUTRAL.textSecondary, marginLeft: 8 }}
        >
          · from {datasetSourceLabel(source)}
        </Typography>
      </AccordionSummary>
      <AccordionDetails style={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {preview.columns.map(col => (
                <TableCell key={col}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {preview.rows.map((row, index) => (
              // eslint-disable-next-line react/no-array-index-key -- rows have no stable id of their own.
              <TableRow key={index}>
                {preview.columns.map(col => (
                  <TableCell key={col}>{String(row[col] ?? '')}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccordionDetails>
    </Accordion>
  );
}

interface DatasetValidationResult {
  check_name: string;
  severity: 'blocking' | 'warning' | 'info';
  message: string;
}

const VALIDATION_SEVERITY_COLOR: Record<
  DatasetValidationResult['severity'],
  string
> = {
  blocking: STATUS.error,
  warning: STATUS.warning,
  info: STATUS.success,
};

const VALIDATION_SEVERITY_LABEL: Record<
  DatasetValidationResult['severity'],
  string
> = {
  blocking: 'Error',
  warning: 'Warning',
  info: 'OK',
};

/**
 * Runs the same data-quality checks `orchestration:validate-dataset`
 * (steps: further down in the template) runs at submit time — POST
 * /datasets/validate — but interactively, the moment dataset/task/columns
 * are all picked, so a bad choice (e.g. a Time column that isn't actually
 * a date — see check_time_gaps) surfaces immediately instead of after the
 * whole 5-step wizard. Debounced 500ms since targetColumn/timeColumn can
 * be free-text fallback fields (no dataset picked yet) that fire on every
 * keystroke. Returns `null` (never throws) while inputs are incomplete,
 * in flight, or on failure — this is a live preview, not a submission
 * gate; the real gate stays the `steps:` action.
 */
function useDatasetValidation(
  datasetUri: unknown,
  taskType: unknown,
  targetColumn: unknown,
  timeColumn: unknown,
  source?: unknown,
): DatasetValidationResult[] | null {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [results, setResults] = useState<DatasetValidationResult[] | null>(
    null,
  );

  useEffect(() => {
    if (
      typeof datasetUri !== 'string' ||
      !datasetUri ||
      typeof taskType !== 'string' ||
      !taskType
    ) {
      setResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          fetch(`${proxyUrl}/orchestration-api/datasets/validate`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataset_uri: datasetUri,
              task_type: taskType,
              target_column:
                typeof targetColumn === 'string' && targetColumn
                  ? targetColumn
                  : undefined,
              time_column:
                typeof timeColumn === 'string' && timeColumn
                  ? timeColumn
                  : undefined,
              source: typeof source === 'string' && source ? source : undefined,
            }),
          }),
        )
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((body: unknown) => {
          if (!cancelled) {
            setResults(
              Array.isArray(body) ? (body as DatasetValidationResult[]) : null,
            );
          }
        })
        .catch(() => {
          if (!cancelled) setResults(null);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    discoveryApi,
    fetch,
    datasetUri,
    taskType,
    targetColumn,
    timeColumn,
    source,
    getAuthHeaders,
  ]);

  return results;
}

/** Color-coded list of live data-quality check results — see useDatasetValidation. Renders nothing until it resolves something. */
function DatasetValidationPanel({
  datasetUri,
  taskType,
  targetColumn,
  timeColumn,
  source,
}: {
  datasetUri: unknown;
  taskType: unknown;
  targetColumn: unknown;
  timeColumn: unknown;
  source?: unknown;
}): JSX.Element | null {
  const results = useDatasetValidation(
    datasetUri,
    taskType,
    targetColumn,
    timeColumn,
    source,
  );
  const [expanded, setExpanded] = useState(true);
  useEffect(() => setExpanded(true), [datasetUri, targetColumn, timeColumn]);
  if (!results || results.length === 0) return null;
  const blockingCount = results.filter(r => r.severity === 'blocking').length;
  return (
    <Accordion
      expanded={expanded}
      onChange={(_e, isExpanded) => setExpanded(isExpanded)}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant="overline"
          style={{ color: NEUTRAL.textSecondary, fontWeight: 700 }}
        >
          Data validation{' '}
          {blockingCount > 0
            ? `(${blockingCount} error${blockingCount > 1 ? 's' : ''})`
            : ''}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          display="flex"
          flexDirection="column"
          style={{ gap: 8, width: '100%' }}
        >
          {results.map(result => (
            <Box
              key={result.check_name}
              display="flex"
              alignItems="flex-start"
              style={{ gap: 8 }}
            >
              <Chip
                label={VALIDATION_SEVERITY_LABEL[result.severity]}
                size="small"
                style={{
                  backgroundColor: VALIDATION_SEVERITY_COLOR[result.severity],
                  color: '#FFF',
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2">{result.message}</Typography>
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

interface FeastEntityMatch {
  matched: number;
  total: number;
  sample_unmatched: string[];
}

/**
 * Live POST /datasets/feast-entity-match — how many of the chosen entity
 * column's values the Feast store actually knows. Debounced 500ms like
 * useDatasetValidation. Returns null while inputs are incomplete, in flight,
 * or on failure (fail-open, same as every other live panel here).
 */
function useFeastEntityMatch(
  datasetUri: unknown,
  entityIdColumn: unknown,
  source?: unknown,
): FeastEntityMatch | null {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [match, setMatch] = useState<FeastEntityMatch | null>(null);

  useEffect(() => {
    if (
      typeof datasetUri !== 'string' ||
      !datasetUri ||
      typeof entityIdColumn !== 'string' ||
      !entityIdColumn
    ) {
      setMatch(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          fetch(`${proxyUrl}/orchestration-api/datasets/feast-entity-match`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataset_uri: datasetUri,
              entity_id_column: entityIdColumn,
              source: typeof source === 'string' && source ? source : undefined,
            }),
          }),
        )
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((body: unknown) => {
          if (!cancelled) {
            const obj = (body ?? {}) as Partial<FeastEntityMatch>;
            setMatch({
              matched: typeof obj.matched === 'number' ? obj.matched : 0,
              total: typeof obj.total === 'number' ? obj.total : 0,
              sample_unmatched: Array.isArray(obj.sample_unmatched)
                ? obj.sample_unmatched.map(String)
                : [],
            });
          }
        })
        .catch(() => {
          if (!cancelled) setMatch(null);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [discoveryApi, fetch, datasetUri, entityIdColumn, source, getAuthHeaders]);

  return match;
}

/**
 * Warns when the chosen entity column shares no values with the Feast store —
 * the enrichment would still "succeed" but every feature would be NaN, which
 * is easy to miss. Renders nothing when everything matches.
 */
function FeastEntityMatchPanel({
  datasetUri,
  entityIdColumn,
  source,
}: {
  datasetUri: unknown;
  entityIdColumn: unknown;
  source?: unknown;
}): JSX.Element | null {
  const match = useFeastEntityMatch(datasetUri, entityIdColumn, source);
  if (!match || match.total === 0) return null;
  if (match.matched === match.total) {
    return (
      <Box display="flex" alignItems="center" style={{ gap: 6 }}>
        <CheckCircleIcon style={{ fontSize: 16, color: STATUS.success }} />
        <Typography variant="caption" style={{ color: NEUTRAL.textSecondary }}>
          All {match.total} entity ids match the Feature Store.
        </Typography>
      </Box>
    );
  }
  const allUnmatched = match.matched === 0;
  const color = allUnmatched ? STATUS.error : STATUS.warning;
  return (
    <Box
      style={{
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: 8,
      }}
    >
      <Box display="flex" alignItems="center" style={{ gap: 6 }}>
        <CancelIcon style={{ fontSize: 16, color }} />
        <Typography variant="body2" style={{ fontWeight: 600 }}>
          {allUnmatched
            ? 'No entity ids match the Feature Store'
            : `${match.total - match.matched} of ${
                match.total
              } entity ids don't match the Feature Store`}
        </Typography>
      </Box>
      <Typography variant="caption" style={{ color: NEUTRAL.textSecondary }}>
        {allUnmatched
          ? 'Every feature will come back empty — pick a dataset/column whose values the Feature Store knows, or the enrichment is a no-op.'
          : `Unmatched rows get empty features, e.g. ${match.sample_unmatched.join(
              ', ',
            )}.`}
      </Typography>
    </Box>
  );
}

interface DatasetPickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  datasets: DatasetInfo[];
  /** True while GET /datasets is in flight — shows a spinner + "Loading datasets…" instead of an empty dropdown. */
  loading?: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Same shape as ColumnPickerField — a Select whose options come from a live
 * API call instead of a JSON Schema enum. `datasets` is expected to already
 * be scoped to one source (see the sibling `dataSourcePicker: true` field,
 * which does that filtering) — this component doesn't know or care how
 * many sources exist upstream. `variant="outlined"` matters: this app's
 * theme renders a plain `FormControl`+`InputLabel`+`Select`'s label
 * invisibly (see plugins/openchoreo's TeamSelectField for the working
 * reference every picker in this file follows).
 */
function DatasetPickerField({
  name,
  title,
  description,
  required,
  datasets,
  loading,
  value,
  onChange,
}: DatasetPickerFieldProps): JSX.Element {
  const selected = typeof value === 'string' ? value : '';
  if (loading) {
    return (
      <TextField
        select
        fullWidth
        variant="outlined"
        label={`${title}${required ? '*' : ''}`}
        helperText={description}
        value=""
        disabled
        name={name}
        SelectProps={{ displayEmpty: true }}
        InputProps={{
          startAdornment: (
            <CircularProgress size={16} style={{ marginRight: 8 }} />
          ),
        }}
      >
        <MenuItem value="">Loading datasets…</MenuItem>
      </TextField>
    );
  }
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
    >
      {datasets.map(dataset => (
        <MenuItem key={dataset.uri} value={dataset.uri}>
          {dataset.name} ({(dataset.size_bytes / 1024).toFixed(1)} KB)
        </MenuItem>
      ))}
    </TextField>
  );
}

interface ReferenceDataLockedFieldProps {
  title: string;
  uri: string;
  modelName: string;
  modelVersion: string;
}

/**
 * Read-only display of a model version's training dataset, bound from MLflow
 * lineage (see the referenceDataUri effect in StepLayout). A disabled field
 * rather than a picker: the value is not a choice — drifting it to another
 * dataset would silently compare production against the wrong baseline.
 * Rendered only once the form value already equals the attached URI, so a
 * lineage URI outside the picker's own listing (e.g. an enriched file with
 * no .dvc sibling) never trips the picker's out-of-range error.
 */
function ReferenceDataLockedField({
  title,
  uri,
  modelName,
  modelVersion,
}: ReferenceDataLockedFieldProps): JSX.Element {
  return (
    <TextField
      fullWidth
      variant="outlined"
      label={title}
      value={uri}
      disabled
      helperText={`Attached from ${modelName}:${modelVersion} training data — change the model to change it.`}
    />
  );
}

interface DataSourcePickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  sources: string[];
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Select of the distinct `source` values found in the live GET /datasets listing — see the GroupField.dataSourcePicker doc comment. */
function DataSourcePickerField({
  name,
  title,
  description,
  required,
  sources,
  value,
  onChange,
}: DataSourcePickerFieldProps): JSX.Element {
  const selected = typeof value === 'string' ? value : '';
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
    >
      {sources.map(source => (
        <MenuItem key={source} value={source}>
          {DATASET_SOURCE_LABELS[source] ?? source}
        </MenuItem>
      ))}
    </TextField>
  );
}

interface BaseModelPickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  models: RegisteredModel[];
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Select of registered models — value is the `models:/<name>/<version>` MLflow Model Registry URI train.py's mlflow_sklearn/mlflow_pytorch load_model() expects. */
function BaseModelPickerField({
  name,
  title,
  description,
  required,
  models,
  value,
  onChange,
}: BaseModelPickerFieldProps): JSX.Element {
  const selected = typeof value === 'string' ? value : '';
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
    >
      {models.map(model => (
        <MenuItem
          key={`${model.name}:${model.version}`}
          value={`models:/${model.name}/${model.version}`}
        >
          {model.name} (v{model.version})
        </MenuItem>
      ))}
    </TextField>
  );
}

interface ActionOption {
  value: string;
  label: string;
  caption: string;
  Icon: typeof FlashOnIcon;
}

/** Evaluate & Deploy Model's own 4 `action` values — see the GroupField.actionPicker doc comment for why these are hardcoded here rather than read from the field's schema. */
const ACTION_OPTIONS: ActionOption[] = [
  {
    value: 'deploy',
    label: 'Deploy',
    caption: 'Evaluate and release a new version',
    Icon: FlashOnIcon,
  },
  {
    value: 'rollback',
    label: 'Rollback',
    caption: 'Instant cutover to an older version (dev)',
    Icon: UndoIcon,
  },
  {
    value: 'promote',
    label: 'Promote',
    caption: 'Open a PR to move a release to the next environment',
    Icon: TrendingUpIcon,
  },
  {
    value: 'promote-confirm',
    label: 'Promote — confirm',
    caption: 'Apply a promotion PR once it is merged',
    Icon: CheckCircleIcon,
  },
];

/**
 * A row of selectable cards replacing `action`'s plain enum `<select>` —
 * see GroupField.actionPicker's doc comment for why. "Selected" is shown
 * with a darker border + bold label, never a colored background/border
 * (packages/app/src/modules/theme/colors.ts's own rule: brand red never
 * appears on peer choice cards like "Choose" among equal template cards —
 * these 4 action cards are exactly that shape).
 */
function ActionPickerField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <Grid container spacing={1}>
      {ACTION_OPTIONS.map(option => {
        const selected = value === option.value;
        return (
          <Grid item xs={12} sm={6} key={option.value}>
            <Card
              onClick={() => onChange(option.value)}
              style={{
                cursor: 'pointer',
                border: `${selected ? 2 : 1}px solid ${
                  selected ? NEUTRAL.textPrimary : NEUTRAL.border
                }`,
                backgroundColor: selected ? NEUTRAL.paper : NEUTRAL.background,
              }}
              elevation={0}
            >
              <CardContent
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: 12,
                }}
              >
                <option.Icon
                  style={{
                    fontSize: 20,
                    marginTop: 2,
                    color: selected
                      ? NEUTRAL.textPrimary
                      : NEUTRAL.textSecondary,
                  }}
                />
                <Box>
                  <Typography
                    variant="body2"
                    style={{ fontWeight: selected ? 700 : 500 }}
                  >
                    {option.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    style={{ color: NEUTRAL.textSecondary }}
                  >
                    {option.caption}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

interface ChoiceCard {
  value: string;
  label: string;
  caption?: string;
  icon?: keyof typeof GROUP_ICONS;
  /** Optional per-option default threshold (schema `x-threshold`) — used by taskTypeMetrics to seed a metric's minimum-acceptable value. */
  threshold?: number;
  /** Optional task type this option belongs to (schema `x-task-type`) — used by taskTypeOptions to hide options that don't apply to the selected model. */
  taskType?: string;
}

/**
 * Reads card options from a field's own schema — `x-cards` (explicit, with
 * per-option caption/icon) wins; else `oneOf` const/title; else `enum`
 * (label = value). Returns `[]` when the field has none of these, so the
 * caller can fall back to the plain field.
 */
function choiceCardsFromSchema(schema: JSONSchema7): ChoiceCard[] {
  const explicit = (schema as { 'x-cards'?: unknown })['x-cards'];
  if (Array.isArray(explicit)) {
    return explicit.flatMap(entry => {
      const obj = (entry ?? {}) as Record<string, unknown>;
      if (typeof obj.value !== 'string') return [];
      return [
        {
          value: obj.value,
          label: typeof obj.label === 'string' ? obj.label : obj.value,
          caption: typeof obj.caption === 'string' ? obj.caption : undefined,
          icon:
            typeof obj.icon === 'string'
              ? (obj.icon as keyof typeof GROUP_ICONS)
              : undefined,
        },
      ];
    });
  }
  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.flatMap(entry => {
      const obj = entry as Record<string, unknown>;
      if (typeof obj.const !== 'string') return [];
      return [
        {
          value: obj.const,
          label: typeof obj.title === 'string' ? obj.title : obj.const,
          threshold:
            typeof obj['x-threshold'] === 'number'
              ? obj['x-threshold']
              : undefined,
          taskType:
            typeof obj['x-task-type'] === 'string'
              ? obj['x-task-type']
              : undefined,
        },
      ];
    });
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map(value => ({
      value: String(value),
      label: String(value),
    }));
  }
  return [];
}

/**
 * Generic row of selectable cards for an enum/oneOf field — same visual
 * shape as ActionPickerField, but options come from the field's schema
 * (see choiceCardsFromSchema) instead of a hardcoded list. Renders nothing
 * (caller falls back to the plain field) when the schema carries no options.
 */
function ChoiceCardsField({
  schema,
  value,
  onChange,
}: {
  schema: JSONSchema7;
  value: unknown;
  onChange: (value: string) => void;
}): JSX.Element | null {
  const options = choiceCardsFromSchema(schema);
  if (options.length === 0) return null;
  return (
    <Grid container spacing={1}>
      {options.map(option => {
        const selected = value === option.value;
        const Icon = option.icon ? GROUP_ICONS[option.icon] : undefined;
        return (
          <Grid item xs={12} sm={6} key={option.value}>
            <Card
              onClick={() => onChange(option.value)}
              style={{
                cursor: 'pointer',
                border: `${selected ? 2 : 1}px solid ${
                  selected ? NEUTRAL.textPrimary : NEUTRAL.border
                }`,
                backgroundColor: selected ? NEUTRAL.paper : NEUTRAL.background,
              }}
              elevation={0}
            >
              <CardContent
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: 12,
                }}
              >
                {Icon && (
                  <Icon
                    style={{
                      fontSize: 20,
                      marginTop: 2,
                      color: selected
                        ? NEUTRAL.textPrimary
                        : NEUTRAL.textSecondary,
                    }}
                  />
                )}
                <Box>
                  <Typography
                    variant="body2"
                    style={{ fontWeight: selected ? 700 : 500 }}
                  >
                    {option.label}
                  </Typography>
                  {option.caption && (
                    <Typography
                      variant="caption"
                      style={{ color: NEUTRAL.textSecondary }}
                    >
                      {option.caption}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

/**
 * Options for a multi-select array field — reads the field's own
 * `items.oneOf`/`items.enum` (the array shape) first, falling back to the
 * field's top-level `oneOf`/`enum` (a scalar field mistakenly flagged).
 * Reuses choiceCardsFromSchema so labels/captions stay identical to the
 * card renderer. Returns `[]` when the schema carries no options, so the
 * caller can fall back to the plain field.
 */
function multiSelectOptionsFromSchema(schema: JSONSchema7): ChoiceCard[] {
  const items = schema.items;
  if (items && typeof items === 'object' && !Array.isArray(items)) {
    const fromItems = choiceCardsFromSchema(items as JSONSchema7);
    if (fromItems.length > 0) return fromItems;
  }
  return choiceCardsFromSchema(schema);
}

interface MultiSelectFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  options: ChoiceCard[];
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Multi-select of a fixed option set (checkbox dropdown + chips) for an
 * array field — the array counterpart of ChoiceCardsField. Writes a string
 * array, so the template's `${{ parameters.<name> }}` reaches the action as
 * a real list. See the `multiSelect` GroupField flag's own doc comment.
 */
function MultiSelectField({
  name,
  title,
  description,
  required,
  options,
  value,
  onChange,
}: MultiSelectFieldProps): JSX.Element {
  const selected = Array.isArray(value) ? (value as string[]) : [];
  const labelFor = (val: string) =>
    options.find(option => option.value === val)?.label ?? val;
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
      SelectProps={{
        multiple: true,
        renderValue: (v: unknown) => (
          <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>
            {(v as string[]).map(val => (
              <Chip key={val} label={labelFor(val)} size="small" />
            ))}
          </Box>
        ),
      }}
    >
      {options.map(option => (
        <MenuItem key={option.value} value={option.value}>
          <Checkbox size="small" checked={selected.includes(option.value)} />
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** Metrics that only make sense for a classification model — see taskTypeMetrics. */
const CLASSIFICATION_METRICS = ['f1_score', 'accuracy', 'precision', 'recall'];
/** Metrics that only make sense for a regression model — see taskTypeMetrics. */
const REGRESSION_METRICS = ['rmse', 'mae', 'r2_score'];

/**
 * The metric names that apply to `taskType`, or `null` when the task type
 * isn't known yet (caller then shows every option rather than guessing).
 */
function metricsForTaskType(taskType: string | null): Set<string> | null {
  if (taskType === 'classification') return new Set(CLASSIFICATION_METRICS);
  if (taskType === 'regression') return new Set(REGRESSION_METRICS);
  return null;
}

/** Seed threshold for a metric — its schema `x-threshold` when set, else a task-type default (1.0 for an error metric, 0.85 for a score). */
function defaultMetricThreshold(
  option: { threshold?: number },
  taskType: string | null,
): number {
  if (typeof option.threshold === 'number') return option.threshold;
  return taskType === 'regression' ? 1 : 0.85;
}

interface TaskTypeMetricsFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  options: ChoiceCard[];
  /** The selected model version's task_type, or null while unknown. */
  taskType: string | null;
  /** Selected metric names (this field's own value). */
  value: unknown;
  /** Per-metric thresholds (the sibling `metricThresholds` object). */
  thresholds: unknown;
  onChange: (names: string[], thresholds: Record<string, number>) => void;
}

/**
 * Task-type-aware metrics table — the DevEx half of "don't make a Dev pick
 * a task type the model already declares". Shows only the metrics that
 * apply to the selected model's task_type, each with its own
 * minimum-acceptable threshold, and writes the metric names + thresholds
 * together so the two can never disagree. See the `taskTypeMetrics`
 * GroupField flag's own doc comment.
 */
function TaskTypeMetricsField({
  name,
  title,
  description,
  required,
  options,
  taskType,
  value,
  thresholds,
  onChange,
}: TaskTypeMetricsFieldProps): JSX.Element {
  const selected = Array.isArray(value) ? (value as string[]) : [];
  const thresholdMap =
    thresholds && typeof thresholds === 'object'
      ? (thresholds as Record<string, number>)
      : {};
  const filter = metricsForTaskType(taskType);
  const relevant = filter ? options.filter(o => filter.has(o.value)) : options;
  const isRegression = taskType === 'regression';

  // Prune metrics that don't belong to the (new) task type, and keep at
  // least one metric selected — so switching a model from classification to
  // regression can't leave `f1_score` (or its threshold) silently attached
  // to a regression model, and the required minItems:1 is always met.
  // Idempotent, so it runs every render like StepLayout's other binding
  // effects; re-seeding when empty (not just on a task-type change) also
  // survives a sibling effect's onChange landing in the same commit.
  useEffect(() => {
    if (!filter || !taskType) return;
    const relevantSelected = selected.filter(m => filter.has(m));
    const stale = selected.filter(m => !filter.has(m));
    const needsSeed = relevantSelected.length === 0 && relevant.length > 0;
    if (stale.length === 0 && !needsSeed) return;
    const nextThresholds = { ...thresholdMap };
    stale.forEach(metric => delete nextThresholds[metric]);
    let nextNames = relevantSelected;
    if (needsSeed) {
      const first = relevant[0];
      nextNames = [first.value];
      nextThresholds[first.value] = defaultMetricThreshold(first, taskType);
    }
    onChange(nextNames, nextThresholds);
  });

  const toggle = (metric: string, checked: boolean) => {
    const nextNames = checked
      ? [...selected, metric]
      : selected.filter(m => m !== metric);
    const nextThresholds = { ...thresholdMap };
    if (checked) {
      const option = options.find(o => o.value === metric) ?? {};
      nextThresholds[metric] = defaultMetricThreshold(option, taskType);
    } else {
      delete nextThresholds[metric];
    }
    onChange(nextNames, nextThresholds);
  };

  const setThreshold = (metric: string, raw: string) => {
    const nextThresholds = { ...thresholdMap };
    if (raw === '') delete nextThresholds[metric];
    else nextThresholds[metric] = Number(raw);
    onChange(selected, nextThresholds);
  };

  return (
    <Box>
      <Typography variant="subtitle2">
        {title}
        {required ? '*' : ''}
      </Typography>
      {description && (
        <Typography
          variant="caption"
          display="block"
          style={{ color: NEUTRAL.textSecondary, marginBottom: 4 }}
        >
          {description}
        </Typography>
      )}
      <Typography
        variant="caption"
        display="block"
        style={{ color: NEUTRAL.textSecondary, marginBottom: 8 }}
      >
        {taskType
          ? `Auto-applied for this model's task type: ${taskType}.`
          : 'Task type not detected yet — showing every metric.'}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Metric</TableCell>
            <TableCell>
              {isRegression ? 'Maximum acceptable error' : 'Minimum acceptable'}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {relevant.map(option => {
            const checked = selected.includes(option.value);
            return (
              <TableRow key={option.value}>
                <TableCell>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={checked}
                        onChange={e => toggle(option.value, e.target.checked)}
                      />
                    }
                    label={option.label}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    variant="outlined"
                    value={thresholdMap[option.value] ?? ''}
                    disabled={!checked}
                    onChange={e => setThreshold(option.value, e.target.value)}
                    inputProps={{
                      min: 0,
                      max: isRegression ? undefined : 1,
                      step: 0.01,
                    }}
                    name={`${name}-${option.value}`}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

interface TaskTypeOptionsFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  options: ChoiceCard[];
  taskType: string | null;
  value: unknown;
  onChange: (value: string) => void;
}

/**
 * Select whose options are filtered to the selected model's task_type (see
 * the `taskTypeOptions` GroupField flag). Clears a value that no longer
 * applies when the task type changes (e.g. a classifier algorithm left over
 * after switching to a regression model) so the select never shows a value
 * that isn't in its own list.
 */
function TaskTypeOptionsField({
  name,
  title,
  description,
  required,
  options,
  taskType,
  value,
  onChange,
}: TaskTypeOptionsFieldProps): JSX.Element {
  const filtered = taskType
    ? options.filter(
        option => option.taskType === undefined || option.taskType === taskType,
      )
    : options;
  const selected = typeof value === 'string' ? value : '';
  useEffect(() => {
    if (!taskType) return;
    if (selected && !filtered.some(option => option.value === selected)) {
      onChange(filtered[0]?.value ?? '');
    }
  });
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
    >
      {filtered.map(option => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

interface ModelNamePickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  modelNames: string[];
  /** True while GET /models is in flight — shows a spinner + "Loading models…" instead of an empty dropdown. */
  loading?: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Select of registered model NAMES only (deduped from GET /models) — unlike BaseModelPickerField, this writes the plain name string, not a models:/ URI, since Evaluate & Deploy Model's own actions take modelName/modelVersion as two separate params. */
function ModelNamePickerField({
  name,
  title,
  description,
  required,
  modelNames,
  loading,
  value,
  onChange,
}: ModelNamePickerFieldProps): JSX.Element {
  const selected = typeof value === 'string' ? value : '';
  if (loading) {
    return (
      <TextField
        select
        fullWidth
        variant="outlined"
        label={`${title}${required ? '*' : ''}`}
        helperText={description}
        value=""
        disabled
        name={name}
        SelectProps={{ displayEmpty: true }}
        InputProps={{
          startAdornment: (
            <CircularProgress size={16} style={{ marginRight: 8 }} />
          ),
        }}
      >
        <MenuItem value="">Loading models…</MenuItem>
      </TextField>
    );
  }
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
    >
      {modelNames.map(modelName => (
        <MenuItem key={modelName} value={modelName}>
          {modelName}
        </MenuItem>
      ))}
    </TextField>
  );
}

interface ModelVersionPickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  versions: string[];
  /** True while GET /models/{name}/versions is in flight — shows a spinner + "Loading versions…" instead of an empty dropdown. */
  loading?: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Select of the sibling modelName's actually-registered versions (GET /models/{name}/versions) — see the modelVersionPicker GroupField flag. */
function ModelVersionPickerField({
  name,
  title,
  description,
  required,
  versions,
  loading,
  value,
  onChange,
}: ModelVersionPickerFieldProps): JSX.Element {
  const selected = typeof value === 'string' ? value : '';
  if (loading) {
    return (
      <TextField
        select
        fullWidth
        variant="outlined"
        label={`${title}${required ? '*' : ''}`}
        helperText={description}
        value=""
        disabled
        name={name}
        SelectProps={{ displayEmpty: true }}
        InputProps={{
          startAdornment: (
            <CircularProgress size={16} style={{ marginRight: 8 }} />
          ),
        }}
      >
        <MenuItem value="">Loading versions…</MenuItem>
      </TextField>
    );
  }
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
    >
      {versions.map(version => (
        <MenuItem key={version} value={version}>
          v{version}
        </MenuItem>
      ))}
    </TextField>
  );
}

interface OptionPickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  options: string[];
  /** e.g. prefixing versions with "v" — ModelVersionPickerField's own formatting, inlined here so this one component covers both the name-only and version-list shapes below. */
  formatOption?: (option: string) => string;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Generic dropdown of a fetched string list — shared by the Prompt/RAG/LLM
 * model pickers (promptNamePicker, promptVersionPicker, ragCollectionPicker,
 * ragIndexVersionPicker, llmModelPicker). ModelNamePickerField/
 * ModelVersionPickerField above predate this and stay as they are rather
 * than being folded in, to avoid touching already-proven fields for a
 * stylistic consolidation.
 */
function OptionPickerField({
  name,
  title,
  description,
  required,
  options,
  formatOption,
  value,
  onChange,
}: OptionPickerFieldProps): JSX.Element {
  const selected = typeof value === 'string' ? value : '';
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
    >
      {/* Optional fields (e.g. evalSetName) need a way back to "unset" —
          without this, picking a value is one-way and the field's own
          `if`/ternary can never fall back to its alternative. Required
          pickers keep their current no-empty-option behavior. */}
      {!required && (
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
      )}
      {options.map(option => (
        <MenuItem key={option} value={option}>
          {formatOption ? formatOption(option) : option}
        </MenuItem>
      ))}
    </TextField>
  );
}

interface ComboPickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  options: string[];
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Free-solo combobox of a fetched string list — like OptionPickerField, but
 * the Dev can also type a value that isn't in the list yet. Used where the
 * field both reuses an existing name and can introduce a new one (Draft
 * Prompt's `promptName`, Draft Eval Set's `evalSetName`: pick an existing
 * one to add a version to, or type a new name to create one).
 * OptionPickerField stays a strict select for fields whose value must already
 * exist.
 */
function ComboPickerField({
  name,
  title,
  description,
  required,
  options,
  value,
  onChange,
}: ComboPickerFieldProps): JSX.Element {
  const selected = typeof value === 'string' ? value : '';
  return (
    <Autocomplete
      freeSolo
      fullWidth
      options={options}
      inputValue={selected}
      onInputChange={(_event, next) => onChange(next)}
      renderInput={params => (
        <TextField
          {...params}
          variant="outlined"
          label={`${title}${required ? '*' : ''}`}
          helperText={description}
          name={name}
        />
      )}
    />
  );
}

/** Free-solo autocomplete of real HF model ids — see huggingFaceModelPicker. */
function HuggingFaceModelPickerField({
  name,
  title,
  description,
  required,
  value,
  onChange,
}: {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  value: unknown;
  onChange: (value: string) => void;
}): JSX.Element {
  const selected = typeof value === 'string' ? value : '';
  const options = useHuggingFaceSearch(selected);
  return (
    <Autocomplete
      freeSolo
      fullWidth
      options={options}
      inputValue={selected}
      onInputChange={(_event, next) => onChange(next)}
      renderInput={params => (
        <TextField
          {...params}
          variant="outlined"
          label={`${title}${required ? '*' : ''}`}
          helperText={description}
          name={name}
        />
      )}
    />
  );
}

/**
 * Dropdown of curated model presets — see modelPresetPicker. Selecting a
 * preset is a one-shot patch of the sibling model + compute fields (applied
 * by the caller); `custom` is a no-op so a hand-typed model is never
 * clobbered.
 */
function ModelPresetPickerField({
  name,
  title,
  description,
  required,
  value,
  onChange,
}: {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  value: unknown;
  onChange: (value: string) => void;
}): JSX.Element {
  const selected =
    typeof value === 'string' && value ? value : CUSTOM_MODEL_PRESET;
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
    >
      {llmServingPresetKeys.map(key => (
        <MenuItem key={key} value={key}>
          {llmServingPresetLabel(key)}
        </MenuItem>
      ))}
    </TextField>
  );
}

interface ModelVersionSummary {
  name: string;
  version: string;
  task_type: string | null;
  metrics: Record<string, number>;
  tags: Record<string, string>;
  dataset_uri?: string | null;
}

type ModelVersionCheckState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'found'; summary: ModelVersionSummary }
  | { status: 'not_found'; message: string };

/**
 * Live GET /models/{name}/{version}/summary lookup — the frontend half of
 * this session's policy-check 404/400 fix: instead of only finding out a
 * model:version combination doesn't exist after the whole wizard submits
 * and the workflow fails downstream, this surfaces it the moment both
 * fields have values. Debounced 500ms like useDatasetValidation. Only a
 * clean 404 from the backend is treated as "not found" — the request
 * itself failing outright (network error, unrelated 5xx) fails quiet back
 * to 'empty', same non-blocking contract as every other live panel here;
 * the real gate stays the `policy-check` step.
 */
function useModelVersionCheck(
  modelName: unknown,
  modelVersion: unknown,
): ModelVersionCheckState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<ModelVersionCheckState>({
    status: 'empty',
  });

  useEffect(() => {
    if (
      typeof modelName !== 'string' ||
      !modelName ||
      typeof modelVersion !== 'string' ||
      !modelVersion
    ) {
      setState({ status: 'empty' });
      return undefined;
    }
    setState({ status: 'loading' });
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          fetch(
            `${proxyUrl}/orchestration-api/models/${encodeURIComponent(
              modelName,
            )}/${encodeURIComponent(modelVersion)}/summary`,
            { headers },
          ),
        )
        .then(async res => {
          if (res.status === 404) {
            const body = await res.json().catch(() => ({ detail: undefined }));
            if (!cancelled) {
              setState({
                status: 'not_found',
                message:
                  typeof body.detail === 'string'
                    ? body.detail
                    : `model version ${modelName}:${modelVersion} not found`,
              });
            }
            return;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const summary = ((await res.json()) ??
            {}) as Partial<ModelVersionSummary>;
          if (!cancelled) {
            setState({
              status: 'found',
              summary: {
                name:
                  typeof summary.name === 'string'
                    ? summary.name
                    : String(modelName),
                version:
                  typeof summary.version === 'string'
                    ? summary.version
                    : String(modelVersion),
                task_type:
                  typeof summary.task_type === 'string'
                    ? summary.task_type
                    : null,
                metrics:
                  summary.metrics && typeof summary.metrics === 'object'
                    ? summary.metrics
                    : {},
                tags:
                  summary.tags && typeof summary.tags === 'object'
                    ? summary.tags
                    : {},
                dataset_uri:
                  typeof summary.dataset_uri === 'string'
                    ? summary.dataset_uri
                    : null,
              },
            });
          }
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'empty' });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [discoveryApi, fetch, modelName, modelVersion, getAuthHeaders]);

  return state;
}

interface GateThresholdCheck {
  metric: string;
  minimum: number | null;
  maximum: number | null;
}

interface GateResult {
  passed: boolean;
  metrics: Record<string, number>;
  thresholds: GateThresholdCheck[];
}

type GatePreviewState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'found'; gate: GateResult }
  | { status: 'unavailable' };

/**
 * Live GET /models/{name}/{version}/gate-preview lookup — same debounced,
 * fail-quiet contract as useModelVersionCheck. Read-only preview of what
 * the "Run the Evaluate Gate" step would compute; no tag-writing side
 * effect (see that endpoint's own docstring, it's a separate read-only
 * route from POST /policy-check). 'unavailable' covers every non-preview
 * case (no task_type tag yet, any fetch failure) — the real gate step
 * still runs at submit time and reports the actual reason, this is
 * advisory only.
 */
function useGatePreview(
  modelName: unknown,
  modelVersion: unknown,
): GatePreviewState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<GatePreviewState>({ status: 'empty' });

  useEffect(() => {
    if (
      typeof modelName !== 'string' ||
      !modelName ||
      typeof modelVersion !== 'string' ||
      !modelVersion
    ) {
      setState({ status: 'empty' });
      return undefined;
    }
    setState({ status: 'loading' });
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          fetch(
            `${proxyUrl}/orchestration-api/models/${encodeURIComponent(
              modelName,
            )}/${encodeURIComponent(modelVersion)}/gate-preview`,
            { headers },
          ),
        )
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<Partial<GateResult>>;
        })
        .then(gate => {
          if (cancelled) return;
          // A 200 with a missing thresholds array would white-screen
          // GatePreviewPanel's thresholds.map — coerce instead.
          setState({
            status: 'found',
            gate: {
              passed: (gate ?? {}).passed === true,
              metrics:
                (gate ?? {}).metrics &&
                typeof (gate as GateResult).metrics === 'object'
                  ? (gate as GateResult).metrics
                  : {},
              thresholds: Array.isArray((gate ?? {}).thresholds)
                ? (gate as GateResult).thresholds
                : [],
            },
          });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'unavailable' });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [discoveryApi, fetch, modelName, modelVersion, getAuthHeaders]);

  return state;
}

/** One metric's pass/fail row — icon + value + the bound it's checked against. */
function formatThresholdBound(threshold: GateThresholdCheck): string {
  if (threshold.minimum !== null) return `≥ ${threshold.minimum}`;
  if (threshold.maximum !== null) return `≤ ${threshold.maximum}`;
  return '';
}

function GateThresholdRow({
  threshold,
  value,
}: {
  threshold: GateThresholdCheck;
  value: number | undefined;
}): JSX.Element {
  const met =
    value !== undefined &&
    (threshold.minimum === null || value >= threshold.minimum) &&
    (threshold.maximum === null || value <= threshold.maximum);
  const bound = formatThresholdBound(threshold);
  return (
    <Box display="flex" alignItems="center" style={{ gap: 6 }}>
      {met ? (
        <CheckCircleIcon
          style={{ fontSize: 16, color: STATUS.success, flexShrink: 0 }}
        />
      ) : (
        <CancelIcon
          style={{ fontSize: 16, color: STATUS.error, flexShrink: 0 }}
        />
      )}
      <Typography variant="body2">
        {threshold.metric}: {value ?? '—'}{' '}
        <span style={{ color: NEUTRAL.textSecondary }}>({bound})</span>
      </Typography>
    </Box>
  );
}

/**
 * Evaluate Gate pass/fail preview, one row per threshold — see
 * useGatePreview. Renders nothing while loading/empty/unavailable so it
 * never crowds the form with a panel that has nothing useful to say yet.
 */
function GatePreviewPanel({
  modelName,
  modelVersion,
}: {
  modelName: unknown;
  modelVersion: unknown;
}): JSX.Element | null {
  const state = useGatePreview(modelName, modelVersion);
  if (state.status !== 'found') return null;
  const { gate } = state;
  return (
    <Box
      style={{
        border: `1px solid ${NEUTRAL.border}`,
        borderRadius: 4,
        padding: 12,
        marginTop: 8,
      }}
    >
      <Chip
        label={
          gate.passed
            ? 'Evaluate Gate: would PASS'
            : 'Evaluate Gate: would FAIL'
        }
        size="small"
        style={{
          backgroundColor: gate.passed ? STATUS.success : STATUS.error,
          color: '#FFF',
          marginBottom: 8,
        }}
      />
      {gate.thresholds.map(threshold => (
        <GateThresholdRow
          key={threshold.metric}
          threshold={threshold}
          value={gate.metrics[threshold.metric]}
        />
      ))}
    </Box>
  );
}

/**
 * Color-coded early-warning panel for Evaluate & Deploy Model's
 * modelName/modelVersion pair — see useModelVersionCheck. Renders nothing
 * until both fields are filled in. Also shows GatePreviewPanel below the
 * metrics line, except for a rollback — action=rollback never re-runs the
 * Evaluate Gate at all (see prepare_deploy_manifest's own comment on
 * that), so previewing it there would suggest a check that doesn't
 * actually happen.
 */
function ModelVersionCheckPanel({
  modelName,
  modelVersion,
  action,
}: {
  modelName: unknown;
  modelVersion: unknown;
  action?: unknown;
}): JSX.Element | null {
  const state = useModelVersionCheck(modelName, modelVersion);
  if (state.status === 'empty') return null;
  if (state.status === 'loading') {
    return (
      <Typography variant="body2" style={{ color: NEUTRAL.textSecondary }}>
        Checking whether this model version exists…
      </Typography>
    );
  }
  if (state.status === 'not_found') {
    return (
      <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
        <Chip
          label="Not found"
          size="small"
          style={{
            backgroundColor: STATUS.error,
            color: '#FFF',
            flexShrink: 0,
          }}
        />
        <Typography variant="body2">{state.message}</Typography>
      </Box>
    );
  }
  const { summary } = state;
  const metricsText = Object.entries(summary.metrics)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return (
    <>
      <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
        <Chip
          label="Found"
          size="small"
          style={{
            backgroundColor: STATUS.success,
            color: '#FFF',
            flexShrink: 0,
          }}
        />
        <Typography variant="body2">
          {summary.task_type
            ? `task_type: ${summary.task_type}`
            : 'no task_type tag set'}
          {metricsText && ` — ${metricsText}`}
        </Typography>
      </Box>
      {action !== 'rollback' && (
        <GatePreviewPanel modelName={modelName} modelVersion={modelVersion} />
      )}
    </>
  );
}

/**
 * Live HuggingFace model check for llm-serve-deploy's `huggingFaceModelId` field —
 * see useHuggingFaceModelInfo. Tells the Dev whether the typed id resolves
 * and whether it is gated (gated => `hfTokenSecretRef` becomes required
 * server-side). Advisory only; the real check stays the backend's own
 * validation at submit time.
 */
function HuggingFaceModelValidatorPanel({
  modelId,
}: {
  modelId: unknown;
}): JSX.Element | null {
  const state = useHuggingFaceModelInfo(modelId);
  if (state.status === 'empty' || state.status === 'loading') return null;
  if (state.status === 'not_found') {
    return (
      <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
        <Chip
          label="Not found"
          size="small"
          style={{
            backgroundColor: STATUS.error,
            color: '#FFF',
            flexShrink: 0,
          }}
        />
        <Typography variant="body2">{state.message}</Typography>
      </Box>
    );
  }
  const { info } = state;
  return (
    <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
      <Chip
        label={info.isGated ? 'Gated' : 'Public'}
        size="small"
        style={{
          backgroundColor: info.isGated ? STATUS.warning : STATUS.success,
          color: '#FFF',
          flexShrink: 0,
        }}
      />
      <Typography variant="body2">
        {info.modelId}
        {info.paramCountBillion !== null &&
          ` — ~${info.paramCountBillion}B params`}
        {info.isGated
          ? ' — gated model: fill hfTokenSecretRef (Secret name, not the token).'
          : ' — public model: no HF token needed.'}
      </Typography>
    </Box>
  );
}

/**
 * GPU suggestion for llm-serve-deploy's compute fields — reads the param count +
 * architecture hints from useHuggingFaceModelInfo plus the step's
 * quantization/maxContextLength, then surfaces GET
 * /llm-deploy/gpu-recommendation's cheapest fitting gpuType/gpuCount (or its
 * explicit "nothing fits" case). Never writes back into formData; the Dev
 * still picks explicitly.
 */
function GpuRecommendationPanel({
  modelId,
  quantization,
  maxContextLength,
}: {
  modelId: unknown;
  quantization: unknown;
  maxContextLength: unknown;
}): JSX.Element | null {
  const hfState = useHuggingFaceModelInfo(modelId);
  const info = hfState.status === 'found' ? hfState.info : undefined;
  const recState = useGpuRecommendation(info?.paramCountBillion, quantization, {
    maxContextLength:
      typeof maxContextLength === 'number'
        ? maxContextLength
        : info?.maxContextLength,
    numLayers: info?.numLayers,
    hiddenSize: info?.hiddenSize,
    numAttentionHeads: info?.numAttentionHeads,
    numKeyValueHeads: info?.numKeyValueHeads,
  });
  if (recState.status !== 'found') return null;
  const { recommendation } = recState;
  const vramText =
    recommendation.vramNeededGb !== null
      ? `needs ~${recommendation.vramNeededGb} GB VRAM`
      : null;
  if (!recommendation.gpuType || !recommendation.gpuCount) {
    return (
      <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
        <Chip
          label="No fit"
          size="small"
          style={{
            backgroundColor: STATUS.error,
            color: '#FFF',
            flexShrink: 0,
          }}
        />
        <Typography variant="body2">
          No GPU configuration fits at up to 8-way tensor parallelism
          {vramText ? ` (${vramText})` : ''} — pick a smaller model or a larger
          quantization before submitting.
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      style={{
        border: `1px solid ${NEUTRAL.border}`,
        borderRadius: 4,
        padding: 12,
      }}
    >
      <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 4 }}>
        Suggested GPU — {recommendation.gpuType} x{recommendation.gpuCount}
      </Typography>
      {vramText && (
        <Typography variant="body2" style={{ color: NEUTRAL.textSecondary }}>
          {vramText} (weights + KV cache estimate).
        </Typography>
      )}
    </Box>
  );
}

/**
 * Rollout gate for llm-serve-deploy's `deployStrategy` field — see
 * useRolloutEligibility. When there is no prior deploy, canary / a-b /
 * blue-green will be rejected server-side, so this warns before submit
 * instead of after the whole wizard runs.
 */
function RolloutEligibilityGatePanel({
  modelName,
}: {
  modelName: unknown;
}): JSX.Element | null {
  const state = useRolloutEligibility(modelName);
  if (state.status !== 'found') return null;
  return (
    <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
      <Chip
        label={state.hasPriorDeploy ? 'Prior deploy found' : 'First deploy'}
        size="small"
        style={{
          backgroundColor: state.hasPriorDeploy
            ? STATUS.success
            : STATUS.warning,
          color: '#FFF',
          flexShrink: 0,
        }}
      />
      <Typography variant="body2">
        {state.hasPriorDeploy
          ? 'Canary / A-B / Blue-Green are available — a prior deploy exists to roll from.'
          : 'No prior deploy yet — keep Direct; canary / a-b / blue-green will be rejected.'}
      </Typography>
    </Box>
  );
}

/**
 * Role gate for llm-serve-deploy's `releaseStrategy` field — see useHasRole.
 * release_strategy='instant' needs 'llm-ops-admin' server-side; without it
 * the run 403s at prepare time. Renders nothing outside environment=dev
 * (instant isn't offered there anyway) or while the role check is loading.
 */
function ReleaseEligibilityPanel({
  environment,
  roleState,
}: {
  environment: unknown;
  roleState: RoleCheckState;
}): JSX.Element | null {
  if (environment !== 'dev' || roleState.status !== 'resolved') return null;
  return (
    <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
      <Chip
        label={roleState.hasRole ? 'Instant available' : 'Instant needs a role'}
        size="small"
        style={{
          backgroundColor: roleState.hasRole ? STATUS.success : STATUS.warning,
          color: '#FFF',
          flexShrink: 0,
        }}
      />
      <Typography variant="body2">
        {roleState.hasRole
          ? 'You have llm-ops-admin — instant deploys are available.'
          : "instant requires the 'llm-ops-admin' role — without it the run 403s, so this form falls back to pr-gated."}
      </Typography>
    </Box>
  );
}

type LiveVersionState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'found'; summary: ModelVersionSummary };

/**
 * Whatever's actually live right now for `modelName` — GET
 * /models/{name}/deploy-status for the live version number, then GET
 * /models/{name}/{live_version}/summary for its metrics. `status: 'none'`
 * covers both "nothing deployed yet" and any fetch failure — same
 * fail-quiet contract as useModelVersionCheck, this is an advisory
 * comparison, never a gate.
 */
function useCurrentLiveVersionSummary(modelName: unknown): LiveVersionState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<LiveVersionState>({ status: 'loading' });

  useEffect(() => {
    if (typeof modelName !== 'string' || !modelName) {
      setState({ status: 'none' });
      return undefined;
    }
    setState({ status: 'loading' });
    let cancelled = false;
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(
          `${proxyUrl}/orchestration-api/models/${encodeURIComponent(
            modelName,
          )}/deploy-status`,
          {
            headers,
          },
        )
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json() as Promise<
              Partial<{ deployed: boolean; live_version: string | null }>
            >;
          })
          .then(deployStatus => {
            if (
              !deployStatus ||
              !deployStatus.deployed ||
              !deployStatus.live_version
            ) {
              return null;
            }
            return fetch(
              `${proxyUrl}/orchestration-api/models/${encodeURIComponent(
                modelName,
              )}/${encodeURIComponent(deployStatus.live_version)}/summary`,
              { headers },
            ).then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json() as Promise<ModelVersionSummary>;
            });
          }),
      )
      .then(summary => {
        if (cancelled) return;
        setState(summary ? { status: 'found', summary } : { status: 'none' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'none' });
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, modelName, getAuthHeaders]);

  return state;
}

/**
 * Side-by-side accuracy/latency-style metrics for the currently-live
 * version vs. the version about to be deployed — see the
 * GroupField.versionComparison doc comment for why (a Canary/A-B traffic
 * percent otherwise has nothing to compare against). Renders nothing when
 * there's no prior deploy, no new-version data yet, or both point at the
 * same version (comparing a version to itself is not useful).
 */
function VersionComparisonPanel({
  modelName,
  newVersion,
}: {
  modelName: unknown;
  newVersion: unknown;
}): JSX.Element | null {
  const live = useCurrentLiveVersionSummary(modelName);
  const incoming = useModelVersionCheck(modelName, newVersion);

  if (live.status !== 'found' || incoming.status !== 'found') return null;
  if (live.summary.version === incoming.summary.version) return null;

  const metricNames = Array.from(
    new Set([
      ...Object.keys(live.summary.metrics),
      ...Object.keys(incoming.summary.metrics),
    ]),
  );
  if (metricNames.length === 0) return null;

  return (
    <Box
      style={{
        border: `1px solid ${NEUTRAL.border}`,
        borderRadius: 4,
        padding: 12,
      }}
    >
      <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 8 }}>
        Live (v{live.summary.version}) vs. new (v{incoming.summary.version})
      </Typography>
      <Grid container spacing={1}>
        {metricNames.map(metric => (
          <Fragment key={metric}>
            <Grid item xs={4}>
              <Typography
                variant="body2"
                style={{ color: NEUTRAL.textSecondary }}
              >
                {metric}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="body2">
                {live.summary.metrics[metric] ?? '—'}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="body2">
                {incoming.summary.metrics[metric] ?? '—'}
              </Typography>
            </Grid>
          </Fragment>
        ))}
      </Grid>
    </Box>
  );
}

interface CostEstimate {
  estimatedCost: number;
  currency: string;
  breakdown: Record<string, number>;
}

interface CostCheck {
  level: 'ok' | 'warn' | 'fail';
  budget: number | null;
  reasons: string[];
  alternatives: string[];
}

type CostEstimateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; estimate: CostEstimate; check: CostCheck }
  | { status: 'error' };

const COST_LEVEL_TONE: Record<
  CostCheck['level'],
  { color: string; label: string }
> = {
  ok: { color: STATUS.success, label: 'Within budget' },
  warn: { color: STATUS.warning, label: 'Near budget' },
  fail: { color: STATUS.error, label: 'Over budget' },
};

/** Every `when` entry must equal the current formData value. */
function matchesWhen(
  when: Record<string, unknown> | undefined,
  data: Record<string, unknown>,
): boolean {
  if (!when) return true;
  return Object.entries(when).every(([key, value]) => data[key] === value);
}

/** First non-empty string among the configured artifact fields. */
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

/** Forward the configured param fields that currently hold a value. */
function buildCostParams(
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

function formatCostUsd(value: number, currency: string): string {
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

/**
 * Live POST /costs/estimate + /costs/check lookup — the pre-flight half of
 * the `orchestration:estimate-cost` / `orchestration:cost-gate` steps, so a
 * Dev sees the cost and budget impact before running the golden path. Same
 * debounced, fail-quiet contract as useGpuRecommendation above: a 500ms
 * debounce, in-flight cancellation on change, and any failure folds into
 * 'error' (the panel then shows a one-line notice, never blocks the form).
 */
function useCostEstimate(
  opts: CostEstimateOptions,
  data: Record<string, unknown>,
): CostEstimateState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<CostEstimateState>({ status: 'idle' });

  const active = matchesWhen(opts.when, data);
  const artifact = firstNonEmptyString(opts.artifactFields, data);
  const params = buildCostParams(opts.paramFields, data);
  // Stable key so the effect only refires when the payload actually changes
  // (params is a fresh object every render).
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!active || !artifact) {
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
        golden_path: opts.goldenPath,
        stage: opts.stage,
        artifact,
        params,
      };
      const jsonHeaders = (headers: HeadersInit): HeadersInit => ({
        ...(headers as Record<string, string>),
        'Content-Type': 'application/json',
      });
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          Promise.all([
            fetch(`${proxyUrl}/orchestration-api/costs/estimate`, {
              method: 'POST',
              headers: jsonHeaders(headers),
              body: JSON.stringify(payload),
            }),
            fetch(`${proxyUrl}/orchestration-api/costs/check`, {
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
          setState({
            status: 'ready',
            estimate: {
              estimatedCost: toNullableNumber(estimateBody.estimated_cost) ?? 0,
              currency:
                typeof estimateBody.currency === 'string'
                  ? estimateBody.currency
                  : 'USD',
              breakdown:
                estimateBody.breakdown &&
                typeof estimateBody.breakdown === 'object'
                  ? (estimateBody.breakdown as Record<string, number>)
                  : {},
            },
            check: {
              level:
                checkBody.level === 'warn' || checkBody.level === 'fail'
                  ? checkBody.level
                  : 'ok',
              budget: toNullableNumber(checkBody.budget),
              reasons: Array.isArray(checkBody.reasons)
                ? checkBody.reasons.map(String)
                : [],
              alternatives: Array.isArray(checkBody.alternatives)
                ? checkBody.alternatives.map(String)
                : [],
            },
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
  }, [
    discoveryApi,
    fetch,
    getAuthHeaders,
    active,
    artifact,
    paramsKey,
    opts.goldenPath,
    opts.stage,
  ]);

  return state;
}

/**
 * Pre-flight cost panel — estimated cost, budget status, gate reasons and
 * the per-component breakdown, all from the same APIs the golden path's own
 * estimate/gate steps call at submit time. Renders nothing until the
 * artifact is set (or when `when` doesn't match), so it never shows an
 * empty box on an unrelated branch.
 */
function CostEstimatePanel({
  opts,
  data,
}: {
  opts: CostEstimateOptions;
  data: Record<string, unknown>;
}): JSX.Element | null {
  const state = useCostEstimate(opts, data);

  if (state.status === 'idle') return null;

  const box = (children: ReactNode) => (
    <Box
      style={{
        border: `1px solid ${NEUTRAL.border}`,
        borderRadius: 4,
        padding: 12,
      }}
    >
      {children}
    </Box>
  );

  if (state.status === 'loading') {
    return box(
      <Typography variant="body2" style={{ color: NEUTRAL.textSecondary }}>
        Estimating {opts.stage} cost…
      </Typography>,
    );
  }
  if (state.status === 'error') {
    return box(
      <Typography variant="body2" style={{ color: NEUTRAL.textSecondary }}>
        Cost estimate unavailable right now.
      </Typography>,
    );
  }

  const { estimate, check } = state;
  const tone = COST_LEVEL_TONE[check.level];
  const breakdownEntries = Object.entries(estimate.breakdown).filter(
    ([, value]) => typeof value === 'number' && value > 0,
  );

  return box(
    <>
      <Box
        display="flex"
        alignItems="baseline"
        justifyContent="space-between"
        style={{ gap: 8 }}
      >
        <Typography variant="body2" style={{ fontWeight: 600 }}>
          Estimated {opts.stage} cost
        </Typography>
        <Typography variant="h6" style={{ fontWeight: 700 }}>
          {formatCostUsd(estimate.estimatedCost, estimate.currency)}
        </Typography>
      </Box>
      {check.budget !== null && (
        <Box
          display="flex"
          alignItems="center"
          style={{ gap: 8, marginTop: 4 }}
        >
          <Chip
            label={tone.label}
            size="small"
            style={{ backgroundColor: tone.color, color: '#FFF' }}
          />
          <Typography variant="body2" style={{ color: NEUTRAL.textSecondary }}>
            Budget {formatCostUsd(check.budget, estimate.currency)}
          </Typography>
        </Box>
      )}
      {check.reasons.length > 0 && (
        <Box marginTop={1}>
          {check.reasons.map((reason, index) => (
            <Typography
              key={index}
              variant="body2"
              style={{ color: NEUTRAL.textSecondary }}
            >
              • {reason}
            </Typography>
          ))}
        </Box>
      )}
      {check.alternatives.length > 0 && (
        <Typography
          variant="body2"
          style={{ color: NEUTRAL.textSecondary, marginTop: 4 }}
        >
          Alternatives: {check.alternatives.join('; ')}
        </Typography>
      )}
      {breakdownEntries.length > 0 && (
        <Box marginTop={1}>
          {breakdownEntries.map(([key, value]) => (
            <Typography
              key={key}
              variant="body2"
              style={{ color: NEUTRAL.textSecondary }}
            >
              {key}: {formatCostUsd(value, estimate.currency)}
            </Typography>
          ))}
        </Box>
      )}
      <Typography
        variant="caption"
        style={{
          color: NEUTRAL.textSecondary,
          display: 'block',
          marginTop: 8,
        }}
      >
        Pre-flight estimate — the actual cost may differ.
      </Typography>
    </>,
  );
}

interface SecurityFinding {
  control: string;
  pillar: string;
  severity: 'blocking' | 'warning';
  message: string;
}

interface SecurityControlStatus {
  id: string;
  pillar: string;
  label: string;
  status: 'enforced' | 'missing' | 'not-applicable';
}

interface SecurityScan {
  passed: boolean;
  score: number;
  findings: SecurityFinding[];
  controls: SecurityControlStatus[];
}

type SecurityScanState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; scan: SecurityScan }
  | { status: 'error' };

const PILLAR_LABELS: Record<string, string> = {
  'model-governance': 'Model Registry Governance',
  'data-isolation': 'Data Isolation',
  'prompt-security': 'Prompt Security',
  'inference-audit': 'Inference Audit',
};

/**
 * Live POST /security/scan lookup — the pre-flight half of the
 * `orchestration:security-scan` step, so a Dev sees the security posture and
 * any blocking finding before running the golden path. Same debounced,
 * fail-quiet contract as useCostEstimate above.
 */
function useSecurityScan(
  opts: SecurityScanOptions,
  data: Record<string, unknown>,
): SecurityScanState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<SecurityScanState>({ status: 'idle' });

  const active = matchesWhen(opts.when, data);
  const artifact = firstNonEmptyString(opts.artifactFields, data);
  const params = buildCostParams(opts.paramFields, data);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!active || !artifact) {
      setState(prev => (prev.status === 'idle' ? prev : { status: 'idle' }));
      return undefined;
    }
    setState(prev =>
      prev.status === 'loading' ? prev : { status: 'loading' },
    );
    let cancelled = false;
    const timer = setTimeout(() => {
      const payload = {
        golden_path: opts.goldenPath,
        stage: opts.stage,
        artifact,
        params,
      };
      Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
        .then(([proxyUrl, headers]) =>
          fetch(`${proxyUrl}/orchestration-api/security/scan`, {
            method: 'POST',
            headers: {
              ...(headers as Record<string, string>),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }),
        )
        .then(async response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body = (await response.json()) as Record<string, unknown>;
          if (cancelled) return;
          setState({
            status: 'ready',
            scan: {
              passed: body.passed === true,
              score: toNullableNumber(body.score) ?? 0,
              findings: Array.isArray(body.findings)
                ? (body.findings as SecurityFinding[])
                : [],
              controls: Array.isArray(body.controls)
                ? (body.controls as SecurityControlStatus[])
                : [],
            },
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
  }, [
    discoveryApi,
    fetch,
    getAuthHeaders,
    active,
    artifact,
    paramsKey,
    opts.goldenPath,
    opts.stage,
  ]);

  return state;
}

/**
 * Pre-flight security panel — posture score, blocking/warning findings and
 * the per-surface control status, all from the same API the golden path's
 * own security-scan step calls at submit time. Renders nothing until the
 * artifact is set (or when `when` doesn't match).
 */
function SecurityScanPanel({
  opts,
  data,
}: {
  opts: SecurityScanOptions;
  data: Record<string, unknown>;
}): JSX.Element | null {
  const state = useSecurityScan(opts, data);

  if (state.status === 'idle') return null;

  const box = (children: ReactNode) => (
    <Box
      style={{
        border: `1px solid ${NEUTRAL.border}`,
        borderRadius: 4,
        padding: 12,
      }}
    >
      {children}
    </Box>
  );

  if (state.status === 'loading') {
    return box(
      <Typography variant="body2" style={{ color: NEUTRAL.textSecondary }}>
        Scanning security posture…
      </Typography>,
    );
  }
  if (state.status === 'error') {
    return box(
      <Typography variant="body2" style={{ color: NEUTRAL.textSecondary }}>
        Security scan unavailable right now.
      </Typography>,
    );
  }

  const { scan } = state;
  const tone = scan.passed ? STATUS.success : STATUS.error;
  const missing = scan.controls.filter(c => c.status === 'missing');

  return box(
    <>
      <Box
        display="flex"
        alignItems="baseline"
        justifyContent="space-between"
        style={{ gap: 8 }}
      >
        <Typography variant="body2" style={{ fontWeight: 600 }}>
          Security posture
        </Typography>
        <Chip
          label={`${scan.score}/100`}
          size="small"
          style={{ backgroundColor: tone, color: '#FFF' }}
        />
      </Box>
      {scan.findings.length === 0 ? (
        <Typography
          variant="body2"
          style={{ color: NEUTRAL.textSecondary, marginTop: 4 }}
        >
          All required controls are in place.
        </Typography>
      ) : (
        <Box marginTop={1}>
          {scan.findings.map((finding, index) => (
            <Typography
              key={index}
              variant="body2"
              style={{
                color:
                  finding.severity === 'blocking'
                    ? STATUS.error
                    : NEUTRAL.textSecondary,
              }}
            >
              • [{PILLAR_LABELS[finding.pillar] ?? finding.pillar}]{' '}
              {finding.message}
            </Typography>
          ))}
        </Box>
      )}
      {missing.length > 0 && (
        <Typography
          variant="caption"
          style={{
            color: NEUTRAL.textSecondary,
            display: 'block',
            marginTop: 8,
          }}
        >
          Missing controls: {missing.map(c => c.label).join(', ')}
        </Typography>
      )}
      <Typography
        variant="caption"
        style={{
          color: NEUTRAL.textSecondary,
          display: 'block',
          marginTop: 8,
        }}
      >
        Pre-flight scan — a blocking finding stops the run at submit time.
      </Typography>
    </>,
  );
}

interface PromotionStatus {
  project: string;
  component: string;
  environments: Record<string, string | null>;
  prod_pending_approval: boolean;
}

type PromotionStatusState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'no_pipeline'; message: string }
  | { status: 'found'; data: PromotionStatus };

const PROMOTION_SOURCE_ENVIRONMENT: Record<string, string> = {
  staging: 'development',
  production: 'staging',
};

/**
 * Live GET /models/{name}/promotion-status lookup — same fail-quiet
 * contract as useModelVersionCheck/useCurrentLiveVersionSummary (a 404 for
 * a model outside the one real scoped project, per
 * routers/models.py's get_promotion_status, folds into 'none' same as any
 * other fetch failure — this panel is advisory, the real check is
 * orchestration:promote-model's own 404/400).
 */
function usePromotionStatus(modelName: unknown): PromotionStatusState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<PromotionStatusState>({
    status: 'loading',
  });

  useEffect(() => {
    if (typeof modelName !== 'string' || !modelName) {
      setState({ status: 'none' });
      return undefined;
    }
    setState({ status: 'loading' });
    let cancelled = false;
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(
          `${proxyUrl}/orchestration-api/models/${encodeURIComponent(
            modelName,
          )}/promotion-status`,
          { headers },
        ),
      )
      .then(async res => {
        // A 404 is the meaningful "this model has no promotion pipeline"
        // case (only the one scoped project does) — surface its detail
        // instead of folding it into the same silent 'none' as a network
        // blip, so the Dev sees why promote will fail before submitting.
        if (res.status === 404) {
          const body = await res.json().catch(() => ({ detail: undefined }));
          if (!cancelled) {
            setState({
              status: 'no_pipeline',
              message:
                typeof body.detail === 'string'
                  ? body.detail
                  : `'${modelName}' has no promotion pipeline`,
            });
          }
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Partial<PromotionStatus>>;
      })
      .then(data => {
        // null sentinel from the 404 branch above — state already set.
        if (cancelled || data === null) return;
        // A 200 without an environments map would crash the panel's
        // per-environment reads — coerce instead of trusting the shape.
        setState({
          status: 'found',
          data: {
            project: typeof data?.project === 'string' ? data.project : '',
            component:
              typeof data?.component === 'string' ? data.component : '',
            environments:
              data?.environments && typeof data.environments === 'object'
                ? (data.environments as Record<string, string | null>)
                : {},
            prod_pending_approval: data?.prod_pending_approval === true,
          },
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'none' });
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, modelName, getAuthHeaders]);

  return state;
}

/**
 * Shows exactly what a promote submit is about to do — release bound per
 * environment today, and which one moves where. An "approval" that only
 * tells the Dev what happened *after* they submit isn't a real approval;
 * this is the "see it before you approve it" half of that. Release names
 * are OpenChoreo ProjectRelease identifiers (e.g.
 * "telco-fraud-detection-6d675ddbf6"), not MLflow version numbers — there
 * is no adapter-side mapping from one to the other yet (see
 * adapters/openchoreo_promotion_adapter.py), so this shows the real
 * identifier rather than inventing a "v3"-style label this data can't
 * actually back.
 */
function PromotionPreviewPanel({
  modelName,
  targetEnvironment,
}: {
  modelName: unknown;
  targetEnvironment: unknown;
}): JSX.Element | null {
  const state = usePromotionStatus(modelName);
  if (state.status === 'no_pipeline') {
    return (
      <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
        <Chip
          label="No pipeline"
          size="small"
          style={{
            backgroundColor: STATUS.warning,
            color: '#FFF',
            flexShrink: 0,
          }}
        />
        <Typography variant="body2">{state.message}</Typography>
      </Box>
    );
  }
  if (state.status !== 'found') return null;
  if (typeof targetEnvironment !== 'string' || !targetEnvironment) return null;

  const sourceEnvironment = PROMOTION_SOURCE_ENVIRONMENT[targetEnvironment];
  const sourceRelease = sourceEnvironment
    ? state.data.environments[sourceEnvironment]
    : undefined;
  const targetRelease = state.data.environments[targetEnvironment];

  return (
    <Box
      style={{
        border: `1px solid ${NEUTRAL.border}`,
        borderRadius: 4,
        padding: 12,
      }}
    >
      <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 8 }}>
        Release bound per environment today
      </Typography>
      <Grid container spacing={1}>
        {(['development', 'staging', 'production'] as const).map(env => (
          <Fragment key={env}>
            <Grid item xs={4}>
              <Typography
                variant="body2"
                style={{ color: NEUTRAL.textSecondary }}
              >
                {env}
              </Typography>
            </Grid>
            <Grid item xs={8}>
              <Typography variant="body2">
                {state.data.environments[env] ?? '(none yet)'}
              </Typography>
            </Grid>
          </Fragment>
        ))}
      </Grid>
      {sourceEnvironment && (
        <Typography variant="body2" style={{ marginTop: 8 }}>
          {sourceRelease ? (
            <>
              Will move <strong>{sourceRelease}</strong> from{' '}
              {sourceEnvironment} into {targetEnvironment}
              {targetRelease ? `, replacing ${targetRelease}` : ''}.
            </>
          ) : (
            <>
              Nothing bound in {sourceEnvironment} yet — submitting will fail
              until something is.
            </>
          )}
        </Typography>
      )}
    </Box>
  );
}

const DEPLOY_STRATEGY_LABELS: Record<string, string> = {
  direct: 'Direct',
  canary: 'Canary',
  ab: 'A/B',
  'blue-green': 'Blue-Green',
};

/**
 * Read-only, computed one-sentence recap of Evaluate & Deploy Model's own
 * fields (e.g. "Will deploy fraud-detection v3, Canary strategy starting
 * at 10%, released via a PR to github.com/org/repo.") — plugs into a
 * `summaryField: true` GroupField placed last, right before Backstage's
 * own Review step, so the user confirms in plain language instead of
 * re-reading each field's raw value. Hardcodes this template's own field
 * names (modelName/modelVersion/deployStrategy/trafficPercent/
 * releaseStrategy/repoUrl/targetEnvironment) rather than a generic
 * template-string DSL — same "specific beats a speculative abstraction"
 * call as ModelVersionCheckPanel's own hardcoded `data.modelName`
 * reference above; nothing else in this template needs a computed
 * summary yet. `action` picks which sentence shape to render — rollback
 * and promote don't touch deployStrategy/releaseStrategy at all, so reusing
 * the deploy sentence for them would be actively wrong, not just
 * imprecise.
 */
function DeploySummaryPanel({
  data,
}: {
  data: Record<string, unknown>;
}): JSX.Element {
  const modelName =
    typeof data.modelName === 'string' && data.modelName
      ? data.modelName
      : '(model not chosen yet)';
  const modelVersion =
    typeof data.modelVersion === 'string' && data.modelVersion
      ? `v${data.modelVersion}`
      : '(version not chosen yet)';
  const action = typeof data.action === 'string' ? data.action : 'deploy';

  let sentence: JSX.Element;
  if (action === 'rollback') {
    sentence = (
      <>
        Will roll back <strong>{modelName}</strong> to{' '}
        <strong>{modelVersion}</strong> — instant, 100% cutover, no PR.
      </>
    );
  } else if (action === 'promote') {
    const targetEnvironment =
      typeof data.targetEnvironment === 'string' && data.targetEnvironment
        ? data.targetEnvironment
        : '(environment not chosen yet)';
    sentence = (
      <>
        Will promote <strong>{modelName}</strong>&apos;s currently-bound release
        to <strong>{targetEnvironment}</strong>.
      </>
    );
  } else if (action === 'promote-confirm') {
    const confirmEnvironment =
      typeof data.confirmEnvironment === 'string' && data.confirmEnvironment
        ? data.confirmEnvironment
        : '(environment not chosen yet)';
    const confirmProjectRelease =
      typeof data.confirmProjectRelease === 'string' &&
      data.confirmProjectRelease
        ? data.confirmProjectRelease
        : '(project release not entered yet)';
    sentence = (
      <>
        Will bind <strong>{modelName}</strong> to{' '}
        <strong>{confirmProjectRelease}</strong> in{' '}
        <strong>{confirmEnvironment}</strong> — only run this after merging the
        PR a prior promote run opened.
      </>
    );
  } else {
    const deployStrategy =
      typeof data.deployStrategy === 'string' ? data.deployStrategy : 'direct';
    const strategyLabel =
      DEPLOY_STRATEGY_LABELS[deployStrategy] ?? deployStrategy;
    const trafficPercent =
      typeof data.trafficPercent === 'number' ? data.trafficPercent : undefined;
    let percentSuffix = '';
    if (deployStrategy === 'blue-green' && trafficPercent !== undefined) {
      percentSuffix = ` (${
        trafficPercent === 100
          ? 'cutting over immediately'
          : 'staged dark, no traffic yet'
      })`;
    } else if (
      (deployStrategy === 'canary' || deployStrategy === 'ab') &&
      trafficPercent !== undefined
    ) {
      percentSuffix = ` starting at ${trafficPercent}%`;
    }
    const releaseStrategy =
      typeof data.releaseStrategy === 'string'
        ? data.releaseStrategy
        : 'pr-gated';
    const repoUrl =
      typeof data.repoUrl === 'string' && data.repoUrl
        ? data.repoUrl
        : undefined;
    const releaseText =
      releaseStrategy === 'pr-gated'
        ? `via a PR${repoUrl ? ` to ${repoUrl}` : ''}`
        : 'instantly, with no PR';
    sentence = (
      <>
        Will deploy <strong>{modelName}</strong> <strong>{modelVersion}</strong>
        , {strategyLabel} strategy{percentSuffix}, released {releaseText}.
      </>
    );
  }

  return (
    <Box
      border={1}
      borderColor={NEUTRAL.border}
      borderRadius={4}
      style={{ padding: 16, backgroundColor: NEUTRAL.background }}
    >
      <Typography variant="body1">{sentence}</Typography>
    </Box>
  );
}

interface ColumnPickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  mode: 'single' | 'multi';
  columns: string[];
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Same 3-tier micro-copy shape as every other field here (label[+*] → input → ≤1-line caption) — built by hand instead of through SchemaField because a Select-from-real-columns has no JSON Schema `enum` to render it from. */
function ColumnPickerField({
  name,
  title,
  description,
  required,
  mode,
  columns,
  value,
  onChange,
}: ColumnPickerFieldProps): JSX.Element {
  let selected: string | string[] = mode === 'multi' ? [] : '';
  if (mode === 'multi' && Array.isArray(value)) selected = value as string[];
  if (mode === 'single' && typeof value === 'string') selected = value;
  return (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={`${title}${required ? '*' : ''}`}
      helperText={description}
      value={selected}
      onChange={e => onChange(e.target.value)}
      name={name}
      SelectProps={{
        multiple: mode === 'multi',
        renderValue:
          mode === 'multi'
            ? (v: unknown) => (
                <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>
                  {(v as string[]).map(col => (
                    <Chip key={col} label={col} size="small" />
                  ))}
                </Box>
              )
            : undefined,
      }}
    >
      {columns.map(col => (
        <MenuItem key={col} value={col}>
          {mode === 'multi' && (
            <Checkbox
              size="small"
              checked={(selected as string[]).includes(col)}
            />
          )}
          {col}
        </MenuItem>
      ))}
    </TextField>
  );
}

interface HyperparamMeta {
  key: string;
  label: string;
  kind: 'numeric' | 'categorical';
  categoricalOptions?: string[];
}

// Snake_case to match hpo_runner.py's build_search_spaces(), which matches
// each key against train.py's _read_dl_hyperparameters() dict — not the
// camelCase form field names. hidden_layers (mlp) is deliberately excluded:
// it's an array of ints (a network shape, e.g. [64, 32]), not a single
// number/category a Range or Choices row can represent.
const MLP_HYPERPARAMS: HyperparamMeta[] = [
  { key: 'learning_rate', label: 'Learning rate', kind: 'numeric' },
  { key: 'epochs', label: 'Epochs', kind: 'numeric' },
  { key: 'batch_size', label: 'Batch size', kind: 'numeric' },
  { key: 'dropout', label: 'Dropout', kind: 'numeric' },
  {
    key: 'optimizer',
    label: 'Optimizer',
    kind: 'categorical',
    categoricalOptions: ['adam', 'sgd'],
  },
];
const LSTM_HYPERPARAMS: HyperparamMeta[] = [
  { key: 'learning_rate', label: 'Learning rate', kind: 'numeric' },
  { key: 'epochs', label: 'Epochs', kind: 'numeric' },
  { key: 'batch_size', label: 'Batch size', kind: 'numeric' },
  { key: 'sequence_length', label: 'Sequence length', kind: 'numeric' },
  { key: 'num_layers', label: 'Number of layers', kind: 'numeric' },
  { key: 'hidden_size', label: 'Hidden size', kind: 'numeric' },
  {
    key: 'optimizer',
    label: 'Optimizer',
    kind: 'categorical',
    categoricalOptions: ['adam', 'sgd'],
  },
];

interface SearchSpaceRow {
  enabled: boolean;
  mode: 'range' | 'choices';
  low: string;
  high: string;
  choicesText: string;
  categoricalChoices: string[];
}

function emptyRow(): SearchSpaceRow {
  return {
    enabled: false,
    mode: 'range',
    low: '',
    high: '',
    choicesText: '',
    categoricalChoices: [],
  };
}

/** Parses an existing `{"param": {"low":..,"high":..} | {"choices":[...]}}` JSON string (or "{}"/invalid) into per-row UI state — only called once, at mount, via useState's lazy initializer (see SearchSpaceBuilderField). */
function parseSearchSpaceJson(
  json: string,
  hyperparams: HyperparamMeta[],
): Record<string, SearchSpaceRow> {
  let parsed: Record<
    string,
    { choices?: unknown[]; low?: number; high?: number }
  > = {};
  try {
    const value: unknown = JSON.parse(json || '{}');
    if (value && typeof value === 'object') parsed = value as typeof parsed;
  } catch {
    // Invalid/empty JSON (e.g. hand-edited before this UI existed) — every
    // row just starts unchecked, same as a fresh "{}".
  }
  const rows: Record<string, SearchSpaceRow> = {};
  for (const meta of hyperparams) {
    const spec = parsed[meta.key];
    if (!spec) {
      rows[meta.key] = emptyRow();
      continue;
    }
    if (Array.isArray(spec.choices)) {
      rows[meta.key] =
        meta.kind === 'categorical'
          ? {
              ...emptyRow(),
              enabled: true,
              mode: 'choices',
              categoricalChoices: spec.choices.map(String),
            }
          : {
              ...emptyRow(),
              enabled: true,
              mode: 'choices',
              choicesText: spec.choices.join(', '),
            };
    } else if (spec.low !== undefined && spec.high !== undefined) {
      rows[meta.key] = {
        ...emptyRow(),
        enabled: true,
        mode: 'range',
        low: String(spec.low),
        high: String(spec.high),
      };
    } else {
      rows[meta.key] = emptyRow();
    }
  }
  return rows;
}

function serializeSearchSpace(
  rows: Record<string, SearchSpaceRow>,
  hyperparams: HyperparamMeta[],
): string {
  const result: Record<
    string,
    { choices?: unknown[]; low?: number; high?: number }
  > = {};
  for (const meta of hyperparams) {
    const row = rows[meta.key];
    if (!row?.enabled) continue;
    if (meta.kind === 'categorical') {
      if (row.categoricalChoices.length > 0)
        result[meta.key] = { choices: row.categoricalChoices };
      continue;
    }
    if (row.mode === 'choices') {
      const numbers = row.choicesText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => !Number.isNaN(n));
      if (numbers.length > 0) result[meta.key] = { choices: numbers };
    } else {
      const low = Number(row.low);
      const high = Number(row.high);
      if (!Number.isNaN(low) && !Number.isNaN(high))
        result[meta.key] = { low, high };
    }
  }
  return JSON.stringify(result);
}

interface SearchSpaceBuilderFieldProps {
  title: string;
  description?: string;
  architecture: unknown;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Click-only replacement for a hand-typed Search space JSON string — one
 * row per DL hyperparameter train.py actually reads for the current
 * architecture (mlp vs lstm), each a checkbox ("search this?") plus either
 * a Range (low/high) or Choices (comma list / checkboxes for `optimizer`)
 * input. Still round-trips through the same `searchSpaceJson` string field
 * underneath (train.py/hpo_runner.py never change), so this is UI-only.
 */
function SearchSpaceBuilderField({
  title,
  description,
  architecture,
  value,
  onChange,
}: SearchSpaceBuilderFieldProps): JSX.Element {
  const hyperparams =
    architecture === 'lstm' ? LSTM_HYPERPARAMS : MLP_HYPERPARAMS;
  const [rows, setRows] = useState<Record<string, SearchSpaceRow>>(() =>
    parseSearchSpaceJson(typeof value === 'string' ? value : '{}', hyperparams),
  );

  const updateRow = (key: string, patch: Partial<SearchSpaceRow>) => {
    const next = { ...rows, [key]: { ...(rows[key] ?? emptyRow()), ...patch } };
    setRows(next);
    onChange(serializeSearchSpace(next, hyperparams));
  };

  const renderValueCell = (row: SearchSpaceRow, meta: HyperparamMeta) => {
    if (!row.enabled) {
      return (
        <Typography variant="body2" color="textSecondary">
          Fixed at the value from Architecture &amp; Task
        </Typography>
      );
    }
    if (meta.kind === 'categorical') {
      return (
        <Box display="flex" style={{ gap: 12 }}>
          {(meta.categoricalOptions ?? []).map(option => (
            <FormControlLabel
              key={option}
              control={
                <Checkbox
                  size="small"
                  checked={row.categoricalChoices.includes(option)}
                  onChange={e =>
                    updateRow(meta.key, {
                      categoricalChoices: e.target.checked
                        ? [...row.categoricalChoices, option]
                        : row.categoricalChoices.filter(o => o !== option),
                    })
                  }
                />
              }
              label={option}
            />
          ))}
        </Box>
      );
    }
    return (
      <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
        <TextField
          select
          variant="outlined"
          size="small"
          value={row.mode}
          onChange={e =>
            updateRow(meta.key, {
              mode: e.target.value as 'range' | 'choices',
            })
          }
          style={{ minWidth: 110 }}
        >
          <MenuItem value="range">Range</MenuItem>
          <MenuItem value="choices">Choices</MenuItem>
        </TextField>
        {row.mode === 'range' ? (
          <>
            <TextField
              variant="outlined"
              size="small"
              label="Low"
              value={row.low}
              onChange={e => updateRow(meta.key, { low: e.target.value })}
              style={{ width: 100 }}
            />
            <TextField
              variant="outlined"
              size="small"
              label="High"
              value={row.high}
              onChange={e => updateRow(meta.key, { high: e.target.value })}
              style={{ width: 100 }}
            />
          </>
        ) : (
          <TextField
            variant="outlined"
            size="small"
            label="Comma-separated values"
            placeholder="e.g. 16, 32, 64"
            value={row.choicesText}
            onChange={e => updateRow(meta.key, { choicesText: e.target.value })}
            fullWidth
          />
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="subtitle2" style={{ marginBottom: 4 }}>
        {title}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell>Hyperparameter</TableCell>
            <TableCell>Search over</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {hyperparams.map(meta => {
            const row = rows[meta.key] ?? emptyRow();
            return (
              <TableRow key={meta.key}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={row.enabled}
                    onChange={e =>
                      updateRow(meta.key, { enabled: e.target.checked })
                    }
                  />
                </TableCell>
                <TableCell>{meta.label}</TableCell>
                <TableCell>{renderValueCell(row, meta)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {description && (
        <Typography
          variant="caption"
          color="textSecondary"
          style={{ display: 'block', marginTop: 4 }}
        >
          {description}
        </Typography>
      )}
    </Box>
  );
}

/**
 * The set of values a resolved (post-`allOf`) property schema currently
 * allows, or `null` if it isn't constrained to a fixed set at all — covers
 * both shapes this template's branches use: a flat `enum` (e.g.
 * `algorithm`'s `enum: [XGBClassifier, custom]`) and a `oneOf` of `const`
 * options (e.g. `algorithmFamily`'s `oneOf: [{const: 'xgboost', ...}, ...]`).
 * `null` for a `oneOf` that isn't every-branch-a-bare-const (e.g. one with
 * its own nested `properties`) — that shape isn't "this field's own set of
 * choices" and clearing against it would be wrong.
 */
function resolvedEnumValues(fieldSchema: JSONSchema7): unknown[] | null {
  if (Array.isArray(fieldSchema.enum)) return fieldSchema.enum;
  if (Array.isArray(fieldSchema.oneOf)) {
    const consts = fieldSchema.oneOf.map(option =>
      typeof option === 'object' && option !== null ? option.const : undefined,
    );
    if (consts.every(value => value !== undefined)) return consts;
  }
  return null;
}

/**
 * Root-level `ui:field` for an entire Scaffolder step — reads
 * `ui:options.groups` to render the step's own (flat, unchanged)
 * properties inside titled Card/Accordion clusters with a responsive
 * grid, instead of RJSF's default one-property-per-full-width-row
 * ObjectFieldTemplate (see @rjsf/material-ui's ObjectFieldTemplate.js,
 * which hardcodes `Grid item xs={12}` for every property with no
 * schema-driven override point).
 *
 * Deliberately does NOT nest properties into a wrapper object — every
 * property stays addressable as `${{ parameters.<name> }}` exactly as
 * before, so this only changes how a step LOOKS, never what the
 * Golden Path's `steps:` receive.
 */
function StepLayout(
  props: FieldExtensionComponentProps<
    Record<string, unknown>,
    StepLayoutUiOptions
  >,
): JSX.Element {
  const {
    schema,
    uiSchema,
    formData,
    onChange,
    idSchema,
    registry,
    errorSchema,
  } = props;
  const { SchemaField } = registry.fields;
  const properties = (schema.properties ?? {}) as Record<string, JSONSchema7>;
  const requiredFields = new Set(schema.required ?? []);
  const groups = uiSchema['ui:options']?.groups ?? [];
  const data = formData ?? {};
  const { datasets, loading: datasetsLoading } = useDatasets();
  // Which source the currently-picked dataset came from — passed to the
  // preview/columns/validation reads so an s3 dataset is fetched from
  // MinIO/S3 rather than a same-named local file.
  const selectedDatasetSource = datasets.find(
    d => d.uri === data.datasetUri,
  )?.source;
  const datasetColumns = useDatasetColumns(
    data.datasetUri,
    selectedDatasetSource,
  );
  const dataSources = groupDatasetsBySource(datasets).map(([source]) => source);
  const { models, loading: modelsLoading } = useModels();
  const availableFeatures = useAvailableFeatures();
  const { versions: modelVersions, loading: modelVersionsLoading } =
    useModelVersions(data.modelName);
  const modelSummary = useModelVersionCheck(data.modelName, data.modelVersion);
  // release_strategy='instant' needs the llm-ops-admin role server-side — see
  // the releaseEligibilityPanel flag / the fallback effect below.
  const llmOpsAdminRole = useHasRole('llm-ops-admin');
  const promptNames = usePrompts();
  const promptVersions = usePromptVersions(data.promptName);
  const ragCollections = useRagCollections();
  const ragIndexVersions = useRagIndexVersions(data.collectionName);
  const llmModels = useLlmModels();
  const evalSets = useEvalSets();
  const ragSources = useRagSources();
  const secretNames = useSecretNames();

  // Three kinds of stale formData this step's own branching
  // (modelCategory/algorithmFamily/architecture) can produce, none of
  // which RJSF clears on its own:
  //
  //  1. A property DISAPPEARS from the resolved schema (e.g.
  //     algorithmFamily/algorithm only exist for modelCategory=
  //     traditional-ml) but keeps its last value — switching to Deep
  //     Learning leaves algorithm="RandomForestClassifier" sitting in
  //     formData, invisible but still a REAL match for later `if`s keyed
  //     on it, and still what ships to orchestration-api in `steps:`.
  //
  //  2. A `const`-only property (e.g. `architecture: {const: sklearn}`)
  //     is hidden by renderField's own const check, so nothing ever
  //     WRITES that value — `architecture` can be genuinely absent, and
  //     `if: {architecture: {const: 'mlp'}}` vacuously passes when a
  //     property is simply missing. Forcing formData to the active
  //     branch's const closes that gap.
  //
  //  3. A property's `enum`/`oneOf` narrows to a different set (e.g.
  //     `algorithm`'s enum changes from sklearn's options to xgboost's the
  //     instant Library switches) but the property itself never
  //     disappears. RJSF's validation does block "Next" here, but
  //     silently — a required Select just looks blank with no clue why.
  //     Clearing it makes that read as "not chosen yet", not "broken".
  //
  // All three run every render (idempotent once in sync) rather than off
  // a dependency array — case 1 needs the previous render's property
  // names to diff against.
  const previousPropertyNames = useRef<Set<string>>(new Set());
  const appliedTrainingPresets = useRef<Record<string, unknown>>({});
  useEffect(() => {
    const currentNames = new Set(Object.keys(properties));
    const updates: Record<string, unknown> = {};

    previousPropertyNames.current.forEach(name => {
      if (!currentNames.has(name) && data[name] !== undefined)
        updates[name] = undefined;
    });
    Object.entries(properties).forEach(([name, fieldSchema]) => {
      if (fieldSchema.const !== undefined) {
        if (data[name] !== fieldSchema.const) updates[name] = fieldSchema.const;
        return;
      }
      const allowedValues = resolvedEnumValues(fieldSchema);
      if (
        allowedValues &&
        data[name] !== undefined &&
        !allowedValues.includes(data[name])
      ) {
        updates[name] = undefined;
      }
    });

    previousPropertyNames.current = currentNames;
    if (data.trainingMode === 'platform') {
      const presetUpdates = trainingPresetUpdates(data);
      Object.entries(presetUpdates).forEach(([name, value]) => {
        if (appliedTrainingPresets.current[name] === data.useCase) return;
        const fieldSchema = properties[name];
        if (!fieldSchema) return;
        const allowed = resolvedEnumValues(fieldSchema);
        if (allowed && value !== undefined && !allowed.includes(value)) return;
        if (name === 'algorithm' && data.algorithmFamily !== 'scikit-learn')
          return;
        updates[name] = value;
        appliedTrainingPresets.current[name] = data.useCase;
      });
    }
    if (Object.keys(updates).length > 0) onChange({ ...data, ...updates });
  });

  // release_strategy='instant' needs the llm-ops-admin role server-side; when
  // the signed-in user lacks it, fall back to pr-gated so the run can't 403
  // at prepare time. Only fires once the role check has resolved, and only
  // for a schema that actually declares releaseStrategy (a no-op elsewhere).
  useEffect(() => {
    if (!properties.releaseStrategy) return;
    if (llmOpsAdminRole.status !== 'resolved' || llmOpsAdminRole.hasRole)
      return;
    if (data.releaseStrategy === 'instant') {
      onChange({ ...data, releaseStrategy: 'pr-gated' });
    }
  });

  // Keeps `dataSource` pointed at a source GET /datasets actually returned
  // (auto-picks one once the list loads / whenever the current value stops
  // being valid — e.g. that adapter went away), and keeps `datasetUri` in
  // sync with it: auto-filled to the one dataset `useCase` (chosen in
  // General Information) resolves to via findDatasetForUseCase, or cleared
  // when it no longer belongs to the current `dataSource` / no longer
  // matches `architecture`'s required file type (e.g. switching
  // architecture from cv to sklearn after already picking a .zip) and
  // useCase doesn't resolve it to a replacement. Runs on every render
  // (idempotent, like the effect above) since "is the current value still
  // valid" has to be rechecked against the latest `datasets` fetch, not
  // just once.
  useEffect(() => {
    if (dataSources.length === 0 || !properties.dataSource) return;
    if (
      typeof data.dataSource !== 'string' ||
      !dataSources.includes(data.dataSource)
    ) {
      // Prefer MinIO ("s3") — that's where the real per-use-case datasets
      // live (scripts/setup-3node-infra.sh seeds MinIO from data/); "local"
      // is only a fallback for a dev machine running the API directly
      // without the cluster's MinIO reachable (see
      // LocalFileObjectStorageAdapter's own doc comment).
      const defaultSource = dataSources.includes('s3') ? 's3' : dataSources[0];
      onChange({ ...data, dataSource: defaultSource, datasetUri: undefined });
      return;
    }
    const matchForUseCase = findDatasetForUseCase(
      datasets,
      data.dataSource,
      data.architecture,
      data.useCase,
    );
    if (matchForUseCase) {
      if (data.datasetUri !== matchForUseCase.uri) {
        onChange({ ...data, datasetUri: matchForUseCase.uri });
      }
      return;
    }
    const wantsZip = data.architecture === 'cv';
    const datasetUriBelongsToSource =
      typeof data.datasetUri === 'string' &&
      datasets.some(
        d =>
          d.source === data.dataSource &&
          d.uri === data.datasetUri &&
          (typeof data.architecture !== 'string' ||
            d.name.toLowerCase().endsWith('.zip') === wantsZip),
      );
    if (data.datasetUri !== undefined && !datasetUriBelongsToSource) {
      onChange({ ...data, datasetUri: undefined });
    }
  });

  // Keeps `modelVersion` in sync with `modelName` (Evaluate & Deploy
  // Model's modelNamePicker/modelVersionPicker pair) — a no-op everywhere
  // else, since it only fires when the schema actually declares a
  // `modelVersion` property. The moment modelName changes to something
  // NEW, clears the stale version immediately (it almost certainly
  // doesn't belong to the new model) rather than leaving a wrong value
  // visible while useModelVersions' fetch for the new name is still in
  // flight. Once that fetch resolves — modelName unchanged since the
  // previous render, `modelVersions` now populated, no version chosen
  // yet — defaults to the latest one. Never overwrites a version the user
  // already picked/edited for the CURRENT modelName, so switching to an
  // older release on purpose sticks.
  const previousModelNameForVersion = useRef<unknown>(undefined);
  useEffect(() => {
    if (!properties.modelVersion) return;
    if (data.modelName !== previousModelNameForVersion.current) {
      previousModelNameForVersion.current = data.modelName;
      if (data.modelVersion !== undefined)
        onChange({ ...data, modelVersion: undefined });
      return;
    }
    if (modelVersions.length > 0 && !data.modelVersion) {
      onChange({ ...data, modelVersion: modelVersions[0] });
    }
  });

  // Bind monitoring.referenceDataUri to the selected model version's
  // registered training dataset when model metadata exposes it. Older model
  // versions may not have that metadata, so the existing dataset picker stays
  // available as a backward-compatible fallback. The binding is enforced,
  // not suggested: once attached, the field renders locked (see
  // ReferenceDataLockedField) so reference data can't drift away from the
  // model it baselines.
  const referenceModelName =
    typeof data.modelName === 'string' && data.modelName.length > 0
      ? data.modelName
      : undefined;
  const referenceModelVersion =
    typeof data.modelVersion === 'string' && data.modelVersion.length > 0
      ? data.modelVersion
      : undefined;
  const attachedReferenceUri =
    properties.referenceDataUri !== undefined &&
    referenceModelName !== undefined &&
    referenceModelVersion !== undefined &&
    modelSummary.status === 'found'
      ? modelSummary.summary.dataset_uri ??
        modelSummary.summary.tags.dataset_uri ??
        modelSummary.summary.tags.training_dataset_uri
      : undefined;
  const previousReferenceModel = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!properties.referenceDataUri) return;
    const modelName = typeof data.modelName === 'string' ? data.modelName : '';
    const modelVersion =
      typeof data.modelVersion === 'string' ? data.modelVersion : '';
    const modelKey =
      modelName && modelVersion ? `${modelName}:${modelVersion}` : undefined;
    if (modelKey !== previousReferenceModel.current) {
      previousReferenceModel.current = modelKey;
      if (data.referenceDataUri !== undefined) {
        onChange({ ...data, referenceDataUri: undefined });
      }
      return;
    }
    if (modelSummary.status !== 'found') return;
    const summaryDatasetUri = attachedReferenceUri;
    if (
      typeof summaryDatasetUri === 'string' &&
      data.referenceDataUri !== summaryDatasetUri
    ) {
      onChange({ ...data, referenceDataUri: summaryDatasetUri });
    }
  });

  // Bind `taskType` to the selected model version's registry metadata — the
  // same "the model already declares this, don't make the Dev retype it"
  // reasoning as the reference-data binding above. Drives the metrics table
  // (taskTypeMetrics) and the retrain request's task_type, so neither can
  // disagree with the model. Clears on a model switch so a stale task type
  // never lingers while the new model's summary is still in flight.
  const previousTaskTypeModel = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!properties.taskType) return;
    const modelName = typeof data.modelName === 'string' ? data.modelName : '';
    const modelVersion =
      typeof data.modelVersion === 'string' ? data.modelVersion : '';
    const modelKey =
      modelName && modelVersion ? `${modelName}:${modelVersion}` : undefined;
    if (modelKey !== previousTaskTypeModel.current) {
      previousTaskTypeModel.current = modelKey;
      if (data.taskType !== undefined) {
        onChange({ ...data, taskType: undefined });
      }
      return;
    }
    if (modelSummary.status !== 'found') return;
    const taskType = modelSummary.summary.task_type;
    if (taskType && data.taskType !== taskType) {
      onChange({ ...data, taskType });
    }
  });

  const renderField = (
    name: string,
    width: GridSize = 12,
    columnPicker?: 'single' | 'multi',
    datasetPicker?: boolean,
    datasetPreview?: boolean,
    dataSourcePicker?: boolean,
    datasetValidation?: boolean,
    baseModelPicker?: boolean,
    lockedDisplay?: boolean,
    featureNamesPicker?: boolean,
    feastEntityMatch?: boolean,
    searchSpaceBuilder?: boolean,
    modelNamePicker?: boolean,
    modelVersionPicker?: boolean,
    modelVersionCheck?: boolean,
    summaryField?: boolean,
    versionComparison?: boolean,
    promotionPreview?: boolean,
    actionPicker?: boolean,
    promptNamePicker?: boolean,
    promptNameCombo?: boolean,
    promptVersionPicker?: boolean,
    ragCollectionPicker?: boolean,
    ragIndexVersionPicker?: boolean,
    llmModelPicker?: boolean,
    evalSetNamePicker?: boolean,
    evalSetNameCombo?: boolean,
    sourcePathsPicker?: boolean,
    choiceCards?: boolean,
    multiSelect?: boolean,
    secretPicker?: boolean,
    huggingFaceModelValidator?: boolean,
    huggingFaceModelPicker?: boolean,
    modelPresetPicker?: boolean,
    gpuRecommendationPanel?: boolean,
    rolloutEligibilityGate?: boolean,
    releaseEligibilityPanel?: boolean,
    costEstimate?: CostEstimateOptions,
    securityScan?: SecurityScanOptions,
    disabled?: boolean,
    autoFillModelName?: boolean,
    taskTypeMetrics?: boolean,
    taskTypeOptions?: boolean,
    hidden?: boolean,
    readOnlyDisplay?: boolean,
  ) => {
    const fieldSchema = properties[name];
    if (!fieldSchema) return null;
    if (hidden) return null;
    if (readOnlyDisplay) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <TextField
            variant="outlined"
            fullWidth
            InputProps={{ readOnly: true }}
            label={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            value={typeof data[name] === 'string' ? (data[name] as string) : ''}
            helperText={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : 'Detected from the model — not editable here.'
            }
          />
        </Grid>
      );
    }
    if (taskTypeMetrics) {
      const options = multiSelectOptionsFromSchema(fieldSchema);
      if (options.length > 0) {
        const taskType =
          modelSummary.status === 'found'
            ? modelSummary.summary.task_type
            : null;
        return (
          <Grid item xs={12} key={name}>
            <TaskTypeMetricsField
              name={name}
              title={
                typeof fieldSchema.title === 'string' ? fieldSchema.title : name
              }
              description={
                typeof fieldSchema.description === 'string'
                  ? fieldSchema.description
                  : undefined
              }
              required={requiredFields.has(name)}
              options={options}
              taskType={taskType}
              value={data[name]}
              thresholds={data.metricThresholds}
              onChange={(names, thresholds) =>
                onChange({
                  ...data,
                  [name]: names,
                  metricThresholds: thresholds,
                })
              }
            />
          </Grid>
        );
      }
    }
    if (taskTypeOptions) {
      const options = multiSelectOptionsFromSchema(fieldSchema);
      if (options.length > 0) {
        const taskType =
          modelSummary.status === 'found'
            ? modelSummary.summary.task_type
            : null;
        return (
          <Grid item xs={12} md={width} key={name}>
            <TaskTypeOptionsField
              name={name}
              title={
                typeof fieldSchema.title === 'string' ? fieldSchema.title : name
              }
              description={
                typeof fieldSchema.description === 'string'
                  ? fieldSchema.description
                  : undefined
              }
              required={requiredFields.has(name)}
              options={options}
              taskType={taskType}
              value={data[name]}
              onChange={value => onChange({ ...data, [name]: value })}
            />
          </Grid>
        );
      }
    }
    if (costEstimate) {
      return (
        <Grid item xs={12} key={name}>
          <CostEstimatePanel opts={costEstimate} data={data} />
        </Grid>
      );
    }
    if (securityScan) {
      return (
        <Grid item xs={12} key={name}>
          <SecurityScanPanel opts={securityScan} data={data} />
        </Grid>
      );
    }
    if (actionPicker) {
      return (
        <Grid item xs={12} key={name}>
          <ActionPickerField
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (choiceCards) {
      const cards = (
        <ChoiceCardsField
          schema={fieldSchema}
          value={data[name]}
          onChange={value => onChange({ ...data, [name]: value })}
        />
      );
      // No options in the schema (e.g. a free-text field mistakenly flagged)
      // — fall through to the plain field rather than render an empty row.
      if (choiceCardsFromSchema(fieldSchema).length > 0) {
        return (
          <Grid item xs={12} key={name}>
            {cards}
          </Grid>
        );
      }
    }
    if (multiSelect) {
      const options = multiSelectOptionsFromSchema(fieldSchema);
      // Same fall-through as choiceCards: no options in the schema means
      // this isn't the field the flag was meant for.
      if (options.length > 0) {
        return (
          <Grid item xs={12} md={width} key={name}>
            <MultiSelectField
              name={name}
              title={
                typeof fieldSchema.title === 'string' ? fieldSchema.title : name
              }
              description={
                typeof fieldSchema.description === 'string'
                  ? fieldSchema.description
                  : undefined
              }
              required={requiredFields.has(name)}
              options={options}
              value={data[name]}
              onChange={value => onChange({ ...data, [name]: value })}
            />
          </Grid>
        );
      }
    }
    if (summaryField) {
      return (
        <Grid item xs={12} key={name}>
          <DeploySummaryPanel data={data} />
        </Grid>
      );
    }
    // A `const`-only property has nothing for the user to choose (its
    // value is fully pinned by whichever branch is active — see
    // train-track-register's `architecture: {const: sklearn}` for
    // modelCategory=traditional-ml) — showing an editable input for it is
    // always pointless. Most const fields skip entirely; `lockedDisplay`
    // opt-in shows a disabled field with the forced value instead, for
    // the few where hiding it would read as the choice having vanished
    // rather than having been made for the user (e.g. taskType).
    if (fieldSchema.const !== undefined) {
      if (!lockedDisplay) return null;
      // `displayTitle` isn't a real JSON Schema keyword — just a plain
      // string this template's own allOf branches can set alongside
      // `const` when the wire value (what train.py actually needs, e.g.
      // "regression") shouldn't also be the label shown here (e.g.
      // "Time-series forecasting" — still literally trains as regression,
      // see train-track-register's finance-operations taskType branch).
      // Falls back to the raw const when a branch doesn't set one.
      const displayTitle = (fieldSchema as { displayTitle?: unknown })
        .displayTitle;
      return (
        <Grid item xs={12} md={width} key={name}>
          <TextField
            variant="outlined"
            fullWidth
            // readOnly, not `disabled` — disabled fades the text out
            // (this needs to stay legible, it's a value being reported to
            // the user, not a field that merely doesn't apply right now).
            InputProps={{ readOnly: true }}
            label={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            value={
              typeof displayTitle === 'string'
                ? displayTitle
                : String(fieldSchema.const)
            }
            helperText={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : 'Set automatically — not editable here.'
            }
          />
        </Grid>
      );
    }
    if (baseModelPicker && models.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <BaseModelPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            models={models}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (modelNamePicker && (modelsLoading || models.length > 0)) {
      const modelNames = Array.from(new Set(models.map(m => m.name)));
      return (
        <Grid item xs={12} md={width} key={name}>
          <ModelNamePickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            modelNames={modelNames}
            loading={modelsLoading}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (modelVersionPicker || modelVersionCheck) {
      const widget =
        modelVersionPicker &&
        (modelVersionsLoading || modelVersions.length > 0) ? (
          <ModelVersionPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            versions={modelVersions}
            loading={modelVersionsLoading}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        ) : (
          <SchemaField
            schema={fieldSchema}
            uiSchema={(uiSchema as Record<string, unknown>)[name] ?? {}}
            formData={data[name] as any}
            onChange={(value: unknown) => onChange({ ...data, [name]: value })}
            idSchema={(idSchema as Record<string, unknown>)[name] as any}
            name={name}
            required={requiredFields.has(name)}
            registry={registry}
            errorSchema={errorSchema?.[name]}
            onBlur={() => {}}
            onFocus={() => {}}
          />
        );
      const field = (
        <Grid item xs={12} md={width} key={`${name}-input`}>
          {widget}
        </Grid>
      );
      if (!modelVersionCheck) return <Fragment key={name}>{field}</Fragment>;
      return (
        <Fragment key={name}>
          {field}
          <Grid item xs={12}>
            <ModelVersionCheckPanel
              modelName={data.modelName}
              modelVersion={data[name]}
              action={data.action}
            />
          </Grid>
        </Fragment>
      );
    }
    if (versionComparison) {
      const field = (
        <Grid item xs={12} md={width} key={`${name}-input`}>
          <SchemaField
            schema={fieldSchema}
            uiSchema={(uiSchema as Record<string, unknown>)[name] ?? {}}
            formData={data[name] as any}
            onChange={(value: unknown) => onChange({ ...data, [name]: value })}
            idSchema={(idSchema as Record<string, unknown>)[name] as any}
            name={name}
            required={requiredFields.has(name)}
            registry={registry}
            errorSchema={errorSchema?.[name]}
            onBlur={() => {}}
            onFocus={() => {}}
          />
        </Grid>
      );
      return (
        <Fragment key={name}>
          {field}
          <Grid item xs={12}>
            <VersionComparisonPanel
              modelName={data.modelName}
              newVersion={data.modelVersion}
            />
          </Grid>
        </Fragment>
      );
    }
    if (promotionPreview) {
      const field = (
        <Grid item xs={12} md={width} key={`${name}-input`}>
          <SchemaField
            schema={fieldSchema}
            uiSchema={(uiSchema as Record<string, unknown>)[name] ?? {}}
            formData={data[name] as any}
            onChange={(value: unknown) => onChange({ ...data, [name]: value })}
            idSchema={(idSchema as Record<string, unknown>)[name] as any}
            name={name}
            required={requiredFields.has(name)}
            registry={registry}
            errorSchema={errorSchema?.[name]}
            onBlur={() => {}}
            onFocus={() => {}}
          />
        </Grid>
      );
      return (
        <Fragment key={name}>
          {field}
          <Grid item xs={12}>
            <PromotionPreviewPanel
              modelName={data.modelName}
              targetEnvironment={data[name]}
            />
          </Grid>
        </Fragment>
      );
    }
    if (promptNameCombo) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <ComboPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            options={promptNames}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (promptNamePicker && promptNames.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <OptionPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            options={promptNames}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (promptVersionPicker && promptVersions.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <OptionPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            options={promptVersions}
            formatOption={version => `v${version}`}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (ragCollectionPicker && ragCollections.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <OptionPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            options={ragCollections}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (ragIndexVersionPicker && ragIndexVersions.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <OptionPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            options={ragIndexVersions}
            formatOption={version => `v${version}`}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (llmModelPicker && llmModels.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <OptionPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            options={llmModels}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (evalSetNameCombo) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <ComboPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            options={evalSets}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (evalSetNamePicker && evalSets.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <OptionPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            options={evalSets}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (sourcePathsPicker && ragSources.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <ColumnPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            mode="multi"
            columns={ragSources}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (secretPicker && secretNames.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <OptionPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            options={secretNames}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (modelPresetPicker) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <ModelPresetPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            value={data[name]}
            onChange={value => {
              // One-shot patch of the model + compute fields; `custom` is a
              // no-op so a hand-typed model is never clobbered.
              onChange({
                ...data,
                [name]: value,
                ...llmServingPresetUpdates(value),
              });
            }}
          />
        </Grid>
      );
    }
    if (releaseEligibilityPanel) {
      return (
        <Fragment key={name}>
          <Grid item xs={12} md={width} key={`${name}-input`}>
            <SchemaField
              schema={fieldSchema}
              uiSchema={(uiSchema as Record<string, unknown>)[name] ?? {}}
              formData={data[name] as any}
              onChange={value => onChange({ ...data, [name]: value })}
              idSchema={(idSchema as Record<string, unknown>)[name] as any}
              name={name}
              required={requiredFields.has(name)}
              registry={registry}
              errorSchema={errorSchema?.[name]}
              onBlur={() => {}}
              onFocus={() => {}}
            />
          </Grid>
          <Grid item xs={12}>
            <ReleaseEligibilityPanel
              environment={data.environment}
              roleState={llmOpsAdminRole}
            />
          </Grid>
        </Fragment>
      );
    }
    if (
      huggingFaceModelValidator ||
      huggingFaceModelPicker ||
      autoFillModelName ||
      gpuRecommendationPanel ||
      rolloutEligibilityGate
    ) {
      const handleChange = (value: unknown) => {
        const next = { ...data, [name]: value };
        // Derive modelName from the HF id so the Dev doesn't retype it.
        if (autoFillModelName && typeof value === 'string') {
          next.modelName = deriveModelName(value);
        }
        // A hand-edited HF id no longer matches the picked preset — flip the
        // dropdown back to custom so it never claims a preset the form no
        // longer holds.
        if (
          properties.modelPreset &&
          !matchesLlmServingPreset(data.modelPreset, value)
        ) {
          next.modelPreset = CUSTOM_MODEL_PRESET;
        }
        onChange(next);
      };
      const field = (
        <Grid item xs={12} md={width} key={`${name}-input`}>
          {huggingFaceModelPicker ? (
            <HuggingFaceModelPickerField
              name={name}
              title={
                typeof fieldSchema.title === 'string' ? fieldSchema.title : name
              }
              description={
                typeof fieldSchema.description === 'string'
                  ? fieldSchema.description
                  : undefined
              }
              required={requiredFields.has(name)}
              value={data[name]}
              onChange={handleChange}
            />
          ) : (
            <SchemaField
              schema={fieldSchema}
              uiSchema={(uiSchema as Record<string, unknown>)[name] ?? {}}
              formData={data[name] as any}
              onChange={handleChange}
              idSchema={(idSchema as Record<string, unknown>)[name] as any}
              name={name}
              required={requiredFields.has(name)}
              registry={registry}
              errorSchema={errorSchema?.[name]}
              onBlur={() => {}}
              onFocus={() => {}}
            />
          )}
        </Grid>
      );
      return (
        <Fragment key={name}>
          {field}
          {huggingFaceModelValidator && (
            <Grid item xs={12}>
              <HuggingFaceModelValidatorPanel modelId={data[name]} />
            </Grid>
          )}
          {gpuRecommendationPanel && (
            <Grid item xs={12}>
              <GpuRecommendationPanel
                modelId={data.huggingFaceModelId}
                quantization={data.quantization}
                maxContextLength={data.maxContextLength}
              />
            </Grid>
          )}
          {rolloutEligibilityGate && (
            <Grid item xs={12}>
              <RolloutEligibilityGatePanel modelName={data.modelName} />
            </Grid>
          )}
        </Fragment>
      );
    }
    if (dataSourcePicker && dataSources.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <DataSourcePickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            sources={dataSources}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (datasetPicker && (datasetsLoading || datasets.length > 0)) {
      // A lineage-attached reference dataset is not a choice — render it
      // locked instead of the picker (which would also out-of-range error
      // when the URI isn't in its own listing, e.g. enriched files).
      if (
        name === 'referenceDataUri' &&
        typeof attachedReferenceUri === 'string' &&
        referenceModelName !== undefined &&
        referenceModelVersion !== undefined &&
        data[name] === attachedReferenceUri
      ) {
        return (
          <Grid item xs={12} md={width} key={`${name}-locked`}>
            <ReferenceDataLockedField
              title={
                typeof fieldSchema.title === 'string' ? fieldSchema.title : name
              }
              uri={attachedReferenceUri}
              modelName={referenceModelName}
              modelVersion={referenceModelVersion}
            />
          </Grid>
        );
      }
      // Scoped to whichever source the sibling dataSourcePicker field
      // currently holds — falls back to showing everything if this step
      // never declared a dataSource field (dataSourcePicker is opt-in per
      // template, not a hard requirement of datasetPicker).
      let scopedDatasets = properties.dataSource
        ? datasets.filter(d => d.source === data.dataSource)
        : datasets;
      // Further scoped to whatever file type `architecture` (set in an
      // earlier step, e.g. train-track-register's Architecture & Task)
      // can actually read — cv needs a .zip of images (ImageFolder),
      // every other architecture needs a CSV (see
      // infra/argo-workflows/training-image/train.py's `pd.read_csv(...)`
      // call, which runs for everything except cv). No-op for any
      // template with a datasetPicker but no `architecture` field.
      if (typeof data.architecture === 'string') {
        const wantsZip = data.architecture === 'cv';
        scopedDatasets = scopedDatasets.filter(
          d => d.name.toLowerCase().endsWith('.zip') === wantsZip,
        );
      }
      // Further scoped to the one data/<...>-<useCase>/ directory built
      // for this use case (see data/README.md's per-use-case layout) —
      // matched by useCase alone (folder suffix), not a
      // `${taskType}-${useCase}` prefix: the folder's own label prefix is
      // cosmetic (e.g. time-series-forecasting-revenue-forecast even
      // though taskType itself is still "regression" underneath — see
      // train-track-register's businessDomain-keyed taskType consts), so
      // requiring it to match taskType exactly broke the moment those two
      // diverged. useCase is already 1:1 with exactly one directory
      // regardless of its prefix, so this turns "every sklearn CSV in the
      // repo" into "the one dataset actually built for this run" without
      // that fragility. Guarded by `matching.length > 0` so a future use
      // case without a matching directory yet fails open to the wider
      // (architecture-filtered) list instead of showing nothing.
      if (typeof data.useCase === 'string' && data.useCase.length > 0) {
        const suffix = `-${data.useCase}`;
        const matching = scopedDatasets.filter(d =>
          (d.name.split('/')[0] ?? '').endsWith(suffix),
        );
        if (matching.length > 0) scopedDatasets = matching;
      }
      const picker = (
        <Grid item xs={12} md={width} key={`${name}-picker`}>
          <DatasetPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            datasets={scopedDatasets}
            loading={datasetsLoading}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
      if (!datasetPreview && !datasetValidation) return picker;
      return (
        <Fragment key={name}>
          {picker}
          {datasetPreview && (
            <Grid item xs={12}>
              <DatasetPreviewPanel
                datasetUri={data[name]}
                source={selectedDatasetSource}
              />
            </Grid>
          )}
          {datasetValidation && (
            <Grid item xs={12}>
              <DatasetValidationPanel
                datasetUri={data[name]}
                taskType={data.taskType}
                targetColumn={data.targetColumn}
                timeColumn={data.timeColumn}
                source={selectedDatasetSource}
              />
            </Grid>
          )}
        </Fragment>
      );
    }
    if (searchSpaceBuilder) {
      return (
        <Grid item xs={12} key={name}>
          <SearchSpaceBuilderField
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            architecture={data.architecture}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (featureNamesPicker && availableFeatures.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <ColumnPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            mode="multi"
            columns={availableFeatures}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (columnPicker && datasetColumns.length > 0) {
      const picker = (
        <Grid item xs={12} md={width} key={`${name}-picker`}>
          <ColumnPickerField
            name={name}
            title={
              typeof fieldSchema.title === 'string' ? fieldSchema.title : name
            }
            description={
              typeof fieldSchema.description === 'string'
                ? fieldSchema.description
                : undefined
            }
            required={requiredFields.has(name)}
            mode={columnPicker}
            columns={datasetColumns}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
      if (!feastEntityMatch) return picker;
      return (
        <Fragment key={name}>
          {picker}
          <Grid item xs={12}>
            <FeastEntityMatchPanel
              datasetUri={data.datasetUri}
              entityIdColumn={data[name]}
              source={selectedDatasetSource}
            />
          </Grid>
        </Fragment>
      );
    }
    return (
      <Grid item xs={12} md={width} key={name}>
        {/* SchemaField is RJSF's generic per-property dispatcher — its
            value/id types are only known at runtime from `schema`, so
            bridging from this object-typed component's props needs `any`
            here rather than fighting RJSF's generics for each property. */}
        <SchemaField
          schema={fieldSchema}
          uiSchema={{
            ...((uiSchema as Record<string, unknown>)[name] ?? {}),
            ...(disabled ? { 'ui:disabled': true } : {}),
          }}
          formData={data[name] as any}
          onChange={(value: unknown) => onChange({ ...data, [name]: value })}
          idSchema={(idSchema as Record<string, unknown>)[name] as any}
          name={name}
          required={requiredFields.has(name)}
          registry={registry}
          errorSchema={errorSchema?.[name]}
          onBlur={() => {}}
          onFocus={() => {}}
        />
      </Grid>
    );
  };

  const renderEntries = (entries: GroupEntry[]) => (
    <Grid container spacing={2}>
      {entries.map(entry => {
        if (isSubpanel(entry)) {
          const { subpanel } = entry;
          const hasAnyField = subpanel.fields.some(
            f => properties[normalizeField(f).name],
          );
          // Progressive disclosure: a conditional child block doesn't exist
          // on screen at all when its condition isn't met — not an empty
          // dashed box.
          if (!hasAnyField) return null;
          return (
            <Grid item xs={12} key={subpanel.title}>
              <Box
                border={1}
                borderColor={NEUTRAL.border}
                borderRadius={4}
                style={{ borderStyle: 'dashed', padding: 16 }}
              >
                <Typography
                  variant="overline"
                  style={{
                    color: NEUTRAL.textSecondary,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 8,
                  }}
                >
                  {subpanel.title}
                </Typography>
                {renderEntries(subpanel.fields)}
              </Box>
            </Grid>
          );
        }
        const {
          name,
          width,
          disabled,
          autoFillModelName,
          columnPicker,
          datasetPicker,
          datasetPreview,
          dataSourcePicker,
          datasetValidation,
          baseModelPicker,
          lockedDisplay,
          featureNamesPicker,
          feastEntityMatch,
          searchSpaceBuilder,
          modelNamePicker,
          modelVersionPicker,
          modelVersionCheck,
          summaryField,
          versionComparison,
          promotionPreview,
          actionPicker,
          promptNamePicker,
          promptNameCombo,
          promptVersionPicker,
          ragCollectionPicker,
          ragIndexVersionPicker,
          llmModelPicker,
          evalSetNamePicker,
          evalSetNameCombo,
          sourcePathsPicker,
          choiceCards,
          multiSelect,
          secretPicker,
          huggingFaceModelValidator,
          huggingFaceModelPicker,
          modelPresetPicker,
          gpuRecommendationPanel,
          rolloutEligibilityGate,
          releaseEligibilityPanel,
          costEstimate,
          securityScan,
          taskTypeMetrics,
          taskTypeOptions,
          hidden,
          readOnlyDisplay,
        } = normalizeField(entry);
        return renderField(
          name,
          width ?? 12,
          columnPicker,
          datasetPicker,
          datasetPreview,
          dataSourcePicker,
          datasetValidation,
          baseModelPicker,
          lockedDisplay,
          featureNamesPicker,
          feastEntityMatch,
          searchSpaceBuilder,
          modelNamePicker,
          modelVersionPicker,
          modelVersionCheck,
          summaryField,
          versionComparison,
          promotionPreview,
          actionPicker,
          promptNamePicker,
          promptNameCombo,
          promptVersionPicker,
          ragCollectionPicker,
          ragIndexVersionPicker,
          llmModelPicker,
          evalSetNamePicker,
          evalSetNameCombo,
          sourcePathsPicker,
          choiceCards,
          multiSelect,
          secretPicker,
          huggingFaceModelValidator,
          huggingFaceModelPicker,
          modelPresetPicker,
          gpuRecommendationPanel,
          rolloutEligibilityGate,
          releaseEligibilityPanel,
          costEstimate,
          securityScan,
          disabled,
          autoFillModelName,
          taskTypeMetrics,
          taskTypeOptions,
          hidden,
          readOnlyDisplay,
        );
      })}
    </Grid>
  );

  const flattenNames = (entries: GroupEntry[]): string[] =>
    entries.flatMap(e =>
      isSubpanel(e)
        ? flattenNames(e.subpanel.fields)
        : [normalizeField(e).name],
    );

  const grouped = new Set<string>();
  groups.forEach(group => {
    flattenNames(group.fields).forEach(n => grouped.add(n));
    if (group.toggleField) grouped.add(group.toggleField);
  });
  const ungrouped = Object.keys(properties).filter(name => !grouped.has(name));

  const PanelTitle = ({ group }: { group: StepLayoutGroup }) => {
    const Icon = group.icon ? GROUP_ICONS[group.icon] : undefined;
    return (
      <Box display="flex" alignItems="center" style={{ gap: 6 }}>
        {Icon && (
          <Icon style={{ fontSize: 16, color: NEUTRAL.textSecondary }} />
        )}
        {/* Panel title is intentionally SMALLER than a field label (12px vs
            13-14px) — it names a group, not a value to enter, so weight +
            icon carry the distinction, not size. */}
        <Typography
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: NEUTRAL.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {group.title}
        </Typography>
      </Box>
    );
  };

  return (
    <>
      {/* Step-level intro/guidance — the Stepper only renders a step's
          title, so a `description:` on the parameter step would otherwise
          never show. Rendered once above the groups as a short "what this
          step is for" line. */}
      {typeof schema.description === 'string' && schema.description && (
        <Typography
          variant="body2"
          style={{ color: NEUTRAL.textSecondary, marginBottom: 16 }}
        >
          {schema.description}
        </Typography>
      )}
      {groups.map(group => {
        // Progressive disclosure at the panel level, not just per-field: a
        // group whose every field belongs to a branch that isn't active
        // right now (e.g. "Training parameters" when modelCategory is still
        // traditional-ml + taskType=clustering, or "Algorithm" once
        // modelCategory=deep-learning empties out its algorithm fields) has
        // nothing to justify showing an empty card — skip the
        // whole panel instead of rendering a header over blank space. A
        // toggleField panel (e.g. Fine-tune) still shows as long as the
        // toggle itself exists, even before it's switched on.
        const toggleFieldExists = Boolean(
          group.toggleField && properties[group.toggleField],
        );
        if (!hasAnyRenderable(group.fields, properties) && !toggleFieldExists)
          return null;
        const toggleOn = group.toggleField
          ? Boolean(data[group.toggleField])
          : true;
        const header = (
          <Box
            display="flex"
            alignItems="flex-start"
            justifyContent="space-between"
          >
            <PanelTitle group={group} />
            {group.toggleField && properties[group.toggleField] && (
              <FormControlLabel
                labelPlacement="start"
                label={<Typography variant="body2">Enable</Typography>}
                control={
                  <Checkbox
                    size="small"
                    checked={toggleOn}
                    onChange={e =>
                      onChange({
                        ...data,
                        [group.toggleField as string]: e.target.checked,
                      })
                    }
                  />
                }
              />
            )}
          </Box>
        );
        // Fields stay hidden while an off toggle makes them moot — same
        // "why does this need to be on screen right now" test as the
        // subpanel/accordion cases, just driven by a UI-only checkbox
        // instead of the branch schema.
        const content = toggleOn ? (
          <Box mt={2}>{renderEntries(group.fields)}</Box>
        ) : null;

        if (group.collapsible) {
          return (
            <Accordion key={group.title} style={{ marginBottom: 24 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <PanelTitle group={group} />
              </AccordionSummary>
              <AccordionDetails>{renderEntries(group.fields)}</AccordionDetails>
            </Accordion>
          );
        }
        return (
          <Card
            variant="outlined"
            style={{
              marginBottom: 24,
              backgroundColor:
                group.variant === 'optional'
                  ? NEUTRAL.background
                  : NEUTRAL.paper,
            }}
            key={group.title}
          >
            <CardContent>
              {header}
              {content}
            </CardContent>
          </Card>
        );
      })}
      {ungrouped.length > 0 && renderEntries(ungrouped)}
    </>
  );
}

export { StepLayout };
export type { StepLayoutUiOptions };
