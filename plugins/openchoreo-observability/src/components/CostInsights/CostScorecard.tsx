import { FC } from 'react';
import { Box, Paper, Typography, makeStyles } from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import WarningIcon from '@material-ui/icons/Warning';
import ErrorIcon from '@material-ui/icons/Error';
import InfoIcon from '@material-ui/icons/Info';
import type { CostSummary } from './types';
import { formatUsd } from './format';

type Status = 'pass' | 'warn' | 'fail' | 'info';

interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

const useStyles = makeStyles(theme => ({
  root: { padding: theme.spacing(2) },
  title: { fontWeight: 600, fontSize: '0.95rem' },
  subtitle: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.75, 0),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  icon: { flexShrink: 0, fontSize: 20 },
  pass: { color: theme.palette.success.main },
  warn: { color: theme.palette.warning.main },
  fail: { color: theme.palette.error.main },
  info: { color: theme.palette.text.secondary },
  body: { flex: 1, minWidth: 0 },
  label: { fontWeight: 600, fontSize: '0.85rem' },
  detail: { fontSize: '0.75rem', color: theme.palette.text.secondary },
}));

const ICONS: Record<Status, typeof CheckCircleIcon> = {
  pass: CheckCircleIcon,
  warn: WarningIcon,
  fail: ErrorIcon,
  info: InfoIcon,
};

/** The compliance checks a scope is measured against, worst-first. */
export function buildScorecardChecks(summary: CostSummary): Check[] {
  const checks: Check[] = [];

  const budget = summary.budget ?? null;
  const forecast = summary.forecastTotal ?? null;
  if (budget === null || forecast === null) {
    checks.push({
      id: 'budget',
      label: 'Budget adherence',
      status: 'info',
      detail: 'No budget set for this scope',
    });
  } else if (forecast <= budget) {
    checks.push({
      id: 'budget',
      label: 'Budget adherence',
      status: 'pass',
      detail: `Forecast ${formatUsd(forecast)} within ${formatUsd(budget)}`,
    });
  } else {
    checks.push({
      id: 'budget',
      label: 'Budget adherence',
      status: 'fail',
      detail: `Forecast ${formatUsd(forecast)} over ${formatUsd(budget)}`,
    });
  }

  const anomalies = summary.anomalyCount ?? 0;
  checks.push({
    id: 'anomaly',
    label: 'Spend anomalies',
    status: anomalies === 0 ? 'pass' : 'warn',
    detail: anomalies === 0 ? 'None in window' : `${anomalies} spike(s) flagged`,
  });

  const saving = summary.totalSaving;
  checks.push({
    id: 'saving',
    label: 'Right-sizing',
    status: saving > 0 ? 'warn' : 'pass',
    detail: saving > 0 ? `${formatUsd(saving)} reclaimable` : 'Fully right-sized',
  });

  const coverage = summary.attributionCoverage ?? 1;
  checks.push({
    id: 'attribution',
    label: 'Cost attribution',
    status: coverage >= 0.9 ? 'pass' : coverage >= 0.5 ? 'warn' : 'fail',
    detail: `${Math.round(coverage * 100)}% of spend attributed`,
  });

  return checks;
}

/**
 * A leadership-facing scorecard: pass/warn/fail against the FinOps standards
 * (budget, anomalies, right-sizing, attribution), so compliance is visible
 * without reading the table.
 */
export const CostScorecard: FC<{ summary: CostSummary }> = ({ summary }) => {
  const classes = useStyles();
  const checks = buildScorecardChecks(summary);

  return (
    <Paper variant="outlined" className={classes.root}>
      <Typography className={classes.title}>FinOps scorecard</Typography>
      <Typography className={classes.subtitle}>
        Standards this scope is measured against.
      </Typography>
      {checks.map(check => {
        const Icon = ICONS[check.status];
        return (
          <Box key={check.id} className={classes.row}>
            <Icon className={`${classes.icon} ${classes[check.status]}`} />
            <Box className={classes.body}>
              <Typography className={classes.label}>{check.label}</Typography>
              <Typography className={classes.detail}>{check.detail}</Typography>
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
};
