'use client';

import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SelectDropdown } from './select-dropdown';

export interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
  className?: string;
}

function buildPageItems(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push('ellipsis');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < totalPages - 1) items.push('ellipsis');
  items.push(totalPages);
  return items;
}

const chevronBtnClass = cn(
  'flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent p-0',
  'text-black transition-colors',
  'hover:bg-[var(--palette-teal-soft)]',
  'disabled:cursor-not-allowed disabled:text-[var(--text-sub-500,#525866)] disabled:opacity-60 disabled:hover:bg-transparent',
);

const pageBtnClass = cn(
  'flex h-8 w-8 items-center justify-center rounded-md border border-[var(--stroke-soft-200,#E2E4E9)] p-1.5',
  'text-sm font-medium leading-5 tracking-[-0.006em] text-center',
  'transition-colors hover:bg-[var(--palette-teal-soft)]',
);

const pageBtnInactiveClass = 'bg-white text-[var(--text-sub-500,#525866)]';
const pageBtnActiveClass =
  'border-[var(--palette-teal)]/30 bg-[var(--palette-teal-soft)] text-[var(--palette-navy)]';
const chevronIconClass = 'h-4 w-4';

/** App-wide pagination control (page label, page numbers, optional rows-per-page). */
export function PaginationBar({
  page,
  totalPages,
  onPageChange,
  limit,
  onLimitChange,
  limitOptions = [8, 20, 50],
  className,
}: PaginationBarProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const pages = buildPageItems(page, safeTotalPages);
  const atStart = page <= 1;
  const atEnd = page >= safeTotalPages;
  const showLimit = limit != null && onLimitChange != null;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
        Page {page} of {safeTotalPages}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className={chevronBtnClass}
          disabled={atStart}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <ChevronsLeft className={chevronIconClass} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={chevronBtnClass}
          disabled={atStart}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className={chevronIconClass} strokeWidth={2.25} />
        </button>

        {pages.map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`e-${index}`}
              className="flex h-8 min-w-8 items-center justify-center text-sm font-medium text-[var(--text-sub-500,#525866)]"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={cn(
                pageBtnClass,
                item === page ? pageBtnActiveClass : pageBtnInactiveClass,
              )}
              aria-current={item === page ? 'page' : undefined}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          className={chevronBtnClass}
          disabled={atEnd}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className={chevronIconClass} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className={chevronBtnClass}
          disabled={atEnd}
          onClick={() => onPageChange(safeTotalPages)}
          aria-label="Last page"
        >
          <ChevronsRight className={chevronIconClass} strokeWidth={2.25} />
        </button>
      </div>

      {showLimit ? (
        <div className="flex justify-end">
          <SelectDropdown
            size="sm"
            aria-label="Rows per page"
            value={String(limit)}
            onValueChange={(next) => onLimitChange(Number(next))}
            options={limitOptions.map((n) => ({ value: String(n), label: `${n} / page` }))}
          />
        </div>
      ) : (
        <div className="hidden sm:block sm:w-[97px]" aria-hidden />
      )}
    </div>
  );
}
