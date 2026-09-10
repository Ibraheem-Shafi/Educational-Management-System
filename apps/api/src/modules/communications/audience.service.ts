import { Injectable } from '@nestjs/common';
import { normalizePakistanPhone, type BranchScope, type CommunicationAudience } from '@eims/shared';
import { PrismaService } from '../../prisma/prisma.module';
import { prismaBranchFilter } from '../../common/utils/branch-scope.util';

export type AudienceRecipient = {
  phone: string;
  displayName: string;
  studentId?: string;
  studentName?: string;
  amount?: string;
  dueDate?: string;
};

export type AudienceFilters = {
  audience: CommunicationAudience;
  programId?: string;
  batchId?: string;
};

@Injectable()
export class CommunicationsAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(scope: BranchScope, filters: AudienceFilters): Promise<AudienceRecipient[]> {
    switch (filters.audience) {
      case 'parents':
        return this.parents(scope, filters);
      case 'students':
        return this.students(scope, filters);
      case 'staff':
        return this.staff(scope);
      case 'fee_defaulters':
        return this.feeDefaulters(scope, filters);
      default:
        return [];
    }
  }

  private studentWhere(scope: BranchScope, filters: AudienceFilters) {
    return {
      deletedAt: null,
      ...prismaBranchFilter(scope),
      ...(filters.programId ? { programId: filters.programId } : {}),
      ...(filters.batchId ? { batchId: filters.batchId } : {}),
    };
  }

  private parents(scope: BranchScope, filters: AudienceFilters): Promise<AudienceRecipient[]> {
    return this.prisma.parent
      .findMany({
        where: {
          deletedAt: null,
          phone: { not: null },
          studentParents: { some: { student: this.studentWhere(scope, filters) } },
        },
        select: {
          fullName: true,
          phone: true,
          studentParents: {
            where: { student: this.studentWhere(scope, filters) },
            select: { student: { select: { id: true, fullName: true } } },
            take: 1,
          },
        },
      })
      .then((rows) => this.uniqueByPhone(rows.map((row) => {
        const child = row.studentParents[0]?.student;
        return {
          phone: row.phone!,
          displayName: row.fullName,
          studentId: child?.id,
          studentName: child?.fullName,
        };
      })));
  }

  private students(scope: BranchScope, filters: AudienceFilters): Promise<AudienceRecipient[]> {
    return this.prisma.student
      .findMany({
        where: { ...this.studentWhere(scope, filters), phone: { not: null } },
        select: { id: true, fullName: true, phone: true },
      })
      .then((rows) =>
        this.uniqueByPhone(
          rows.map((row) => ({
            phone: row.phone!,
            displayName: row.fullName,
            studentId: row.id,
            studentName: row.fullName,
          })),
        ),
      );
  }

  private staff(scope: BranchScope): Promise<AudienceRecipient[]> {
    return this.prisma.user
      .findMany({
        where: {
          deletedAt: null,
          isActive: true,
          phone: { not: null },
          ...prismaBranchFilter(scope),
        },
        select: { fullName: true, phone: true },
      })
      .then((rows) =>
        this.uniqueByPhone(
          rows.map((row) => ({
            phone: row.phone!,
            displayName: row.fullName,
          })),
        ),
      );
  }

  private async feeDefaulters(scope: BranchScope, filters: AudienceFilters): Promise<AudienceRecipient[]> {
    const today = new Date();
    const invoices = await this.prisma.feeInvoice.findMany({
      where: {
        ...prismaBranchFilter(scope),
        paidAt: null,
        OR: [{ dueDate: null }, { dueDate: { lt: today } }],
        student: this.studentWhere(scope, filters),
      },
      select: {
        netAmount: true,
        dueDate: true,
        student: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            studentParents: {
              where: { parent: { deletedAt: null, phone: { not: null } } },
              select: { parent: { select: { fullName: true, phone: true } } },
              take: 1,
            },
          },
        },
      },
    });

    return this.uniqueByPhone(
      invoices.flatMap((inv) => {
        const parent = inv.student.studentParents[0]?.parent;
        const phone = parent?.phone ?? inv.student.phone;
        if (!phone) return [];
        return [
          {
            phone,
            displayName: parent?.fullName ?? inv.student.fullName,
            studentId: inv.student.id,
            studentName: inv.student.fullName,
            amount: String(Math.round((Number(inv.netAmount) + Number.EPSILON) * 100) / 100),
            dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? 'ASAP',
          },
        ];
      }),
    );
  }

  private uniqueByPhone(rows: AudienceRecipient[]): AudienceRecipient[] {
    const seen = new Set<string>();
    const unique: AudienceRecipient[] = [];
    for (const row of rows) {
      const phone = normalizePakistanPhone(row.phone);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      unique.push({ ...row, phone });
    }
    return unique;
  }
}
