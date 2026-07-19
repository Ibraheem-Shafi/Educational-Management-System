import { PrismaClient } from '@prisma/client';
import { DEMO_SEED_VERSION } from './seed-demo/types';
import { DEMO_BRANCH_CODES } from './seed-demo/branch-helpers';

const GLOBAL_THRESHOLDS = {
  students: 45,
  batches: 6,
  parents: 30,
  attendance: 500,
  assessments: 8,
  feeInvoices: 90,
  notices: 7,
  users: 11,
};

const PER_BRANCH_MIN = {
  students: 10,
  batches: 2,
  attendance: 100,
  assessments: 2,
  feeInvoices: 20,
  feePayments: 5,
  notices: 2,
  timetable: 3,
  documents: 1,
  learning: 5,
  inquiries: 2,
  libraryBooks: 2,
  transportRoutes: 1,
  payrollRuns: 1,
  biometricDevices: 1,
  punchLogs: 1,
  contracts: 2,
  leaveRequests: 1,
  journalVouchers: 1,
  budgets: 1,
  ocrSessions: 1,
};

async function main() {
  const prisma = new PrismaClient();
  let failed = false;

  const settings = await prisma.institutionSettings.findUnique({ where: { id: 'default' } });
  const demoVersion = (settings?.terminology as Record<string, unknown>)?._demoSeedVersion;

  console.log('Demo seed verification');
  console.log(`  demoSeedVersion: ${demoVersion ?? '(not set)'}`);
  console.log('');

  const [
    students,
    batches,
    parents,
    attendance,
    assessments,
    feeInvoices,
    notices,
    users,
  ] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.batch.count({ where: { deletedAt: null } }),
    prisma.parent.count({ where: { deletedAt: null } }),
    prisma.attendanceRecord.count(),
    prisma.assessment.count(),
    prisma.feeInvoice.count(),
    prisma.notice.count(),
    prisma.user.count({ where: { deletedAt: null } }),
  ]);

  const globalChecks = [
    { name: 'students', actual: students, min: GLOBAL_THRESHOLDS.students },
    { name: 'batches', actual: batches, min: GLOBAL_THRESHOLDS.batches },
    { name: 'parents', actual: parents, min: GLOBAL_THRESHOLDS.parents },
    { name: 'attendance', actual: attendance, min: GLOBAL_THRESHOLDS.attendance },
    { name: 'assessments', actual: assessments, min: GLOBAL_THRESHOLDS.assessments },
    { name: 'feeInvoices', actual: feeInvoices, min: GLOBAL_THRESHOLDS.feeInvoices },
    { name: 'notices', actual: notices, min: GLOBAL_THRESHOLDS.notices },
    { name: 'users', actual: users, min: GLOBAL_THRESHOLDS.users },
  ];

  console.log('Global totals');
  for (const c of globalChecks) {
    const ok = c.actual >= c.min;
    if (!ok) failed = true;
    console.log(`  ${ok ? '✓' : '✗'} ${c.name}: ${c.actual} (need >= ${c.min})`);
  }

  if (demoVersion !== DEMO_SEED_VERSION) {
    console.log(`  ✗ demoSeedVersion should be ${DEMO_SEED_VERSION}`);
    failed = true;
  } else {
    console.log(`  ✓ demoSeedVersion: ${demoVersion}`);
  }

  console.log('');
  console.log('Per-branch matrix');

  for (const code of DEMO_BRANCH_CODES) {
    const branch = await prisma.branch.findFirst({ where: { code } });
    if (!branch) {
      console.log(`  ✗ ${code}: branch missing`);
      failed = true;
      continue;
    }

    const branchId = branch.id;
    const counts = {
      students: await prisma.student.count({ where: { branchId, deletedAt: null } }),
      batches: await prisma.batch.count({ where: { branchId, deletedAt: null } }),
      attendance: await prisma.attendanceRecord.count({ where: { branchId } }),
      assessments: await prisma.assessment.count({ where: { branchId } }),
      feeInvoices: await prisma.feeInvoice.count({ where: { branchId } }),
      feePayments: await prisma.feePayment.count({ where: { branchId } }),
      notices: await prisma.notice.count({ where: { branchId } }),
      timetable: await prisma.timetableSlot.count({ where: { branchId } }),
      documents: await prisma.document.count({ where: { branchId } }),
      learning: await prisma.learningResource.count({
        where: { branchId, deletedAt: null },
      }),
      inquiries: await prisma.admissionInquiry.count({ where: { branchId } }),
      libraryBooks: await prisma.libraryBook.count({
        where: { branchId, deletedAt: null },
      }),
      transportRoutes: await prisma.transportRoute.count({
        where: { branchId, deletedAt: null },
      }),
      payrollRuns: await prisma.payrollRun.count({ where: { branchId } }),
      biometricDevices: await prisma.biometricDevice.count({
        where: { branchId, deletedAt: null },
      }),
      punchLogs: await prisma.biometricPunchLog.count({
        where: { device: { branchId } },
      }),
      contracts: await prisma.employmentContract.count({
        where: { branchId, deletedAt: null },
      }),
      leaveRequests: await prisma.leaveRequest.count({
        where: {
          OR: [
            { user: { branchId } },
            { student: { branchId } },
          ],
        },
      }),
      journalVouchers: await prisma.journalVoucher.count({ where: { branchId } }),
      budgets: await prisma.budget.count({ where: { branchId } }),
      ocrSessions: await prisma.attendanceOcrSession.count({ where: { branchId } }),
    };

    console.log(`  ${code}`);
    for (const [key, min] of Object.entries(PER_BRANCH_MIN)) {
      const actual = counts[key as keyof typeof counts];
      const ok = actual >= min;
      if (!ok) failed = true;
      console.log(`    ${ok ? '✓' : '✗'} ${key}: ${actual} (need >= ${min})`);
    }

    // Cross-branch integrity samples
    const badInvoices = await prisma.feeInvoice.count({
      where: {
        branchId,
        student: { branchId: { not: branchId } },
      },
    });
    const badAssessments = await prisma.assessmentRecord.count({
      where: {
        assessment: { branchId },
        student: { branchId: { not: branchId } },
      },
    });
    const badTimetableSlots = await prisma.timetableSlot.findMany({
      where: { branchId },
      select: { id: true, batchId: true },
    });
    const batchIdsForBranch = new Set(
      (
        await prisma.batch.findMany({
          where: { branchId },
          select: { id: true },
        })
      ).map((b) => b.id),
    );
    const badTimetable = badTimetableSlots.filter((s) => !batchIdsForBranch.has(s.batchId)).length;

    for (const [label, count] of [
      ['invoice/student branch mismatch', badInvoices],
      ['assessment/student branch mismatch', badAssessments],
      ['timetable/batch branch mismatch', badTimetable],
    ] as const) {
      const ok = count === 0;
      if (!ok) failed = true;
      console.log(`    ${ok ? '✓' : '✗'} ${label}: ${count}`);
    }
  }

  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
