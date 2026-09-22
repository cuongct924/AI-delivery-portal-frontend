import { FC } from 'react';
import { Grid, Paper, Typography, makeStyles } from '@material-ui/core';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import type { CostSummary } from './types';
import { formatUsd } from './format';

const useStyles = makeStyles(theme => ({
  label: {
    fontWeight: 600,
    fontSize: '0.75rem',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  value: {
    fontWeight: 700,
    fontSize: '1.5rem',
    lineHeight: 1.1,
    color: theme.palette.text.primary,
  },
  valueDense: { fontSize: '1.15rem' },
  delta: { display: 'inline-flex', alignItems: 'center', gap: 2 },
  up: { color: theme.palette.error.main },
  down: { color: theme.palette.success.main },
  deltaIcon: { fontSize: 16 },
  muted: { color: theme.palette.text.secondary },
  card: {
    height: '100%',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  cardValue: {
    fontWeight: 700,
    fontSize: '1.35rem',
    lineHeight: 1.1,
    color: theme.palette.text.primary,
  },
  cardHint: { fontSize: '0.75rem', color: theme.palette.text.secondary },
  over: { color: theme.palette.error.main },
  under: { color: theme.palette.success.main },
}));

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}

const KpiCard: FC<KpiCardProps> = ({ label, value, hint, valueClassName }) => {
  const classes = useStyles();
  return (
    <Paper variant="outlined" className={classes.card}>
      <Typography className={classes.label}>{label}</Typography>
      <Typography className={`${classes.cardValue} ${valueClassName ?? ''}`}>
        {value}
      </Typography>
      {hint && <Typography className={classes.cardHint}>{hint}</Typography>}
    </Paper>
  );
};

/**
 * The KPI row: total spend plus the Build/Run split, forecast-vs-budget burn,
 * reclaimable saving and anomaly count. Every card is derived from the same
 * summary, so a stage filter narrows all of them together.
 */
export const CostSummaryCards: FC<{ summary: CostSummary }> = ({ summary }) => {
  const classes = useStyles();
  const budget = summary.budget ?? null;
  const forecast = summary.forecastTotal ?? null;
  const overBudget = budget !== null && forecast !== null && forecast > budget;
  const burnPct =
    budget !== null && budget > 0 && forecast !== null
      ? Math.round((forecast / budget) * 100)
      : null;

  const forecastValue = (): string => {
    if (forecast === null) return '—';
    if (budget === null) return formatUsd(forecast);
    return `${formatUsd(forecast)} / ${formatUsd(budget)}`;
  };
  const forecastHint = (): string => {
    if (burnPct === null) return 'No budget set';
    return `${burnPct}% of monthly budget`;
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={2}>
        <KpiCard label="Total cost" value={formatUsd(summary.totalCost)} />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <KpiCard
          label="Build"
          value={formatUsd(summary.buildCost ?? 0)}
          hint="One-time, per version"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <KpiCard
          label="Run"
          value={formatUsd(summary.runCost ?? 0)}
          hint="Recurring, per period"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <KpiCard
          label="Forecast vs budget"
          value={forecastValue()}
          hint={forecastHint()}
          valueClassName={overBudget ? classes.over : undefined}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <KpiCard
          label="Potential saving"
          value={formatUsd(summary.totalSaving)}
          hint="Reclaimable via right-sizing"
          valueClassName={summary.totalSaving > 0 ? classes.under : undefined}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={2}>
        <KpiCard
          label="Anomalies"
          value={String(summary.anomalyCount ?? 0)}
          hint="Spend spikes in window"
          valueClassName={
            (summary.anomalyCount ?? 0) > 0 ? classes.over : undefined
          }
        />
      </Grid>
    </Grid>
  );
};

const DeltaChip: FC<{ deltaPct: number | null }> = ({ deltaPct }) => {
  const classes = useStyles();
  if (deltaPct === null || !Number.isFinite(deltaPct)) {
    return (
      <Typography variant="body2" className={classes.muted}>
        No previous window
      </Typography>
    );
  }
  const rounded = Math.round(deltaPct);
  const up = rounded > 0;
  const down = rounded < 0;
  return (
    <Typography
      variant="body2"
      component="span"
      className={`${classes.delta} ${up ? classes.up : ''} ${
        down ? classes.down : ''
      }`}
    >
      {up && <ArrowUpwardIcon className={classes.deltaIcon} />}
      {down && <ArrowDownwardIcon className={classes.deltaIcon} />}
      {`${Math.abs(rounded)}% vs prev window`}
    </Typography>
  );
};

/**
 * The Total Cost card's inner content (label, headline value, delta), without a
 * `Card` wrapper — so the catalog overview's cost summary card can render it
 * without nesting one `Card` inside another.
 */
export const TotalCostContent: FC<{
  summary: CostSummary;
  dense?: boolean;
}> = ({ summary, dense }) => {
  const classes = useStyles();
  return (
    <>
      <Typography className={classes.label}>Total Cost</Typography>
      <Typography
        component="div"
        className={`${classes.value} ${dense ? classes.valueDense : ''}`}
      >
        {formatUsd(summary.totalCost)}
      </Typography>
      <DeltaChip deltaPct={summary.deltaPct} />
    </>
  );
};
