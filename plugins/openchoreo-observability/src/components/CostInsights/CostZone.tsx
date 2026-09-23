import { FC, ReactNode } from 'react';
import { Box, Typography, makeStyles } from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  root: { marginTop: theme.spacing(3) },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1.5),
    paddingBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(2),
  },
  step: {
    fontWeight: 700,
    fontSize: '0.7rem',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.palette.primary.main,
  },
  title: { fontWeight: 600, fontSize: '1rem' },
  subtitle: { fontSize: '0.8rem', color: theme.palette.text.secondary },
}));

export interface CostZoneProps {
  /** The FinOps phase this zone maps to: Inform, Optimize or Operate. */
  step: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

/**
 * A titled section that maps a part of the page to a FinOps phase, so the
 * dashboard reads as a workflow (see → improve → act) rather than a flat list
 * of widgets.
 */
export const CostZone: FC<CostZoneProps> = ({
  step,
  title,
  subtitle,
  children,
}) => {
  const classes = useStyles();
  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography className={classes.step}>{step}</Typography>
        <Typography className={classes.title}>{title}</Typography>
        <Typography className={classes.subtitle}>{subtitle}</Typography>
      </Box>
      {children}
    </Box>
  );
};
