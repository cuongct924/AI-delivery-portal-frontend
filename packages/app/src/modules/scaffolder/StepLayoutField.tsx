import { useEffect, useRef, useState } from 'react';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Box from '@material-ui/core/Box';
import Checkbox from '@material-ui/core/Checkbox';
import Chip from '@material-ui/core/Chip';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import Grid, { GridSize } from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AppsIcon from '@material-ui/icons/Apps';
import TuneIcon from '@material-ui/icons/Tune';
import FunctionsIcon from '@material-ui/icons/Functions';
import FilterListIcon from '@material-ui/icons/FilterList';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { JSONSchema7 } from 'json-schema';
import { NEUTRAL } from '../theme/colors';

/** One field placed inside a group — `width` is an MD-breakpoint span out of 12 (6 = half-width, side by side with another 6). */
interface GroupField {
  name: string;
  width?: GridSize;
  /**
   * Renders this field as a picker populated from the chosen dataset's own
   * CSV header (GET /datasets/columns) instead of a free-text/array input
   * that makes the user guess or mistype a column name — 'single' for one
   * column (e.g. Target column), 'multi' for several (e.g. ID columns).
   * Falls back to the plain field whenever no dataset is selected yet, the
   * fetch is still in flight, or it fails (e.g. architecture=cv's dataset
   * is a .zip, not a CSV) — never blocks the field from being usable.
   */
  columnPicker?: 'single' | 'multi';
  /**
   * Renders this field as a picker populated from the object store's
   * dataset listing (GET /datasets — adapters/object_storage_adapter.py,
   * a real MinIO `list_objects_v2` in production) instead of a free-text
   * `file://` path the user has to type/guess. Falls back to the plain
   * field while the list is still loading or comes back empty.
   */
  datasetPicker?: boolean;
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
  /** A boolean field rendered as a compact checkbox in the header row (mockup's "☐ Bật"), instead of a full-width field in the grid below. */
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
 * Fetches the current dataset's column names via orchestration-api
 * (GET /datasets/columns) whenever `datasetUri` is a non-empty string.
 * Returns `[]` (never throws into the caller) while unset, loading, or on
 * failure — every call site treats an empty list as "show the plain field
 * instead", so this never blocks the form.
 */
function useDatasetColumns(datasetUri: unknown): string[] {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    if (typeof datasetUri !== 'string' || !datasetUri) {
      setColumns([]);
      return undefined;
    }
    let cancelled = false;
    discoveryApi
      .getBaseUrl('proxy')
      .then(proxyUrl =>
        fetch(`${proxyUrl}/orchestration-api/datasets/columns?dataset_uri=${encodeURIComponent(datasetUri)}`),
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
  }, [discoveryApi, fetch, datasetUri]);

  return columns;
}

interface DatasetInfo {
  name: string;
  uri: string;
  size_bytes: number;
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
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    discoveryApi
      .getBaseUrl('proxy')
      .then(proxyUrl => fetch(`${proxyUrl}/orchestration-api/datasets`))
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
  }, [discoveryApi, fetch]);

  return datasets;
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

/** Same shape as ColumnPickerField — a Select whose options come from a live API call instead of a JSON Schema enum. */
function DatasetPickerField({
  name,
  title,
  description,
  required,
  datasets,
  value,
  onChange,
}: DatasetPickerFieldProps): JSX.Element {
  const labelId = `dataset-picker-${name}-label`;
  const selected = typeof value === 'string' ? value : '';
  return (
    <FormControl fullWidth>
      <InputLabel id={labelId}>{`${title}${required ? '*' : ''}`}</InputLabel>
      <Select labelId={labelId} value={selected} onChange={e => onChange(e.target.value)}>
        {datasets.map(dataset => (
          <MenuItem key={dataset.uri} value={dataset.uri}>
            {dataset.name} ({(dataset.size_bytes / 1024).toFixed(1)} KB)
          </MenuItem>
        ))}
      </Select>
      {description && <FormHelperText>{description}</FormHelperText>}
    </FormControl>
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
  const labelId = `column-picker-${name}-label`;
  let selected: string | string[] = mode === 'multi' ? [] : '';
  if (mode === 'multi' && Array.isArray(value)) selected = value as string[];
  if (mode === 'single' && typeof value === 'string') selected = value;
  return (
    <FormControl fullWidth>
      <InputLabel id={labelId}>{`${title}${required ? '*' : ''}`}</InputLabel>
      <Select
        labelId={labelId}
        multiple={mode === 'multi'}
        value={selected}
        onChange={e => onChange(e.target.value)}
        renderValue={
          mode === 'multi'
            ? (v => (
                <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>
                  {(v as string[]).map(col => (
                    <Chip key={col} label={col} size="small" />
                  ))}
                </Box>
              ))
            : undefined
        }
      >
        {columns.map(col => (
          <MenuItem key={col} value={col}>
            {mode === 'multi' && <Checkbox size="small" checked={(selected as string[]).includes(col)} />}
            {col}
          </MenuItem>
        ))}
      </Select>
      {description && <FormHelperText>{description}</FormHelperText>}
    </FormControl>
  );
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

  // Two related kinds of stale formData this step's own branching
  // (modelCategory/algorithmFamily/architecture) can produce, neither of
  // which RJSF clears on its own:
  //
  //  1. A property that DISAPPEARS from this step's resolved schema (e.g.
  //     algorithmFamily/algorithm only exist while
  //     modelCategory=traditional-ml) keeps whatever value it last had —
  //     e.g. picking Traditional ML (algorithmFamily defaults to
  //     "scikit-learn") then switching to Deep Learning leaves
  //     algorithmFamily="scikit-learn" and algorithm="<some sklearn
  //     algo>" sitting in formData even though neither field is visible
  //     anymore. That's not just a cosmetic risk: it's a REAL (not
  //     vacuous) match for `if: {algorithmFamily: {const: 'scikit-learn'},
  //     taskType: {...}}`, which is exactly what re-activates the
  //     "Thuật toán" sklearn-algorithm panel underneath Deep Learning —
  //     and it's what actually ships to orchestration-api in `steps:`,
  //     i.e. a Deep Learning submission could silently carry a leftover
  //     algorithm="RandomForestClassifier". Clearing a field's value the
  //     instant its property disappears fixes both.
  //
  //  2. A `const`-only property (e.g. `architecture: {const: sklearn}`
  //     once modelCategory=traditional-ml) is hidden by renderField's own
  //     const check, so nothing ever WRITES that value in the first
  //     place — meaning `architecture` can be genuinely absent, and JSON
  //     Schema's `if: {properties: {architecture: {const: 'mlp'}}}`
  //     vacuously PASSES when a property is simply absent. Forcing
  //     formData to match the active branch's const closes that gap.
  //
  // Both run on every render (idempotent — a no-op once already in sync)
  // rather than off a dependency array, since "the previous render's set
  // of property names" is exactly what case 1 needs to diff against.
  const previousPropertyNames = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentNames = new Set(Object.keys(properties));
    const updates: Record<string, unknown> = {};

    previousPropertyNames.current.forEach(name => {
      if (!currentNames.has(name) && data[name] !== undefined) updates[name] = undefined;
    });
    Object.entries(properties).forEach(([name, fieldSchema]) => {
      if (fieldSchema.const !== undefined && data[name] !== fieldSchema.const) {
        updates[name] = fieldSchema.const;
      }
    });

    previousPropertyNames.current = currentNames;
    if (Object.keys(updates).length > 0) onChange({ ...data, ...updates });
  });

  const renderField = (
    name: string,
    width: GridSize = 12,
    columnPicker?: 'single' | 'multi',
    datasetPicker?: boolean,
  ) => {
    const fieldSchema = properties[name];
    if (!fieldSchema) return null;
    // A `const`-only property has nothing for the user to choose (its
    // value is fully pinned by whichever branch is active — see
    // train-track-register's `architecture: {const: sklearn}` for
    // modelCategory=traditional-ml) — showing an input for it is always
    // pointless, so skip it regardless of which group listed it.
    if (fieldSchema.const !== undefined) return null;
    if (datasetPicker && datasets.length > 0) {
      return (
        <Grid item xs={12} md={width} key={name}>
          <DatasetPickerField
            name={name}
            title={typeof fieldSchema.title === 'string' ? fieldSchema.title : name}
            description={typeof fieldSchema.description === 'string' ? fieldSchema.description : undefined}
            required={requiredFields.has(name)}
            datasets={datasets}
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
        const { name, width, columnPicker, datasetPicker } = normalizeField(entry);
        return renderField(name, width ?? 12, columnPicker, datasetPicker);
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
        // right now (e.g. "Tham số huấn luyện" when modelCategory is still
        // traditional-ml + taskType=clustering, or "Thuật toán" once
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
                label={<Typography variant="body2">Bật</Typography>}
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
