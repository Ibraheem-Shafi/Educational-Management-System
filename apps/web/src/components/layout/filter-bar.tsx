import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      {children}
    </div>
  );
}

export const filterSelectClass =
  'flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm sm:w-auto';

export const filterInputClass = 'w-full sm:w-auto';
