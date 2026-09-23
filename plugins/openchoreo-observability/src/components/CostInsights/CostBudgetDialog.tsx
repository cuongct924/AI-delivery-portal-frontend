import { FC, useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@material-ui/core';

export interface CostBudgetDialogProps {
  open: boolean;
  initial?: number;
  onClose: () => void;
  onSave: (value: number | undefined) => void;
}

/**
 * The Operate zone's "Set budget" action: a small dialog to set or clear the
 * scope's monthly budget, so the scorecard's budget check is actionable.
 */
export const CostBudgetDialog: FC<CostBudgetDialogProps> = ({
  open,
  initial,
  onClose,
  onSave,
}) => {
  const [value, setValue] = useState(
    initial !== undefined ? String(initial) : '',
  );

  useEffect(() => {
    if (open) setValue(initial !== undefined ? String(initial) : '');
  }, [open, initial]);

  const handleSave = () => {
    const parsed = Number(value);
    onSave(
      value.trim() === '' || !Number.isFinite(parsed) ? undefined : parsed,
    );
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Set monthly budget</DialogTitle>
      <DialogContent>
        <TextField
          // eslint-disable-next-line jsx-a11y/no-autofocus -- single-field dialog; focusing it is the intent
          autoFocus
          margin="dense"
          label="Budget (USD / month)"
          type="number"
          fullWidth
          value={value}
          onChange={e => setValue(e.target.value)}
          helperText="Leave empty to clear the budget."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
