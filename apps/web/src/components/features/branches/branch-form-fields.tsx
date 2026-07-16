'use client';

import {
  FormFieldLabel,
  InvitePhoneField,
  modalFieldClassName,
} from '@/components/features/users/invite-form-fields';
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
}: {
  form: BranchFormValues;
  onChange: (key: keyof BranchFormValues, value: string) => void;
  autoCode?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <FormFieldLabel required>Branch Name</FormFieldLabel>
        <input
          className={modalFieldClassName}
          placeholder="Enter Branch Name"
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
          onBlur={() => {
            if (autoCode && !form.code.trim() && form.name.trim()) {
              onChange('code', slugifyBranchCode(form.name));
            }
          }}
          required
        />
      </div>

      <div>
        <FormFieldLabel required>Address</FormFieldLabel>
        <input
          className={modalFieldClassName}
          placeholder="Enter Address"
          value={form.address}
          onChange={(e) => onChange('address', e.target.value)}
        />
      </div>

      <div>
        <FormFieldLabel required>Email</FormFieldLabel>
        <input
          type="email"
          className={modalFieldClassName}
          placeholder="e.g., info@nexium.edu.pk"
          value={form.email}
          onChange={(e) => onChange('email', e.target.value)}
        />
      </div>

      <div>
        <FormFieldLabel required>Phone Number</FormFieldLabel>
        <InvitePhoneField
          countryCode={form.phoneCountryCode}
          onCountryCodeChange={(code) => onChange('phoneCountryCode', code)}
          value={form.phone}
          onChange={(value) => onChange('phone', value)}
        />
      </div>
    </div>
  );
}
