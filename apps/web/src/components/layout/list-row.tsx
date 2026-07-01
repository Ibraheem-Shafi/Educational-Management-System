import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ListRowProps {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ListRow({ children, actions, className }: ListRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </div>
  );
}
