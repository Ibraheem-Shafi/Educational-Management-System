'use client';

import {
  FormFieldLabel,
  modalFieldClassName,
} from '@/components/features/users/invite-form-fields';
import { FormFieldError } from '@/components/forms/form-field-error';
import { PakistanPhoneInput } from '@/components/ui/pakistan-phone-input';
import type { BranchFormValues } from '@/lib/branch-form';
import { slugifyBranchCode } from '@/lib/branch-form';
import { cn } from '@/lib/utils';

export function BranchReadOnlyField({
  label,
  value,
  required,
}: {
  label: string;
  value: string;
  required?: boolean;
}) {
  return (
    <div>
      <FormFieldLabel required={required}>{label}</FormFieldLabel>
      <div
        className={cn(
          modalFieldClassName,
          'cursor-default text-[var(--text-main-900)]',
        )}
      >
        {value || '—'}
      </div>
    </div>
  );
}

export function BranchFormFields({
  form,
  onChange,
  autoCode = false,
  errors = {},
  fieldClassName,
  clearField,
}: {
  form: BranchFormValues;
  onChange: (key: keyof BranchFormValues, value: string) => void;
  autoCode?: boolean;
  errors?: Record<string, string>;
  fieldClassName?: (field: string, baseClass: string) => string;
  clearField?: (field: string) => void;
}) {
  const inputClass = (field: string) =>
    fieldClassName ? fieldClassName(field, modalFieldClassName) : modalFieldClassName;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <FormFieldLabel required>Branch Name</FormFieldLabel>
        <input
          className={inputClass('name')}
          placeholder="Enter Branch Name"
          value={form.name}
          onChange={(e) => {
            onChange('name', e.target.value);
            clearField?.('name');
          }}
          onBlur={() => {
            if (autoCode && !form.code.trim() && form.name.trim()) {
              onChange('code', slugifyBranchCode(form.name));
            }
          }}
        />
        <FormFieldError message={errors.name} />
      </div>

      <div>
        <FormFieldLabel required>Address</FormFieldLabel>
        <input
          className={inputClass('address')}
          placeholder="Enter Address"
          value={form.address}
          onChange={(e) => {
            onChange('address', e.target.value);
            clearField?.('address');
          }}
        />
        <FormFieldError message={errors.address} />
      </div>

      <div>
        <FormFieldLabel required>Email</FormFieldLabel>
        <input
          type="email"
          className={inputClass('email')}
          placeholder="e.g., info@nexium.edu.pk"
          value={form.email}
          onChange={(e) => {
            onChange('email', e.target.value);
            clearField?.('email');
          }}
        />
        <FormFieldError message={errors.email} />
      </div>

      <div>
        <FormFieldLabel required>Phone Number</FormFieldLabel>
        <PakistanPhoneInput
          value={form.phone}
          onChange={(value) => {
            onChange('phone', value);
            clearField?.('phone');
          }}
          className={errors.phone ? 'border-red-500' : undefined}
        />
        <FormFieldError message={errors.phone} />
      </div>
    </div>
  );
}
