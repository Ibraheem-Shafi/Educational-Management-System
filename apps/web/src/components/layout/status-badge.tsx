import { cn } from '@/lib/utils';

function statusDotColor(code: string | null | undefined, label: string): string {
  const normalized = (code ?? label).toLowerCase();
  if (normalized === 'active' || normalized === 'present' || normalized === 'paid') {
    return 'bg-[#38C793]';
  }
  if (
    normalized === 'inactive' ||
    normalized === 'absent' ||
    normalized === 'withdrawn' ||
    normalized === 'cancelled'
  ) {
    return 'bg-[#EF4444]';
  }
  if (normalized === 'pending' || normalized === 'draft') {
    return 'bg-[#F59E0B]';
  }
  return 'bg-[var(--text-soft-400,#868C98)]';
}

export function StatusBadge({
  label,
  code,
}: {
  label: string;
  code?: string | null;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white',
        'py-1 pl-1 pr-2',
        'text-xs font-medium leading-4 text-[var(--text-sub-500,#525866)]',
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDotColor(code, label))} />
      {label}
    </span>
  );
}
