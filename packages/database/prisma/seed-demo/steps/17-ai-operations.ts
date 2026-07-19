import type { PrismaClient } from '@prisma/client';
import {
  configuredBranchCodes,
  firstBatchCode,
  staffUserId,
} from '../branch-helpers';
import type { DemoContext } from '../types';

export async function seedAiOperations(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const batchCode = firstBatchCode(ctx, branchCode);
    const batchId = batchCode ? ctx.batchMap.get(batchCode) : null;
    if (!batchId) continue;

    const teacherId = staffUserId(ctx, branchCode, 'teacher');
    const imagePath = `demo/ai-attendance/${branchCode.toLowerCase()}-sheet.jpg`;

    const existing = await prisma.attendanceOcrSession.findFirst({
      where: { branchId, batchId, imagePath },
    });
    if (existing) continue;

    await prisma.attendanceOcrSession.create({
      data: {
        branchId,
        batchId,
        date: today,
        imagePath,
        rawText: `DEMO OCR sheet for ${branchCode}\nPresent: 18\nAbsent: 2\nLate: 1`,
        status: 'analyzed',
        suggestions: [
          { name: 'Sample Present Student', status: 'present', confidence: 0.92 },
          { name: 'Sample Absent Student', status: 'absent', confidence: 0.81 },
        ],
        createdById: teacherId,
        confirmedAt: null,
      },
    });
  }
}
