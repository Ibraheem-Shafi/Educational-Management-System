import type { PrismaClient } from '@prisma/client';
import type { DemoContext } from '../types';

export async function seedBatches(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  for (const batch of ctx.config.batches) {
    const branchId = ctx.branchMap.get(batch.branchCode)!;
    const programId = ctx.programMap.get(`${batch.branchCode}:${batch.programCode}`)!;

    let row = await prisma.batch.findFirst({
      where: { branchId, code: batch.code, deletedAt: null },
    });
    if (!row) {
      row = await prisma.batch.create({
        data: {
          branchId,
          programId,
          name: batch.name,
          code: batch.code,
          sessionId: ctx.sessionId,
          scheduleType: batch.scheduleType,
        },
      });
    }

    for (const sc of batch.subjects) {
      const subjectId = ctx.subjectMap.get(sc)!;
      await prisma.batchSubject.upsert({
        where: { batchId_subjectId: { batchId: row.id, subjectId } },
        create: { batchId: row.id, subjectId },
        update: {},
      });
    }

    ctx.batchMap.set(batch.code, row.id);
  }
}
