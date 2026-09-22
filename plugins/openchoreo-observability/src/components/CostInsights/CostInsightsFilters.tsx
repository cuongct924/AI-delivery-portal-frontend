import { FC } from 'react';
import { Box, Button, Tooltip, makeStyles } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import {
  SingleSelectFilter,
  type MultiSelectOption,
} from '@openchoreo/backstage-design-system';
import { type Environment } from '@openchoreo/backstage-plugin-react';
import { EnvironmentMultiSelect } from './EnvironmentMultiSelect';
import {
  COST_DIMENSIONS,
  COST_DIMENSION_LABELS,
  COST_STAGES,
  COST_STAGE_LABELS,
  DEFAULT_COST_DIMENSION,
  DEFAULT_COST_STAGE,
  type CostDimension,
  type CostStageFilter,
} from './types';

const STAGE_OPTIONS: MultiSelectOption[] = [
  { value: 'all', label: COST_STAGE_LABELS.all },
  ...COST_STAGES.map(s => ({ value: s, label: COST_STAGE_LABELS[s] })),
];

const DIMENSION_OPTIONS: MultiSelectOption[] = COST_DIMENSIONS.map(d => ({
  value: d,
  label: COST_DIMENSION_LABELS[d],
}));

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
  // `contents` so these controls become direct flex items of the page's filter
  // row, sharing one line with the scope filters.
  root: { display: 'contents' },
  control: { minWidth: 200, marginLeft: theme.spacing(0.5) },
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
    <Box className={classes.root}>
      {onStageChange && (
        <SingleSelectFilter
          label="Stage"
          options={STAGE_OPTIONS}
          value={stage}
          onChange={next => onStageChange(next as CostStageFilter)}
          active={stage !== DEFAULT_COST_STAGE}
          disabled={disabled}
        />
      )}

      {onDimensionChange && (
        <SingleSelectFilter
          label="Group by"
          options={DIMENSION_OPTIONS}
          value={dimension}
          onChange={next => onDimensionChange(next as CostDimension)}
          active={dimension !== DEFAULT_COST_DIMENSION}
          disabled={disabled}
        />
      )}

      <Box className={classes.control}>
        <EnvironmentMultiSelect
          environments={environments}
          loading={environmentsLoading}
          value={selectedEnvironments}
          onChange={onEnvironmentsChange}
          disabled={disabled}
          size="small"
        />
      </Box>

      {onRefresh && (
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
      )}
    </Box>
  );
};
