'use client';

import { BranchScopeSelect } from '@/components/layout/branch-scope-select';
import { useAppBranchScope } from '@/providers/branch-scope-provider';
import { Button } from '@/components/ui/button';
import { usePageBranchScope } from '@/hooks/use-page-branch-scope';
import { cn } from '@/lib/utils';

/** App-level branch scope control (Super Admin only). */
export function AppBranchScopeControl({
  className,
  size = 'sm',
}: {
  className?: string;
  size?: 'default' | 'sm';
}) {
  const { appScope, setAppScope, canSelect, isLocked, branches, summaryLabel } =
    useAppBranchScope();

  if (isLocked) {
    return (
      <div
        className={cn(
          'truncate rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] bg-[var(--neutral-50)] px-3 py-1.5 text-xs text-[var(--text-sub-500)]',
          className,
        )}
        title={summaryLabel}
      >
        {summaryLabel}
      </div>
    );
  }

  if (!canSelect) return null;

  return (
    <BranchScopeSelect
      value={appScope}
      onValueChange={setAppScope}
      options={branches.map((b) => ({ value: b.id, label: b.name }))}
      aria-label="App branch scope"
      size={size}
      className={className}
    />
  );
}

/**
 * Page-level temporary override. Defaults to app selection; reset clears override.
 * Shown only for Super Admin.
 */
export function PageBranchScopeControl({
  className,
  label = 'Branch',
}: {
  className?: string;
  label?: string;
}) {
  const {
    appScope,
    effectiveScope,
    setPageOverride,
    clearPageOverride,
    hasPageOverride,
    canSelect,
    isLocked,
    branches,
    summaryLabel,
  } = usePageBranchScope();

  if (isLocked) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-[var(--text-sub-500)]', className)}>
        <span className="text-[var(--text-soft-400)]">{label}:</span>
        <span>{summaryLabel}</span>
      </div>
    );
  }

  if (!canSelect) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <BranchScopeSelect
        value={effectiveScope}
        onValueChange={(scope) => setPageOverride(scope)}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
        aria-label={`${label} page override`}
        placeholder={hasPageOverride ? undefined : 'Using app selection'}
      />
      {hasPageOverride ? (
        <Button type="button" variant="ghost" size="sm" onClick={clearPageOverride}>
          Reset to app selection
        </Button>
      ) : (
        <span className="text-xs text-[var(--text-soft-400)]">Using app selection</span>
      )}
      {/* Keep appScope referenced so lint knows we read it for equality via hasPageOverride */}
      <span className="sr-only">{appScope.kind}</span>
    </div>
  );
}
