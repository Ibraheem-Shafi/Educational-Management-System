import type { PrismaClient } from '@prisma/client';
import type { DemoContext } from '../types';

const DEMO_PLATE = 'ISB-1234';
const DEMO_ROUTE_NAME = 'Demo Route — G-9 to Campus';
const DEMO_GPS_DEVICE = 'DEMO-GPS-1';

export async function seedTransport(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const branchId =
    ctx.branchMap.get('MAIN') ?? ctx.branchMap.values().next().value ?? null;
  if (!branchId) return;

  const driverId = ctx.userIds.get('ahmed.teacher@nexium.edu.pk') ?? null;
  const studentOne = ctx.studentIds.get('ali-khan');
  const studentTwo = ctx.studentIds.get('ayesha-malik');

  const existingVehicle = await prisma.transportVehicle.findFirst({
    where: { branchId, plateNumber: DEMO_PLATE, deletedAt: null },
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
    where: { branchId, name: DEMO_ROUTE_NAME, deletedAt: null },
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

  const vehicle = await prisma.transportVehicle.create({
    data: {
      branchId,
      plateNumber: DEMO_PLATE,
      makeModel: 'Toyota Coaster 2022',
      capacity: 30,
      status: 'active',
      gpsDeviceId: DEMO_GPS_DEVICE,
      lastLat: 33.68442,
      lastLng: 73.04788,
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
          storagePath: 'transport/demo/vehicle-registration.pdf',
          mimeType: 'application/pdf',
        },
      },
    },
  });

  const route = await prisma.transportRoute.create({
    data: {
      branchId,
      name: DEMO_ROUTE_NAME,
      code: 'RT-DEMO-01',
      isActive: true,
      stops: {
        create: [
          { name: 'G-9 Markaz', sequence: 1, pickupTime: '07:15', dropoffTime: '14:30' },
          { name: 'Peshawar Mor', sequence: 2, pickupTime: '07:30', dropoffTime: '14:15' },
          { name: 'Campus Gate A', sequence: 3, pickupTime: '07:45', dropoffTime: '14:00' },
        ],
      },
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

export { DEMO_PLATE, DEMO_ROUTE_NAME, DEMO_GPS_DEVICE };
