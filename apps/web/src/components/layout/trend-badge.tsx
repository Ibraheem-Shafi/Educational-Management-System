import { cn } from '@/lib/utils';

export function TrendBadge({
  changePercent,
  onFilled,
}: {
  changePercent: number | null | undefined;
  /** White-on-color pill for filled KPI cards. */
  onFilled?: boolean;
}) {
  if (changePercent === null || changePercent === undefined) return null;

  const isPositive = changePercent > 0;
  const isNegative = changePercent < 0;
  const label = `${isPositive ? '+' : ''}${changePercent}%`;

  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-9 items-center justify-center rounded-full px-1.5 py-0.5',
        'text-[11px] font-medium leading-3 tracking-[0.02em] uppercase',
        onFilled && isPositive && 'bg-white/20 text-white',
        onFilled && isNegative && 'bg-black/15 text-white',
        onFilled && !isPositive && !isNegative && 'bg-white/15 text-white/80',
        !onFilled && isPositive && 'bg-[var(--green-light)] text-[var(--green-darker)]',
        !onFilled && isNegative && 'bg-[var(--red-light)] text-[var(--red-darker)]',
        !onFilled && !isPositive && !isNegative && 'bg-[var(--neutral-50)] text-[var(--text-soft-400)]',
      )}
    >
      {label}
    </span>
  );
}
