import { PrismaClient } from '@prisma/client';
import { runDemoSeed } from './seed-demo';

const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany();
  const branchMap = new Map(branches.map((b) => [b.code, b.id]));
  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.code, r.id]));

  if (branchMap.size === 0 || roleMap.size === 0) {
    console.error('Foundation seed required first. Run: npm run db:seed');
    process.exit(1);
  }

  await runDemoSeed(prisma, branchMap, roleMap, { force: true });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
