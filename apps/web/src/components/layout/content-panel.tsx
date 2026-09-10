import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ContentPanel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-stroke-soft-200 border-l-[3px] border-l-[var(--palette-teal)] bg-neutral-0',
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex flex-col gap-3 border-b border-stroke-soft-200 bg-[var(--palette-navy-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <div className="text-base font-medium leading-6 text-text-main-900">{title}</div>
          )}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
