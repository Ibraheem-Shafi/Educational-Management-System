import {
  appendBranchScopeParams,
  branchScopeKey,
  branchScopeToQueryParams,
  type BranchScope,
} from '@eims/shared';

/** Build `?a=1&branchId=...` or `?branchIds=a,b` from a path and scope. */
export function withBranchScope(
  path: string,
  scope: BranchScope,
  extra?: Record<string, string | number | undefined | null>,
): string {
  const [base, existing] = path.split('?');
  const params = new URLSearchParams(existing ?? '');
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
  }
  appendBranchScopeParams(params, scope);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function branchScopeQueryKey(scope: BranchScope): string {
  return branchScopeKey(scope);
}

export { branchScopeToQueryParams, appendBranchScopeParams };
