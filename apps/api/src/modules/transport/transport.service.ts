import { narrowScope, prismaBranchFilter } from '../../common/utils/branch-scope.util';
import { selectedBranchScope } from '@eims/shared';
import type { BranchScope } from '@eims/shared';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginatedResult } from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '@eims/types';
import type {
  BulkTransportAttendanceInput,
  CreateStudentTransportInput,
  CreateTransportRouteInput,
  CreateTransportTripInput,
  CreateTransportVehicleDocumentInput,
  CreateTransportVehicleInput,
  ListStudentTransportQuery,
  ListTransportRoutesQuery,
  ListTransportTripsQuery,
  ListTransportVehiclesQuery,
  TransportGpsWebhookInput,
  UpdateStudentTransportInput,
  UpdateTransportRouteInput,
  UpdateTransportTripInput,
  UpdateTransportVehicleInput,
} from '@eims/shared';

const vehicleInclude = {
  staffAssignments: {
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true } },
    },
  },
  documents: true,
  _count: { select: { trips: true } },
} as const;

const routeInclude = {
  stops: { orderBy: { sequence: 'asc' as const } },
  _count: { select: { assignments: { where: { deletedAt: null } }, trips: true } },
} as const;

@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private parseTripDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid trip date');
    }
    return date;
  }

  private async assertRouteInBranch(routeId: string, branchId: string) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: routeId, branchId, deletedAt: null },
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  private async assertVehicleInBranch(vehicleId: string, branchId: string) {
    const vehicle = await this.prisma.transportVehicle.findFirst({
      where: { id: vehicleId, branchId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  private async replaceVehicleStaff(
    vehicleId: string,
    staff: Array<{ userId: string; role: string }> | undefined,
  ) {
    if (staff === undefined) return;
    await this.prisma.transportStaffAssignment.deleteMany({ where: { vehicleId } });
    if (staff.length === 0) return;
    await this.prisma.transportStaffAssignment.createMany({
      data: staff.map((item) => ({
        vehicleId,
        userId: item.userId,
        role: item.role,
      })),
    });
  }

  // --- Vehicles ---

  async findAllVehicles(query: ListTransportVehiclesQuery, scope: BranchScope) {
    const where = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { plateNumber: { contains: query.search, mode: 'insensitive' as const } },
              { makeModel: { contains: query.search, mode: 'insensitive' as const } },
              { gpsDeviceId: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [vehicles, total] = await Promise.all([
      this.prisma.transportVehicle.findMany({
        where,
        orderBy: { plateNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: vehicleInclude,
      }),
      this.prisma.transportVehicle.count({ where }),
    ]);

    const data = vehicles.map((vehicle) => ({
      ...vehicle,
      lastLat: vehicle.lastLat ? Number(vehicle.lastLat) : null,
      lastLng: vehicle.lastLng ? Number(vehicle.lastLng) : null,
    }));

    return paginatedResult(data, total, page, limit);
  }

  async findOneVehicle(id: string, scope: BranchScope) {
    const vehicle = await this.prisma.transportVehicle.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: vehicleInclude,
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return {
      ...vehicle,
      lastLat: vehicle.lastLat ? Number(vehicle.lastLat) : null,
      lastLng: vehicle.lastLng ? Number(vehicle.lastLng) : null,
    };
  }

  async createVehicle(input: CreateTransportVehicleInput, user: AuthUser) {
    const vehicle = await this.prisma.transportVehicle.create({
      data: {
        branchId: input.branchId,
        plateNumber: input.plateNumber,
        makeModel: input.makeModel ?? null,
        capacity: input.capacity ?? null,
        status: input.status ?? 'active',
        gpsDeviceId: input.gpsDeviceId ?? null,
      },
      include: vehicleInclude,
    });

    await this.replaceVehicleStaff(vehicle.id, input.staff);

    const withStaff = await this.findOneVehicle(vehicle.id, selectedBranchScope([input.branchId]));

    await this.audit.log({
      userId: user.id,
      action: 'transport.vehicle.created',
      entityType: 'TransportVehicle',
      entityId: vehicle.id,
      newValue: withStaff,
    });

    return withStaff;
  }

  async updateVehicle(
    id: string,
    input: UpdateTransportVehicleInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.prisma.transportVehicle.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    await this.prisma.transportVehicle.update({
      where: { id },
      data: {
        ...(input.plateNumber !== undefined ? { plateNumber: input.plateNumber } : {}),
        ...(input.makeModel !== undefined ? { makeModel: input.makeModel } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.gpsDeviceId !== undefined ? { gpsDeviceId: input.gpsDeviceId } : {}),
      },
    });

    await this.replaceVehicleStaff(id, input.staff);

    const updated = await this.findOneVehicle(id, selectedBranchScope([existing.branchId]));

    await this.audit.log({
      userId: user.id,
      action: 'transport.vehicle.updated',
      entityType: 'TransportVehicle',
      entityId: id,
      previousValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async removeVehicle(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.transportVehicle.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    const vehicle = await this.prisma.transportVehicle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'transport.vehicle.deleted',
      entityType: 'TransportVehicle',
      entityId: id,
      previousValue: existing,
    });

    return vehicle;
  }

  async addVehicleDocument(
    vehicleId: string,
    input: CreateTransportVehicleDocumentInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const vehicle = await this.prisma.transportVehicle.findFirst({
      where: { id: vehicleId, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const document = await this.prisma.transportVehicleDocument.create({
      data: {
        vehicleId,
        title: input.title,
        storagePath: input.storagePath,
        mimeType: input.mimeType ?? null,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'transport.vehicle.document.created',
      entityType: 'TransportVehicleDocument',
      entityId: document.id,
      newValue: document,
    });

    return document;
  }

  async removeVehicleDocument(id: string, user: AuthUser, scope: BranchScope) {
    const document = await this.prisma.transportVehicleDocument.findFirst({
      where: {
        id,
        vehicle: {
          deletedAt: null,
          ...prismaBranchFilter(scope),
        },
      },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.transportVehicleDocument.delete({ where: { id } });

    await this.audit.log({
      userId: user.id,
      action: 'transport.vehicle.document.deleted',
      entityType: 'TransportVehicleDocument',
      entityId: id,
      previousValue: document,
    });

    return { success: true };
  }

  // --- Routes ---

  async findAllRoutes(query: ListTransportRoutesQuery, scope: BranchScope) {
    const where = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { code: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [routes, total] = await Promise.all([
      this.prisma.transportRoute.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: routeInclude,
      }),
      this.prisma.transportRoute.count({ where }),
    ]);

    return paginatedResult(routes, total, page, limit);
  }

  async findOneRoute(id: string, scope: BranchScope) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: routeInclude,
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  async createRoute(input: CreateTransportRouteInput, user: AuthUser) {
    const route = await this.prisma.transportRoute.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        code: input.code ?? null,
        isActive: input.isActive ?? true,
        stops: {
          create: input.stops.map((stop) => ({
            name: stop.name,
            sequence: stop.sequence,
            pickupTime: stop.pickupTime ?? null,
            dropoffTime: stop.dropoffTime ?? null,
          })),
        },
      },
      include: routeInclude,
    });

    await this.audit.log({
      userId: user.id,
      action: 'transport.route.created',
      entityType: 'TransportRoute',
      entityId: route.id,
      newValue: route,
    });

    return route;
  }

  async updateRoute(
    id: string,
    input: UpdateTransportRouteInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.prisma.transportRoute.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
      include: { stops: true },
    });
    if (!existing) throw new NotFoundException('Route not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.transportRoute.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });

      if (input.stops !== undefined) {
        await tx.transportStop.deleteMany({ where: { routeId: id } });
        if (input.stops.length > 0) {
          await tx.transportStop.createMany({
            data: input.stops.map((stop) => ({
              routeId: id,
              name: stop.name,
              sequence: stop.sequence,
              pickupTime: stop.pickupTime ?? null,
              dropoffTime: stop.dropoffTime ?? null,
            })),
          });
        }
      }
    });

    const updated = await this.findOneRoute(id, selectedBranchScope([existing.branchId]));

    await this.audit.log({
      userId: user.id,
      action: 'transport.route.updated',
      entityType: 'TransportRoute',
      entityId: id,
      previousValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async removeRoute(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.transportRoute.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!existing) throw new NotFoundException('Route not found');

    const route = await this.prisma.transportRoute.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'transport.route.deleted',
      entityType: 'TransportRoute',
      entityId: id,
      previousValue: existing,
    });

    return route;
  }

  // --- Student assignments ---

  async findAllStudentAssignments(query: ListStudentTransportQuery, scope: BranchScope) {
    const effective = narrowScope(scope, query.branchId);
    const where = {
      deletedAt: null,
      ...(query.routeId ? { routeId: query.routeId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      route: { deletedAt: null, ...prismaBranchFilter(effective) },
      ...(query.search
        ? {
            student: {
              fullName: { contains: query.search, mode: 'insensitive' as const },
              ...prismaBranchFilter(effective),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [assignments, total] = await Promise.all([
      this.prisma.studentTransport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          student: { select: { id: true, fullName: true, phone: true, batchId: true } },
          route: { select: { id: true, name: true, code: true } },
          stop: { select: { id: true, name: true, sequence: true, pickupTime: true, dropoffTime: true } },
        },
      }),
      this.prisma.studentTransport.count({ where }),
    ]);

    return paginatedResult(assignments, total, page, limit);
  }

  async createStudentAssignment(input: CreateStudentTransportInput, user: AuthUser) {
    await this.assertRouteInBranch(input.routeId, input.branchId);

    const stop = await this.prisma.transportStop.findFirst({
      where: { id: input.stopId, routeId: input.routeId },
    });
    if (!stop) throw new BadRequestException('Stop does not belong to the selected route');

    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, branchId: input.branchId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const assignment = await this.prisma.studentTransport.create({
      data: {
        studentId: input.studentId,
        routeId: input.routeId,
        stopId: input.stopId,
        direction: input.direction,
      },
      include: {
        student: { select: { id: true, fullName: true, phone: true, batchId: true } },
        route: { select: { id: true, name: true, code: true } },
        stop: { select: { id: true, name: true, sequence: true, pickupTime: true, dropoffTime: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'transport.student_assignment.created',
      entityType: 'StudentTransport',
      entityId: assignment.id,
      newValue: assignment,
    });

    return assignment;
  }

  async updateStudentAssignment(
    id: string,
    input: UpdateStudentTransportInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.prisma.studentTransport.findFirst({
      where: {
        id,
        deletedAt: null,
        route: {
          deletedAt: null,
          ...prismaBranchFilter(scope),
        },
      },
      include: { route: true },
    });
    if (!existing) throw new NotFoundException('Student assignment not found');

    const routeId = input.routeId ?? existing.routeId;
    if (input.stopId || input.routeId) {
      const stopId = input.stopId ?? existing.stopId;
      const stop = await this.prisma.transportStop.findFirst({
        where: { id: stopId, routeId },
      });
      if (!stop) throw new BadRequestException('Stop does not belong to the selected route');
    }

    if (input.studentId) {
      const student = await this.prisma.student.findFirst({
        where: {
          id: input.studentId,
          branchId: existing.route.branchId,
          deletedAt: null,
        },
      });
      if (!student) throw new NotFoundException('Student not found');
    }

    const assignment = await this.prisma.studentTransport.update({
      where: { id },
      data: {
        ...(input.studentId !== undefined ? { studentId: input.studentId } : {}),
        ...(input.routeId !== undefined ? { routeId: input.routeId } : {}),
        ...(input.stopId !== undefined ? { stopId: input.stopId } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
      },
      include: {
        student: { select: { id: true, fullName: true, phone: true, batchId: true } },
        route: { select: { id: true, name: true, code: true } },
        stop: { select: { id: true, name: true, sequence: true, pickupTime: true, dropoffTime: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'transport.student_assignment.updated',
      entityType: 'StudentTransport',
      entityId: id,
      previousValue: existing,
      newValue: assignment,
    });

    return assignment;
  }

  async removeStudentAssignment(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.prisma.studentTransport.findFirst({
      where: {
        id,
        deletedAt: null,
        route: {
          deletedAt: null,
          ...prismaBranchFilter(scope),
        },
      },
    });
    if (!existing) throw new NotFoundException('Student assignment not found');

    const assignment = await this.prisma.studentTransport.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'transport.student_assignment.deleted',
      entityType: 'StudentTransport',
      entityId: id,
      previousValue: existing,
    });

    return assignment;
  }

  // --- Trips ---

  async findAllTrips(query: ListTransportTripsQuery, scope: BranchScope) {
    const where = {
      ...(query.routeId ? { routeId: query.routeId } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.tripDate ? { tripDate: this.parseTripDate(query.tripDate) } : {}),
      route: { deletedAt: null, ...prismaBranchFilter(narrowScope(scope, query.branchId)) },
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [trips, total] = await Promise.all([
      this.prisma.transportTrip.findMany({
        where,
        orderBy: [{ tripDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          route: { select: { id: true, name: true, code: true, branchId: true } },
          vehicle: { select: { id: true, plateNumber: true, makeModel: true } },
          _count: { select: { attendance: true } },
        },
      }),
      this.prisma.transportTrip.count({ where }),
    ]);

    return paginatedResult(trips, total, page, limit);
  }

  async findOneTrip(id: string, scope: BranchScope) {
    const trip = await this.prisma.transportTrip.findFirst({
      where: {
        id,
        route: {
          deletedAt: null,
          ...prismaBranchFilter(scope),
        },
      },
      include: {
        route: { select: { id: true, name: true, code: true, branchId: true } },
        vehicle: { select: { id: true, plateNumber: true, makeModel: true } },
        attendance: {
          include: {
            student: { select: { id: true, fullName: true, phone: true } },
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async createTrip(input: CreateTransportTripInput, user: AuthUser) {
    await this.assertRouteInBranch(input.routeId, input.branchId);
    if (input.vehicleId) {
      await this.assertVehicleInBranch(input.vehicleId, input.branchId);
    }

    const trip = await this.prisma.transportTrip.create({
      data: {
        routeId: input.routeId,
        vehicleId: input.vehicleId ?? null,
        tripDate: this.parseTripDate(input.tripDate),
        direction: input.direction,
        status: input.status ?? 'scheduled',
      },
      include: {
        route: { select: { id: true, name: true, code: true, branchId: true } },
        vehicle: { select: { id: true, plateNumber: true, makeModel: true } },
        _count: { select: { attendance: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'transport.trip.created',
      entityType: 'TransportTrip',
      entityId: trip.id,
      newValue: trip,
    });

    return trip;
  }

  async updateTrip(
    id: string,
    input: UpdateTransportTripInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.prisma.transportTrip.findFirst({
      where: {
        id,
        route: {
          deletedAt: null,
          ...prismaBranchFilter(scope),
        },
      },
      include: { route: true },
    });
    if (!existing) throw new NotFoundException('Trip not found');

    if (input.routeId) {
      await this.assertRouteInBranch(input.routeId, existing.route.branchId);
    }
    if (input.vehicleId) {
      await this.assertVehicleInBranch(input.vehicleId, existing.route.branchId);
    }

    const trip = await this.prisma.transportTrip.update({
      where: { id },
      data: {
        ...(input.routeId !== undefined ? { routeId: input.routeId } : {}),
        ...(input.vehicleId !== undefined ? { vehicleId: input.vehicleId } : {}),
        ...(input.tripDate !== undefined ? { tripDate: this.parseTripDate(input.tripDate) } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: {
        route: { select: { id: true, name: true, code: true, branchId: true } },
        vehicle: { select: { id: true, plateNumber: true, makeModel: true } },
        _count: { select: { attendance: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'transport.trip.updated',
      entityType: 'TransportTrip',
      entityId: id,
      previousValue: existing,
      newValue: trip,
    });

    return trip;
  }

  async bulkMarkTripAttendance(
    tripId: string,
    input: BulkTransportAttendanceInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const trip = await this.prisma.transportTrip.findFirst({
      where: {
        id: tripId,
        route: {
          deletedAt: null,
          ...prismaBranchFilter(scope),
        },
      },
      include: { route: true },
    });
    if (!trip) throw new NotFoundException('Trip not found');

    const studentIds = input.records.map((record) => record.studentId);
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        branchId: trip.route.branchId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (students.length !== studentIds.length) {
      throw new BadRequestException('One or more students are invalid for this branch');
    }

    const results = await this.prisma.$transaction(
      input.records.map((record) =>
        this.prisma.transportAttendance.upsert({
          where: {
            tripId_studentId: {
              tripId,
              studentId: record.studentId,
            },
          },
          create: {
            tripId,
            studentId: record.studentId,
            status: record.status,
            recordedAt: record.recordedAt ? new Date(record.recordedAt) : new Date(),
          },
          update: {
            status: record.status,
            recordedAt: record.recordedAt ? new Date(record.recordedAt) : new Date(),
          },
        }),
      ),
    );

    await this.audit.log({
      userId: user.id,
      action: 'transport.trip.attendance_bulk_marked',
      entityType: 'TransportTrip',
      entityId: tripId,
      newValue: { count: results.length },
    });

    return { data: results };
  }

  // --- GPS ---

  async handleGpsWebhook(input: TransportGpsWebhookInput, user?: AuthUser) {
    const vehicle = await this.prisma.transportVehicle.findFirst({
      where: { gpsDeviceId: input.deviceId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found for GPS device');

    const updated = await this.prisma.transportVehicle.update({
      where: { id: vehicle.id },
      data: {
        lastLat: new Prisma.Decimal(input.lat),
        lastLng: new Prisma.Decimal(input.lng),
        lastPingAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      },
      include: vehicleInclude,
    });

    if (user) {
      await this.audit.log({
        userId: user.id,
        action: 'transport.gps.ping',
        entityType: 'TransportVehicle',
        entityId: vehicle.id,
        newValue: {
          lat: input.lat,
          lng: input.lng,
          recordedAt: input.recordedAt ?? new Date().toISOString(),
        },
      });
    }

    return {
      ...updated,
      lastLat: Number(updated.lastLat),
      lastLng: Number(updated.lastLng),
    };
  }
}
