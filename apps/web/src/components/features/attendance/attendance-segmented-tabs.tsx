'use client';

import { cn } from '@/lib/utils';

interface AttendanceSegmentedTabsProps {
  tabs: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function AttendanceSegmentedTabs({
  tabs,
  activeId,
  onChange,
  className,
}: AttendanceSegmentedTabsProps) {
  return (
    <div
      className={cn(
        'flex h-10 items-center rounded-[10px] bg-[#E8E8E8] p-1',
        className,
      )}
      role="tablist"
      aria-label="Attendance type"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'h-8 rounded-lg px-4 text-sm font-normal leading-5 tracking-[-0.006em] transition-colors',
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
