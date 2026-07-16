import type { PrismaClient } from '@prisma/client';
import { deterministicUuid } from '../utils';
import type { DemoContext } from '../types';

export async function seedUsers(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  for (const account of ctx.config.accounts) {
    const roleId = ctx.roleMap.get(account.role);
    if (!roleId) throw new Error(`Role not found: ${account.role}`);

    const branchId = account.branchCode ? ctx.branchMap.get(account.branchCode) ?? null : null;

    const existing = await prisma.user.findFirst({
      where: { email: account.email, deletedAt: null },
    });

    const user =
      existing ??
      (await prisma.user.create({
        data: {
          supabaseUserId: deterministicUuid(account.email),
          email: account.email,
          fullName: account.fullName,
          phone: account.phone ?? null,
          gender: account.gender ?? null,
          cnic: account.cnic ?? null,
          branchId,
        },
      }));

    if (existing && (account.gender || account.cnic)) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(account.gender ? { gender: account.gender } : {}),
          ...(account.cnic ? { cnic: account.cnic } : {}),
        },
      });
    }

    const existingRole = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId },
    });
    if (!existingRole) {
      await prisma.userRole.create({ data: { userId: user.id, roleId, branchId } });
    }

    ctx.userIds.set(account.email, user.id);
  }

  await prisma.invitation.updateMany({
    where: { email: 'admin@nexium.edu.pk', acceptedAt: null },
    data: { acceptedAt: new Date() },
  });
}
