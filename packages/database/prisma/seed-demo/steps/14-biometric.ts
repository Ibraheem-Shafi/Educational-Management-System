import type { PrismaClient } from '@prisma/client';
import type { DemoContext } from '../types';

const DEMO_DEVICE_CODE = 'DEMO-BIO-MAIN-01';
const DEMO_DEVICE_NAME = 'Main Gate Terminal';

export async function seedBiometric(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const branchId =
    ctx.branchMap.get('MAIN') ?? ctx.branchMap.values().next().value ?? null;
  if (!branchId) return;

  const studentOne = ctx.studentIds.get('ali-khan');
  const studentTwo = ctx.studentIds.get('ayesha-malik');

  const existingDevice = await prisma.biometricDevice.findFirst({
    where: { deviceCode: DEMO_DEVICE_CODE },
  });
  if (existingDevice) {
    await prisma.biometricPunchLog.deleteMany({ where: { deviceId: existingDevice.id } });
    await prisma.biometricExternalId.deleteMany({ where: { deviceId: existingDevice.id } });
    await prisma.biometricDevice.delete({ where: { id: existingDevice.id } });
  }

  await prisma.biometricExternalId.deleteMany({
    where: {
      branchId,
      externalPersonId: { in: ['DEMO-1001', 'DEMO-1002'] },
    },
  });

  const device = await prisma.biometricDevice.create({
    data: {
      branchId,
      name: DEMO_DEVICE_NAME,
      vendor: 'generic',
      deviceCode: DEMO_DEVICE_CODE,
      location: 'Main entrance',
      isActive: true,
    },
  });

  if (studentOne) {
    await prisma.biometricExternalId.create({
      data: {
        branchId,
        deviceId: device.id,
        externalPersonId: 'DEMO-1001',
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
        externalPersonId: 'DEMO-1002',
        entityType: 'student',
        entityId: studentTwo,
      },
    });
  }
}

export { DEMO_DEVICE_CODE, DEMO_DEVICE_NAME };
