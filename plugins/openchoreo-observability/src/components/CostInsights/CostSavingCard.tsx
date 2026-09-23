import { FC } from 'react';
import { Box, Paper, Typography, makeStyles } from '@material-ui/core';
import MonetizationOnIcon from '@material-ui/icons/MonetizationOn';
import { formatUsd } from './format';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
  },
  icon: { color: theme.palette.success.main, fontSize: 28, flexShrink: 0 },
  body: { flex: 1, minWidth: 0 },
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
    color: theme.palette.success.main,
  },
  hint: { fontSize: '0.8rem', color: theme.palette.text.secondary },
}));

/**
 * The Optimize zone's headline: reclaimable spend. Quantifying the saving is an
 * Optimize activity, so it sits above the right-sizing table rather than in the
 * Inform KPI row.
 */
export const CostSavingCard: FC<{ totalSaving: number }> = ({ totalSaving }) => {
  const classes = useStyles();
  return (
    <Paper variant="outlined" className={classes.root}>
      <MonetizationOnIcon className={classes.icon} />
      <Box className={classes.body}>
        <Typography className={classes.label}>Potential saving</Typography>
        <Typography className={classes.value}>
          {formatUsd(totalSaving)}
        </Typography>
        <Typography className={classes.hint}>
          Reclaimable by applying the right-sizing recommendations below.
        </Typography>
      </Box>
    </Paper>
  );
};
