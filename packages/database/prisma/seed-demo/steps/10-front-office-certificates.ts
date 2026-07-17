import type { PrismaClient } from '@prisma/client';
import type { DemoContext } from '../types';

const DEMO_INQUIRY_NAMES = [
  'Ahmed Raza (inquiry)',
  'Fatima Noor (inquiry)',
  'Hassan Ali (inquiry)',
] as const;

export async function seedFrontOfficeAndCertificates(
  prisma: PrismaClient,
  ctx: DemoContext,
): Promise<void> {
  const branchId =
    ctx.branchMap.get('MAIN') ??
    ctx.branchMap.values().next().value ??
    null;
  if (!branchId) return;

  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;
  const receptionistId =
    ctx.userIds.get('receptionist@nexium.edu.pk') ??
    ctx.userIds.get('reception@nexium.edu.pk') ??
    adminId;

  // Certificate templates (institution defaults)
  const templates = [
    { type: 'certificate', name: 'Completion Certificate' },
    { type: 'id_card', name: 'Student ID Card' },
  ];
  for (const t of templates) {
    const existing = await prisma.certificateTemplate.findFirst({
      where: { branchId: null, type: t.type, name: t.name },
    });
    if (!existing) {
      await prisma.certificateTemplate.create({
        data: {
          branchId: null,
          type: t.type,
          name: t.name,
          fields: {},
          isActive: true,
        },
      });
    }
  }

  // Soft-clean prior demo front-office rows by known names
  await prisma.admissionInquiry.deleteMany({
    where: { fullName: { in: [...DEMO_INQUIRY_NAMES] } },
  });
  await prisma.visitor.deleteMany({
    where: { fullName: { in: ['Walk-in Parent', 'Textbook Supplier'] } },
  });
  await prisma.complaintRequest.deleteMany({
    where: { subject: { in: ['Fee clarification', 'Timetable request'] } },
  });

  const inquiries = [
    {
      fullName: DEMO_INQUIRY_NAMES[0],
      phone: '0300-1112233',
      email: 'ahmed.inquiry@example.com',
      programInterest: 'CSS Evening',
      status: 'new',
      notes: 'Called from Facebook ad',
    },
    {
      fullName: DEMO_INQUIRY_NAMES[1],
      phone: '0321-4455667',
      email: 'fatima.inquiry@example.com',
      programInterest: 'PMS Batch',
      status: 'contacted',
      notes: 'Follow-up scheduled',
    },
    {
      fullName: DEMO_INQUIRY_NAMES[2],
      phone: '0333-9988776',
      programInterest: 'Entry Test',
      status: 'interested',
      notes: 'Wants campus tour',
    },
  ];

  for (const row of inquiries) {
    const inquiry = await prisma.admissionInquiry.create({
      data: {
        branchId,
        ...row,
        createdById: receptionistId,
        followUpAt: row.status === 'contacted' ? new Date(Date.now() + 86400000 * 2) : null,
      },
    });
    await prisma.receptionActivity.create({
      data: {
        branchId,
        action: 'inquiry.created',
        entityType: 'AdmissionInquiry',
        entityId: inquiry.id,
        summary: `Inquiry from ${row.fullName}`,
        createdById: receptionistId,
      },
    });
  }

  const visitor = await prisma.visitor.create({
    data: {
      branchId,
      fullName: 'Walk-in Parent',
      phone: '0301-5556677',
      purpose: 'Meet branch admin about fees',
      hostName: 'Branch Admin',
      createdById: receptionistId,
    },
  });
  await prisma.receptionActivity.create({
    data: {
      branchId,
      action: 'visitor.checked_in',
      entityType: 'Visitor',
      entityId: visitor.id,
      summary: 'Visitor checked in: Walk-in Parent',
      createdById: receptionistId,
    },
  });

  await prisma.visitor.create({
    data: {
      branchId,
      fullName: 'Textbook Supplier',
      phone: '042-1112222',
      purpose: 'Delivery',
      hostName: 'Store',
      checkedOutAt: new Date(),
      createdById: receptionistId,
    },
  });

  const complaint = await prisma.complaintRequest.create({
    data: {
      branchId,
      type: 'request',
      subject: 'Fee clarification',
      body: 'Parent asked for installment options for sibling discount.',
      status: 'open',
      priority: 'normal',
      requesterName: 'Imran Malik',
      requesterPhone: '0300-2223344',
      createdById: receptionistId,
    },
  });
  await prisma.receptionActivity.create({
    data: {
      branchId,
      action: 'complaint.created',
      entityType: 'ComplaintRequest',
      entityId: complaint.id,
      summary: 'Request opened: Fee clarification',
      createdById: receptionistId,
    },
  });

  await prisma.complaintRequest.create({
    data: {
      branchId,
      type: 'complaint',
      subject: 'Timetable request',
      body: 'Student requested section change for evening class.',
      status: 'in_progress',
      priority: 'high',
      requesterName: 'Sara Khan',
      createdById: receptionistId,
    },
  });

  // Sample certificate issue for first demo student if present
  const firstStudentId = ctx.studentIds.values().next().value as string | undefined;
  const certTemplate = await prisma.certificateTemplate.findFirst({
    where: { type: 'certificate', isActive: true },
  });
  if (firstStudentId && certTemplate) {
    const existingIssue = await prisma.certificateIssue.findFirst({
      where: {
        studentId: firstStudentId,
        title: 'Demo Completion Certificate',
        deletedAt: null,
      },
    });
    if (!existingIssue) {
      await prisma.certificateIssue.create({
        data: {
          branchId,
          studentId: firstStudentId,
          templateId: certTemplate.id,
          title: 'Demo Completion Certificate',
          serialNo: 'DEMO-CERT-001',
          issuedById: adminId,
          meta: { _demo: true },
        },
      });
    }
  }
}
