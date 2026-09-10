import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { accentForLabel, paletteColor, paletteSoft } from '@/lib/ui-palette';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  icon?: LucideIcon;
}

/** Primary CTA styles matching Figma page headers (midnight blue, 40px height). */
export const pageHeaderActionClassName = cn(
  'inline-flex h-10 items-center justify-center gap-1 rounded-[10px] p-2.5',
  'bg-[var(--midnight-blue-950)] text-white',
  'text-sm font-medium leading-5 tracking-[-0.006em]',
  'hover:opacity-90',
);

/** Thin white plus icon for page-header primary actions. */
export function PageHeaderActionIcon({ className }: { className?: string }) {
  return (
    <Plus
      className={cn('h-4 w-4 shrink-0 text-white', className)}
      strokeWidth={2.25}
      aria-hidden
    />
  );
}

export function PageHeader({ title, description, actions, className, icon: Icon }: PageHeaderProps) {
  const accent = accentForLabel(title);

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: paletteSoft(accent),
              color: paletteColor(accent),
            }}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-medium leading-6 tracking-[-0.015em] text-[var(--text-main-900)]">
            {title}
          </h1>
          {description && (
            <p className="text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500)]">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
