import type { PrismaClient } from '@prisma/client';
import type { DemoContext } from './types';

export async function loadLookupStatusIds(prisma: PrismaClient) {
  const categories = await prisma.lookupCategory.findMany({
    where: { code: { in: ['student_status', 'attendance_status', 'fee_status'] } },
    include: { statuses: true },
  });

  const pick = (cat: string) => {
    const c = categories.find((x) => x.code === cat);
    if (!c) throw new Error(`Lookup category missing: ${cat}`);
    return Object.fromEntries(c.statuses.map((s) => [s.code, s.id]));
  };

  return {
    student: pick('student_status') as Record<string, string>,
    attendance: pick('attendance_status') as Record<string, string>,
    fee: pick('fee_status') as Record<string, string>,
  };
}

export async function buildDemoContext(
  prisma: PrismaClient,
  branchMap: Map<string, string>,
  roleMap: Map<string, string>,
  config: import('./types').DemoConfig,
): Promise<DemoContext> {
  const statusIds = await loadLookupStatusIds(prisma);

  const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  if (!session) throw new Error('No current academic session — run foundation seed first');

  const subjects = await prisma.subject.findMany({ where: { deletedAt: null } });
  const subjectMap = new Map(subjects.map((s) => [s.code ?? s.name, s.id]));

  const programs = await prisma.program.findMany({ where: { deletedAt: null } });
  const programMap = new Map<string, string>();
  for (const p of programs) {
    const branch = await prisma.branch.findUnique({ where: { id: p.branchId } });
    if (branch?.code && p.code) programMap.set(`${branch.code}:${p.code}`, p.id);
  }

  const feeTypes = await prisma.feeType.findMany();
  const feeTypeMap = new Map(feeTypes.map((f) => [f.code, f.id]));

  const assessmentTypes = await prisma.assessmentType.findMany();
  const assessmentTypeMap = new Map(assessmentTypes.map((a) => [a.code, a.id]));

  const series = await prisma.assessmentSeries.findMany();
  const seriesMap = new Map(series.map((s) => [s.code, s.id]));

  return {
    branchMap,
    roleMap,
    subjectMap,
    programMap,
    batchMap: new Map(),
    feeTypeMap,
    assessmentTypeMap,
    seriesMap,
    sessionId: session.id,
    statusIds,
    userIds: new Map(),
    studentIds: new Map(),
    parentIds: new Map(),
    config,
  };
}
