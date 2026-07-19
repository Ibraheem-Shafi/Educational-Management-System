import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const roles = await prisma.role.findMany({
  select: {
    code: true,
    rolePermissions: { select: { permission: { select: { code: true } } } },
  },
});
for (const r of roles) {
  const perms = r.rolePermissions.map((rp) => rp.permission.code);
  console.log(
    r.code,
    '| count:',
    perms.length,
    '| leave.request:',
    perms.includes('leave.request'),
  );
}

const allPerms = await prisma.permission.findMany({ select: { code: true } });
console.log('\nTotal Permission rows:', allPerms.length);
console.log('leave.request exists as Permission:', allPerms.some((p) => p.code === 'leave.request'));
await prisma.$disconnect();
