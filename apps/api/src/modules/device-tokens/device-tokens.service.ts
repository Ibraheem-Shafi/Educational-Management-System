import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import type { AuthUser } from '@eims/types';
import type { RegisterDeviceTokenInput } from '@eims/shared';

@Injectable()
export class DeviceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(user: AuthUser, input: RegisterDeviceTokenInput) {
    const record = await this.prisma.devicePushToken.upsert({
      where: { token: input.token },
      create: {
        userId: user.id,
        token: input.token,
        platform: input.platform,
        appRole: input.appRole,
      },
      update: {
        userId: user.id,
        platform: input.platform,
        appRole: input.appRole,
      },
    });
    return { id: record.id, token: record.token };
  }

  async unregister(user: AuthUser, token: string) {
    await this.prisma.devicePushToken.deleteMany({
      where: { token, userId: user.id },
    });
    return { ok: true };
  }
}
