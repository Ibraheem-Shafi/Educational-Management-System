'use client';

import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
  /** Accessible name for the tablist. */
  'aria-label'?: string;
}

/**
 * Universal segmented tabs — gray track with a white active pill.
 * Use for page-level view switching (Academic, Attendance, Timetable, etc.).
 */
export function Tabs({
  tabs,
  value,
  onValueChange,
  className,
  'aria-label': ariaLabel = 'Tabs',
}: TabsProps) {
  return (
    <div
      className={cn(
        'inline-flex h-10 max-w-full items-center overflow-x-auto rounded-[10px] bg-[#E8E8E8] p-1',
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => {
              if (!tab.disabled) onValueChange(tab.id);
            }}
            className={cn(
              'h-8 shrink-0 rounded-lg px-4 text-sm font-normal leading-5 tracking-[-0.006em] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)] focus-visible:ring-offset-1',
              'disabled:pointer-events-none disabled:opacity-50',
              active
                ? 'bg-white text-[var(--text-main-900)] shadow-sm'
                : 'text-[var(--text-sub-500)] hover:text-[var(--text-main-900)]',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
