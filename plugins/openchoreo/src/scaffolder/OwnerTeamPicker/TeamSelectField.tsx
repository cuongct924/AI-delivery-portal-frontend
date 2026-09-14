import { useEffect, useState } from 'react';
import {
  TextField,
  MenuItem,
  CircularProgress,
  InputAdornment,
} from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export interface TeamOption {
  name: string;
  displayName?: string;
}

export interface TeamSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  required?: boolean;
  error?: boolean;
}

/**
 * Owning-team dropdown. Fetches all Group entities from the Catalog and
 * renders them as a native select — unlike an Autocomplete, clicking the
 * field always reopens the full list instead of filtering it down to
 * whatever text is currently in the input.
 */
export const TeamSelectField = ({
  value,
  onChange,
  label = 'Owning team',
  helperText = 'Select the team that owns this resource',
  required,
  error,
}: TeamSelectFieldProps) => {
  const catalogApi = useApi(catalogApiRef);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string>();

  useEffect(() => {
    let ignore = false;

    const fetch = async () => {
      try {
        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Group' },
        });
        const list: TeamOption[] = items.map(e => ({
          name: e.metadata.name,
          displayName: e.metadata.title || e.metadata.name,
        }));
        if (ignore) return;
        setTeams(list);
      } catch (err) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line no-console
          console.error('Failed to fetch teams', err);
          setFetchError(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetch();
    return () => {
      ignore = true;
    };
  }, [catalogApi]);

  // Keep the currently selected value selectable even if it hasn't shown up
  // in the Catalog fetch yet (e.g. a schema default before the list loads).
  const options =
    value && !teams.some(t => t.name === value)
      ? [{ name: value, displayName: value }, ...teams]
      : teams;

  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={loading}
      fullWidth
      variant="outlined"
      required={required}
      error={error || !!fetchError}
      helperText={fetchError || helperText}
      InputProps={{
        endAdornment: loading ? (
          <InputAdornment position="end">
            <CircularProgress size={20} />
          </InputAdornment>
        ) : undefined,
      }}
    >
      {options.map(team => (
        <MenuItem key={team.name} value={team.name}>
          {team.displayName ?? team.name}
        </MenuItem>
      ))}
    </TextField>
  );
};
