import { FC, useMemo } from 'react';
import { Box, Paper, Typography, makeStyles } from '@material-ui/core';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';
import { useCostVariance } from './useCostVariance';
import { formatUsd } from './format';

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
    gap: theme.spacing(2),
    padding: theme.spacing(0.75, 0),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  artifact: { flex: 1, minWidth: 0, fontWeight: 600, fontSize: '0.85rem' },
  cell: { width: 110, textAlign: 'right', fontSize: '0.8rem' },
  over: { color: theme.palette.error.main, fontWeight: 600 },
  under: { color: theme.palette.success.main, fontWeight: 600 },
  empty: { fontSize: '0.85rem', color: theme.palette.text.secondary },
}));

export interface CostVarianceCardProps {
  timeRange: string;
  customStartTime?: string;
  customEndTime?: string;
}

/**
 * Estimate-vs-actual variance: how far the pre-flight estimate was from the
 * cost the run actually recorded. A large positive variance means the estimate
 * under-predicted (the run cost more than planned).
 */
export const CostVarianceCard: FC<CostVarianceCardProps> = ({
  timeRange,
  customStartTime,
  customEndTime,
}) => {
  const classes = useStyles();
  const { startTime, endTime } = useMemo(
    () =>
      calculateTimeRange(timeRange, {
        startTime: customStartTime,
        endTime: customEndTime,
      }),
    [timeRange, customStartTime, customEndTime],
  );
  const { rows, loading } = useCostVariance(startTime, endTime);

  const renderBody = () => {
    if (loading) {
      return <Typography className={classes.empty}>Loading…</Typography>;
    }
    if (rows.length === 0) {
      return (
        <Typography className={classes.empty}>
          No estimate/actual pairs in the window.
        </Typography>
      );
    }
    return rows.map(row => {
      const pct = row.variance_pct;
      let varianceClass = '';
      if (pct !== null) varianceClass = pct > 0 ? classes.over : classes.under;
      return (
        <Box key={row.artifact} className={classes.row}>
          <Typography className={classes.artifact}>{row.artifact}</Typography>
          <Typography className={classes.cell}>
            est {formatUsd(row.estimated)}
          </Typography>
          <Typography className={classes.cell}>
            act {formatUsd(row.actual)}
          </Typography>
          <Typography className={`${classes.cell} ${varianceClass}`}>
            {pct === null ? '—' : `${pct > 0 ? '+' : ''}${Math.round(pct)}%`}
          </Typography>
        </Box>
      );
    });
  };

  return (
    <Paper variant="outlined" className={classes.root}>
      <Typography className={classes.title}>Estimate vs actual</Typography>
      <Typography className={classes.subtitle}>
        How close the pre-flight estimate was to the recorded cost.
      </Typography>
      {renderBody()}
    </Paper>
  );
};
