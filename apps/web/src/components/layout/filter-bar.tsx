import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-3 rounded-xl border border-stroke-soft-200 bg-[var(--palette-navy-soft)] px-4 py-3',
        'shadow-[inset_4px_0_0_var(--palette-teal)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export const filterSelectClass =
  'flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm sm:w-auto';

export const filterInputClass = 'w-full sm:w-auto';
