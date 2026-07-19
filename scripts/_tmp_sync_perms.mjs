import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@eims/shared';

const prisma = new PrismaClient();

const permissionMap = new Map();
for (const code of Object.values(PERMISSIONS)) {
  const name = code.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const moduleName = code.split('.')[0] ?? 'general';
  const perm = await prisma.permission.upsert({
    where: { code },
    create: { code, name, module: moduleName },
    update: {},
  });
  permissionMap.set(code, perm.id);
}
console.log('Permissions ensured:', permissionMap.size);

for (const [roleCode, permCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) {
    console.log('  skip (no role):', roleCode);
    continue;
  }
  const allowed = new Set();
  for (const permCode of permCodes) {
    const permissionId = permissionMap.get(permCode);
    if (!permissionId) continue;
    allowed.add(permissionId);
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId } },
      create: { roleId: role.id, permissionId },
      update: {},
    });
  }
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: role.id,
      ...(allowed.size > 0 ? { permissionId: { notIn: [...allowed] } } : {}),
    },
  });
  console.log('  synced role:', roleCode, '->', allowed.size, 'permissions');
}

await prisma.$disconnect();
