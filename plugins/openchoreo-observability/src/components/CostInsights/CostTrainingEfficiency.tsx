import { FC, useMemo } from 'react';
import { Box, Paper, Typography, makeStyles } from '@material-ui/core';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';
import { useTrainingEfficiency } from './useTrainingEfficiency';
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
  cell: { width: 120, textAlign: 'right', fontSize: '0.8rem' },
  value: { fontWeight: 700, color: theme.palette.text.primary },
  empty: { fontSize: '0.85rem', color: theme.palette.text.secondary },
}));

export interface CostTrainingEfficiencyProps {
  timeRange: string;
  customStartTime?: string;
  customEndTime?: string;
}

/**
 * Training cost efficiency: build cost per accuracy point. Ties training spend
 * to the quality it produced — the FinOps-for-AI value KPI.
 */
export const CostTrainingEfficiency: FC<CostTrainingEfficiencyProps> = ({
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
  const { rows, loading } = useTrainingEfficiency(startTime, endTime);

  const renderBody = () => {
    if (loading) {
      return <Typography className={classes.empty}>Loading…</Typography>;
    }
    if (rows.length === 0) {
      return (
        <Typography className={classes.empty}>
          No training runs in the window.
        </Typography>
      );
    }
    return rows.map(row => (
      <Box key={row.artifact} className={classes.row}>
        <Typography className={classes.artifact}>{row.artifact}</Typography>
        <Typography className={classes.cell}>
          {formatUsd(row.build_cost)}
        </Typography>
        <Typography className={classes.cell}>
          {row.accuracy !== null
            ? `${Math.round(row.accuracy * 100)}% acc`
            : '—'}
        </Typography>
        <Typography className={`${classes.cell} ${classes.value}`}>
          {row.cost_per_point !== null
            ? `${formatUsd(row.cost_per_point)}/pt`
            : '—'}
        </Typography>
      </Box>
    ));
  };

  return (
    <Paper variant="outlined" className={classes.root}>
      <Typography className={classes.title}>
        Training cost efficiency
      </Typography>
      <Typography className={classes.subtitle}>
        Build cost per accuracy point — cheaper per point is better.
      </Typography>
      {renderBody()}
    </Paper>
  );
};
