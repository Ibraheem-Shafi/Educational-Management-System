'use client';

import { useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import {
  allBranchScope,
  selectedBranchScope,
  type BranchScope,
} from '@eims/shared';
import {
  DropdownMenuBackdrop,
  dropdownMenuStyle,
  getDropdownPortalRoot,
  useDropdownMenu,
} from '@/hooks/use-dropdown-menu';
import { cn } from '@/lib/utils';

export interface BranchOption {
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

function scopeLabel(scope: BranchScope, options: BranchOption[]): string {
  if (scope.kind === 'all') return 'All branches';
  if (scope.branchIds.length === 1) {
    return options.find((o) => o.value === scope.branchIds[0])?.label ?? '1 branch';
  }
  return `${scope.branchIds.length} branches`;
}
/**
 * Multi-select branch scope control.
 * - "All branches" is mutually exclusive with specific IDs.
 * - Empty selection resolves to All.
 */
export function BranchScopeSelect({
  value,
  onValueChange,
  options,
  className,
  disabled = false,
  size = 'default',
  'aria-label': ariaLabel = 'Branch scope',
  placeholder,
}: {
  value: BranchScope;
  onValueChange: (scope: BranchScope) => void;
  options: BranchOption[];
  className?: string;
  disabled?: boolean;
  size?: 'default' | 'sm';
  'aria-label'?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const isSm = size === 'sm';

  const { triggerRef, menuRef, position, closeMenu } = useDropdownMenu<HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    align: isSm ? 'right' : 'match',
    minWidth: isSm ? 200 : undefined,
  });

  const selectedSet = useMemo(() => {
    if (value.kind === 'all') return new Set<string>();
    return new Set(value.branchIds);
  }, [value]);

  const displayLabel = placeholder ?? scopeLabel(value, options);
  const isAll = value.kind === 'all';

  const toggleAll = () => {
    onValueChange(allBranchScope());
  };

  const toggleId = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) {
      onValueChange(allBranchScope());
      return;
    }
    onValueChange(selectedBranchScope([...next]));
  };

  return (
    <div
      className={cn(
        'relative',
        isSm ? 'w-auto min-w-[140px] shrink-0' : 'w-full sm:w-auto sm:min-w-[180px]',
        className,
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => !disabled && setOpen((c) => !c)}
        className={cn(
          'flex w-full items-center justify-between bg-white',
          'font-[family-name:var(--font-inter)] text-sm font-normal',
          'hover:bg-[var(--neutral-50)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)] focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-60',
          isSm
            ? 'h-8 gap-1 rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] py-1.5 pl-3 pr-1.5 leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]'
            : 'h-10 gap-2 rounded-[10px] border border-[var(--base-input,#E4E4E7)] px-3 py-2 leading-[120%]',
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <SelectChevron open={open} placement={position?.placement} />
      </button>

      {open && position && typeof document !== 'undefined' && (
        <DropdownMenuBackdrop onClose={closeMenu} />
      )}

      {open &&
        position &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            data-dropdown-menu
            aria-label={ariaLabel}
            style={dropdownMenuStyle(position)}
            className="max-h-72 touch-pan-y overscroll-contain overflow-y-auto rounded-[10px] border border-[var(--base-input,#E4E4E7)] bg-white py-1 shadow-lg"
            onWheel={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="option"
              aria-selected={isAll}
              onClick={toggleAll}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                'hover:bg-[var(--neutral-50)]',
                isAll && 'bg-[var(--neutral-50)] font-medium',
              )}
            >
              <span>All branches</span>
              {isAll && (
                <Check
                  className="h-4 w-4 shrink-0 text-[var(--midnight-blue-950,#01366C)]"
                  strokeWidth={2}
                  aria-hidden
                />
              )}
            </button>
            <div className="my-1 h-px bg-[var(--stroke-soft-200,#E2E4E9)]" />
            {options.map((option) => {
              const checked = !isAll && selectedSet.has(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggleId(option.value)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    'hover:bg-[var(--neutral-50)]',
                    checked && 'bg-[var(--neutral-50)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      checked
                        ? 'border-[var(--midnight-blue-950,#01366C)] bg-[var(--midnight-blue-950,#01366C)] text-white'
                        : 'border-[var(--stroke-soft-200,#E2E4E9)] bg-white',
                    )}
                    aria-hidden
                  >
                    {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>,
          getDropdownPortalRoot(),
        )}
    </div>
  );
}
