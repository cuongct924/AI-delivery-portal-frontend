import { FC } from 'react';
import { Box, Paper, Typography, makeStyles } from '@material-ui/core';
import WarningIcon from '@material-ui/icons/Warning';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import MonetizationOnIcon from '@material-ui/icons/MonetizationOn';
import type { CostAnomaly, CostBudget } from './types';
import { formatCostUsd } from './format';

const useStyles = makeStyles(theme => ({
  root: { display: 'flex', flexDirection: 'column', gap: theme.spacing(1.5) },
  heading: {
    fontWeight: 600,
    fontSize: '0.75rem',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
  },
  icon: { flexShrink: 0 },
  iconDanger: { color: theme.palette.error.main },
  iconWarn: { color: theme.palette.warning.main },
  iconGood: { color: theme.palette.success.main },
  body: { flex: 1, minWidth: 0 },
  title: { fontWeight: 600, fontSize: '0.9rem' },
  detail: { fontSize: '0.8rem', color: theme.palette.text.secondary },
  amount: { fontWeight: 700, whiteSpace: 'nowrap' },
  empty: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    fontSize: '0.85rem',
  },
}));

export interface CostActionPanelProps {
  anomalies: CostAnomaly[];
  budget: CostBudget | null;
  forecastTotal: number | null;
  totalSaving: number;
}

/**
 * The "Operate" zone: budget burn, spend anomalies and the reclaimable saving,
 * each as one actionable row. Renders nothing when there is nothing to act on,
 * so a healthy scope doesn't grow an empty panel.
 */
export const CostActionPanel: FC<CostActionPanelProps> = ({
  anomalies,
  budget,
  forecastTotal,
  totalSaving,
}) => {
  const classes = useStyles();

  const overBudget =
    budget !== null && forecastTotal !== null && forecastTotal > budget.amount;
  const hasContent = overBudget || anomalies.length > 0 || totalSaving > 0;
  if (!hasContent) return null;

  return (
    <Box className={classes.root}>
      <Typography className={classes.heading}>Action needed</Typography>

      {overBudget && budget && forecastTotal !== null && (
        <Paper variant="outlined" className={classes.row}>
          <WarningIcon className={`${classes.icon} ${classes.iconDanger}`} />
          <Box className={classes.body}>
            <Typography className={classes.title}>
              Forecast exceeds budget
            </Typography>
            <Typography className={classes.detail}>
              Projected {formatCostUsd(forecastTotal)} against a{' '}
              {formatCostUsd(budget.amount)} monthly budget for {budget.scope}.
            </Typography>
          </Box>
          <Typography className={`${classes.amount} ${classes.iconDanger}`}>
            +{formatCostUsd(forecastTotal - budget.amount)}
          </Typography>
        </Paper>
      )}

      {anomalies.map(anomaly => {
        const severe = anomaly.severity === 'high';
        const tone = severe ? classes.iconDanger : classes.iconWarn;
        return (
          <Paper key={anomaly.id} variant="outlined" className={classes.row}>
            <TrendingUpIcon className={`${classes.icon} ${tone}`} />
            <Box className={classes.body}>
              <Typography className={classes.title}>
                {anomaly.dimension} · {anomaly.stage} · {anomaly.severity}
              </Typography>
              <Typography className={classes.detail}>
                Spend {formatCostUsd(anomaly.observed)} vs{' '}
                {formatCostUsd(anomaly.expected)} expected.
              </Typography>
            </Box>
            <Typography className={`${classes.amount} ${tone}`}>
              +{Math.round(anomaly.deltaPct)}%
            </Typography>
          </Paper>
        );
      })}

      {totalSaving > 0 && (
        <Paper variant="outlined" className={classes.row}>
          <MonetizationOnIcon
            className={`${classes.icon} ${classes.iconGood}`}
          />
          <Box className={classes.body}>
            <Typography className={classes.title}>
              Reclaimable via right-sizing
            </Typography>
            <Typography className={classes.detail}>
              Apply the recommendations in the table to capture this saving.
            </Typography>
          </Box>
          <Typography className={`${classes.amount} ${classes.iconGood}`}>
            {formatCostUsd(totalSaving)}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};
