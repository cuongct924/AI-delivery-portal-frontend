import { useState } from 'react';
import { Button, Menu, MenuItem, Tooltip, Typography } from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import CheckIcon from '@material-ui/icons/Check';
import { useStyles } from '../MultiSelectFilter/styles';
import type { MultiSelectOption } from '../MultiSelectFilter';

export interface SingleSelectFilterProps {
  /** Trigger prefix, e.g. "Stage" or "Group by". */
  label: string;
  options: MultiSelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Highlight the trigger as an active (non-default) filter. */
  active?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}

/**
 * A single-select dropdown filter, styled identically to
 * {@link MultiSelectFilter} so it sits on the same row as the scope filters.
 * The trigger reads "{label}: {value}" and the menu picks exactly one option.
 */
export const SingleSelectFilter = ({
  label,
  options,
  value,
  onChange,
  active = false,
  disabled = false,
  disabledHint,
}: SingleSelectFilterProps) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const selected = options.find(option => option.value === value);

  return (
    <>
      <Tooltip title={disabled && disabledHint ? disabledHint : ''}>
        {/* span wrapper keeps the tooltip working even when the button is
            disabled, and takes the focus the disabled button cannot. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <span tabIndex={disabled && disabledHint ? 0 : undefined}>
          <Button
            variant="outlined"
            size="small"
            className={
              open || active
                ? `${classes.button} ${classes.buttonActive}`
                : classes.button
            }
            endIcon={<ArrowDropDownIcon />}
            onClick={event => setAnchorEl(event.currentTarget)}
            aria-label={`Select ${label.toLowerCase()}`}
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={disabled || options.length === 0}
          >
            <span className={classes.buttonLabel}>
              {label}: {selected?.label ?? 'All'}
            </span>
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        classes={{ paper: classes.menuPaper }}
        variant="menu"
      >
        {options.map(option => (
          <MenuItem
            key={option.value}
            dense
            selected={option.value === value}
            className={classes.menuItem}
            onClick={() => {
              onChange(option.value);
              setAnchorEl(null);
            }}
          >
            <CheckIcon
              style={{
                opacity: option.value === value ? 1 : 0,
                marginRight: 8,
                fontSize: 18,
              }}
            />
            <Typography variant="body2" style={{ flexGrow: 1 }}>
              {option.label}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

SingleSelectFilter.displayName = 'SingleSelectFilter';
