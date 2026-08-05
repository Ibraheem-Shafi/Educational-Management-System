import { Prisma, type PrismaClient } from '@prisma/client';
import { cleanupDemoData } from './cleanup';
import { loadDemoConfig } from './load-demo-config';
import { buildDemoContext } from './resolve-ids';
import { seedUsers } from './steps/01-users';
import { seedBatches } from './steps/02-batches';
import { seedStudentsAndParents } from './steps/03-students-parents';
import { seedAttendance } from './steps/04-attendance';
import { seedAssessments } from './steps/05-assessments';
import { seedFees } from './steps/06-fees';
import { seedNoticesTimetableDocs } from './steps/07-notices-timetable-docs';
import { seedCommsAndAudit } from './steps/08-comms-audit';
import { seedLearning } from './steps/09-learning';
import { seedFrontOfficeAndCertificates } from './steps/10-front-office-certificates';
import { seedLibrary } from './steps/11-library';
import { seedTransport } from './steps/12-transport';
import { seedPayroll } from './steps/13-payroll';
import { seedBiometric } from './steps/14-biometric';
import { seedHrAndLeave } from './steps/15-hr-leave';
import { seedAccounting } from './steps/16-accounting';
import { seedAiOperations } from './steps/17-ai-operations';
import { seedPrintTemplates } from './steps/18-print-templates';
import { DEMO_SEED_VERSION, type RunDemoSeedOptions } from './types';

async function getDemoSeedVersion(prisma: PrismaClient): Promise<string | null> {
  const settings = await prisma.institutionSettings.findUnique({ where: { id: 'default' } });
  if (!settings) return null;
  const terminology = settings.terminology as Record<string, unknown> | null;
  const v = terminology?._demoSeedVersion;
  return typeof v === 'string' ? v : null;
}

async function setDemoSeedVersion(
  prisma: PrismaClient,
  version: string,
  institution: import('./types').DemoConfig['institution'],
): Promise<void> {
  const settings = await prisma.institutionSettings.findUnique({ where: { id: 'default' } });
  const terminology = (settings?.terminology as Record<string, unknown>) ?? {};
  await prisma.institutionSettings.update({
    where: { id: 'default' },
    data: {
      terminology: { ...terminology, _demoSeedVersion: version },
      siblingDiscountPercent: new Prisma.Decimal(institution.siblingDiscountPercent),
      lateFeeAmount: new Prisma.Decimal(institution.lateFeeAmount),
      lateFeeDaysAfterDue: institution.lateFeeDaysAfterDue,
    },
  });
}

export async function runDemoSeed(
  prisma: PrismaClient,
  branchMap: Map<string, string>,
  roleMap: Map<string, string>,
  options: RunDemoSeedOptions = {},
): Promise<void> {
  const force = options.force ?? process.argv.includes('--force-demo');
  const config = loadDemoConfig(options.configPath);

  const currentVersion = await getDemoSeedVersion(prisma);
  if (currentVersion === config.version && !force) {
    console.log(`Demo seed v${config.version} already applied — skipping Phase 2.`);
    return;
  }

  if (force || (currentVersion && currentVersion !== config.version)) {
    console.log(
      force
        ? 'Force demo: removing demo-tagged records…'
        : `Upgrading demo ${currentVersion} → ${config.version}: cleaning prior demo records…`,
    );
    await cleanupDemoData(prisma, config);
  }

  console.log(`Seeding demo dataset (${config.version}, Pakistani coaching center)…`);

  const ctx = await buildDemoContext(prisma, branchMap, roleMap, config);

  console.log('  → users');
  await seedUsers(prisma, ctx);
  console.log('  → batches');
  await seedBatches(prisma, ctx);
  console.log('  → students & parents');
  await seedStudentsAndParents(prisma, ctx);
  console.log('  → attendance');
  await seedAttendance(prisma, ctx);
  console.log('  → assessments');
  await seedAssessments(prisma, ctx);
  console.log('  → fees');
  await seedFees(prisma, ctx);
  console.log('  → notices, timetable, documents');
  await seedNoticesTimetableDocs(prisma, ctx);
  console.log('  → communications & audit');
  await seedCommsAndAudit(prisma, ctx);
  console.log('  → learning content');
  await seedLearning(prisma, ctx);
  console.log('  → front office & certificates');
  await seedFrontOfficeAndCertificates(prisma, ctx);
  console.log('  → library');
  await seedLibrary(prisma, ctx);
  console.log('  → transport');
  await seedTransport(prisma, ctx);
  console.log('  → payroll');
  await seedPayroll(prisma, ctx);
  console.log('  → biometric');
  await seedBiometric(prisma, ctx);
  console.log('  → HR & leave');
  await seedHrAndLeave(prisma, ctx);
  console.log('  → accounting');
  await seedAccounting(prisma, ctx);
  console.log('  → AI operations');
  await seedAiOperations(prisma, ctx);
  console.log('  → print templates');
  await seedPrintTemplates(prisma);

  await setDemoSeedVersion(prisma, config.version, config.institution);

  console.log('');
  console.log('Demo dataset ready:');
  console.log(`  • ${ctx.studentIds.size} students across ${ctx.config.batches.length} batches`);
  console.log(`  • Branches: ${[...ctx.branchMap.keys()].join(', ')}`);
  console.log(`  • Run npm run db:seed:auth for Supabase login accounts (password in nexium.institution.json)`);
}

export { loadDemoConfig, DEMO_SEED_VERSION };
