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
import {
  allBranchScope,
  branchScopeKey,
  branchScopeSummary,
  isSuperAdmin,
  normalizeBranchIds,
  selectedBranchScope,
  scopesEqual,
  type BranchScope,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { useBranches } from '@/hooks/use-branches';

const STORAGE_PREFIX = 'eims.branch-scope.v1:';

type BranchRow = { id: string; name: string; isActive?: boolean };

interface BranchScopeContextValue {
  /** App-wide scope (persisted for super admin). */
  appScope: BranchScope;
  setAppScope: (scope: BranchScope) => void;
  /** Locked assigned branch for non–super-admins. */
  isLocked: boolean;
  canSelect: boolean;
  branches: BranchRow[];
  branchesLoading: boolean;
  scopeKey: string;
  summaryLabel: string;
}

const BranchScopeContext = createContext<BranchScopeContextValue | null>(null);

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function readStoredScope(userId: string): BranchScope | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BranchScope;
    if (parsed?.kind === 'all') return allBranchScope();
    if (parsed?.kind === 'selected' && Array.isArray(parsed.branchIds)) {
      return selectedBranchScope(parsed.branchIds);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredScope(userId: string, scope: BranchScope): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(scope));
  } catch {
    /* ignore */
  }
}

function pruneScope(scope: BranchScope, validIds: Set<string>): BranchScope {
  if (scope.kind === 'all') return scope;
  const next = normalizeBranchIds(scope.branchIds.filter((id) => validIds.has(id)));
  return next.length === 0 ? allBranchScope() : selectedBranchScope(next);
}

export function BranchScopeProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const token = session?.access_token;
  const { data: branchesData, isLoading: branchesLoading } = useBranches(token);
  const branches = useMemo(
    () => (branchesData?.data ?? []) as BranchRow[],
    [branchesData],
  );

  const canSelect = !!user && isSuperAdmin(user.roles);
  const isLocked = !!user && !canSelect && !!user.branchId;

  const [appScope, setAppScopeState] = useState<BranchScope>(() => allBranchScope());
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);

  // Hydrate from localStorage / lock to assigned branch when user changes.
  useEffect(() => {
    if (!user) {
      setAppScopeState(allBranchScope());
      setHydratedUserId(null);
      return;
    }

    if (!canSelect) {
      setAppScopeState(
        user.branchId ? selectedBranchScope([user.branchId]) : allBranchScope(),
      );
      setHydratedUserId(user.id);
      return;
    }

    const stored = readStoredScope(user.id);
    setAppScopeState(stored ?? allBranchScope());
    setHydratedUserId(user.id);
  }, [user, canSelect]);

  // Prune stale branch IDs once catalog loads.
  useEffect(() => {
    if (!user || !canSelect || hydratedUserId !== user.id) return;
    if (branchesLoading || branches.length === 0) return;

    const validIds = new Set(
      branches.filter((b) => b.isActive !== false).map((b) => b.id),
    );
    setAppScopeState((prev) => {
      const next = pruneScope(prev, validIds);
      if (!scopesEqual(prev, next)) {
        writeStoredScope(user.id, next);
      }
      return next;
    });
  }, [user, canSelect, hydratedUserId, branches, branchesLoading]);

  const setAppScope = useCallback(
    (scope: BranchScope) => {
      if (!user || !canSelect) return;
      const validIds = new Set(
        branches.filter((b) => b.isActive !== false).map((b) => b.id),
      );
      const next =
        branches.length > 0 ? pruneScope(scope, validIds) : scope.kind === 'all'
          ? allBranchScope()
          : selectedBranchScope(scope.branchIds);
      setAppScopeState(next);
      writeStoredScope(user.id, next);
    },
    [user, canSelect, branches],
  );

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branches) map.set(b.id, b.name);
    return map;
  }, [branches]);

  const value = useMemo<BranchScopeContextValue>(
    () => ({
      appScope,
      setAppScope,
      isLocked,
      canSelect,
      branches,
      branchesLoading,
      scopeKey: branchScopeKey(appScope),
      summaryLabel: branchScopeSummary(appScope, (id) => nameById.get(id)),
    }),
    [
      appScope,
      setAppScope,
      isLocked,
      canSelect,
      branches,
      branchesLoading,
      nameById,
    ],
  );

  return (
    <BranchScopeContext.Provider value={value}>{children}</BranchScopeContext.Provider>
  );
}

export function useAppBranchScope(): BranchScopeContextValue {
  const ctx = useContext(BranchScopeContext);
  if (!ctx) {
    throw new Error('useAppBranchScope must be used within BranchScopeProvider');
  }
  return ctx;
}

/** Safe optional access when provider may be absent (portal routes). */
export function useAppBranchScopeOptional(): BranchScopeContextValue | null {
  return useContext(BranchScopeContext);
}
