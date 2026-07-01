import { PrismaClient } from '@prisma/client';

const THRESHOLDS = {
  students: 45,
  batches: 6,
  parents: 30,
  attendance: 500,
  assessments: 5,
  feeInvoices: 60,
  notices: 5,
  users: 8,
};

async function main() {
  const prisma = new PrismaClient();

  const [
    students,
    batches,
    parents,
    attendance,
    assessments,
    feeInvoices,
    notices,
    users,
    settings,
  ] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.batch.count({ where: { deletedAt: null } }),
    prisma.parent.count({ where: { deletedAt: null } }),
    prisma.attendanceRecord.count(),
    prisma.assessment.count(),
    prisma.feeInvoice.count(),
    prisma.notice.count(),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.institutionSettings.findUnique({ where: { id: 'default' } }),
  ]);

  const demoVersion = (settings?.terminology as Record<string, unknown>)?._demoSeedVersion;

  const checks = [
    { name: 'students', actual: students, min: THRESHOLDS.students },
    { name: 'batches', actual: batches, min: THRESHOLDS.batches },
    { name: 'parents', actual: parents, min: THRESHOLDS.parents },
    { name: 'attendance', actual: attendance, min: THRESHOLDS.attendance },
    { name: 'assessments', actual: assessments, min: THRESHOLDS.assessments },
    { name: 'feeInvoices', actual: feeInvoices, min: THRESHOLDS.feeInvoices },
    { name: 'notices', actual: notices, min: THRESHOLDS.notices },
    { name: 'users', actual: users, min: THRESHOLDS.users },
  ];

  console.log('Demo seed verification');
  console.log(`  demoSeedVersion: ${demoVersion ?? '(not set)'}`);
  console.log('');

  let failed = false;
  for (const c of checks) {
    const ok = c.actual >= c.min;
    if (!ok) failed = true;
    console.log(`  ${ok ? '✓' : '✗'} ${c.name}: ${c.actual} (need >= ${c.min})`);
  }

  if (demoVersion !== 'rekhta-v1') {
    console.log(`  ✗ demoSeedVersion should be rekhta-v1`);
    failed = true;
  }

  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
