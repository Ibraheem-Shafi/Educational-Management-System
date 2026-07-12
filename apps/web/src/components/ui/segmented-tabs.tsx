'use client';

/**
 * @deprecated Prefer `Tabs` from `@/components/ui/tabs`.
 * Kept as a thin adapter for existing call sites that used `activeId` / `onChange`.
 */
import { Tabs, type TabItem, type TabsProps } from '@/components/ui/tabs';

export type SegmentedTab = TabItem;

export interface SegmentedTabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
}

export function SegmentedTabs({
  tabs,
  activeId,
  onChange,
  className,
  'aria-label': ariaLabel,
}: SegmentedTabsProps) {
  return (
    <Tabs
      tabs={tabs}
      value={activeId}
      onValueChange={onChange}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

export type { TabsProps };
