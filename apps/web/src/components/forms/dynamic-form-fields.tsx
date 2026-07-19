'use client';

import { Input } from '@/components/ui/input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldError } from '@/components/forms/form-field-error';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';

export interface FormFieldDef {
  id: string;
  code: string;
  label: string;
  fieldType: string;
  options?: string[] | null;
  isRequired: boolean;
}

interface Props {
  fields: FormFieldDef[];
  values: Record<string, string | boolean>;
  onChange: (code: string, value: string | boolean) => void;
  onFileChange?: (code: string, file: File | null) => void;
  errors?: Record<string, string>;
  clearField?: (code: string) => void;
  fieldClassName?: (field: string, baseClass: string) => string;
}

export function DynamicFormFields({
  fields,
  values,
  onChange,
  onFileChange,
  errors = {},
  clearField,
  fieldClassName,
}: Props) {
  if (fields.length === 0) return null;

  const inputClass = (code: string) =>
    fieldClassName ? fieldClassName(code, modalFieldClassName) : modalFieldClassName;

  return (
    <div className="space-y-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] pt-4">
      <p className="text-sm font-medium text-[var(--text-sub-500,#525866)]">Additional information</p>
      {fields.map((field) => (
        <div key={field.id}>
          <FormFieldLabel required={field.isRequired}>{field.label}</FormFieldLabel>
          {field.fieldType === 'dropdown' ? (
            <>
              <SelectDropdown
                fullWidth
                aria-label={field.label}
                placeholder={`Select ${field.label.toLowerCase()}`}
                value={String(values[field.code] ?? '')}
                onValueChange={(value) => {
                  onChange(field.code, value);
                  clearField?.(field.code);
                }}
                options={[
                  { value: '', label: `Select ${field.label.toLowerCase()}` },
                  ...(field.options ?? []).map((opt) => ({ value: opt, label: opt })),
                ]}
              />
              <FormFieldError message={errors[field.code]} />
            </>
          ) : field.fieldType === 'checkbox' ? (
            <>
              <label className="flex h-10 items-center gap-2 text-sm text-[var(--text-main-900)]">
                <input
                  type="checkbox"
                  checked={Boolean(values[field.code])}
                  onChange={(e) => {
                    onChange(field.code, e.target.checked);
                    clearField?.(field.code);
                  }}
                />
                Yes
              </label>
              <FormFieldError message={errors[field.code]} />
            </>
          ) : field.fieldType === 'file' ? (
            <>
              <Input
                type="file"
                className={inputClass(field.code)}
                onChange={(e) => {
                  onFileChange?.(field.code, e.target.files?.[0] ?? null);
                  clearField?.(field.code);
                }}
                required={field.isRequired}
              />
              <FormFieldError message={errors[field.code]} />
            </>
          ) : (
            <>
              <input
                type={
                  field.fieldType === 'number'
                    ? 'number'
                    : field.fieldType === 'date'
                      ? 'date'
                      : 'text'
                }
                className={cn(inputClass(field.code), field.fieldType === 'date' && 'appearance-none')}
                value={String(values[field.code] ?? '')}
                onChange={(e) => {
                  onChange(field.code, e.target.value);
                  clearField?.(field.code);
                }}
                required={field.isRequired}
              />
              <FormFieldError message={errors[field.code]} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
