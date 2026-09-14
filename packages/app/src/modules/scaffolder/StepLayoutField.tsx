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
  return useCallback(async () => {
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

  const renderField = (
    name: string,
    width: GridSize = 12,
    columnPicker?: 'single' | 'multi',
    datasetPicker?: boolean,
    datasetPreview?: boolean,
    dataSourcePicker?: boolean,
    datasetValidation?: boolean,
    baseModelPicker?: boolean,
  ) => {
    const fieldSchema = properties[name];
    if (!fieldSchema) return null;
    // A `const`-only property has nothing for the user to choose (its
    // value is fully pinned by whichever branch is active — see
    // train-track-register's `architecture: {const: sklearn}` for
    // modelCategory=traditional-ml) — showing an input for it is always
    // pointless, so skip it regardless of which group listed it.
    if (fieldSchema.const !== undefined) return null;
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
