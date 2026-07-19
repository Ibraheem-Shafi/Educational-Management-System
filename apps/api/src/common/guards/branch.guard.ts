import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  allBranchScope,
  isSuperAdmin,
  parseBranchScopeFromQuery,
  selectedBranchScope,
  type BranchScope,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';

@Injectable()
export class BranchGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) return true;

    const query = request.query ?? {};
    const body = request.body ?? {};

    if (isSuperAdmin(user.roles)) {
      let scope: BranchScope;
      try {
        // Prefer query for reads; body branchId alone is for writes and does not define list scope.
        const hasQueryScope =
          (query.branchId != null && query.branchId !== '') ||
          (query.branchIds != null && query.branchIds !== '');
        if (hasQueryScope) {
          scope = parseBranchScopeFromQuery({
            branchId: query.branchId,
            branchIds: query.branchIds,
          });
        } else {
          scope = allBranchScope();
        }
      } catch (err) {
        throw new BadRequestException(err instanceof Error ? err.message : 'Invalid branch scope');
      }

      request.branchScope = scope;
      request.branchId =
        scope.kind === 'selected' && scope.branchIds.length === 1 ? scope.branchIds[0]! : null;
      return true;
    }

    if (!user.branchId) throw new ForbiddenException('No branch assigned');

    // Non–super-admins are always forced to their assigned branch.
    const requested = parseRequestedIds(query, body);
    if (requested.length > 0) {
      const foreign = requested.some((id) => id !== user.branchId);
      if (foreign || requested.length > 1) {
        throw new ForbiddenException('Cannot access other branches');
      }
    }

    const scope = selectedBranchScope([user.branchId]);
    request.branchScope = scope;
    request.branchId = user.branchId;
    return true;
  }
}

function parseRequestedIds(
  query: Record<string, unknown>,
  body: Record<string, unknown>,
): string[] {
  try {
    const fromQuery = parseBranchScopeFromQuery({
      branchId: query.branchId as string | string[] | undefined,
      branchIds: query.branchIds as string | string[] | undefined,
    });
    if (fromQuery.kind === 'selected') return fromQuery.branchIds;
  } catch {
    // Invalid query is ignored for non-superadmins; assigned branch wins.
  }

  const bodyId = body?.branchId;
  if (typeof bodyId === 'string' && bodyId.trim()) return [bodyId.trim()];
  return [];
}
