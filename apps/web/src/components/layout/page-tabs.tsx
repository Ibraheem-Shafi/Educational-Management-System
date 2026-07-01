import { cn } from '@/lib/utils';

interface PageTab {
  id: string;
  label: string;
}

interface PageTabsProps {
  tabs: PageTab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function PageTabs({ tabs, activeId, onChange, className }: PageTabsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeId === tab.id
              ? 'bg-[var(--institution-primary)] text-white'
              : 'bg-muted text-foreground hover:bg-muted/80',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
