import type { PrismaClient } from '@prisma/client';
import type { DemoContext } from '../types';

/** Demo learning titles — also used by cleanup. */
export const DEMO_LEARNING_TITLES = [
  'Weekly class notes — Grammar focus',
  'CSS Midterm preparation material',
  'Batch syllabus — Morning CSS 2026',
  'Useful Urdu literature reading list',
  'Homework: Essay outline (due this week)',
  'Homework: Past paper practice set',
  'Homework: Vocabulary quiz prep',
] as const;

export async function seedLearning(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;
  const teacherId = ctx.userIds.get('ahmed.teacher@nexium.edu.pk') ?? adminId;
  const mainBranchId = ctx.branchMap.get('MAIN');
  if (!mainBranchId) return;

  const firstBatch = ctx.config.batches.find((b) => b.branchCode === 'MAIN');
  const batchId = firstBatch ? ctx.batchMap.get(firstBatch.code) : null;
  const subjectCode = firstBatch?.subjects[0];
  const subjectId = subjectCode ? ctx.subjectMap.get(subjectCode) : null;
  const programId = firstBatch
    ? (
        await prisma.batch.findFirst({
          where: { id: batchId ?? undefined },
          select: { programId: true },
        })
      )?.programId ?? null
    : null;

  const dueInDays = (days: number) => {
    const d = new Date();
    d.setUTCHours(23, 59, 59, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  };

  const resources: Array<{
    title: string;
    type: string;
    description: string;
    body: string;
    visibilityScope: string;
    audience: string;
    dueAt?: Date;
    maxMarks?: number;
    attachment?: { fileName: string; storagePath: string };
  }> = [
    {
      title: DEMO_LEARNING_TITLES[0],
      type: 'note',
      description: 'Key points from this week’s lectures',
      body: '1. Subject-verb agreement\n2. Active vs passive voice\n3. Practice sentences for homework review.',
      visibilityScope: batchId ? 'batch' : 'branch',
      audience: 'students',
    },
    {
      title: DEMO_LEARNING_TITLES[1],
      type: 'material',
      description: 'Revision handout for midterms',
      body: 'Download the attached summary and complete the practice questions before class.',
      visibilityScope: batchId && subjectId ? 'batch_subject' : batchId ? 'batch' : 'branch',
      audience: 'all',
      attachment: {
        fileName: 'css-midterm-prep.pdf',
        storagePath: 'demo/learning/css-midterm-prep.pdf',
      },
    },
    {
      title: DEMO_LEARNING_TITLES[2],
      type: 'syllabus',
      description: 'Full term outline',
      body: 'Week 1–4: Language foundations\nWeek 5–8: Composition\nWeek 9–12: Exam preparation.',
      visibilityScope: batchId ? 'batch' : 'branch',
      audience: 'all',
      attachment: {
        fileName: 'batch-syllabus.pdf',
        storagePath: 'demo/learning/batch-syllabus.pdf',
      },
    },
    {
      title: DEMO_LEARNING_TITLES[3],
      type: 'resource',
      description: 'Extra reading for parents and students',
      body: 'Recommended collections and online archives for additional practice.',
      visibilityScope: 'branch',
      audience: 'all',
    },
    {
      title: DEMO_LEARNING_TITLES[4],
      type: 'homework',
      description: 'Submit outline in class notebook',
      body: 'Write a 1-page outline on a topic of your choice using the structure taught in lecture.',
      visibilityScope: batchId ? 'batch' : 'branch',
      audience: 'all',
      dueAt: dueInDays(3),
      maxMarks: 10,
    },
    {
      title: DEMO_LEARNING_TITLES[5],
      type: 'homework',
      description: 'Timed practice from past papers',
      body: 'Attempt one past paper under timed conditions. Bring mistakes to the next class.',
      visibilityScope: batchId && subjectId ? 'batch_subject' : batchId ? 'batch' : 'branch',
      audience: 'students',
      dueAt: dueInDays(5),
      maxMarks: 20,
    },
    {
      title: DEMO_LEARNING_TITLES[6],
      type: 'homework',
      description: 'Study list for Friday quiz',
      body: 'Memorize vocabulary list units 1–3. Quiz is closed-book.',
      visibilityScope: batchId ? 'batch' : 'branch',
      audience: 'parents',
      dueAt: dueInDays(2),
      maxMarks: 15,
    },
  ];

  for (const item of resources) {
    const existing = await prisma.learningResource.findFirst({
      where: { branchId: mainBranchId, title: item.title, deletedAt: null },
    });
    if (existing) continue;

    await prisma.learningResource.create({
      data: {
        branchId: mainBranchId,
        type: item.type,
        title: item.title,
        description: item.description,
        body: item.body,
        programId: item.visibilityScope === 'program' || item.visibilityScope.startsWith('batch') ? programId : null,
        batchId: item.visibilityScope.startsWith('batch') ? batchId : null,
        subjectId: item.visibilityScope === 'batch_subject' ? subjectId : null,
        visibilityScope: item.visibilityScope,
        audience: item.audience,
        dueAt: item.dueAt ?? null,
        maxMarks: item.maxMarks ?? null,
        isPublished: true,
        publishedAt: new Date(),
        createdById: item.type === 'homework' ? teacherId : adminId,
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
