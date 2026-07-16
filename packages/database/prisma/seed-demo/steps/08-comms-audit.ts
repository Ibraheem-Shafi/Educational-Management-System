import type { Prisma, PrismaClient } from '@prisma/client';
import type { DemoContext } from '../types';

export async function seedCommsAndAudit(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const receptionId = ctx.userIds.get('reception@nexium.edu.pk') ?? null;
  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;

  const commCount = await prisma.communicationLog.count();
  if (commCount < 5) {
    const logs: Prisma.CommunicationLogCreateManyInput[] = ctx.config.communications.map((log) => ({
      channel: log.channel,
      recipient: log.recipient,
      subject: log.subject ?? null,
      body: log.body,
      status: log.status,
      metadata: log.metadata ?? undefined,
      createdById: receptionId,
    }));
    await prisma.communicationLog.createMany({ data: logs, skipDuplicates: true });
  }

  const auditCount = await prisma.auditLog.count();
  if (auditCount < 10 && adminId) {
    const entries: Prisma.AuditLogCreateManyInput[] = [
      { userId: adminId, action: 'student.created', entityType: 'Student', newValue: { source: 'demo_seed' } },
      { userId: adminId, action: 'attendance.bulk_marked', entityType: 'AttendanceRecord', newValue: { source: 'demo_seed' } },
      { userId: adminId, action: 'fee.invoice_created', entityType: 'FeeInvoice', newValue: { source: 'demo_seed' } },
      { userId: adminId, action: 'notice.published', entityType: 'Notice', newValue: { source: 'demo_seed' } },
      { userId: adminId, action: 'assessment.marks_entered', entityType: 'AssessmentRecord', newValue: { source: 'demo_seed' } },
    ];
    await prisma.auditLog.createMany({ data: entries, skipDuplicates: true });
  }
}
