'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  appendBranchScopeParams,
  branchScopeKey,
  branchScopeSummary,
  branchScopeToQueryParams,
  getSingleBranchId,
  isSingleBranchScope,
  scopesEqual,
  type BranchScope,
} from '@eims/shared';
import { useAppBranchScope } from '@/providers/branch-scope-provider';

interface PageBranchScopeValue {
  appScope: BranchScope;
  pageOverride: BranchScope | null;
  effectiveScope: BranchScope;
  setPageOverride: (scope: BranchScope | null) => void;
  clearPageOverride: () => void;
  hasPageOverride: boolean;
  scopeKey: string;
  summaryLabel: string;
  /** Single branch id when effective scope is exactly one branch. */
  singleBranchId: string | null;
  isSingle: boolean;
  canSelect: boolean;
  isLocked: boolean;
  branches: Array<{ id: string; name: string; isActive?: boolean }>;
  /** Query object for apiClient paths / URLSearchParams. */
  queryParams: Record<string, string>;
  appendToSearchParams: (params: URLSearchParams) => void;
}

const PageBranchScopeContext = createContext<PageBranchScopeValue | null>(null);

export function PageBranchScopeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { appScope, canSelect, isLocked, branches } = useAppBranchScope();

  const [pageOverride, setPageOverrideState] = useState<BranchScope | null>(null);

  // Clear temporary override on every route change (including back navigation).
  useEffect(() => {
    setPageOverrideState(null);
  }, [pathname]);

  const setPageOverride = useCallback((scope: BranchScope | null) => {
    setPageOverrideState(scope);
  }, []);

  const clearPageOverride = useCallback(() => {
    setPageOverrideState(null);
  }, []);

  const effectiveScope = pageOverride ?? appScope;
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branches) map.set(b.id, b.name);
    return map;
  }, [branches]);

  const value = useMemo<PageBranchScopeValue>(() => {
    const hasPageOverride =
      pageOverride != null && !scopesEqual(pageOverride, appScope);
    return {
      appScope,
      pageOverride,
      effectiveScope,
      setPageOverride,
      clearPageOverride,
      hasPageOverride,
      scopeKey: branchScopeKey(effectiveScope),
      summaryLabel: branchScopeSummary(effectiveScope, (id) => nameById.get(id)),
      singleBranchId: getSingleBranchId(effectiveScope),
      isSingle: isSingleBranchScope(effectiveScope),
      canSelect,
      isLocked,
      branches,
      queryParams: branchScopeToQueryParams(effectiveScope),
      appendToSearchParams: (params: URLSearchParams) =>
        appendBranchScopeParams(params, effectiveScope),
    };
  }, [
    appScope,
    pageOverride,
    effectiveScope,
    setPageOverride,
    clearPageOverride,
    canSelect,
    isLocked,
    branches,
    nameById,
  ]);

  return (
    <PageBranchScopeContext.Provider value={value}>
      {children}
    </PageBranchScopeContext.Provider>
  );
}

export function usePageBranchScope(): PageBranchScopeValue {
  const ctx = useContext(PageBranchScopeContext);
  if (!ctx) {
    throw new Error('usePageBranchScope must be used within PageBranchScopeProvider');
  }
  return ctx;
}

export function usePageBranchScopeOptional(): PageBranchScopeValue | null {
  return useContext(PageBranchScopeContext);
}

export function useEffectiveBranchScope(): PageBranchScopeValue {
  return usePageBranchScope();
}
