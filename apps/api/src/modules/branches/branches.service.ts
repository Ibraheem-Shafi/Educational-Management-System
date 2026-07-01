import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import type { Branch, AuthUser } from '@eims/types';
import type { CreateBranchInput, UpdateBranchInput } from '@eims/shared';

const BRANCHES_CACHE_TTL_MS = 300_000;

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async findAll(branchId: string | null) {
    const cacheKey = `branches:list:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<{ data: Branch[] }>(cacheKey);
    if (cached) return cached;

    const branches = await this.prisma.branch.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { id: branchId } : {}),
      },
      orderBy: { name: 'asc' },
    });
    const result = { data: branches.map(this.toResponse) };
    this.ttlCache.set(cacheKey, result, BRANCHES_CACHE_TTL_MS);
    return result;
  }

  async findOne(id: string, branchId: string | null) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { id: branchId } : {}),
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.toResponse(branch);
  }

  async create(input: CreateBranchInput, user: AuthUser) {
    const existing = await this.prisma.branch.findFirst({
      where: { code: input.code, deletedAt: null },
    });
    if (existing) throw new ConflictException('Branch code already exists');

    const branch = await this.prisma.branch.create({
      data: {
        name: input.name,
        code: input.code,
        address: input.address,
        city: input.city,
        phone: input.phone,
        email: input.email,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'branch.created',
      entityType: 'Branch',
      entityId: branch.id,
      newValue: branch,
    });

    this.invalidateBranchesCache();
    return this.toResponse(branch);
  }

  async update(
    id: string,
    input: UpdateBranchInput,
    branchId: string | null,
    user: AuthUser,
  ) {
    const existing = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { id: branchId } : {}),
      },
    });
    if (!existing) throw new NotFoundException('Branch not found');

    if (input.code && input.code !== existing.code) {
      const codeTaken = await this.prisma.branch.findFirst({
        where: { code: input.code, deletedAt: null, NOT: { id } },
      });
      if (codeTaken) throw new ConflictException('Branch code already exists');
    }

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'branch.updated',
      entityType: 'Branch',
      entityId: branch.id,
      previousValue: existing,
      newValue: branch,
    });

    this.invalidateBranchesCache();
    return this.toResponse(branch);
  }

  async deactivate(id: string, branchId: string | null, user: AuthUser) {
    const existing = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { id: branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Branch not found');

    const branch = await this.prisma.branch.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'branch.deactivated',
      entityType: 'Branch',
      entityId: branch.id,
      previousValue: existing,
      newValue: branch,
    });

    this.invalidateBranchesCache();
    return this.toResponse(branch);
  }

  private invalidateBranchesCache(): void {
    this.ttlCache.deleteByPrefix('branches:');
  }

  private toResponse(branch: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Branch {
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      city: branch.city,
      phone: branch.phone,
      email: branch.email,
      isActive: branch.isActive,
      createdAt: branch.createdAt.toISOString(),
      updatedAt: branch.updatedAt.toISOString(),
    };
  }
}
