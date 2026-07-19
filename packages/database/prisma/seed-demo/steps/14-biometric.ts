import type { PrismaClient } from '@prisma/client';
import {
  configuredBranchCodes,
  featuredStudentDemoKey,
  secondaryStudentDemoKey,
} from '../branch-helpers';
import type { DemoContext } from '../types';

function deviceCodeFor(branchCode: string): string {
  return `DEMO-BIO-${branchCode}-01`;
}

function deviceNameFor(branchCode: string): string {
  return branchCode === 'LAHORE' ? 'Lahore Gate Terminal' : 'Main Gate Terminal';
}

function externalIdsFor(branchCode: string): [string, string] {
  return branchCode === 'LAHORE' ? ['DEMO-LHR-1001', 'DEMO-LHR-1002'] : ['DEMO-1001', 'DEMO-1002'];
}

export const DEMO_DEVICE_CODES = ['DEMO-BIO-MAIN-01', 'DEMO-BIO-LAHORE-01'] as const;

export async function seedBiometric(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const deviceCode = deviceCodeFor(branchCode);
    const [extOne, extTwo] = externalIdsFor(branchCode);
    const studentOne = ctx.studentIds.get(featuredStudentDemoKey(branchCode));
    const studentTwo = ctx.studentIds.get(secondaryStudentDemoKey(branchCode));

    const existingDevice = await prisma.biometricDevice.findFirst({
      where: { deviceCode },
    });
    if (existingDevice) {
      await prisma.biometricPunchLog.deleteMany({ where: { deviceId: existingDevice.id } });
      await prisma.biometricExternalId.deleteMany({ where: { deviceId: existingDevice.id } });
      await prisma.biometricDevice.delete({ where: { id: existingDevice.id } });
    }

    await prisma.biometricExternalId.deleteMany({
      where: {
        branchId,
        externalPersonId: { in: [extOne, extTwo] },
      },
    });

    const device = await prisma.biometricDevice.create({
      data: {
        branchId,
        name: deviceNameFor(branchCode),
        vendor: 'generic',
        deviceCode,
        location: branchCode === 'LAHORE' ? 'Gulberg entrance' : 'Main entrance',
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    if (studentOne) {
      await prisma.biometricExternalId.create({
        data: {
          branchId,
          deviceId: device.id,
          externalPersonId: extOne,
          entityType: 'student',
          entityId: studentOne,
        },
      });
    }

    if (studentTwo) {
      await prisma.biometricExternalId.create({
        data: {
          branchId,
          deviceId: device.id,
          externalPersonId: extTwo,
          entityType: 'student',
          entityId: studentTwo,
        },
      });
    }

    const punches: Array<{ externalPersonId: string; hoursAgo: number }> = [];
    if (studentOne) punches.push({ externalPersonId: extOne, hoursAgo: 2 });
    if (studentTwo) punches.push({ externalPersonId: extTwo, hoursAgo: 5 });
    punches.push({ externalPersonId: 'UNMATCHED-999', hoursAgo: 1 });

    for (const punch of punches) {
      const punchedAt = new Date(Date.now() - punch.hoursAgo * 3600000);
      await prisma.biometricPunchLog.create({
        data: {
          deviceId: device.id,
          externalPersonId: punch.externalPersonId,
          punchedAt,
          matched: punch.externalPersonId !== 'UNMATCHED-999',
          payload: { _demo: true, branchCode },
        },
      });
    }
  }
}

export { deviceCodeFor, deviceNameFor };
