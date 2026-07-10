import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { UserAvatar } from './user-avatar';

export interface PanelTableColumn {
  key: string;
  label: string;
  className?: string;
}

export interface PanelTableRow {
  id: string;
  href?: ComponentProps<typeof Link>['href'];
  name: string;
  cells?: ReactNode[];
}

export function PanelTable({
  columns,
  rows,
  emptyMessage = 'No records found.',
}: {
  columns: PanelTableColumn[];
  rows: PanelTableRow[];
  emptyMessage?: string;
}) {
  return (
    <div>
      <div className="hidden bg-neutral-50 px-5 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)]">
        {columns.map((col) => (
          <span
            key={col.key}
            className={cn(
              'text-xs font-medium uppercase leading-4 tracking-[0.04em] text-text-soft-400',
              col.className,
            )}
          >
            {col.label}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-text-sub-500">{emptyMessage}</p>
      ) : (
        <div>
          {rows.map((row, index) => {
            const content = (
              <div className="flex items-center gap-3 px-5 py-3">
                <UserAvatar name={row.name} size="sm" />
                <span className="truncate text-sm font-medium text-text-main-900">{row.name}</span>
                {row.cells}
              </div>
            );

            return (
              <div key={row.id}>
                {row.href ? (
                  <Link
                    href={row.href}
                    className="block transition-colors hover:bg-neutral-50/80"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
                {index < rows.length - 1 && (
                  <div className="flex justify-center" aria-hidden>
                    <div className="h-px w-[80%] bg-stroke-soft-200" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
