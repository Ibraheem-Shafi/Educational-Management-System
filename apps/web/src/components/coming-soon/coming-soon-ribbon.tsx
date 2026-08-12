import { cn } from '@/lib/utils';

/**
 * Diagonal corner ribbon. Parent must be `relative overflow-hidden`
 * so the rotated strip is clipped inside that box (never past the page edge).
 */
export function ComingSoonRibbon({
  label = 'Coming soon',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]',
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          'absolute right-[-32px] top-[22px] w-[148px] rotate-45',
          'bg-[var(--midnight-blue-950,#01366C)] py-1.5 text-center',
          'text-[10px] font-semibold uppercase tracking-[0.06em] text-white shadow-sm',
        )}
      >
        {label}
      </div>
    </div>
  );
}
