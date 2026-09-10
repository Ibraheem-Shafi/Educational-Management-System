import type { PrismaClient } from '@prisma/client';
import { codesFromAccessFlags, type AccessModuleFlag } from '@eims/shared';

const CUSTOM_SEED_TEMPLATES: {
  code: string;
  name: string;
  flags: AccessModuleFlag[];
}[] = [
  {
    code: 'fee_collector',
    name: 'Fee Collector',
    flags: [
      { moduleId: 'students', view: true, edit: false },
      { moduleId: 'fees', view: true, edit: true },
      { moduleId: 'reports', view: true, edit: false },
    ],
  },
  {
    code: 'hr_finance',
    name: 'HR & Finance Officer',
    flags: [
      { moduleId: 'hr', view: true, edit: true },
      { moduleId: 'payroll', view: true, edit: true },
      { moduleId: 'accounting', view: true, edit: true },
      { moduleId: 'documents', view: true, edit: true },
      { moduleId: 'leave', view: true, edit: true },
      { moduleId: 'reports', view: true, edit: false },
    ],
  },
];

/** Non-system templates used by Shahwali demo staff. Seeded once; later admin edits survive. */
export async function ensureCustomAccessTemplates(
  prisma: PrismaClient,
  roleMap: Map<string, string>,
): Promise<void> {
  for (const template of CUSTOM_SEED_TEMPLATES) {
    const role = await prisma.role.upsert({
      where: { code: template.code },
      create: { code: template.code, name: template.name, isSystem: false },
      update: {},
    });
    roleMap.set(template.code, role.id);

    const existingCount = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existingCount > 0) continue;

    const codes = codesFromAccessFlags(template.flags);
    const permissions = await prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    if (!permissions.length) continue;

    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }
}
