import { FC } from 'react';
import { Box, Paper, Typography, makeStyles } from '@material-ui/core';
import type { CostSummary } from './types';
import { formatUsd } from './format';

const useStyles = makeStyles(theme => ({
  root: { padding: theme.spacing(2) },
  title: { fontWeight: 600, fontSize: '0.95rem' },
  subtitle: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(0.75, 0),
  },
  labelCol: { width: 150, flexShrink: 0 },
  label: { fontWeight: 600, fontSize: '0.85rem' },
  hint: { fontSize: '0.7rem', color: theme.palette.text.secondary },
  barCol: { flex: 1, minWidth: 0 },
  barTrack: {
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.palette.action.hover,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 7, transition: 'width 240ms ease' },
  valueCol: { width: 110, flexShrink: 0, textAlign: 'right' },
  value: { fontWeight: 700, fontSize: '0.85rem' },
  pct: { fontSize: '0.7rem', color: theme.palette.text.secondary },
  empty: { fontSize: '0.85rem', color: theme.palette.text.secondary },
}));

const STAGES = [
  {
    key: 'build' as const,
    label: 'Build',
    hint: 'One-time, per version',
    color: '#5567d5',
  },
  {
    key: 'gate' as const,
    label: 'Gate',
    hint: 'Evaluate Gate runs',
    color: '#8e5bd5',
  },
  {
    key: 'run' as const,
    label: 'Run',
    hint: 'Recurring, per period',
    color: '#2e9e6b',
  },
];

/**
 * The lifecycle lens: where spend sits across Build → Gate → Run. Complements
 * the KPI cards with a proportional view, so a scope dominated by one stage is
 * obvious at a glance.
 */
export const CostLifecycleWaterfall: FC<{ summary: CostSummary }> = ({
  summary,
}) => {
  const classes = useStyles();
  const total = summary.totalCost || 0;
  const values: Record<'build' | 'gate' | 'run', number> = {
    build: summary.buildCost ?? 0,
    gate: summary.gateCost ?? 0,
    run: summary.runCost ?? 0,
  };

  return (
    <Paper variant="outlined" className={classes.root}>
      <Typography className={classes.title}>Lifecycle cost</Typography>
      <Typography className={classes.subtitle}>
        Where the spend sits across the model lifecycle.
      </Typography>
      {total <= 0 ? (
        <Typography className={classes.empty}>
          No spend in the selected window.
        </Typography>
      ) : (
        STAGES.map(stage => {
          const value = values[stage.key];
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <Box key={stage.key} className={classes.row}>
              <Box className={classes.labelCol}>
                <Typography className={classes.label}>{stage.label}</Typography>
                <Typography className={classes.hint}>{stage.hint}</Typography>
              </Box>
              <Box className={classes.barCol}>
                <Box className={classes.barTrack}>
                  <Box
                    className={classes.barFill}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </Box>
              </Box>
              <Box className={classes.valueCol}>
                <Typography className={classes.value}>
                  {formatUsd(value)}
                </Typography>
                <Typography className={classes.pct}>
                  {Math.round(pct)}%
                </Typography>
              </Box>
            </Box>
          );
        })
      )}
    </Paper>
  );
};
