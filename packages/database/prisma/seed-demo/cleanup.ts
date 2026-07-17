import type { PrismaClient } from '@prisma/client';
import type { DemoConfig } from './types';
import { DEMO_LEARNING_TITLES } from './steps/09-learning';

export async function cleanupDemoData(prisma: PrismaClient, config: DemoConfig): Promise<void> {
  const batchCodes = config.batches.map((b) => b.code);
  const demoKeys = config.students.map((s) => s.demoKey);
  const parentCnic = config.parents.map((p) => p.cnic);

  const demoStudents = await prisma.student.findMany({
    where: {
      OR: [
        ...demoKeys.map((key) => ({
          customFields: { path: ['_demoKey'], equals: key },
        })),
        { cnicOrBForm: { in: config.students.map((s) => s.cnic) } },
      ],
    },
    select: { id: true },
  });
  const studentIds = demoStudents.map((s) => s.id);

  const demoBatches = await prisma.batch.findMany({
    where: { code: { in: batchCodes } },
    select: { id: true },
  });
  const batchIds = demoBatches.map((b) => b.id);

  if (studentIds.length) {
    await prisma.assessmentRecord.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.attendanceRecord.deleteMany({ where: { entityId: { in: studentIds } } });
    await prisma.feeInvoice.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentParent.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentSubject.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.document.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  }

  if (parentCnic.length) {
    await prisma.parent.deleteMany({ where: { cnic: { in: parentCnic } } });
  }

  if (batchIds.length) {
    await prisma.timetableSlot.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.batchSubject.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.batch.deleteMany({ where: { id: { in: batchIds } } });
  }

  await prisma.assessment.deleteMany({
    where: { name: { in: config.assessments.map((a) => a.name) } },
  });
  await prisma.feeStructure.deleteMany({
    where: {
      feeTypeId: {
        in: (
          await prisma.feeType.findMany({
            where: { code: { in: config.feeStructures.map((f) => f.feeTypeCode) } },
            select: { id: true },
          })
        ).map((f) => f.id),
      },
    },
  });
  await prisma.notice.deleteMany({
    where: { title: { in: config.notices.map((n) => n.title) } },
  });
  await prisma.document.deleteMany({
    where: { title: { in: config.documents.map((d) => d.title) } },
  });
  await prisma.learningAttachment.deleteMany({
    where: { resource: { title: { in: [...DEMO_LEARNING_TITLES] } } },
  });
  await prisma.learningResource.deleteMany({
    where: { title: { in: [...DEMO_LEARNING_TITLES] } },
  });
  await prisma.communicationLog.deleteMany({});

  await prisma.admissionInquiry.deleteMany({
    where: {
      fullName: {
        in: [
          'Ahmed Raza (inquiry)',
          'Fatima Noor (inquiry)',
          'Hassan Ali (inquiry)',
        ],
      },
    },
  });
  await prisma.visitor.deleteMany({
    where: { fullName: { in: ['Walk-in Parent', 'Textbook Supplier'] } },
  });
  await prisma.complaintRequest.deleteMany({
    where: { subject: { in: ['Fee clarification', 'Timetable request'] } },
  });
  await prisma.certificateIssue.deleteMany({
    where: { title: 'Demo Completion Certificate' },
  });
  await prisma.receptionActivity.deleteMany({
    where: {
      OR: [
        { summary: { contains: '(inquiry)' } },
        { summary: { contains: 'Walk-in Parent' } },
        { summary: { contains: 'Fee clarification' } },
      ],
    },
  });

  const demoTransportRoutes = await prisma.transportRoute.findMany({
    where: { name: 'Demo Route — G-9 to Campus' },
    select: { id: true },
  });
  if (demoTransportRoutes.length) {
    const routeIds = demoTransportRoutes.map((r) => r.id);
    await prisma.transportAttendance.deleteMany({
      where: { trip: { routeId: { in: routeIds } } },
    });
    await prisma.transportTrip.deleteMany({ where: { routeId: { in: routeIds } } });
    await prisma.studentTransport.deleteMany({ where: { routeId: { in: routeIds } } });
    await prisma.transportStop.deleteMany({ where: { routeId: { in: routeIds } } });
    await prisma.transportRoute.deleteMany({ where: { id: { in: routeIds } } });
  }

  const demoVehicles = await prisma.transportVehicle.findMany({
    where: { plateNumber: 'ISB-1234' },
    select: { id: true },
  });
  if (demoVehicles.length) {
    const vehicleIds = demoVehicles.map((v) => v.id);
    await prisma.transportStaffAssignment.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.transportVehicleDocument.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.transportTrip.updateMany({
      where: { vehicleId: { in: vehicleIds } },
      data: { vehicleId: null },
    });
    await prisma.transportVehicle.deleteMany({ where: { id: { in: vehicleIds } } });
  }

  // Keep demo users (and their supabaseUserId links). seedUsers upserts by email.
  // Deleting users here breaks auth until db:seed:auth is re-run.
}
