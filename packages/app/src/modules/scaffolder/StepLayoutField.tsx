import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Box from '@material-ui/core/Box';
import Checkbox from '@material-ui/core/Checkbox';
import Chip from '@material-ui/core/Chip';
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
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AppsIcon from '@material-ui/icons/Apps';
import TuneIcon from '@material-ui/icons/Tune';
import FunctionsIcon from '@material-ui/icons/Functions';
import FilterListIcon from '@material-ui/icons/FilterList';
import FlashOnIcon from '@material-ui/icons/FlashOn';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import UndoIcon from '@material-ui/icons/Undo';
import RestoreIcon from '@material-ui/icons/Restore';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CancelIcon from '@material-ui/icons/Cancel';
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
   * Same live GET /models/{name}/promotion-status table as
   * `promotionPreview`, without the "will move X into Y" sentence — meant
   * for the action=promote-rollback branch's `rollbackEnvironment` field.
   * See PromotionPreviewPanel's `mode` prop doc comment for why that
   * sentence doesn't apply to a rollback.
   */
  rollbackPreview?: boolean;
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
   * Live GET /llm-deploy/validate-model lookup below this field — the
   * frontend half of deploy-llm's gated-model guardrail: surfaces whether
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
}

/**
 * A conditional child block (e.g. BYOC fields under Algorithm) — dashed
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
  // "bolt"/"query_stats" were already used by templates/register-deploy's
  // Action/Monitoring groups before these 2 entries existed — silently
  // rendering no icon (GROUP_ICONS[group.icon] === undefined) since
  // group.icon comes from YAML, not something tsc could catch. Fixed
  // while adding "trending_up" for the new Promotion group.
  bolt: FlashOnIcon,
  query_stats: ShowChartIcon,
  trending_up: TrendingUpIcon,
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
    ]) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).map(String);
    }
  }
  return [];
}

/**
 * Fetches the current dataset's column names via orchestration-api
 * (GET /datasets/columns) whenever `datasetUri` is a non-empty string.
 * Returns `[]` (never throws into the caller) while unset, loading, or on
 * failure — every call site treats an empty list as "show the plain field
 * instead", so this never blocks the form.
 */
function useDatasetColumns(datasetUri: unknown): string[] {
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
          )}`,
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
  }, [discoveryApi, fetch, datasetUri, getAuthHeaders]);

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
 * Fetches the object store's dataset listing (GET /datasets) once on
 * mount. Returns `[]` (never throws) while loading or on failure — every
 * call site treats an empty list as "show the plain `file://` text field
 * instead", same fallback contract as useDatasetColumns above.
 */
function useDatasets(): DatasetInfo[] {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
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
          setDatasets(Array.isArray(list) ? (list as DatasetInfo[]) : []);
        }
      })
      .catch(() => {
        if (!cancelled) setDatasets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, getAuthHeaders]);

  return datasets;
}

interface RegisteredModel {
  name: string;
  version: string;
}

/**
 * Fetches registered models (GET /models — name + latest version) once on
 * mount, for the "Continue training from an existing model" picker.
 * Returns `[]` (never throws) while loading or on failure, same fail-open
 * contract as useDatasets above.
 */
function useModels(): RegisteredModel[] {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [models, setModels] = useState<RegisteredModel[]>([]);

  useEffect(() => {
    let cancelled = false;
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
          setModels(Array.isArray(list) ? (list as RegisteredModel[]) : []);
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, getAuthHeaders]);

  return models;
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

/**
 * Fetches every ACTUALLY REGISTERED version of `modelName` (GET
 * /models/{name}/versions), newest first — for the Evaluate & Deploy Model
 * template's `modelVersionPicker` field, so the version dropdown can never
 * offer a version that doesn't exist. Re-fetches whenever `modelName`
 * changes; returns `[]` (never throws) while `modelName` is empty,
 * mid-fetch, or on failure, same fail-open contract as useModels above.
 */
function useModelVersions(modelName: unknown): string[] {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [versions, setVersions] = useState<string[]>([]);

  useEffect(() => {
    if (typeof modelName !== 'string' || !modelName) {
      setVersions([]);
      return undefined;
    }
    let cancelled = false;
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
        if (!cancelled) setVersions(toStringList(body));
      })
      .catch(() => {
        if (!cancelled) setVersions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, modelName, getAuthHeaders]);

  return versions;
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

/**
 * Fetches the chosen dataset's first rows (GET /datasets/preview) whenever
 * `datasetUri` is a non-empty string. Returns `null` (never throws) while
 * unset, loading, or on failure — same fail-open contract as
 * useDatasetColumns/useDatasets: a non-CSV dataset (architecture=cv's
 * `.zip`) legitimately fails here, and the caller just renders nothing.
 */
function useDatasetPreview(datasetUri: unknown): DatasetPreview | null {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [preview, setPreview] = useState<DatasetPreview | null>(null);

  useEffect(() => {
    if (typeof datasetUri !== 'string' || !datasetUri) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    Promise.all([discoveryApi.getBaseUrl('proxy'), getAuthHeaders()])
      .then(([proxyUrl, headers]) =>
        fetch(
          `${proxyUrl}/orchestration-api/datasets/preview?dataset_uri=${encodeURIComponent(
            datasetUri,
          )}&limit=${DATASET_PREVIEW_ROW_LIMIT}`,
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
          setPreview({
            columns: Array.isArray(obj.columns) ? obj.columns.map(String) : [],
            rows: Array.isArray(obj.rows)
              ? (obj.rows as Record<string, unknown>[])
              : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetch, datasetUri, getAuthHeaders]);

  return preview;
}

/**
 * Read-only table of a dataset's first rows, inside a collapsible Accordion
 * (same collapsible visual language as StepLayoutUiOptions groups) so it
 * doesn't permanently take up space once a user has seen it. Renders
 * nothing until useDatasetPreview resolves something. Re-expands whenever
 * `datasetUri` changes — picking a different dataset should show its data,
 * not stay collapsed on whatever the previous dataset left it at.
 */
function DatasetPreviewPanel({
  datasetUri,
}: {
  datasetUri: unknown;
}): JSX.Element | null {
  const preview = useDatasetPreview(datasetUri);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => setExpanded(true), [datasetUri]);
  if (!preview || preview.rows.length === 0) return null;
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
}: {
  datasetUri: unknown;
  taskType: unknown;
  targetColumn: unknown;
  timeColumn: unknown;
}): JSX.Element | null {
  const results = useDatasetValidation(
    datasetUri,
    taskType,
    targetColumn,
    timeColumn,
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

interface DatasetPickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  datasets: DatasetInfo[];
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
  value,
  onChange,
}: DatasetPickerFieldProps): JSX.Element {
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
      {datasets.map(dataset => (
        <MenuItem key={dataset.uri} value={dataset.uri}>
          {dataset.name} ({(dataset.size_bytes / 1024).toFixed(1)} KB)
        </MenuItem>
      ))}
    </TextField>
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
    caption: 'Move a release to the next environment',
    Icon: TrendingUpIcon,
  },
  {
    value: 'promote-rollback',
    label: 'Promote rollback',
    caption: 'Undo the last promotion (staging/prod)',
    Icon: RestoreIcon,
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

interface ModelNamePickerFieldProps {
  name: string;
  title: string;
  description?: string;
  required: boolean;
  modelNames: string[];
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
  value,
  onChange,
}: ModelNamePickerFieldProps): JSX.Element {
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
  value,
  onChange,
}: ModelVersionPickerFieldProps): JSX.Element {
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
      {options.map(option => (
        <MenuItem key={option} value={option}>
          {formatOption ? formatOption(option) : option}
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
  const bound =
    threshold.minimum !== null
      ? `≥ ${threshold.minimum}`
      : threshold.maximum !== null
      ? `≤ ${threshold.maximum}`
      : '';
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
 * Live HuggingFace model check for deploy-llm's `huggingFaceModelId` field —
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
 * GPU suggestion for deploy-llm's compute fields — reads the param count +
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
 * Rollout gate for deploy-llm's `deployStrategy` field — see
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

interface PromotionStatus {
  project: string;
  component: string;
  environments: Record<string, string | null>;
  prod_pending_approval: boolean;
}

type PromotionStatusState =
  | { status: 'loading' }
  | { status: 'none' }
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
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Partial<PromotionStatus>>;
      })
      .then(data => {
        if (cancelled) return;
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
  mode = 'promote',
}: {
  modelName: unknown;
  targetEnvironment: unknown;
  /** 'rollback' skips the "will move X into Y" sentence below the table —
   * that framing (source environment -> target) only describes what
   * promote does. A rollback swaps `targetEnvironment` back to whatever
   * was there before, which this table's per-environment values don't
   * predict (the "previous" pointer isn't exposed by GET
   * /models/{name}/promotion-status — see
   * adapters/openchoreo_promotion_adapter.py's annotation-based undo).
   * The table itself (what's bound right now) is still useful context
   * for deciding which environment to roll back. */
  mode?: 'promote' | 'rollback';
}): JSX.Element | null {
  const state = usePromotionStatus(modelName);
  if (state.status !== 'found') return null;
  if (typeof targetEnvironment !== 'string' || !targetEnvironment) return null;

  const sourceEnvironment =
    mode === 'promote'
      ? PROMOTION_SOURCE_ENVIRONMENT[targetEnvironment]
      : undefined;
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
 * summary yet. `action` picks which of the 3 sentence shapes to render —
 * rollback and promote don't touch deployStrategy/releaseStrategy at all,
 * so reusing the deploy sentence for them would be actively wrong, not
 * just imprecise.
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
  } else if (action === 'promote-rollback') {
    const rollbackEnvironment =
      typeof data.rollbackEnvironment === 'string' && data.rollbackEnvironment
        ? data.rollbackEnvironment
        : '(environment not chosen yet)';
    sentence = (
      <>
        Will undo the last promotion to <strong>{rollbackEnvironment}</strong>{' '}
        for <strong>{modelName}</strong>, one step back.
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
                <TableCell>
                  {!row.enabled ? (
                    <Typography variant="body2" color="textSecondary">
                      Fixed at the value from Architecture &amp; Task
                    </Typography>
                  ) : meta.kind === 'categorical' ? (
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
                                    : row.categoricalChoices.filter(
                                        o => o !== option,
                                      ),
                                })
                              }
                            />
                          }
                          label={option}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Box
                      display="flex"
                      alignItems="flex-start"
                      style={{ gap: 8 }}
                    >
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
                            onChange={e =>
                              updateRow(meta.key, { low: e.target.value })
                            }
                            style={{ width: 100 }}
                          />
                          <TextField
                            variant="outlined"
                            size="small"
                            label="High"
                            value={row.high}
                            onChange={e =>
                              updateRow(meta.key, { high: e.target.value })
                            }
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
                          onChange={e =>
                            updateRow(meta.key, { choicesText: e.target.value })
                          }
                          fullWidth
                        />
                      )}
                    </Box>
                  )}
                </TableCell>
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
  const datasetColumns = useDatasetColumns(data.datasetUri);
  const datasets = useDatasets();
  const dataSources = groupDatasetsBySource(datasets).map(([source]) => source);
  const models = useModels();
  const availableFeatures = useAvailableFeatures();
  const modelVersions = useModelVersions(data.modelName);
  const modelSummary = useModelVersionCheck(data.modelName, data.modelVersion);
  const promptNames = usePrompts();
  const promptVersions = usePromptVersions(data.promptName);
  const ragCollections = useRagCollections();
  const ragIndexVersions = useRagIndexVersions(data.collectionName);
  const llmModels = useLlmModels();

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
    if (Object.keys(updates).length > 0) onChange({ ...data, ...updates });
  });

  // Keeps `dataSource` pointed at a source GET /datasets actually returned
  // (auto-picks the first one once the list loads / whenever the current
  // value stops being valid — e.g. that adapter went away), and clears
  // `datasetUri` the moment it no longer belongs to the current
  // `dataSource` OR no longer matches `architecture`'s required file type
  // (e.g. switching architecture from cv to sklearn after already picking
  // a .zip) — same "never let a stale cross-field value survive" contract
  // as the effect above, scoped to just this one pair. Runs on every
  // render (idempotent, like the effect above) since "is the current value
  // still valid" has to be rechecked against the latest `datasets` fetch,
  // not just once.
  useEffect(() => {
    if (dataSources.length === 0 || !properties.dataSource) return;
    if (
      typeof data.dataSource !== 'string' ||
      !dataSources.includes(data.dataSource)
    ) {
      onChange({ ...data, dataSource: dataSources[0], datasetUri: undefined });
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
  // available as a backward-compatible fallback.
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
    const summaryDatasetUri =
      modelSummary.summary.dataset_uri ??
      modelSummary.summary.tags.dataset_uri ??
      modelSummary.summary.tags.training_dataset_uri;
    if (summaryDatasetUri && data.referenceDataUri !== summaryDatasetUri) {
      onChange({ ...data, referenceDataUri: summaryDatasetUri });
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
    searchSpaceBuilder?: boolean,
    modelNamePicker?: boolean,
    modelVersionPicker?: boolean,
    modelVersionCheck?: boolean,
    summaryField?: boolean,
    versionComparison?: boolean,
    promotionPreview?: boolean,
    rollbackPreview?: boolean,
    actionPicker?: boolean,
    promptNamePicker?: boolean,
    promptVersionPicker?: boolean,
    ragCollectionPicker?: boolean,
    ragIndexVersionPicker?: boolean,
    llmModelPicker?: boolean,
    huggingFaceModelValidator?: boolean,
    gpuRecommendationPanel?: boolean,
    rolloutEligibilityGate?: boolean,
  ) => {
    const fieldSchema = properties[name];
    if (!fieldSchema) return null;
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
    if (modelNamePicker && models.length > 0) {
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
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (modelVersionPicker || modelVersionCheck) {
      const widget =
        modelVersionPicker && modelVersions.length > 0 ? (
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
    if (rollbackPreview) {
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
              mode="rollback"
            />
          </Grid>
        </Fragment>
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
    if (
      huggingFaceModelValidator ||
      gpuRecommendationPanel ||
      rolloutEligibilityGate
    ) {
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
    if (datasetPicker && datasets.length > 0) {
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
              <DatasetPreviewPanel datasetUri={data[name]} />
            </Grid>
          )}
          {datasetValidation && (
            <Grid item xs={12}>
              <DatasetValidationPanel
                datasetUri={data[name]}
                taskType={data.taskType}
                targetColumn={data.targetColumn}
                timeColumn={data.timeColumn}
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
            mode={columnPicker}
            columns={datasetColumns}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
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
          columnPicker,
          datasetPicker,
          datasetPreview,
          dataSourcePicker,
          datasetValidation,
          baseModelPicker,
          lockedDisplay,
          featureNamesPicker,
          searchSpaceBuilder,
          modelNamePicker,
          modelVersionPicker,
          modelVersionCheck,
          summaryField,
          versionComparison,
          promotionPreview,
          rollbackPreview,
          actionPicker,
          promptNamePicker,
          promptVersionPicker,
          ragCollectionPicker,
          ragIndexVersionPicker,
          llmModelPicker,
          huggingFaceModelValidator,
          gpuRecommendationPanel,
          rolloutEligibilityGate,
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
          searchSpaceBuilder,
          modelNamePicker,
          modelVersionPicker,
          modelVersionCheck,
          summaryField,
          versionComparison,
          promotionPreview,
          rollbackPreview,
          actionPicker,
          promptNamePicker,
          promptVersionPicker,
          ragCollectionPicker,
          ragIndexVersionPicker,
          llmModelPicker,
          huggingFaceModelValidator,
          gpuRecommendationPanel,
          rolloutEligibilityGate,
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
      {groups.map(group => {
        // Progressive disclosure at the panel level, not just per-field: a
        // group whose every field belongs to a branch that isn't active
        // right now (e.g. "Training parameters" when modelCategory is still
        // traditional-ml + taskType=clustering, or "Algorithm" once
        // modelCategory=deep-learning empties out its algorithm/BYOC
        // fields) has nothing to justify showing an empty card — skip the
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
