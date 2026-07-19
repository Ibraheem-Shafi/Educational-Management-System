import type { PrismaClient } from '@prisma/client';
import {
  configuredBranchCodes,
  firstBatchCode,
  staffUserId,
} from '../branch-helpers';
import type { DemoContext } from '../types';

/** Base titles — branch-qualified at seed time; also used by cleanup. */
export const DEMO_LEARNING_TITLE_SUFFIXES = [
  'Weekly class notes — Grammar focus',
  'CSS Midterm preparation material',
  'Batch syllabus — Morning CSS 2026',
  'Useful Urdu literature reading list',
  'Homework: Essay outline (due this week)',
  'Homework: Past paper practice set',
  'Homework: Vocabulary quiz prep',
  'Online class: English composition workshop',
  'Online class: Parent-teacher Q&A session',
] as const;

/** @deprecated use branchQualifiedLearningTitle — kept for cleanup of v1.4 titles */
export const DEMO_LEARNING_TITLES = DEMO_LEARNING_TITLE_SUFFIXES;

export function branchQualifiedLearningTitle(branchCode: string, suffix: string): string {
  return `[${branchCode}] ${suffix}`;
}

export async function seedLearning(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;

  const dueInDays = (days: number) => {
    const d = new Date();
    d.setUTCHours(23, 59, 59, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  };

  const tomorrowAt = (hour: number, minute = 0, durationMinutes = 60) => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(hour, minute, 0, 0);
    const end = new Date(start);
    end.setUTCMinutes(end.getUTCMinutes() + durationMinutes);
    return { start, end };
  };

  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const teacherId = staffUserId(ctx, branchCode, 'teacher') ?? adminId;
    const batchCode = firstBatchCode(ctx, branchCode);
    const batchCfg = ctx.config.batches.find((b) => b.code === batchCode);
    const batchId = batchCode ? ctx.batchMap.get(batchCode) ?? null : null;
    const subjectCode = batchCfg?.subjects[0];
    const subjectId = subjectCode ? ctx.subjectMap.get(subjectCode) ?? null : null;
    const programId = batchId
      ? (
          await prisma.batch.findFirst({
            where: { id: batchId },
            select: { programId: true },
          })
        )?.programId ?? null
      : null;

    const resources: Array<{
      title: string;
      type: string;
      description: string;
      body: string;
      visibilityScope: string;
      audience: string;
      dueAt?: Date;
      maxMarks?: number;
      startsAt?: Date;
      endsAt?: Date;
      meetingUrl?: string;
      meetingPlatform?: string;
      attachment?: { fileName: string; storagePath: string };
    }> = [
      {
        title: branchQualifiedLearningTitle(branchCode, DEMO_LEARNING_TITLE_SUFFIXES[0]),
        type: 'note',
        description: 'Key points from this week’s lectures',
        body: '1. Subject-verb agreement\n2. Active vs passive voice\n3. Practice sentences for homework review.',
        visibilityScope: batchId ? 'batch' : 'branch',
        audience: 'students',
      },
      {
        title: branchQualifiedLearningTitle(branchCode, DEMO_LEARNING_TITLE_SUFFIXES[1]),
        type: 'material',
        description: 'Revision handout for midterms',
        body: 'Download the attached summary and complete the practice questions before class.',
        visibilityScope: batchId && subjectId ? 'batch_subject' : batchId ? 'batch' : 'branch',
        audience: 'all',
        attachment: {
          fileName: `${branchCode.toLowerCase()}-midterm-prep.pdf`,
          storagePath: `demo/learning/${branchCode.toLowerCase()}-midterm-prep.pdf`,
        },
      },
      {
        title: branchQualifiedLearningTitle(branchCode, DEMO_LEARNING_TITLE_SUFFIXES[2]),
        type: 'syllabus',
        description: 'Full term outline',
        body: 'Week 1–4: Language foundations\nWeek 5–8: Composition\nWeek 9–12: Exam preparation.',
        visibilityScope: batchId ? 'batch' : 'branch',
        audience: 'all',
      },
      {
        title: branchQualifiedLearningTitle(branchCode, DEMO_LEARNING_TITLE_SUFFIXES[3]),
        type: 'resource',
        description: 'Extra reading for parents and students',
        body: 'Recommended collections and online archives for additional practice.',
        visibilityScope: 'branch',
        audience: 'all',
      },
      {
        title: branchQualifiedLearningTitle(branchCode, DEMO_LEARNING_TITLE_SUFFIXES[4]),
        type: 'homework',
        description: 'Submit outline in class notebook',
        body: 'Write a 1-page outline on a topic of your choice using the structure taught in lecture.',
        visibilityScope: batchId ? 'batch' : 'branch',
        audience: 'all',
        dueAt: dueInDays(3),
        maxMarks: 10,
      },
      {
        title: branchQualifiedLearningTitle(branchCode, DEMO_LEARNING_TITLE_SUFFIXES[5]),
        type: 'homework',
        description: 'Timed practice from past papers',
        body: 'Attempt one past paper under timed conditions. Bring mistakes to the next class.',
        visibilityScope: batchId && subjectId ? 'batch_subject' : batchId ? 'batch' : 'branch',
        audience: 'students',
        dueAt: dueInDays(5),
        maxMarks: 20,
      },
      {
        title: branchQualifiedLearningTitle(branchCode, DEMO_LEARNING_TITLE_SUFFIXES[6]),
        type: 'homework',
        description: 'Study list for Friday quiz',
        body: 'Memorize vocabulary list units 1–3. Quiz is closed-book.',
        visibilityScope: batchId ? 'batch' : 'branch',
        audience: 'parents',
        dueAt: dueInDays(2),
        maxMarks: 15,
      },
      {
        title: branchQualifiedLearningTitle(branchCode, DEMO_LEARNING_TITLE_SUFFIXES[7]),
        type: 'online_class',
        description: 'Live workshop on essay structure and composition',
        body: 'Join the session for a guided walkthrough of essay planning, introductions, and conclusions.',
        visibilityScope: batchId && subjectId ? 'batch_subject' : batchId ? 'batch' : 'branch',
        audience: 'students',
        ...(() => {
          const { start, end } = tomorrowAt(10, 0, 90);
          return {
            startsAt: start,
            endsAt: end,
            meetingUrl: `https://meet.google.com/demo-${branchCode.toLowerCase()}`,
            meetingPlatform: 'meet',
          };
        })(),
      },
      {
        title: branchQualifiedLearningTitle(branchCode, DEMO_LEARNING_TITLE_SUFFIXES[8]),
        type: 'online_class',
        description: 'Open Q&A for parents about term progress and homework',
        body: 'Parents are welcome to join and ask questions about assignments, attendance, and upcoming assessments.',
        visibilityScope: batchId ? 'batch' : 'branch',
        audience: 'parents',
        ...(() => {
          const { start, end } = tomorrowAt(15, 30, 45);
          return {
            startsAt: start,
            endsAt: end,
            meetingUrl: `https://meet.google.com/demo-${branchCode.toLowerCase()}-ptm`,
            meetingPlatform: 'meet',
          };
        })(),
      },
    ];

    for (const item of resources) {
      const existing = await prisma.learningResource.findFirst({
        where: { branchId, title: item.title, deletedAt: null },
      });
      if (existing) continue;

      await prisma.learningResource.create({
        data: {
          branchId,
          type: item.type,
          title: item.title,
          description: item.description,
          body: item.body,
          programId:
            item.visibilityScope === 'program' || item.visibilityScope.startsWith('batch')
              ? programId
              : null,
          batchId: item.visibilityScope.startsWith('batch') ? batchId : null,
          subjectId: item.visibilityScope === 'batch_subject' ? subjectId : null,
          visibilityScope: item.visibilityScope,
          audience: item.audience,
          dueAt: item.dueAt ?? null,
          maxMarks: item.maxMarks ?? null,
          startsAt: item.startsAt ?? null,
          endsAt: item.endsAt ?? null,
          meetingUrl: item.meetingUrl ?? null,
          meetingPlatform: item.meetingPlatform ?? null,
          isPublished: true,
          publishedAt: new Date(),
          createdById: item.type === 'homework' || item.type === 'online_class' ? teacherId : adminId,
          attachments: item.attachment
            ? {
                create: {
                  fileName: item.attachment.fileName,
                  storagePath: item.attachment.storagePath,
                  mimeType: 'application/pdf',
                  sizeBytes: 102400,
                },
              }
            : undefined,
        },
      });
    }
  }
}
