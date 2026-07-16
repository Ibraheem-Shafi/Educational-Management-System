'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { dropdownMenuStyle, getDropdownPortalRoot, handleDropdownOptionSelect, useDropdownMenu } from '@/hooks/use-dropdown-menu';
import { cn } from '@/lib/utils';

export function FormFieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1 flex items-center gap-px text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-main-900)]">
      {children}
      {required && <span className="text-[#FF3B30]">*</span>}
    </label>
  );
}

export const modalFieldClassName = cn(
  'flex h-10 w-full items-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white',
  'py-[10px] pl-3 pr-[10px] font-[family-name:var(--font-inter)] text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900)]',
  'shadow-[0px_1px_2px_rgba(228,229,231,0.24)]',
  'placeholder:font-[family-name:var(--font-inter)] placeholder:text-sm placeholder:font-normal placeholder:leading-5 placeholder:tracking-[-0.006em] placeholder:text-[var(--text-soft-400,#868C98)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)] focus-visible:ring-offset-1',
);

/** @deprecated Use modalFieldClassName */
export const inviteFieldClassName = modalFieldClassName;

export const inviteFieldInputClassName = cn(
  modalFieldClassName,
  'border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
);

export const PHONE_COUNTRY_OPTIONS = [
  { value: '+92', label: 'Pakistan', flag: '🇵🇰' },
  { value: '+971', label: 'United Arab Emirates', flag: '🇦🇪' },
  { value: '+966', label: 'Saudi Arabia', flag: '🇸🇦' },
  { value: '+44', label: 'United Kingdom', flag: '🇬🇧' },
  { value: '+1', label: 'United States', flag: '🇺🇸' },
] as const;

export function InvitePhoneField({
  value,
  countryCode,
  onChange,
  onCountryCodeChange,
  required,
}: {
  value: string;
  countryCode: string;
  onChange: (value: string) => void;
  onCountryCodeChange: (code: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const { triggerRef, menuRef, position } = useDropdownMenu<HTMLUListElement>({
    open,
    onClose: () => setOpen(false),
    align: 'left',
    minWidth: 220,
    maxHeight: 192,
  });

  const selected =
    PHONE_COUNTRY_OPTIONS.find((option) => option.value === countryCode) ??
    PHONE_COUNTRY_OPTIONS[0];

  return (
    <div
      ref={rootRef}
      className={cn(
        modalFieldClassName,
        'gap-0 overflow-hidden p-0 focus-within:ring-2 focus-within:ring-[var(--institution-primary)] focus-within:ring-offset-1',
      )}
    >
      <div className="relative h-full shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setOpen((current) => !current)}
          className="flex h-10 items-center gap-1.5 border-r border-[var(--stroke-soft-200,#E2E4E9)] py-[10px] pl-3 pr-2.5 hover:bg-[var(--neutral-50)]"
        >
          <span className="text-base leading-none" aria-hidden>
            {selected.flag}
          </span>
          <span className="text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900)]">
            {selected.value}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-[var(--text-sub-500,#525866)] transition-transform',
              open && position?.placement !== 'top' && 'rotate-180',
            )}
            strokeWidth={2}
          />
        </button>

        {open &&
          position &&
          typeof document !== 'undefined' &&
          createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              data-dropdown-menu
              aria-label="Country code"
              style={dropdownMenuStyle(position)}
              className="max-h-48 min-w-[220px] touch-pan-y overscroll-contain overflow-y-auto rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white py-1 shadow-lg"
              onWheel={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
            >
              {PHONE_COUNTRY_OPTIONS.map((option) => {
                const isSelected = option.value === selected.value;
                return (
                  <li key={option.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onPointerDown={(event) =>
                        handleDropdownOptionSelect(event, () => {
                          onCountryCodeChange(option.value);
                          setOpen(false);
                        })
                      }
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm leading-5',
                        'text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]',
                        isSelected && 'bg-[var(--neutral-50)] font-medium',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-base leading-none" aria-hidden>
                          {option.flag}
                        </span>
                        <span className="truncate">{option.label}</span>
                        <span className="text-[var(--text-sub-500)]">{option.value}</span>
                      </span>
                      {isSelected && (
                        <Check
                          className="h-4 w-4 shrink-0 text-[var(--midnight-blue-950,#01366C)]"
                          strokeWidth={2}
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>,
            getDropdownPortalRoot(),
          )}
      </div>

      <input
        type="tel"
        inputMode="tel"
        className={cn(inviteFieldInputClassName, 'min-w-0 flex-1 rounded-none px-3')}
        placeholder="12 34 56 78"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}
