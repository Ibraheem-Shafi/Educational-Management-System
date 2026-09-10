import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl bg-[var(--palette-navy-soft)] px-6 py-10 text-center',
        className,
      )}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--palette-teal-soft)] text-[var(--palette-teal)]"
        aria-hidden
      >
        <Inbox className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium text-[var(--text-main-900)]">{title}</p>
      {description ? (
        <p className="text-sm text-[var(--text-sub-500)]">{description}</p>
      ) : null}
    </div>
  );
}

export function EmptyStateCell({
  colSpan,
  title,
}: {
  colSpan: number;
  title: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6">
        <EmptyState title={title} />
      </td>
    </tr>
  );
}
