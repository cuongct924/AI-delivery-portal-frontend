import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { TeamSelectField } from './TeamSelectField';

/**
 * Scaffolder field extension for selecting the owning team (Group entity).
 * Stores the value as a plain group name (e.g. "mlops-team").
 */
export const OwnerTeamPicker = ({
  onChange,
  formData,
  schema,
  rawErrors,
  required,
}: FieldExtensionComponentProps<string>) => {
  const hasError = (rawErrors?.length ?? 0) > 0;

  return (
    <TeamSelectField
      value={formData ?? ''}
      onChange={onChange}
      label={schema?.title ?? 'Owning team'}
      helperText={
        hasError
          ? rawErrors?.[0]
          : (schema?.description as string) ??
            'Select the team that owns this resource'
      }
      required={required}
      error={hasError}
    />
  );
};
