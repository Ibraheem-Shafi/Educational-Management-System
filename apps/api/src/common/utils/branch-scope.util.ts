import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  branchScopeKey,
  getSingleBranchId,
  type BranchScope,
} from '@eims/shared';

/** Prisma where fragment for models with a `branchId` column. */
export function prismaBranchFilter(
  scope: BranchScope,
): { branchId: string } | { branchId: { in: string[] } } | Record<string, never> {
  if (scope.kind === 'all') return {};
  if (scope.branchIds.length === 1) return { branchId: scope.branchIds[0]! };
  return { branchId: { in: scope.branchIds } };
}

/** Prisma where fragment for the Branch model (`id` column). */
export function prismaBranchIdFilter(
  scope: BranchScope,
): { id: string } | { id: { in: string[] } } | Record<string, never> {
  if (scope.kind === 'all') return {};
  if (scope.branchIds.length === 1) return { id: scope.branchIds[0]! };
  return { id: { in: scope.branchIds } };
}

/**
 * SQL AND fragment for raw queries, e.g. `AND ar."branchId" = $x` or `IN (...)`.
 * Pass the quoted column expression (already including table alias if needed).
 */
export function sqlBranchFilter(scope: BranchScope, columnSql: string): Prisma.Sql {
  if (scope.kind === 'all') return Prisma.empty;
  if (scope.branchIds.length === 1) {
    return Prisma.sql`AND ${Prisma.raw(columnSql)} = ${scope.branchIds[0]!}`;
  }
  return Prisma.sql`AND ${Prisma.raw(columnSql)} IN (${Prisma.join(
    scope.branchIds.map((id) => Prisma.sql`${id}`),
  )})`;
}

export function requireSingleBranchId(scope: BranchScope): string {
  const id = getSingleBranchId(scope);
  if (!id) {
    throw new BadRequestException('A single branch must be selected for this action');
  }
  return id;
}

export function scopeCacheKey(scope: BranchScope): string {
  return branchScopeKey(scope);
}

/** Legacy bridge: map nullable branchId to BranchScope. */
export function scopeFromLegacyBranchId(branchId: string | null | undefined): BranchScope {
  if (!branchId) return { kind: 'all' };
  return { kind: 'selected', branchIds: [branchId] };
}

/**
 * Narrow an 'all' scope using a legacy `query.branchId`.
 * A 'selected' scope always wins; multi-branch is never widened to 'all'.
 */
export function narrowScope(scope: BranchScope, queryBranchId?: string | null): BranchScope {
  if (scope.kind === 'selected') return scope;
  if (queryBranchId) return { kind: 'selected', branchIds: [queryBranchId] };
  return scope;
}
