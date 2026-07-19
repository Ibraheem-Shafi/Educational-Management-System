import { Prisma, type PrismaClient } from '@prisma/client';
import {
  configuredBranchCodes,
  featuredStudentDemoKey,
  staffUserId,
} from '../branch-helpers';
import type { DemoContext } from '../types';

export async function seedHrAndLeave(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;
  const parentId = ctx.parentIds.get('rashid-ahmad-khan') ?? [...ctx.parentIds.values()][0] ?? null;

  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const teacherId = staffUserId(ctx, branchCode, 'teacher');
    const accountantId = staffUserId(ctx, branchCode, 'accountant');
    const receptionistId = staffUserId(ctx, branchCode, 'receptionist');
    const branchAdminId = staffUserId(ctx, branchCode, 'branch_admin') ?? adminId;

    for (const [userId, salaryNote, employmentType] of [
      [teacherId, 'PKR 80,000 basic + transport', 'full_time'],
      [accountantId, 'PKR 75,000 basic + transport', 'full_time'],
      [receptionistId, 'PKR 55,000 basic', 'full_time'],
    ] as const) {
      if (!userId) continue;

      const existing = await prisma.employmentContract.findFirst({
        where: { userId, branchId, deletedAt: null, status: 'active' },
      });
      if (!existing) {
        await prisma.employmentContract.create({
          data: {
            userId,
            branchId,
            startDate: new Date(Date.UTC(2025, 0, 1)),
            employmentType,
            salaryNote,
            status: 'active',
            documentPath: `hr/demo/${branchCode.toLowerCase()}-${userId.slice(-6)}-contract.pdf`,
          },
        });
      }

      const reviewPeriod = `H1 2026 [${branchCode}]`;
      const existingReview = await prisma.performanceReview.findFirst({
        where: { userId, branchId, periodLabel: reviewPeriod, deletedAt: null },
      });
      if (!existingReview) {
        await prisma.performanceReview.create({
          data: {
            userId,
            branchId,
            periodLabel: reviewPeriod,
            reviewedAt: new Date(Date.UTC(2026, 5, 15)),
            score: new Prisma.Decimal(userId === teacherId ? 88 : 82),
            summary: `Solid performance for ${branchCode} campus. Demo review record.`,
            reviewedById: branchAdminId,
          },
        });
      }
    }

    // Employee leave: pending + approved
    if (teacherId) {
      await upsertLeave(prisma, {
        kind: 'employee',
        userId: teacherId,
        fromDate: new Date(Date.UTC(2026, 6, 22)),
        toDate: new Date(Date.UTC(2026, 6, 23)),
        reason: `Family event — ${branchCode} campus teacher leave`,
        status: 'pending',
      });
    }
    if (accountantId) {
      await upsertLeave(prisma, {
        kind: 'employee',
        userId: accountantId,
        fromDate: new Date(Date.UTC(2026, 5, 10)),
        toDate: new Date(Date.UTC(2026, 5, 11)),
        reason: `Medical leave — ${branchCode}`,
        status: 'approved',
        reviewedById: branchAdminId,
      });
    }

    // Student leave (parent-submitted) for featured student
    const studentId = ctx.studentIds.get(featuredStudentDemoKey(branchCode));
    if (studentId && parentId) {
      await upsertLeave(prisma, {
        kind: 'student',
        studentId,
        parentId,
        fromDate: new Date(Date.UTC(2026, 6, 18)),
        toDate: new Date(Date.UTC(2026, 6, 18)),
        reason: `Family function — student absence (${branchCode})`,
        status: 'pending',
      });
    }
  }
}

async function upsertLeave(
  prisma: PrismaClient,
  data: {
    kind: string;
    studentId?: string;
    parentId?: string | null;
    userId?: string;
    fromDate: Date;
    toDate: Date;
    reason: string;
    status: string;
    reviewedById?: string | null;
  },
): Promise<void> {
  const existing = await prisma.leaveRequest.findFirst({
    where: {
      kind: data.kind,
      reason: data.reason,
      fromDate: data.fromDate,
      ...(data.userId ? { userId: data.userId } : {}),
      ...(data.studentId ? { studentId: data.studentId } : {}),
    },
  });
  if (existing) return;

  await prisma.leaveRequest.create({
    data: {
      kind: data.kind,
      studentId: data.studentId ?? null,
      parentId: data.parentId ?? null,
      userId: data.userId ?? null,
      fromDate: data.fromDate,
      toDate: data.toDate,
      reason: data.reason,
      status: data.status,
      reviewedById: data.reviewedById ?? null,
    },
  });
}
