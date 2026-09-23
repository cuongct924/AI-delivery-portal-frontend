import { FC, useMemo } from 'react';
import { Box, Paper, Typography, makeStyles } from '@material-ui/core';
import AttachMoneyIcon from '@material-ui/icons/AttachMoney';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';
import { useRateOptimization } from './useRateOptimization';

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
    padding: theme.spacing(1, 0),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  icon: { color: theme.palette.warning.main, flexShrink: 0 },
  body: { flex: 1, minWidth: 0 },
  label: { fontWeight: 600, fontSize: '0.85rem' },
  detail: { fontSize: '0.75rem', color: theme.palette.text.secondary },
  saving: {
    fontWeight: 700,
    fontSize: '0.85rem',
    color: theme.palette.success.main,
    whiteSpace: 'nowrap',
  },
  empty: { fontSize: '0.85rem', color: theme.palette.text.secondary },
}));

export interface CostRateOptimizationProps {
  timeRange: string;
  customStartTime?: string;
  customEndTime?: string;
}

/**
 * Rate optimization: paying less for the same resources (spot, reserved,
 * caching) — the counterpart to right-sizing's usage optimization.
 */
export const CostRateOptimization: FC<CostRateOptimizationProps> = ({
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
  const { suggestions, loading } = useRateOptimization(startTime, endTime);

  return (
    <Paper variant="outlined" className={classes.root}>
      <Typography className={classes.title}>Rate optimization</Typography>
      <Typography className={classes.subtitle}>
        Pay less for the resources you must use.
      </Typography>
      {loading ? (
        <Typography className={classes.empty}>Loading…</Typography>
      ) : suggestions.length === 0 ? (
        <Typography className={classes.empty}>
          No rate-optimization opportunities in the window.
        </Typography>
      ) : (
        suggestions.map(s => (
          <Box key={s.id} className={classes.row}>
            <AttachMoneyIcon className={classes.icon} />
            <Box className={classes.body}>
              <Typography className={classes.label}>{s.title}</Typography>
              <Typography className={classes.detail}>{s.detail}</Typography>
            </Box>
            <Typography className={classes.saving}>
              ~{Math.round(s.saving_pct)}%
            </Typography>
          </Box>
        ))
      )}
    </Paper>
  );
};
