import { accentForSeed, type PaletteName } from '@/lib/ui-palette';
import { cn } from '@/lib/utils';

type StatusKey = 'green' | 'orange' | 'yellow' | 'coral' | 'muted';

type StatusTone = {
  dot: string;
  pill: string;
};

const TONE: Record<StatusKey, StatusTone> = {
  green: {
    dot: 'bg-palette-green',
    pill: 'border-[var(--palette-green)]/30 bg-[var(--palette-green-soft)] text-[var(--palette-green)]',
  },
  orange: {
    dot: 'bg-palette-orange',
    pill: 'border-[var(--palette-orange)]/30 bg-[var(--palette-orange-soft)] text-[var(--palette-orange)]',
  },
  yellow: {
    dot: 'bg-palette-yellow',
    pill: 'border-[var(--palette-yellow)]/35 bg-[var(--palette-yellow-soft)] text-[var(--palette-yellow)]',
  },
  coral: {
    dot: 'bg-palette-coral',
    pill: 'border-[var(--palette-coral)]/30 bg-[var(--palette-coral-soft)] text-[var(--palette-coral)]',
  },
  muted: {
    dot: 'bg-[var(--text-soft-400,#868C98)]',
    pill: 'border-[var(--stroke-soft-200,#E2E4E9)] bg-white text-[var(--text-sub-500,#525866)]',
  },
};

function statusKey(code: string | null | undefined, label: string): StatusKey {
  const n = `${code ?? ''} ${label}`.toLowerCase();

  if (n.includes('overdue')) return 'coral';
  if (n.includes('unpaid') || n.includes('outstanding') || n.includes('unmatched')) return 'coral';
  if (n.includes('lost') || n.includes('waived')) return 'coral';
  if (n.includes('partial')) return 'orange';
  if (
    n.includes('inactive') ||
    n.includes('absent') ||
    n.includes('withdrawn') ||
    n.includes('cancelled') ||
    n.includes('rejected') ||
    n.includes('failed')
  ) {
    return 'coral';
  }
  if (
    n.includes('paid') ||
    n.includes('active') ||
    n.includes('present') ||
    n.includes('approved') ||
    n.includes('success') ||
    n.includes('confirmed') ||
    n.includes('matched') ||
    n.includes('published') ||
    n.includes('sent') ||
    n.includes('delivered') ||
    n.includes('completed') ||
    n.includes('finalized') ||
    n.includes('posted') ||
    n.includes('returned') ||
    n.includes('boarded') ||
    n.includes('resolved') ||
    n.includes('enrolled') ||
    n.includes('available') ||
    n.includes('fulfilled')
  ) {
    return 'green';
  }
  if (n.includes('queued') || n.includes('fallback')) return 'orange';
  if (n.includes('read')) return 'green';
  if (n.includes('draft')) return 'yellow';
  if (n.includes('pending') || n.includes('invited') || n.includes('scheduled')) return 'orange';
  return 'muted';
}

/** Soft row fill so paid / overdue / pending invoices read at a glance. */
export function statusRowClass(code?: string | null, label = '') {
  const n = `${code ?? ''} ${label}`.toLowerCase();
  if (
    (n.includes('pending') || n.includes('invited') || n.includes('scheduled')) &&
    !n.includes('paid')
  ) {
    return 'bg-[var(--palette-yellow-soft)] hover:bg-[#f5e9c4]';
  }
  switch (statusKey(code, label)) {
    case 'green':
      return 'bg-[var(--palette-green-soft)] hover:bg-[var(--green-light,#cbf5e5)]';
    case 'coral':
      return 'bg-[var(--palette-coral-soft)] hover:bg-[var(--red-light,#f8c9d2)]';
    case 'orange':
      return 'bg-[var(--palette-orange-soft)] hover:bg-[#fde4d4]';
    case 'yellow':
      return 'bg-[var(--palette-yellow-soft)] hover:bg-[#f5e9c4]';
    default:
      return 'hover:bg-[var(--palette-teal-soft)]/70';
  }
}

export function statusRowAccentClass(code?: string | null, label = '') {
  const n = `${code ?? ''} ${label}`.toLowerCase();
  if (n.includes('pending') && !n.includes('paid')) {
    return 'border-l-[3px] border-l-[var(--palette-yellow)]';
  }
  switch (statusKey(code, label)) {
    case 'green':
      return 'border-l-[3px] border-l-[var(--palette-green)]';
    case 'coral':
      return 'border-l-[3px] border-l-[var(--palette-coral)]';
    case 'orange':
      return 'border-l-[3px] border-l-[var(--palette-orange)]';
    case 'yellow':
      return 'border-l-[3px] border-l-[var(--palette-yellow)]';
    default:
      return 'border-l-[3px] border-l-[var(--palette-navy)]';
  }
}

export function activeRowClass(isActive: boolean) {
  return statusRowClass(isActive ? 'active' : 'inactive', isActive ? 'Active' : 'Inactive');
}

const ROW_TINT: Record<PaletteName, string> = {
  teal: 'bg-[var(--palette-teal-soft)] hover:bg-[#c5efe8]',
  orange: 'bg-[var(--palette-orange-soft)] hover:bg-[#fde4d4]',
  yellow: 'bg-[var(--palette-yellow-soft)] hover:bg-[#f5e9c4]',
  green: 'bg-[var(--palette-green-soft)] hover:bg-[var(--green-light,#cbf5e5)]',
  coral: 'bg-[var(--palette-coral-soft)] hover:bg-[var(--red-light,#f8c9d2)]',
  purple: 'bg-[var(--palette-purple-soft)] hover:bg-[#e8d4f5]',
};

const ROW_STRIPE: Record<PaletteName | 'navy', string> = {
  teal: 'border-l-[3px] border-l-[var(--palette-teal)]',
  orange: 'border-l-[3px] border-l-[var(--palette-orange)]',
  yellow: 'border-l-[3px] border-l-[var(--palette-yellow)]',
  green: 'border-l-[3px] border-l-[var(--palette-green)]',
  coral: 'border-l-[3px] border-l-[var(--palette-coral)]',
  purple: 'border-l-[3px] border-l-[var(--palette-purple)]',
  navy: 'border-l-[3px] border-l-[var(--palette-navy)]',
};

/** Score / % bands: high/good = green, mid = yellow, low/bad = coral. Pass invert for risk. */
export function metricRowClass(value: number | null | undefined, invert = false) {
  if (value == null || Number.isNaN(Number(value))) {
    return cn('hover:bg-[var(--palette-teal-soft)]/70', ROW_STRIPE.navy);
  }
  const n = invert ? 100 - Number(value) : Number(value);
  if (n >= 70) return cn(ROW_TINT.green, ROW_STRIPE.green);
  if (n >= 40) return cn(ROW_TINT.yellow, ROW_STRIPE.yellow);
  return cn(ROW_TINT.coral, ROW_STRIPE.coral);
}

export function riskRowClass(level: string | null | undefined) {
  const n = (level ?? '').toLowerCase();
  if (n.includes('high') || n.includes('critical') || n.includes('severe')) {
    return cn(ROW_TINT.coral, ROW_STRIPE.coral);
  }
  if (n.includes('med') || n.includes('moderate') || n.includes('warn')) {
    return cn(ROW_TINT.yellow, ROW_STRIPE.yellow);
  }
  if (n.includes('low') || n.includes('ok') || n.includes('good')) {
    return cn(ROW_TINT.green, ROW_STRIPE.green);
  }
  return statusRowClass(level, level ?? '');
}

/** Category / type rows — stable tint from the label (same type = same color). */
export function categoryRowClass(label: string) {
  const accent = accentForSeed(label);
  return cn(ROW_TINT[accent], ROW_STRIPE[accent]);
}

/** No semantic field: navy-soft zebra + seed stripe. */
export function seedRowClass(seed: string, index = 0) {
  const accent = accentForSeed(seed);
  const zebra = index % 2 === 1 ? 'bg-[var(--palette-navy-soft)]' : 'bg-white';
  return cn(zebra, 'hover:bg-[var(--palette-teal-soft)]/70', ROW_STRIPE[accent]);
}

export function StatusBadge({
  label,
  code,
}: {
  label: string;
  code?: string | null;
}) {
  const tone = TONE[statusKey(code, label)];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2 py-1',
        'text-xs font-semibold leading-4',
        tone.pill,
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} />
      {label}
    </span>
  );
}
