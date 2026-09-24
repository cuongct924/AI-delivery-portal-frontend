import { useParams } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Alert, { Color as AlertSeverity } from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';
import LinkIcon from '@material-ui/icons/Link';
import RefreshIcon from '@material-ui/icons/Refresh';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import HistoryIcon from '@material-ui/icons/History';
import { parseEntityRef } from '@backstage/catalog-model';
import { Link, MarkdownContent } from '@backstage/core-components';
import { useApi, useApp, useRouteRef } from '@backstage/core-plugin-api';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import type { ScaffolderTaskOutput } from '@backstage/plugin-scaffolder-common';

const useStyles = makeStyles({
  section: {
    padding: 16,
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  nav: {
    padding: 16,
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  link: {
    '&:hover': {
      textDecoration: 'none',
    },
  },
  alert: {
    // MarkdownContent renders its text in a <p>; drop the default block margins
    // so the note reads as a single alert-bar line.
    '& p': {
      margin: 0,
    },
  },
  costCard: {
    padding: 16,
    marginBottom: 16,
  },
  costHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  costTitle: { fontWeight: 600, fontSize: '0.85rem' },
  costAmount: { fontWeight: 700, fontSize: '1.1rem' },
  costRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  costMuted: { fontSize: '0.8rem', color: '#5F5F5F' },
  costOk: { backgroundColor: '#2E7D32', color: '#FFF' },
  costWarn: { backgroundColor: '#F57C00', color: '#FFF' },
  costFail: { backgroundColor: '#D32F2F', color: '#FFF' },
});

const ALERT_SEVERITIES: readonly AlertSeverity[] = [
  'error',
  'warning',
  'info',
  'success',
];

/**
 * Maps a scaffolder `output.text` entry's `icon` field to an Alert severity.
 * `output.text` has no dedicated severity field, so templates signal intent via
 * `icon` (e.g. `icon: 'warning'`). Anything unset/unrecognised renders as a
 * neutral info bar.
 */
const toSeverity = (icon?: string): AlertSeverity =>
  ALERT_SEVERITIES.includes(icon as AlertSeverity)
    ? (icon as AlertSeverity)
    : 'info';

/** A single `output.text` entry rendered as a severity-coloured alert bar. */
function TemplateTextOutput(props: {
  severity: AlertSeverity;
  title?: string;
  content: string;
}) {
  const classes = useStyles();
  return (
    <Box paddingBottom={2}>
      <Alert severity={props.severity} className={classes.alert}>
        {props.title && <AlertTitle>{props.title}</AlertTitle>}
        <MarkdownContent content={props.content} />
      </Alert>
    </Box>
  );
}

/**
 * "Run this template again" / "Choose another template" bar above a
 * task's outputs. Template ref isn't passed to this component, so it's
 * resolved via a one-shot `getTask(taskId)` rather than
 * `useTaskEventStream` (which would open a second log stream).
 */
function TemplateRunNav() {
  const classes = useStyles();
  const scaffolderApi = useApi(scaffolderApiRef);
  const { taskId } = useParams<{ taskId: string }>();
  const tasksLink = useRouteRef(scaffolderPlugin.routes.listTasks);

  const { value: runAgainHref } = useAsync(async () => {
    if (!taskId) return undefined;
    const task = await scaffolderApi.getTask(taskId);
    const entityRef = task.spec.templateInfo?.entityRef;
    if (!entityRef) return undefined;
    const { namespace, name } = parseEntityRef(entityRef, {
      defaultKind: 'Template',
      defaultNamespace: 'default',
    });
    return `/create/templates/${namespace}/${name}`;
  }, [taskId]);

  return (
    <Box paddingBottom={2}>
      <Paper>
        <Box className={classes.nav}>
          <Link to="/create" classes={{ root: classes.link }}>
            <Button startIcon={<ArrowBackIcon />} component="div">
              Choose another template
            </Button>
          </Link>
          {tasksLink && (
            <Link to={tasksLink()} classes={{ root: classes.link }}>
              <Button startIcon={<HistoryIcon />} component="div">
                View all task runs
              </Button>
            </Link>
          )}
          {runAgainHref && (
            <Link to={runAgainHref} classes={{ root: classes.link }}>
              <Button
                startIcon={<RefreshIcon />}
                component="div"
                color="primary"
              >
                Run this template again
              </Button>
            </Link>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

interface CostOutput {
  goldenPath?: unknown;
  stage?: unknown;
  estimatedCost?: unknown;
  level?: unknown;
  budget?: unknown;
  reasons?: unknown;
  alternatives?: unknown;
}

interface SecurityOutput {
  score?: unknown;
  passed?: unknown;
}

const COST_LEVEL_LABEL: Record<string, string> = {
  ok: 'Within budget',
  warn: 'Near budget',
  fail: 'Over budget',
};

function formatUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toReasons(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim() !== '') {
    return value
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Pre-flight FinOps recap on the task result — the same estimate/gate the
 * form panel showed, read from the template's `output.cost` block. Renders
 * nothing when the estimate step was skipped (all values empty).
 */
function CostCard({ cost }: { cost: CostOutput }) {
  const classes = useStyles();
  const estimated = toNumber(cost.estimatedCost);
  if (estimated === null) return null;

  const budget = toNumber(cost.budget);
  const level = typeof cost.level === 'string' ? cost.level : '';
  const reasons = toReasons(cost.reasons);
  const alternatives = toReasons(cost.alternatives);
  const stage = typeof cost.stage === 'string' ? cost.stage : '';
  let levelClass = classes.costOk;
  if (level === 'fail') levelClass = classes.costFail;
  else if (level === 'warn') levelClass = classes.costWarn;

  return (
    <Box paddingBottom={2}>
      <Paper className={classes.costCard}>
        <Box className={classes.costHeader}>
          <Typography className={classes.costTitle}>
            Estimated {stage} cost
          </Typography>
          <Typography className={classes.costAmount}>
            {formatUsd(estimated)}
          </Typography>
        </Box>
        {budget !== null && (
          <Box className={classes.costRow}>
            <Chip
              label={COST_LEVEL_LABEL[level] ?? 'Within budget'}
              size="small"
              className={levelClass}
            />
            <Typography className={classes.costMuted}>
              Budget {formatUsd(budget)}
            </Typography>
          </Box>
        )}
        {reasons.map((reason, index) => (
          <Typography key={index} className={classes.costMuted}>
            • {reason}
          </Typography>
        ))}
        {alternatives.length > 0 && (
          <Typography className={classes.costMuted} style={{ marginTop: 4 }}>
            Alternatives: {alternatives.join('; ')}
          </Typography>
        )}
        <Typography className={classes.costMuted} style={{ marginTop: 8 }}>
          Pre-flight estimate — the actual cost may differ.
        </Typography>
      </Paper>
    </Box>
  );
}

/**
 * Security posture recap on the task result — the same scan the form panel
 * showed, read from the template's flat `security*` output keys. Renders
 * nothing when the scan step was skipped (no score).
 */
function SecurityCard({ security }: { security: SecurityOutput }) {
  const classes = useStyles();
  const score = toNumber(security.score);
  if (score === null) return null;

  const passed = security.passed === true || security.passed === 'true';

  return (
    <Box paddingBottom={2}>
      <Paper className={classes.costCard}>
        <Box className={classes.costHeader}>
          <Typography className={classes.costTitle}>
            Security posture
          </Typography>
          <Typography className={classes.costAmount}>{score}/100</Typography>
        </Box>
        <Box className={classes.costRow}>
          <Chip
            label={passed ? 'All controls enforced' : 'Blocked'}
            size="small"
            className={passed ? classes.costOk : classes.costFail}
          />
        </Box>
        <Typography className={classes.costMuted} style={{ marginTop: 8 }}>
          Model Registry Governance · Data Isolation · Prompt Security ·
          Inference Audit
        </Typography>
      </Paper>
    </Box>
  );
}

/**
 * Scaffolder task-page outputs renderer used across all OpenChoreo templates
 * (wired as `EXPERIMENTAL_TemplateOutputsComponent` in OpenChoreoScaffolderPage).
 *
 * Renders the standard "links in a centered box" (e.g. the "View Project"
 * link), then each `output.text` entry as an alert bar below it instead of the
 * default plain card. Each bar's variant is data-driven: `text.icon` selects
 * the severity ('error' | 'warning' | 'info' | 'success', default 'info') and
 * `text.title` renders as an optional heading. The project wizard's manual-
 * deploy note, for example, sets `icon: 'warning'` and no title.
 */
export function OpenChoreoTemplateOutputs(props: {
  output?: ScaffolderTaskOutput;
}) {
  const classes = useStyles();
  const app = useApp();
  const entityRoute = useRouteRef(entityRouteRef);

  const output = props.output;
  const links = (output?.links ?? []).filter(({ url, entityRef }) =>
    Boolean(url || entityRef),
  );
  const texts = (output?.text ?? []).filter(text => Boolean(text.content));
  // The template's `output` schema only allows string values, so the cost
  // recap is spread across flat `cost*` keys rather than one nested object.
  const cost: CostOutput = {
    goldenPath: output?.costGoldenPath,
    stage: output?.costStage,
    estimatedCost: output?.costEstimated,
    level: output?.costLevel,
    budget: output?.costBudget,
    reasons: output?.costReasons,
    alternatives: output?.costAlternatives,
  };
  const security: SecurityOutput = {
    score: output?.securityScore,
    passed: output?.securityPassed,
  };

  if (
    links.length === 0 &&
    texts.length === 0 &&
    !cost.estimatedCost &&
    security.score === undefined
  ) {
    return <TemplateRunNav />;
  }

  const resolveIcon = (key?: string) =>
    (key && app.getSystemIcon(key)) || LinkIcon;

  return (
    <>
      <TemplateRunNav />
      {links.length > 0 && (
        <Box paddingBottom={2}>
          <Paper>
            <Box className={classes.section}>
              {links.map(({ url, entityRef, title, icon }, index) => {
                const Icon = resolveIcon(icon);
                const to = entityRef
                  ? entityRoute(parseEntityRef(entityRef))
                  : url!;
                return (
                  <Link key={index} to={to} classes={{ root: classes.link }}>
                    <Button
                      startIcon={<Icon />}
                      component="div"
                      color="primary"
                    >
                      {title}
                    </Button>
                  </Link>
                );
              })}
            </Box>
          </Paper>
        </Box>
      )}
      {cost.estimatedCost && <CostCard cost={cost} />}
      <SecurityCard security={security} />
      {texts.map((text, index) => (
        <TemplateTextOutput
          key={index}
          severity={toSeverity(text.icon)}
          title={text.title}
          content={text.content ?? ''}
        />
      ))}
    </>
  );
}
