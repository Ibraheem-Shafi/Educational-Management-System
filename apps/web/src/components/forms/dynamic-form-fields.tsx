'use client';

import { Input } from '@/components/ui/input';

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
}

export function DynamicFormFields({ fields, values, onChange, onFileChange }: Props) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <p className="text-sm font-medium text-muted-foreground">Additional information</p>
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <label className="text-sm font-medium">
            {field.label}
            {field.isRequired ? ' *' : ''}
          </label>
          {field.fieldType === 'dropdown' ? (
            <select
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={String(values[field.code] ?? '')}
              onChange={(e) => onChange(field.code, e.target.value)}
              required={field.isRequired}
            >
              <option value="">—</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : field.fieldType === 'checkbox' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(values[field.code])}
                onChange={(e) => onChange(field.code, e.target.checked)}
              />
              Yes
            </label>
          ) : field.fieldType === 'file' ? (
            <Input
              type="file"
              onChange={(e) => onFileChange?.(field.code, e.target.files?.[0] ?? null)}
              required={field.isRequired}
            />
          ) : (
            <Input
              type={
                field.fieldType === 'number'
                  ? 'number'
                  : field.fieldType === 'date'
                    ? 'date'
                    : 'text'
              }
              value={String(values[field.code] ?? '')}
              onChange={(e) => onChange(field.code, e.target.value)}
              required={field.isRequired}
            />
          )}
        </div>
      ))}
    </div>
  );
}
