import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ComingSoonFeatureId } from './coming-soon-features';
import { ComingSoonBanner } from './coming-soon-banner';
import { ComingSoonRibbon } from './coming-soon-ribbon';

/**
 * Marks a surface as Coming soon / demo without blocking clicks or forms.
 * Ribbon is clipped to the banner (or a corner host) so it never spills off-screen.
 */
export function ComingSoonFrame({
  featureId,
  children,
  className,
  showBanner = true,
  showRibbon = true,
}: {
  featureId: ComingSoonFeatureId;
  children: ReactNode;
  className?: string;
  showBanner?: boolean;
  showRibbon?: boolean;
}) {
  return (
    <div className={cn('relative', className)}>
      <div className="space-y-4">
        {showBanner ? (
          <ComingSoonBanner featureId={featureId} showRibbon={showRibbon} />
        ) : showRibbon ? (
          <div className="relative h-0 overflow-visible">
            <div className="pointer-events-none absolute right-0 top-0 h-16 w-28 overflow-hidden">
              <ComingSoonRibbon />
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
