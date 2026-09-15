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
import { configApiRef, discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
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
   * Live GET /models/{name}/{version}/summary lookup below this field —
   * the frontend half of this session's policy-check 404 fix: instead of
   * only finding out a model:version doesn't exist after the whole
   * wizard submits and the training/deploy workflow fails, this surfaces
   * it (task_type + metrics if found, a clear "not found" if not) the
   * moment both `modelName` and this field have values. Advisory only —
   * same non-blocking contract as datasetValidation above, not a hard
   * gate on "Next".
   */
  modelVersionCheck?: boolean;
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
function isRenderable(name: string, properties: Record<string, JSONSchema7>): boolean {
  const fieldSchema = properties[name];
  return Boolean(fieldSchema) && fieldSchema.const === undefined;
}

function hasAnyRenderable(entries: GroupEntry[], properties: Record<string, JSONSchema7>): boolean {
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
    const authEnabled = configApi.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;
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
        fetch(`${proxyUrl}/orchestration-api/datasets/columns?dataset_uri=${encodeURIComponent(datasetUri)}`, {
          headers,
        }),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: { columns: string[] }) => {
        if (!cancelled) setColumns(body.columns);
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
function groupDatasetsBySource(datasets: DatasetInfo[]): [string, DatasetInfo[]][] {
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
      .then(([proxyUrl, headers]) => fetch(`${proxyUrl}/orchestration-api/datasets`, { headers }))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: { datasets: DatasetInfo[] }) => {
        if (!cancelled) setDatasets(body.datasets);
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
      .then(([proxyUrl, headers]) => fetch(`${proxyUrl}/orchestration-api/models`, { headers }))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: RegisteredModel[]) => {
        if (!cancelled) setModels(body);
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
      .then(([proxyUrl, headers]) => fetch(`${proxyUrl}/orchestration-api/features`, { headers }))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: { features: string[] }) => {
        if (!cancelled) setFeatures(body.features);
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
          `${proxyUrl}/orchestration-api/datasets/preview?dataset_uri=${encodeURIComponent(datasetUri)}&limit=${DATASET_PREVIEW_ROW_LIMIT}`,
          { headers },
        ),
      )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: DatasetPreview) => {
        if (!cancelled) setPreview(body);
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
function DatasetPreviewPanel({ datasetUri }: { datasetUri: unknown }): JSX.Element | null {
  const preview = useDatasetPreview(datasetUri);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => setExpanded(true), [datasetUri]);
  if (!preview || preview.rows.length === 0) return null;
  return (
    <Accordion expanded={expanded} onChange={(_e, isExpanded) => setExpanded(isExpanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline" style={{ color: NEUTRAL.textSecondary, fontWeight: 700 }}>
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

const VALIDATION_SEVERITY_COLOR: Record<DatasetValidationResult['severity'], string> = {
  blocking: STATUS.error,
  warning: STATUS.warning,
  info: STATUS.success,
};

const VALIDATION_SEVERITY_LABEL: Record<DatasetValidationResult['severity'], string> = {
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
  const [results, setResults] = useState<DatasetValidationResult[] | null>(null);

  useEffect(() => {
    if (typeof datasetUri !== 'string' || !datasetUri || typeof taskType !== 'string' || !taskType) {
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
              target_column: typeof targetColumn === 'string' && targetColumn ? targetColumn : undefined,
              time_column: typeof timeColumn === 'string' && timeColumn ? timeColumn : undefined,
            }),
          }),
        )
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((body: DatasetValidationResult[]) => {
          if (!cancelled) setResults(body);
        })
        .catch(() => {
          if (!cancelled) setResults(null);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [discoveryApi, fetch, datasetUri, taskType, targetColumn, timeColumn, getAuthHeaders]);

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
  const results = useDatasetValidation(datasetUri, taskType, targetColumn, timeColumn);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => setExpanded(true), [datasetUri, targetColumn, timeColumn]);
  if (!results || results.length === 0) return null;
  const blockingCount = results.filter(r => r.severity === 'blocking').length;
  return (
    <Accordion expanded={expanded} onChange={(_e, isExpanded) => setExpanded(isExpanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline" style={{ color: NEUTRAL.textSecondary, fontWeight: 700 }}>
          Data validation {blockingCount > 0 ? `(${blockingCount} error${blockingCount > 1 ? 's' : ''})` : ''}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box display="flex" flexDirection="column" style={{ gap: 8, width: '100%' }}>
          {results.map(result => (
            <Box key={result.check_name} display="flex" alignItems="flex-start" style={{ gap: 8 }}>
              <Chip
                label={VALIDATION_SEVERITY_LABEL[result.severity]}
                size="small"
                style={{ backgroundColor: VALIDATION_SEVERITY_COLOR[result.severity], color: '#FFF', flexShrink: 0 }}
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
        <MenuItem key={`${model.name}:${model.version}`} value={`models:/${model.name}/${model.version}`}>
          {model.name} (v{model.version})
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

interface ModelVersionSummary {
  name: string;
  version: string;
  task_type: string | null;
  metrics: Record<string, number>;
  tags: Record<string, string>;
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
function useModelVersionCheck(modelName: unknown, modelVersion: unknown): ModelVersionCheckState {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const getAuthHeaders = useOpenChoreoAuthHeaders();
  const [state, setState] = useState<ModelVersionCheckState>({ status: 'empty' });

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
            `${proxyUrl}/orchestration-api/models/${encodeURIComponent(modelName)}/${encodeURIComponent(modelVersion)}/summary`,
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
          const summary: ModelVersionSummary = await res.json();
          if (!cancelled) setState({ status: 'found', summary });
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

/** Color-coded early-warning panel for Evaluate & Deploy Model's modelName/modelVersion pair — see useModelVersionCheck. Renders nothing until both fields are filled in. */
function ModelVersionCheckPanel({
  modelName,
  modelVersion,
}: {
  modelName: unknown;
  modelVersion: unknown;
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
          style={{ backgroundColor: STATUS.error, color: '#FFF', flexShrink: 0 }}
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
    <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
      <Chip
        label="Found"
        size="small"
        style={{ backgroundColor: STATUS.success, color: '#FFF', flexShrink: 0 }}
      />
      <Typography variant="body2">
        {summary.task_type ? `task_type: ${summary.task_type}` : 'no task_type tag set'}
        {metricsText && ` — ${metricsText}`}
      </Typography>
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
            ? ((v: unknown) => (
                <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>
                  {(v as string[]).map(col => (
                    <Chip key={col} label={col} size="small" />
                  ))}
                </Box>
              ))
            : undefined,
      }}
    >
      {columns.map(col => (
        <MenuItem key={col} value={col}>
          {mode === 'multi' && <Checkbox size="small" checked={(selected as string[]).includes(col)} />}
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
  { key: 'optimizer', label: 'Optimizer', kind: 'categorical', categoricalOptions: ['adam', 'sgd'] },
];
const LSTM_HYPERPARAMS: HyperparamMeta[] = [
  { key: 'learning_rate', label: 'Learning rate', kind: 'numeric' },
  { key: 'epochs', label: 'Epochs', kind: 'numeric' },
  { key: 'batch_size', label: 'Batch size', kind: 'numeric' },
  { key: 'sequence_length', label: 'Sequence length', kind: 'numeric' },
  { key: 'num_layers', label: 'Number of layers', kind: 'numeric' },
  { key: 'hidden_size', label: 'Hidden size', kind: 'numeric' },
  { key: 'optimizer', label: 'Optimizer', kind: 'categorical', categoricalOptions: ['adam', 'sgd'] },
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
  return { enabled: false, mode: 'range', low: '', high: '', choicesText: '', categoricalChoices: [] };
}

/** Parses an existing `{"param": {"low":..,"high":..} | {"choices":[...]}}` JSON string (or "{}"/invalid) into per-row UI state — only called once, at mount, via useState's lazy initializer (see SearchSpaceBuilderField). */
function parseSearchSpaceJson(
  json: string,
  hyperparams: HyperparamMeta[],
): Record<string, SearchSpaceRow> {
  let parsed: Record<string, { choices?: unknown[]; low?: number; high?: number }> = {};
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
          ? { ...emptyRow(), enabled: true, mode: 'choices', categoricalChoices: spec.choices.map(String) }
          : { ...emptyRow(), enabled: true, mode: 'choices', choicesText: spec.choices.join(', ') };
    } else if (spec.low !== undefined && spec.high !== undefined) {
      rows[meta.key] = { ...emptyRow(), enabled: true, mode: 'range', low: String(spec.low), high: String(spec.high) };
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
  const result: Record<string, { choices?: unknown[]; low?: number; high?: number }> = {};
  for (const meta of hyperparams) {
    const row = rows[meta.key];
    if (!row?.enabled) continue;
    if (meta.kind === 'categorical') {
      if (row.categoricalChoices.length > 0) result[meta.key] = { choices: row.categoricalChoices };
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
      if (!Number.isNaN(low) && !Number.isNaN(high)) result[meta.key] = { low, high };
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
  const hyperparams = architecture === 'lstm' ? LSTM_HYPERPARAMS : MLP_HYPERPARAMS;
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
                    onChange={e => updateRow(meta.key, { enabled: e.target.checked })}
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
                                    : row.categoricalChoices.filter(o => o !== option),
                                })
                              }
                            />
                          }
                          label={option}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Box display="flex" alignItems="flex-start" style={{ gap: 8 }}>
                      <TextField
                        select
                        variant="outlined"
                        size="small"
                        value={row.mode}
                        onChange={e => updateRow(meta.key, { mode: e.target.value as 'range' | 'choices' })}
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
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {description && (
        <Typography variant="caption" color="textSecondary" style={{ display: 'block', marginTop: 4 }}>
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
  props: FieldExtensionComponentProps<Record<string, unknown>, StepLayoutUiOptions>,
): JSX.Element {
  const { schema, uiSchema, formData, onChange, idSchema, registry, errorSchema } = props;
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
      if (!currentNames.has(name) && data[name] !== undefined) updates[name] = undefined;
    });
    Object.entries(properties).forEach(([name, fieldSchema]) => {
      if (fieldSchema.const !== undefined) {
        if (data[name] !== fieldSchema.const) updates[name] = fieldSchema.const;
        return;
      }
      const allowedValues = resolvedEnumValues(fieldSchema);
      if (allowedValues && data[name] !== undefined && !allowedValues.includes(data[name])) {
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
    if (typeof data.dataSource !== 'string' || !dataSources.includes(data.dataSource)) {
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
          (typeof data.architecture !== 'string' || d.name.toLowerCase().endsWith('.zip') === wantsZip),
      );
    if (data.datasetUri !== undefined && !datasetUriBelongsToSource) {
      onChange({ ...data, datasetUri: undefined });
    }
  });

  // Auto-fills `modelVersion` with the latest known version the moment
  // `modelName` changes to a NEW value (Evaluate & Deploy Model's
  // modelNamePicker field) — a no-op everywhere else, since it only fires
  // when the schema actually declares a `modelVersion` property. Only
  // reacts to modelName actually changing (tracked via the ref), so it
  // never stomps on a version the user deliberately edited afterwards to
  // target an older release.
  const previousModelName = useRef<unknown>(undefined);
  useEffect(() => {
    if (!properties.modelVersion || models.length === 0) return;
    if (data.modelName === previousModelName.current) return;
    previousModelName.current = data.modelName;
    const match = models.find(m => m.name === data.modelName);
    if (match) onChange({ ...data, modelVersion: match.version });
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
    modelVersionCheck?: boolean,
  ) => {
    const fieldSchema = properties[name];
    if (!fieldSchema) return null;
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
      const displayTitle = (fieldSchema as { displayTitle?: unknown }).displayTitle;
      return (
        <Grid item xs={12} md={width} key={name}>
          <TextField
            variant="outlined"
            fullWidth
            // readOnly, not `disabled` — disabled fades the text out
            // (this needs to stay legible, it's a value being reported to
            // the user, not a field that merely doesn't apply right now).
            InputProps={{ readOnly: true }}
            label={typeof fieldSchema.title === 'string' ? fieldSchema.title : name}
            value={typeof displayTitle === 'string' ? displayTitle : String(fieldSchema.const)}
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
            title={typeof fieldSchema.title === 'string' ? fieldSchema.title : name}
            description={typeof fieldSchema.description === 'string' ? fieldSchema.description : undefined}
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
            title={typeof fieldSchema.title === 'string' ? fieldSchema.title : name}
            description={typeof fieldSchema.description === 'string' ? fieldSchema.description : undefined}
            required={requiredFields.has(name)}
            modelNames={modelNames}
            value={data[name]}
            onChange={value => onChange({ ...data, [name]: value })}
          />
        </Grid>
      );
    }
    if (modelVersionCheck) {
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
            <ModelVersionCheckPanel modelName={data.modelName} modelVersion={data[name]} />
          </Grid>
        </Fragment>
      );
    }
    if (dataSourcePicker && dataSources.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <DataSourcePickerField
            name={name}
            title={typeof fieldSchema.title === 'string' ? fieldSchema.title : name}
            description={typeof fieldSchema.description === 'string' ? fieldSchema.description : undefined}
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
      // Excludes the recsys/ sample data (data/recsys/ locally, same
      // prefix convention in the S3 bucket) — interactions/item-feature
      // tables with no target column, unusable by train.py/train_dl.py
      // and only ever meant for recommend-train-register's own
      // interactionsUri field, which doesn't go through this picker.
      scopedDatasets = scopedDatasets.filter(d => !/^recsys\//i.test(d.name));
      // Further scoped to whatever file type `architecture` (set in an
      // earlier step, e.g. train-track-register's Architecture & Task)
      // can actually read — cv needs a .zip of images (ImageFolder),
      // every other architecture needs a CSV (see
      // infra/argo-workflows/training-image/train.py's `pd.read_csv(...)`
      // call, which runs for everything except cv). No-op for any
      // template with a datasetPicker but no `architecture` field.
      if (typeof data.architecture === 'string') {
        const wantsZip = data.architecture === 'cv';
        scopedDatasets = scopedDatasets.filter(d => d.name.toLowerCase().endsWith('.zip') === wantsZip);
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
        const matching = scopedDatasets.filter(d => (d.name.split('/')[0] ?? '').endsWith(suffix));
        if (matching.length > 0) scopedDatasets = matching;
      }
      const picker = (
        <Grid item xs={12} md={width} key={`${name}-picker`}>
          <DatasetPickerField
            name={name}
            title={typeof fieldSchema.title === 'string' ? fieldSchema.title : name}
            description={typeof fieldSchema.description === 'string' ? fieldSchema.description : undefined}
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
            title={typeof fieldSchema.title === 'string' ? fieldSchema.title : name}
            description={typeof fieldSchema.description === 'string' ? fieldSchema.description : undefined}
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
            title={typeof fieldSchema.title === 'string' ? fieldSchema.title : name}
            description={typeof fieldSchema.description === 'string' ? fieldSchema.description : undefined}
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
            title={typeof fieldSchema.title === 'string' ? fieldSchema.title : name}
            description={typeof fieldSchema.description === 'string' ? fieldSchema.description : undefined}
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
          const hasAnyField = subpanel.fields.some(f => properties[normalizeField(f).name]);
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
                  style={{ color: NEUTRAL.textSecondary, fontWeight: 700, display: 'block', marginBottom: 8 }}
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
          modelVersionCheck,
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
          modelVersionCheck,
        );
      })}
    </Grid>
  );

  const flattenNames = (entries: GroupEntry[]): string[] =>
    entries.flatMap(e => (isSubpanel(e) ? flattenNames(e.subpanel.fields) : [normalizeField(e).name]));

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
        {Icon && <Icon style={{ fontSize: 16, color: NEUTRAL.textSecondary }} />}
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
        const toggleFieldExists = Boolean(group.toggleField && properties[group.toggleField]);
        if (!hasAnyRenderable(group.fields, properties) && !toggleFieldExists) return null;
        const toggleOn = group.toggleField ? Boolean(data[group.toggleField]) : true;
        const header = (
          <Box display="flex" alignItems="flex-start" justifyContent="space-between">
            <PanelTitle group={group} />
            {group.toggleField && properties[group.toggleField] && (
              <FormControlLabel
                labelPlacement="start"
                label={<Typography variant="body2">Enable</Typography>}
                control={
                  <Checkbox
                    size="small"
                    checked={toggleOn}
                    onChange={e => onChange({ ...data, [group.toggleField as string]: e.target.checked })}
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
              backgroundColor: group.variant === 'optional' ? NEUTRAL.background : NEUTRAL.paper,
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
