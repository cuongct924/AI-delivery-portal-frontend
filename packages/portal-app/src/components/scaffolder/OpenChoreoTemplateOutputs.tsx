import { useParams } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
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

  if (links.length === 0 && texts.length === 0) {
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
