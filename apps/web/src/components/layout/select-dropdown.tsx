'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import {
  DropdownMenuBackdrop,
  dropdownMenuStyle,
  getDropdownPortalRoot,
  handleDropdownOptionSelect,
  useDropdownMenu,
} from '@/hooks/use-dropdown-menu';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

function SelectChevron({ open, placement }: { open: boolean; placement?: 'top' | 'bottom' }) {
  return (
    <svg
      width="10"
      height="5"
      viewBox="0 0 10 5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'shrink-0 transition-transform',
        open && placement === 'top' && 'rotate-0',
        open && placement !== 'top' && 'rotate-180',
        !open && 'rotate-0',
      )}
      aria-hidden
    >
      <path
        d="M1 0.75L5 4.25L9 0.75"
        stroke="#545454"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SelectDropdown({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  className,
  size = 'default',
  fullWidth = false,
  'aria-label': ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: 'default' | 'sm';
  fullWidth?: boolean;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const isSm = size === 'sm';

  const { triggerRef, menuRef, position } = useDropdownMenu<HTMLUListElement>({
    open,
    onClose: () => setOpen(false),
    align: isSm ? 'right' : 'match',
    minWidth: isSm ? 120 : undefined,
  });

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  return (
    <div
      className={cn(
        'relative',
        fullWidth
          ? 'w-full min-w-0'
          : isSm
            ? 'w-[97px] shrink-0'
            : 'w-full sm:w-auto sm:min-w-[160px]',
        className,
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel ?? placeholder}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex w-full items-center justify-between bg-white',
          'font-[family-name:var(--font-inter)] text-sm font-normal',
          'hover:bg-[var(--neutral-50)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)] focus-visible:ring-offset-1',
          isSm
            ? 'h-8 gap-1 rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] py-1.5 pl-3 pr-1.5 leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]'
            : fullWidth
              ? 'h-10 gap-2 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-[10px] leading-5 tracking-[-0.006em] shadow-[0px_1px_2px_rgba(228,229,231,0.24)]'
              : 'h-10 gap-2 rounded-[10px] border border-[var(--base-input,#E4E4E7)] px-3 py-2 leading-[120%]',
          selected?.value
            ? 'text-[var(--text-main-900,#0A0D14)]'
            : 'text-[var(--text-soft-400,#868C98)]',
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <SelectChevron open={open} placement={position?.placement} />
      </button>

      {open && position && typeof document !== 'undefined' && (
        <DropdownMenuBackdrop onClose={() => setOpen(false)} />
      )}

      {open &&
        position &&
        typeof document !== 'undefined' &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            data-dropdown-menu
            aria-label={ariaLabel ?? placeholder}
            style={dropdownMenuStyle(position)}
            className="max-h-60 touch-pan-y overscroll-contain overflow-y-auto rounded-[10px] border border-[var(--base-input,#E4E4E7)] bg-white py-1 shadow-lg"
            onWheel={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value || '__empty'} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onPointerDown={(event) =>
                      handleDropdownOptionSelect(event, () => {
                        onValueChange(option.value);
                        setOpen(false);
                      })
                    }
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm leading-5 whitespace-nowrap',
                      'text-[var(--base-foreground,#18181B)]',
                      'hover:bg-[var(--neutral-50)]',
                      isSelected && 'bg-[var(--neutral-50)] font-medium',
                    )}
                  >
                    <span>{option.label}</span>
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
  );
}
