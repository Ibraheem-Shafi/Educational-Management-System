'use client';

import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel } from '@/components/features/users/invite-form-fields';
import { FormFieldError } from '@/components/forms/form-field-error';
import { useAppBranchScopeOptional } from '@/providers/branch-scope-provider';

/**
 * Explicit single-branch picker for write forms.
 * Render when the effective branch scope is All / multiple branches so the
 * user must choose exactly one target branch for the record being created.
 */
export function BranchSelectField({
  value,
  onValueChange,
  error,
  required = true,
  label = 'Branch',
}: {
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  required?: boolean;
  label?: string;
}) {
  const scope = useAppBranchScopeOptional();
  const branches = scope?.branches ?? [];

  return (
    <div>
      <FormFieldLabel required={required}>{label}</FormFieldLabel>
      <SelectDropdown
        fullWidth
        aria-label={label}
        placeholder="Select branch"
        value={value}
        onValueChange={onValueChange}
        options={[
          { value: '', label: 'Select branch' },
          ...branches.map((b) => ({ value: b.id, label: b.name })),
        ]}
      />
      <FormFieldError message={error} />
    </div>
  );
}
