import type { PrismaClient } from '@prisma/client';
import {
  configuredBranchCodes,
  featuredStudentDemoKey,
  secondaryStudentDemoKey,
  staffUserId,
} from '../branch-helpers';
import type { DemoContext } from '../types';

function plateFor(branchCode: string): string {
  return branchCode === 'LAHORE' ? 'LHR-5678' : 'ISB-1234';
}

function routeNameFor(branchCode: string): string {
  return branchCode === 'LAHORE'
    ? 'Demo Route — Gulberg to Campus'
    : 'Demo Route — G-9 to Campus';
}

function routeCodeFor(branchCode: string): string {
  return branchCode === 'LAHORE' ? 'RT-DEMO-LHR-01' : 'RT-DEMO-01';
}

function gpsDeviceFor(branchCode: string): string {
  return branchCode === 'LAHORE' ? 'DEMO-GPS-LHR-1' : 'DEMO-GPS-1';
}

export const DEMO_PLATES = ['ISB-1234', 'LHR-5678'] as const;
export const DEMO_ROUTE_NAMES = [
  'Demo Route — G-9 to Campus',
  'Demo Route — Gulberg to Campus',
] as const;

export async function seedTransport(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const plate = plateFor(branchCode);
    const routeName = routeNameFor(branchCode);
    const driverId = staffUserId(ctx, branchCode, 'teacher');
    const studentOne = ctx.studentIds.get(featuredStudentDemoKey(branchCode));
    const studentTwo = ctx.studentIds.get(secondaryStudentDemoKey(branchCode));

    const existingVehicle = await prisma.transportVehicle.findFirst({
      where: { branchId, plateNumber: plate, deletedAt: null },
    });
    if (existingVehicle) {
      await prisma.transportAttendance.deleteMany({
        where: { trip: { vehicleId: existingVehicle.id } },
      });
      await prisma.transportTrip.deleteMany({ where: { vehicleId: existingVehicle.id } });
      await prisma.transportStaffAssignment.deleteMany({ where: { vehicleId: existingVehicle.id } });
      await prisma.transportVehicleDocument.deleteMany({ where: { vehicleId: existingVehicle.id } });
      await prisma.transportVehicle.delete({ where: { id: existingVehicle.id } });
    }

    const existingRoute = await prisma.transportRoute.findFirst({
      where: { branchId, name: routeName, deletedAt: null },
    });
    if (existingRoute) {
      await prisma.transportAttendance.deleteMany({
        where: { trip: { routeId: existingRoute.id } },
      });
      await prisma.transportTrip.deleteMany({ where: { routeId: existingRoute.id } });
      await prisma.studentTransport.deleteMany({ where: { routeId: existingRoute.id } });
      await prisma.transportStop.deleteMany({ where: { routeId: existingRoute.id } });
      await prisma.transportRoute.delete({ where: { id: existingRoute.id } });
    }

    const coords =
      branchCode === 'LAHORE'
        ? { lastLat: 31.5204, lastLng: 74.3587 }
        : { lastLat: 33.68442, lastLng: 73.04788 };

    const vehicle = await prisma.transportVehicle.create({
      data: {
        branchId,
        plateNumber: plate,
        makeModel: 'Toyota Coaster 2022',
        capacity: 30,
        status: 'active',
        gpsDeviceId: gpsDeviceFor(branchCode),
        lastLat: coords.lastLat,
        lastLng: coords.lastLng,
        lastPingAt: new Date(),
        ...(driverId
          ? {
              staffAssignments: {
                create: [{ userId: driverId, role: 'driver' }],
              },
            }
          : {}),
        documents: {
          create: {
            title: 'Vehicle Registration',
            storagePath: `transport/demo/${branchCode.toLowerCase()}-vehicle-registration.pdf`,
            mimeType: 'application/pdf',
          },
        },
      },
    });

    const stops =
      branchCode === 'LAHORE'
        ? [
            { name: 'Gulberg Main Blvd', sequence: 1, pickupTime: '07:20', dropoffTime: '14:40' },
            { name: 'Liberty Market', sequence: 2, pickupTime: '07:35', dropoffTime: '14:25' },
            { name: 'Campus Gate', sequence: 3, pickupTime: '07:50', dropoffTime: '14:10' },
          ]
        : [
            { name: 'G-9 Markaz', sequence: 1, pickupTime: '07:15', dropoffTime: '14:30' },
            { name: 'Peshawar Mor', sequence: 2, pickupTime: '07:30', dropoffTime: '14:15' },
            { name: 'Campus Gate A', sequence: 3, pickupTime: '07:45', dropoffTime: '14:00' },
          ];

    const route = await prisma.transportRoute.create({
      data: {
        branchId,
        name: routeName,
        code: routeCodeFor(branchCode),
        isActive: true,
        stops: { create: stops },
      },
      include: { stops: { orderBy: { sequence: 'asc' } } },
    });

    const firstStop = route.stops[0];
    const secondStop = route.stops[1];

    if (studentOne && firstStop) {
      await prisma.studentTransport.create({
        data: {
          studentId: studentOne,
          routeId: route.id,
          stopId: firstStop.id,
          direction: 'both',
        },
      });
    }

    if (studentTwo && secondStop) {
      await prisma.studentTransport.create({
        data: {
          studentId: studentTwo,
          routeId: route.id,
          stopId: secondStop.id,
          direction: 'pickup',
        },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const trip = await prisma.transportTrip.create({
      data: {
        routeId: route.id,
        vehicleId: vehicle.id,
        tripDate: today,
        direction: 'pickup',
        status: 'scheduled',
      },
    });

    if (studentOne) {
      await prisma.transportAttendance.create({
        data: {
          tripId: trip.id,
          studentId: studentOne,
          status: 'boarded',
        },
      });
    }
  }
}

export { plateFor, routeNameFor, gpsDeviceFor };
