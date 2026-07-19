import { prismaBranchFilter } from '../../common/utils/branch-scope.util';
import { selectedBranchScope } from '@eims/shared';
import type { BranchScope } from '@eims/shared';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { paginatedResult } from '../../common/utils/pagination.util';
import { LookupCacheService } from '../../common/lookup/lookup-cache.service';
import { AuditService } from '../audit/audit.service';
import {
  ATTENDANCE_ENTITY_STAFF,
  ATTENDANCE_ENTITY_STUDENT,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BiometricPunchWebhookInput,
  CreateBiometricDeviceInput,
  CreateBiometricMappingInput,
  ListBiometricDevicesQuery,
  ListBiometricMappingsQuery,
  ListBiometricPunchLogsQuery,
  UpdateBiometricDeviceInput,
  UpdateBiometricMappingInput,
} from '@eims/shared';

function parseDateOnlyFromPunch(punchedAt: Date): Date {
  return new Date(
    Date.UTC(punchedAt.getUTCFullYear(), punchedAt.getUTCMonth(), punchedAt.getUTCDate()),
  );
}

@Injectable()
export class BiometricService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookupCache: LookupCacheService,
    private readonly audit: AuditService,
  ) {}

  private async assertDeviceInBranch(deviceId: string, scope: BranchScope) {
    const device = await this.prisma.biometricDevice.findFirst({
      where: { id: deviceId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  private async assertMappingInBranch(mappingId: string, scope: BranchScope) {
    const mapping = await this.prisma.biometricExternalId.findFirst({
      where: { id: mappingId, ...prismaBranchFilter(scope) },
    });
    if (!mapping) throw new NotFoundException('Mapping not found');
    return mapping;
  }

  private async validateEntity(
    branchId: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    if (entityType === 'student') {
      const student = await this.prisma.student.findFirst({
        where: { id: entityId, branchId, deletedAt: null },
        select: { id: true },
      });
      if (!student) throw new BadRequestException('Student not found in branch');
      return;
    }
    if (entityType === 'user') {
      const user = await this.prisma.user.findFirst({
        where: { id: entityId, branchId, deletedAt: null },
        select: { id: true },
      });
      if (!user) throw new BadRequestException('User not found in branch');
      return;
    }
    throw new BadRequestException('Invalid entity type');
  }

  // --- Devices ---

  async findAllDevices(query: ListBiometricDevicesQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const where = {
      deletedAt: null,
      ...prismaBranchFilter(effective),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { deviceCode: { contains: query.search, mode: 'insensitive' as const } },
              { location: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [devices, total] = await Promise.all([
      this.prisma.biometricDevice.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { externalIds: true, punchLogs: true } },
        },
      }),
      this.prisma.biometricDevice.count({ where }),
    ]);

    return paginatedResult(devices, total, page, limit);
  }

  async findOneDevice(id: string, scope: BranchScope) {
    const device = await this.assertDeviceInBranch(id, scope);
    return {
      ...device,
      _count: await this.prisma.biometricExternalId.count({ where: { deviceId: id } }),
    };
  }

  async createDevice(input: CreateBiometricDeviceInput, user: AuthUser) {
    const existing = await this.prisma.biometricDevice.findFirst({
      where: { deviceCode: input.deviceCode, deletedAt: null },
    });
    if (existing) throw new BadRequestException('Device code already in use');

    const device = await this.prisma.biometricDevice.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        vendor: input.vendor ?? 'generic',
        deviceCode: input.deviceCode,
        location: input.location ?? null,
        isActive: input.isActive ?? true,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'biometric.device.created',
      entityType: 'BiometricDevice',
      entityId: device.id,
      newValue: { name: device.name, deviceCode: device.deviceCode },
    });

    return device;
  }

  async updateDevice(
    id: string,
    input: UpdateBiometricDeviceInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    await this.assertDeviceInBranch(id, scope);

    if (input.deviceCode) {
      const existing = await this.prisma.biometricDevice.findFirst({
        where: { deviceCode: input.deviceCode, deletedAt: null, NOT: { id } },
      });
      if (existing) throw new BadRequestException('Device code already in use');
    }

    const device = await this.prisma.biometricDevice.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
        ...(input.deviceCode !== undefined ? { deviceCode: input.deviceCode } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'biometric.device.updated',
      entityType: 'BiometricDevice',
      entityId: device.id,
      newValue: input,
    });

    return device;
  }

  async removeDevice(id: string, user: AuthUser, scope: BranchScope) {
    await this.assertDeviceInBranch(id, scope);
    await this.prisma.biometricDevice.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      userId: user.id,
      action: 'biometric.device.removed',
      entityType: 'BiometricDevice',
      entityId: id,
    });

    return { id, removed: true };
  }

  // --- Mappings ---

  async findAllMappings(query: ListBiometricMappingsQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const where = {
      ...prismaBranchFilter(effective),
      ...(query.deviceId ? { deviceId: query.deviceId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.search
        ? {
            OR: [
              { externalPersonId: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [mappings, total] = await Promise.all([
      this.prisma.biometricExternalId.findMany({
        where,
        orderBy: { externalPersonId: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { device: { select: { id: true, name: true, deviceCode: true } } },
      }),
      this.prisma.biometricExternalId.count({ where }),
    ]);

    const studentIds = mappings.filter((m) => m.entityType === 'student').map((m) => m.entityId);
    const userIds = mappings.filter((m) => m.entityType === 'user').map((m) => m.entityId);

    const [students, users] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, fullName: true, phone: true },
          })
        : [],
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, email: true },
          })
        : [],
    ]);

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = mappings.map((mapping) => ({
      ...mapping,
      entity:
        mapping.entityType === 'student'
          ? (studentMap.get(mapping.entityId) ?? null)
          : mapping.entityType === 'user'
            ? (userMap.get(mapping.entityId) ?? null)
            : null,
    }));

    return paginatedResult(data, total, page, limit);
  }

  async createMapping(input: CreateBiometricMappingInput, user: AuthUser) {
    await this.validateEntity(input.branchId, input.entityType, input.entityId);

    if (input.deviceId) {
      await this.assertDeviceInBranch(input.deviceId, selectedBranchScope([input.branchId]));
    }

    const existing = await this.prisma.biometricExternalId.findUnique({
      where: {
        branchId_externalPersonId: {
          branchId: input.branchId,
          externalPersonId: input.externalPersonId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('External person ID already mapped in this branch');
    }

    const mapping = await this.prisma.biometricExternalId.create({
      data: {
        branchId: input.branchId,
        externalPersonId: input.externalPersonId,
        entityType: input.entityType,
        entityId: input.entityId,
        deviceId: input.deviceId ?? null,
      },
      include: { device: { select: { id: true, name: true, deviceCode: true } } },
    });

    await this.audit.log({
      userId: user.id,
      action: 'biometric.mapping.created',
      entityType: 'BiometricExternalId',
      entityId: mapping.id,
      newValue: {
        externalPersonId: mapping.externalPersonId,
        entityType: mapping.entityType,
        entityId: mapping.entityId,
      },
    });

    return mapping;
  }

  async updateMapping(
    id: string,
    input: UpdateBiometricMappingInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.assertMappingInBranch(id, scope);
    const effectiveBranchId = existing.branchId;

    if (input.entityType && input.entityId) {
      await this.validateEntity(effectiveBranchId, input.entityType, input.entityId);
    } else if (input.entityId) {
      await this.validateEntity(effectiveBranchId, input.entityType ?? existing.entityType, input.entityId);
    } else if (input.entityType && input.entityType !== existing.entityType) {
      await this.validateEntity(effectiveBranchId, input.entityType, existing.entityId);
    }

    if (input.deviceId) {
      await this.assertDeviceInBranch(input.deviceId, selectedBranchScope([effectiveBranchId]));
    }

    if (input.externalPersonId && input.externalPersonId !== existing.externalPersonId) {
      const conflict = await this.prisma.biometricExternalId.findUnique({
        where: {
          branchId_externalPersonId: {
            branchId: effectiveBranchId,
            externalPersonId: input.externalPersonId,
          },
        },
      });
      if (conflict && conflict.id !== id) {
        throw new BadRequestException('External person ID already mapped in this branch');
      }
    }

    const mapping = await this.prisma.biometricExternalId.update({
      where: { id },
      data: {
        ...(input.externalPersonId !== undefined ? { externalPersonId: input.externalPersonId } : {}),
        ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
        ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
        ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
      },
      include: { device: { select: { id: true, name: true, deviceCode: true } } },
    });

    await this.audit.log({
      userId: user.id,
      action: 'biometric.mapping.updated',
      entityType: 'BiometricExternalId',
      entityId: mapping.id,
      newValue: input,
    });

    return mapping;
  }

  async removeMapping(id: string, user: AuthUser, scope: BranchScope) {
    await this.assertMappingInBranch(id, scope);
    await this.prisma.biometricExternalId.delete({ where: { id } });

    await this.audit.log({
      userId: user.id,
      action: 'biometric.mapping.removed',
      entityType: 'BiometricExternalId',
      entityId: id,
    });

    return { id, removed: true };
  }

  // --- Punch logs ---

  async findAllPunchLogs(query: ListBiometricPunchLogsQuery, scope: BranchScope) {
    const effective =
      scope.kind === 'selected'
        ? scope
        : query.branchId
          ? selectedBranchScope([query.branchId])
          : scope;
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const deviceFilter =
      effective.kind === 'selected' || query.deviceId
        ? {
            device: {
              deletedAt: null,
              ...prismaBranchFilter(effective),
              ...(query.deviceId ? { id: query.deviceId } : {}),
            },
          }
        : {};

    const where = {
      ...deviceFilter,
      ...(query.externalPersonId ? { externalPersonId: query.externalPersonId } : {}),
      ...(query.matched !== undefined ? { matched: query.matched } : {}),
      ...(query.from || query.to
        ? {
            punchedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.biometricPunchLog.findMany({
        where,
        orderBy: { punchedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          device: { select: { id: true, name: true, deviceCode: true, branchId: true } },
        },
      }),
      this.prisma.biometricPunchLog.count({ where }),
    ]);

    return paginatedResult(logs, total, page, limit);
  }

  // --- Webhook ---

  async handlePunchWebhook(input: BiometricPunchWebhookInput, user?: AuthUser) {
    const device = await this.prisma.biometricDevice.findFirst({
      where: { deviceCode: input.deviceCode, isActive: true, deletedAt: null },
    });
    if (!device) throw new NotFoundException('Biometric device not found or inactive');

    const punchedAt = input.punchedAt ? new Date(input.punchedAt) : new Date();
    const mapping = await this.prisma.biometricExternalId.findUnique({
      where: {
        branchId_externalPersonId: {
          branchId: device.branchId,
          externalPersonId: input.externalPersonId,
        },
      },
    });

    let attendanceRecordId: string | null = null;
    let matched = false;

    if (mapping) {
      const statusCode = input.statusCode ?? 'present';
      const statusId = await this.lookupCache.getStatusId('attendance_status', statusCode);
      if (!statusId) {
        throw new BadRequestException(`Invalid attendance status code: ${statusCode}`);
      }

      const date = parseDateOnlyFromPunch(punchedAt);
      const markedById = user?.id ?? null;

      if (mapping.entityType === 'student') {
        const attendance = await this.prisma.attendanceRecord.upsert({
          where: {
            entityType_entityId_date: {
              entityType: ATTENDANCE_ENTITY_STUDENT,
              entityId: mapping.entityId,
              date,
            },
          },
          create: {
            branchId: device.branchId,
            entityType: ATTENDANCE_ENTITY_STUDENT,
            entityId: mapping.entityId,
            date,
            statusId,
            remarks: 'Biometric punch',
            markedById,
          },
          update: {
            statusId,
            remarks: 'Biometric punch',
            markedById,
          },
        });
        attendanceRecordId = attendance.id;
        matched = true;
      } else if (mapping.entityType === 'user') {
        const attendance = await this.prisma.attendanceRecord.upsert({
          where: {
            entityType_entityId_date: {
              entityType: ATTENDANCE_ENTITY_STAFF,
              entityId: mapping.entityId,
              date,
            },
          },
          create: {
            branchId: device.branchId,
            entityType: ATTENDANCE_ENTITY_STAFF,
            entityId: mapping.entityId,
            date,
            statusId,
            remarks: 'Biometric punch',
            markedById,
          },
          update: {
            statusId,
            remarks: 'Biometric punch',
            markedById,
          },
        });
        attendanceRecordId = attendance.id;
        matched = true;
      }
    }

    const [punchLog] = await this.prisma.$transaction([
      this.prisma.biometricPunchLog.create({
        data: {
          deviceId: device.id,
          externalPersonId: input.externalPersonId,
          punchedAt,
          payload: input as object,
          matched,
          attendanceRecordId,
        },
      }),
      this.prisma.biometricDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: punchedAt },
      }),
    ]);

    if (user) {
      await this.audit.log({
        userId: user.id,
        action: 'biometric.punch.received',
        entityType: 'BiometricPunchLog',
        entityId: punchLog.id,
        newValue: {
          deviceCode: input.deviceCode,
          externalPersonId: input.externalPersonId,
          matched,
        },
      });
    }

    return {
      id: punchLog.id,
      matched,
      attendanceRecordId,
      punchedAt: punchLog.punchedAt.toISOString(),
      deviceId: device.id,
    };
  }
}
