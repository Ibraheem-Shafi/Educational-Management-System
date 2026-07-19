import type { PrismaClient } from '@prisma/client';
import type { DemoConfig } from './types';
import { DEMO_BRANCH_CODES } from './branch-helpers';
import {
  DEMO_LEARNING_TITLE_SUFFIXES,
  branchQualifiedLearningTitle,
} from './steps/09-learning';
import {
  inquiryNames,
  visitorNames,
  complaintSubjects,
  certTitle,
} from './steps/10-front-office-certificates';
import { ALL_DEMO_ACCESSION_NOS } from './steps/11-library';
import { DEMO_PLATES, DEMO_ROUTE_NAMES } from './steps/12-transport';
import { DEMO_DEVICE_CODES } from './steps/14-biometric';

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

  const branchIds = (
    await prisma.branch.findMany({
      where: { code: { in: [...DEMO_BRANCH_CODES] } },
      select: { id: true },
    })
  ).map((b) => b.id);

  // Biometric
  await prisma.biometricPunchLog.deleteMany({
    where: { device: { deviceCode: { in: [...DEMO_DEVICE_CODES] } } },
  });
  await prisma.biometricExternalId.deleteMany({
    where: { device: { deviceCode: { in: [...DEMO_DEVICE_CODES] } } },
  });
  await prisma.biometricDevice.deleteMany({
    where: { deviceCode: { in: [...DEMO_DEVICE_CODES] } },
  });

  // AI attendance
  if (batchIds.length) {
    await prisma.attendanceOcrSession.deleteMany({
      where: { batchId: { in: batchIds } },
    });
  }

  // Accounting demo vouchers / budgets
  if (branchIds.length) {
    const vouchers = await prisma.journalVoucher.findMany({
      where: {
        branchId: { in: branchIds },
        voucherNo: { startsWith: 'JV-' },
        OR: [{ sourceType: 'demo' }, { voucherNo: { contains: '-DEMO-' } }],
      },
      select: { id: true },
    });
    if (vouchers.length) {
      await prisma.journalLine.deleteMany({
        where: { voucherId: { in: vouchers.map((v) => v.id) } },
      });
      await prisma.journalVoucher.deleteMany({
        where: { id: { in: vouchers.map((v) => v.id) } },
      });
    }

    const budgets = await prisma.budget.findMany({
      where: {
        branchId: { in: branchIds },
        name: { contains: 'Operating Budget [' },
      },
      select: { id: true },
    });
    if (budgets.length) {
      await prisma.budgetLine.deleteMany({
        where: { budgetId: { in: budgets.map((b) => b.id) } },
      });
      await prisma.budget.deleteMany({
        where: { id: { in: budgets.map((b) => b.id) } },
      });
    }

    await prisma.account.deleteMany({
      where: {
        branchId: { in: branchIds },
        code: { in: ['5100-ISB', '5100-LHR'] },
      },
    });
  }

  // HR / leave
  if (branchIds.length) {
    await prisma.performanceReview.deleteMany({
      where: {
        branchId: { in: branchIds },
        periodLabel: { contains: '[' },
      },
    });
    await prisma.employmentContract.deleteMany({
      where: {
        branchId: { in: branchIds },
        documentPath: { startsWith: 'hr/demo/' },
      },
    });
  }
  await prisma.leaveRequest.deleteMany({
    where: {
      OR: [
        { reason: { contains: 'campus teacher leave' } },
        { reason: { contains: 'Medical leave —' } },
        { reason: { contains: 'student absence' } },
      ],
    },
  });

  // Payroll
  if (branchIds.length) {
    const runs = await prisma.payrollRun.findMany({
      where: {
        branchId: { in: branchIds },
        OR: [
          { notes: { contains: 'Demo payroll' } },
          { notes: { contains: 'Demo draft payroll' } },
        ],
      },
      select: { id: true },
    });
    if (runs.length) {
      await prisma.payrollLine.deleteMany({
        where: { runId: { in: runs.map((r) => r.id) } },
      });
      await prisma.payrollRun.deleteMany({
        where: { id: { in: runs.map((r) => r.id) } },
      });
    }
  }

  // Transport
  const demoTransportRoutes = await prisma.transportRoute.findMany({
    where: { name: { in: [...DEMO_ROUTE_NAMES] } },
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
    where: { plateNumber: { in: [...DEMO_PLATES] } },
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

  // Library
  const demoBooks = await prisma.libraryBook.findMany({
    where: { accessionNo: { in: ALL_DEMO_ACCESSION_NOS } },
    select: { id: true },
  });
  if (demoBooks.length) {
    const bookIds = demoBooks.map((b) => b.id);
    await prisma.libraryFine.deleteMany({
      where: { loan: { copy: { bookId: { in: bookIds } } } },
    });
    await prisma.libraryLoan.deleteMany({
      where: { copy: { bookId: { in: bookIds } } },
    });
    await prisma.libraryReservation.deleteMany({ where: { bookId: { in: bookIds } } });
    await prisma.libraryCopy.deleteMany({ where: { bookId: { in: bookIds } } });
    await prisma.libraryBook.deleteMany({ where: { id: { in: bookIds } } });
  }
  await prisma.libraryCategory.deleteMany({
    where: {
      OR: DEMO_BRANCH_CODES.map((code) => ({ name: `CSS & PMS Reference [${code}]` })),
    },
  });

  // Front office + certificates
  const inquiryNameList = DEMO_BRANCH_CODES.flatMap((c) => [...inquiryNames(c)]);
  // Include legacy v1.4 names
  inquiryNameList.push(
    'Ahmed Raza (inquiry)',
    'Fatima Noor (inquiry)',
    'Hassan Ali (inquiry)',
  );
  await prisma.admissionInquiry.deleteMany({
    where: { fullName: { in: inquiryNameList } },
  });
  await prisma.visitor.deleteMany({
    where: {
      fullName: {
        in: [
          ...DEMO_BRANCH_CODES.flatMap((c) => [...visitorNames(c)]),
          'Walk-in Parent',
          'Textbook Supplier',
        ],
      },
    },
  });
  await prisma.complaintRequest.deleteMany({
    where: {
      subject: {
        in: [
          ...DEMO_BRANCH_CODES.flatMap((c) => [...complaintSubjects(c)]),
          'Fee clarification',
          'Timetable request',
        ],
      },
    },
  });
  await prisma.certificateIssue.deleteMany({
    where: {
      title: {
        in: [
          ...DEMO_BRANCH_CODES.map((c) => certTitle(c)),
          'Demo Completion Certificate',
        ],
      },
    },
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

  if (studentIds.length) {
    await prisma.feePayment.deleteMany({
      where: { invoice: { studentId: { in: studentIds } } },
    });
    await prisma.assessmentRecord.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.attendanceRecord.deleteMany({ where: { entityId: { in: studentIds } } });
    await prisma.feeInvoice.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentParent.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.studentSubject.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.document.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.leaveRequest.deleteMany({ where: { studentId: { in: studentIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  }

  // Staff attendance (entityId = user ids) — best-effort by branch
  if (branchIds.length) {
    await prisma.attendanceRecord.deleteMany({
      where: {
        branchId: { in: branchIds },
        entityType: { in: ['teacher', 'staff'] },
      },
    });
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
            where: { code: { in: [...new Set(config.feeStructures.map((f) => f.feeTypeCode))] } },
            select: { id: true },
          })
        ).map((f) => f.id),
      },
      branchId: { in: branchIds },
    },
  });
  await prisma.notice.deleteMany({
    where: { title: { in: config.notices.map((n) => n.title) } },
  });
  await prisma.document.deleteMany({
    where: { title: { in: config.documents.map((d) => d.title) } },
  });

  const learningTitles = [
    ...DEMO_LEARNING_TITLE_SUFFIXES,
    ...DEMO_BRANCH_CODES.flatMap((code) =>
      DEMO_LEARNING_TITLE_SUFFIXES.map((suffix) => branchQualifiedLearningTitle(code, suffix)),
    ),
  ];
  await prisma.learningAttachment.deleteMany({
    where: { resource: { title: { in: learningTitles } } },
  });
  await prisma.learningResource.deleteMany({
    where: { title: { in: learningTitles } },
  });

  // Only demo-tagged communications (do not wipe user data)
  await prisma.communicationLog.deleteMany({
    where: {
      OR: [
        { body: { contains: 'Nexium Academy' } },
        { subject: { in: ['PTM Reminder', 'Lahore Campus'] } },
      ],
    },
  });
}
