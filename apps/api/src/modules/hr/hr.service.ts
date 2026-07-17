import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '@eims/types';
import type {
  CreateContractInput,
  UpdateContractInput,
  ListContractsQuery,
  CreateReviewInput,
  UpdateReviewInput,
  ListReviewsQuery,
} from '@eims/shared';

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findContracts(query: ListContractsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const contracts = await this.prisma.employmentContract.findMany({
      where: {
        userId: query.userId,
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      },
      orderBy: { startDate: 'desc' },
    });
    return { data: contracts.map(this.toContractResponse) };
  }

  async findContract(id: string, branchId: string | null) {
    const contract = await this.prisma.employmentContract.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return this.toContractResponse(contract);
  }

  async createContract(input: CreateContractInput, user: AuthUser) {
    await this.assertUserInBranch(input.userId, input.branchId);

    const contract = await this.prisma.employmentContract.create({
      data: {
        userId: input.userId,
        branchId: input.branchId,
        startDate: this.parseDate(input.startDate, 'startDate'),
        endDate: input.endDate ? this.parseDate(input.endDate, 'endDate') : null,
        employmentType: input.employmentType,
        salaryNote: input.salaryNote ?? null,
        status: input.status ?? 'active',
        documentPath: input.documentPath ?? null,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'hr.contract.created',
      entityType: 'EmploymentContract',
      entityId: contract.id,
      newValue: contract,
    });

    return this.toContractResponse(contract);
  }

  async updateContract(
    id: string,
    input: UpdateContractInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.employmentContract.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Contract not found');

    const contract = await this.prisma.employmentContract.update({
      where: { id },
      data: {
        ...(input.startDate !== undefined
          ? { startDate: this.parseDate(input.startDate, 'startDate') }
          : {}),
        ...(input.endDate !== undefined
          ? { endDate: input.endDate ? this.parseDate(input.endDate, 'endDate') : null }
          : {}),
        ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
        ...(input.salaryNote !== undefined ? { salaryNote: input.salaryNote } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.documentPath !== undefined ? { documentPath: input.documentPath } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'hr.contract.updated',
      entityType: 'EmploymentContract',
      entityId: contract.id,
      previousValue: existing,
      newValue: contract,
    });

    return this.toContractResponse(contract);
  }

  async removeContract(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.employmentContract.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Contract not found');

    await this.prisma.employmentContract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'hr.contract.deleted',
      entityType: 'EmploymentContract',
      entityId: id,
      previousValue: existing,
    });

    return { success: true };
  }

  async findReviews(query: ListReviewsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const reviews = await this.prisma.performanceReview.findMany({
      where: {
        userId: query.userId,
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      },
      orderBy: { reviewedAt: 'desc' },
      include: {
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });
    return { data: reviews.map(this.toReviewResponse) };
  }

  async findReview(id: string, branchId: string | null) {
    const review = await this.prisma.performanceReview.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: {
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!review) throw new NotFoundException('Review not found');
    return this.toReviewResponse(review);
  }

  async createReview(input: CreateReviewInput, user: AuthUser) {
    await this.assertUserInBranch(input.userId, input.branchId);

    const review = await this.prisma.performanceReview.create({
      data: {
        userId: input.userId,
        branchId: input.branchId,
        periodLabel: input.periodLabel,
        reviewedAt: this.parseDate(input.reviewedAt, 'reviewedAt'),
        score: input.score ?? null,
        summary: input.summary,
        reviewedById: input.reviewedById ?? user.id,
      },
      include: {
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'hr.review.created',
      entityType: 'PerformanceReview',
      entityId: review.id,
      newValue: review,
    });

    return this.toReviewResponse(review);
  }

  async updateReview(
    id: string,
    input: UpdateReviewInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.performanceReview.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Review not found');

    const review = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        ...(input.periodLabel !== undefined ? { periodLabel: input.periodLabel } : {}),
        ...(input.reviewedAt !== undefined
          ? { reviewedAt: this.parseDate(input.reviewedAt, 'reviewedAt') }
          : {}),
        ...(input.score !== undefined ? { score: input.score } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.reviewedById !== undefined ? { reviewedById: input.reviewedById } : {}),
      },
      include: {
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'hr.review.updated',
      entityType: 'PerformanceReview',
      entityId: review.id,
      previousValue: existing,
      newValue: review,
    });

    return this.toReviewResponse(review);
  }

  async removeReview(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.performanceReview.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Review not found');

    await this.prisma.performanceReview.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'hr.review.deleted',
      entityType: 'PerformanceReview',
      entityId: id,
      previousValue: existing,
    });

    return { success: true };
  }

  private async assertUserInBranch(userId: string, branchId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, branchId },
    });
    if (!target) throw new NotFoundException('User not found in branch');
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return date;
  }

  private toContractResponse(contract: {
    id: string;
    userId: string;
    branchId: string;
    startDate: Date;
    endDate: Date | null;
    employmentType: string;
    salaryNote: string | null;
    status: string;
    documentPath: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: contract.id,
      userId: contract.userId,
      branchId: contract.branchId,
      startDate: contract.startDate.toISOString().slice(0, 10),
      endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
      employmentType: contract.employmentType,
      salaryNote: contract.salaryNote,
      status: contract.status,
      documentPath: contract.documentPath,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
    };
  }

  private toReviewResponse(review: {
    id: string;
    userId: string;
    branchId: string;
    periodLabel: string;
    reviewedAt: Date;
    score: { toString(): string } | null;
    summary: string;
    reviewedById: string | null;
    reviewedBy: { id: string; fullName: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: review.id,
      userId: review.userId,
      branchId: review.branchId,
      periodLabel: review.periodLabel,
      reviewedAt: review.reviewedAt.toISOString().slice(0, 10),
      score: review.score != null ? Number(review.score) : null,
      summary: review.summary,
      reviewedById: review.reviewedById,
      reviewedBy: review.reviewedBy,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }
}
