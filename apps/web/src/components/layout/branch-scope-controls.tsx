'use client';

import { CampusBranchFace, BranchScopeSelect } from '@/components/layout/branch-scope-select';
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
          'flex h-10 min-w-[200px] items-center gap-2 rounded-xl border border-[var(--palette-navy-soft)] bg-white py-1 pl-1.5 pr-3',
          'shadow-[0_1px_2px_rgba(11,31,58,0.06)]',
          className,
        )}
        title={summaryLabel}
      >
        <CampusBranchFace label={summaryLabel} />
      </div>
    );
  }

  if (!canSelect) return null;

  return (
    <BranchScopeSelect
      value={appScope}
      onValueChange={setAppScope}
      options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
      aria-label="App branch scope"
      size={size}
      variant="campus"
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
        options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
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
