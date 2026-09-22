import { FC } from 'react';
import {
  Box,
  Button,
  Grid,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import Refresh from '@material-ui/icons/Refresh';
import { type Environment } from '@openchoreo/backstage-plugin-react';
import { EnvironmentMultiSelect } from './EnvironmentMultiSelect';
import {
  COST_DIMENSIONS,
  COST_DIMENSION_LABELS,
  COST_STAGES,
  COST_STAGE_LABELS,
  type CostDimension,
  type CostStageFilter,
} from './types';

export const GRANULARITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '12h', label: '12 hours' },
  { value: '1d', label: '1 day' },
  { value: '7d', label: '1 week' },
];

export const DEFAULT_GRANULARITY = '1h';

export interface CostInsightsFiltersProps {
  environments: Environment[];
  environmentsLoading?: boolean;
  selectedEnvironments: string[];
  onEnvironmentsChange: (names: string[]) => void;
  /** Active lifecycle stage filter. */
  stage?: CostStageFilter;
  onStageChange?: (stage: CostStageFilter) => void;
  /** Active row dimension. */
  dimension?: CostDimension;
  onDimensionChange?: (dimension: CostDimension) => void;
  /** Refetch the cost data. */
  onRefresh?: () => void;
  /** Disables the refresh button while a fetch is in flight. */
  refreshing?: boolean;
  disabled?: boolean;
}

const useStyles = makeStyles(theme => ({
  spacer: { flexGrow: 1 },
  control: { minWidth: 220 },
  switchers: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  },
  switcher: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  switcherLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  group: {
    '& .MuiToggleButton-root': {
      padding: theme.spacing(0.5, 1.5),
      textTransform: 'none',
      fontSize: '0.8rem',
    },
  },
}));

export const CostInsightsFilters: FC<CostInsightsFiltersProps> = ({
  environments,
  environmentsLoading = false,
  selectedEnvironments,
  onEnvironmentsChange,
  stage = 'all',
  onStageChange,
  dimension = 'infra',
  onDimensionChange,
  onRefresh,
  refreshing = false,
  disabled = false,
}) => {
  const classes = useStyles();

  return (
    <>
      {(onStageChange || onDimensionChange) && (
        <Box className={classes.switchers}>
          {onStageChange && (
            <Box className={classes.switcher}>
              <Typography className={classes.switcherLabel}>Stage</Typography>
              <ToggleButtonGroup
                className={classes.group}
                size="small"
                exclusive
                value={stage}
                onChange={(_e, next: CostStageFilter | null) => {
                  if (next) onStageChange(next);
                }}
                aria-label="Cost stage"
              >
                <ToggleButton value="all" aria-label="All stages">
                  {COST_STAGE_LABELS.all}
                </ToggleButton>
                {COST_STAGES.map(s => (
                  <ToggleButton
                    key={s}
                    value={s}
                    aria-label={COST_STAGE_LABELS[s]}
                  >
                    {COST_STAGE_LABELS[s]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          {onDimensionChange && (
            <Box className={classes.switcher}>
              <Typography className={classes.switcherLabel}>
                Group by
              </Typography>
              <ToggleButtonGroup
                className={classes.group}
                size="small"
                exclusive
                value={dimension}
                onChange={(_e, next: CostDimension | null) => {
                  if (next) onDimensionChange(next);
                }}
                aria-label="Cost dimension"
              >
                {COST_DIMENSIONS.map(d => (
                  <ToggleButton
                    key={d}
                    value={d}
                    aria-label={COST_DIMENSION_LABELS[d]}
                  >
                    {COST_DIMENSION_LABELS[d]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}
        </Box>
      )}

      <Grid container spacing={2} alignItems="center" wrap="nowrap">
        <Grid item className={classes.spacer} />

        <Grid item className={classes.control}>
          <EnvironmentMultiSelect
            environments={environments}
            loading={environmentsLoading}
            value={selectedEnvironments}
            onChange={onEnvironmentsChange}
            disabled={disabled}
          />
        </Grid>

        {onRefresh && (
          <Grid item>
            <Tooltip title="Refresh">
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={onRefresh}
                disabled={disabled || refreshing}
              >
                Refresh
              </Button>
            </Tooltip>
          </Grid>
        )}
      </Grid>
    </>
  );
};
