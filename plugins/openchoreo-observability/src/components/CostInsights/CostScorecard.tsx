import { FC } from 'react';
import { Box, Button, Paper, Typography, makeStyles } from '@material-ui/core';
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
  /** Optional call-to-action, so the scorecard is actionable, not just a report. */
  cta?: { label: string; href?: string };
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
  cta: { flexShrink: 0, textTransform: 'none' },
}));

const ICONS: Record<Status, typeof CheckCircleIcon> = {
  pass: CheckCircleIcon,
  warn: WarningIcon,
  fail: ErrorIcon,
  info: InfoIcon,
};

/** pass/warn/fail band for a 0-1 coverage ratio. */
function coverageStatus(
  value: number,
  passThreshold: number,
  warnThreshold: number,
): Status {
  if (value >= passThreshold) return 'pass';
  if (value >= warnThreshold) return 'warn';
  return 'fail';
}

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
      cta: { label: 'Set budget' },
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
      cta: { label: 'Set budget' },
    });
  }

  const anomalies = summary.anomalyCount ?? 0;
  checks.push({
    id: 'anomaly',
    label: 'Spend anomalies',
    status: anomalies === 0 ? 'pass' : 'warn',
    detail:
      anomalies === 0 ? 'None in window' : `${anomalies} spike(s) flagged`,
    cta:
      anomalies === 0
        ? undefined
        : { label: 'Investigate', href: '#cost-operate' },
  });

  const saving = summary.totalSaving;
  checks.push({
    id: 'saving',
    label: 'Right-sizing',
    status: saving > 0 ? 'warn' : 'pass',
    detail:
      saving > 0 ? `${formatUsd(saving)} reclaimable` : 'Fully right-sized',
    cta:
      saving > 0
        ? { label: 'Apply recommendations', href: '#cost-optimize' }
        : undefined,
  });

  const coverage = summary.attributionCoverage ?? 1;
  checks.push({
    id: 'attribution',
    label: 'Cost attribution',
    status: coverageStatus(coverage, 0.9, 0.5),
    detail: `${Math.round(coverage * 100)}% of spend attributed`,
    cta:
      coverage >= 0.9
        ? undefined
        : { label: 'Review spend', href: '#cost-optimize' },
  });

  const ttlCoverage = summary.ttlCoverage ?? 1;
  checks.push({
    id: 'ttl',
    label: 'Notebook TTL',
    status: coverageStatus(ttlCoverage, 1, 0.5),
    detail: `${Math.round(ttlCoverage * 100)}% of notebooks auto-shutdown`,
  });

  return checks;
}

/**
 * A leadership-facing scorecard: pass/warn/fail against the FinOps standards
 * (budget, anomalies, right-sizing, attribution), so compliance is visible
 * without reading the table.
 */
export const CostScorecard: FC<{
  summary: CostSummary;
  /** Opens the budget dialog; the budget check's CTA calls it. */
  onSetBudget?: () => void;
}> = ({ summary, onSetBudget }) => {
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
            {check.cta && (
              <Button
                size="small"
                variant="outlined"
                color="primary"
                className={classes.cta}
                href={check.cta.href}
                onClick={
                  check.id === 'budget' && onSetBudget ? onSetBudget : undefined
                }
              >
                {check.cta.label}
              </Button>
            )}
          </Box>
        );
      })}
    </Paper>
  );
};
