/**
 * Branch scope for Super Admin app-level / page-level filtering.
 * - `all`: every branch (institution-wide)
 * - `selected`: one or more explicit branch IDs (normalized, sorted, unique)
 */

export type BranchScope =
  | { kind: 'all' }
  | { kind: 'selected'; branchIds: string[] };

export function allBranchScope(): BranchScope {
  return { kind: 'all' };
}

/** Normalize IDs: trim, drop empties, dedupe, sort for stable cache keys. */
export function normalizeBranchIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  out.sort();
  return out;
}

export function selectedBranchScope(ids: readonly string[]): BranchScope {
  const branchIds = normalizeBranchIds(ids);
  if (branchIds.length === 0) return allBranchScope();
  return { kind: 'selected', branchIds };
}

export function branchScopeKey(scope: BranchScope): string {
  if (scope.kind === 'all') return 'all';
  return `selected:${scope.branchIds.join(',')}`;
}

export function isSingleBranchScope(scope: BranchScope): boolean {
  return scope.kind === 'selected' && scope.branchIds.length === 1;
}

export function getSingleBranchId(scope: BranchScope): string | null {
  if (scope.kind !== 'selected' || scope.branchIds.length !== 1) return null;
  return scope.branchIds[0]!;
}

export function branchIdsFromScope(scope: BranchScope): string[] | null {
  return scope.kind === 'all' ? null : scope.branchIds;
}

export function scopesEqual(a: BranchScope, b: BranchScope): boolean {
  return branchScopeKey(a) === branchScopeKey(b);
}

export type BranchScopeQueryInput = {
  branchId?: string | string[] | null;
  branchIds?: string | string[] | null;
};

function coerceIdList(value: string | string[] | null | undefined): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.flatMap((v) => String(v).split(',')).map((s) => s.trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse query/body branch parameters into a BranchScope.
 * - Prefer `branchIds` (CSV or repeated) when present.
 * - Fall back to legacy `branchId`.
 * - Empty / missing → `all` (caller must still enforce role rules).
 * Throws Error with message suitable for 400 responses when both are set with conflicting intent.
 */
export function parseBranchScopeFromQuery(input: BranchScopeQueryInput): BranchScope {
  const hasBranchId =
    input.branchId != null &&
    input.branchId !== '' &&
    !(Array.isArray(input.branchId) && input.branchId.length === 0);
  const hasBranchIds =
    input.branchIds != null &&
    input.branchIds !== '' &&
    !(Array.isArray(input.branchIds) && input.branchIds.length === 0);

  if (hasBranchId && hasBranchIds) {
    throw new Error('Provide either branchId or branchIds, not both');
  }

  if (hasBranchIds) {
    const ids = coerceIdList(input.branchIds);
    if (ids.length === 0) {
      throw new Error('branchIds must include at least one branch id');
    }
    return selectedBranchScope(ids);
  }

  if (hasBranchId) {
    const ids = coerceIdList(input.branchId);
    if (ids.length === 0) {
      throw new Error('branchId must be a non-empty string');
    }
    if (ids.length > 1) {
      return selectedBranchScope(ids);
    }
    return selectedBranchScope(ids);
  }

  return allBranchScope();
}

/** Serialize scope for API query strings (omits params when all). */
export function branchScopeToQueryParams(scope: BranchScope): Record<string, string> {
  if (scope.kind === 'all') return {};
  if (scope.branchIds.length === 1) {
    return { branchId: scope.branchIds[0]! };
  }
  return { branchIds: scope.branchIds.join(',') };
}

/** Append scope params onto URLSearchParams. */
export function appendBranchScopeParams(params: URLSearchParams, scope: BranchScope): void {
  const q = branchScopeToQueryParams(scope);
  for (const [key, value] of Object.entries(q)) {
    params.set(key, value);
  }
}

/** Human-readable label helper (UI can refine with branch names). */
export function branchScopeSummary(
  scope: BranchScope,
  resolveName?: (id: string) => string | undefined,
): string {
  if (scope.kind === 'all') return 'All branches';
  if (scope.branchIds.length === 1) {
    const id = scope.branchIds[0]!;
    return resolveName?.(id) ?? id;
  }
  return `${scope.branchIds.length} branches`;
}
