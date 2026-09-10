import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getComingSoonFeature,
  type ComingSoonFeatureId,
} from './coming-soon-features';
import { ComingSoonRibbon } from './coming-soon-ribbon';

export function ComingSoonBanner({
  featureId,
  className,
  showRibbon = true,
}: {
  featureId: ComingSoonFeatureId;
  className?: string;
  showRibbon?: boolean;
}) {
  const feature = getComingSoonFeature(featureId);

  return (
    <div
      role="status"
      className={cn(
        'relative overflow-hidden rounded-[10px] border border-[var(--palette-yellow)]/35',
        'flex min-h-[88px] items-center gap-3 border-l-[4px] border-l-[var(--palette-yellow)] bg-[var(--palette-yellow-soft)] px-4 py-5',
        showRibbon && 'pr-20',
        className,
      )}
    >
      {showRibbon ? <ComingSoonRibbon /> : null}
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--midnight-blue-950,#01366C)]"
        strokeWidth={1.75}
        aria-hidden
      />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-[var(--text-main-900,#0A0D14)]">
          {feature.title} — demo preview
        </p>
        <p className="text-sm leading-5 text-[var(--text-sub-500)]">{feature.description}</p>
      </div>
    </div>
  );
}
