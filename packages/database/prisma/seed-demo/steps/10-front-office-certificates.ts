import type { PrismaClient } from '@prisma/client';
import {
  configuredBranchCodes,
  featuredStudentDemoKey,
  staffUserId,
} from '../branch-helpers';
import type { DemoContext } from '../types';

function inquiryNames(branchCode: string): [string, string, string] {
  return [
    `Ahmed Raza (inquiry) [${branchCode}]`,
    `Fatima Noor (inquiry) [${branchCode}]`,
    `Hassan Ali (inquiry) [${branchCode}]`,
  ];
}

function visitorNames(branchCode: string): [string, string] {
  return [`Walk-in Parent [${branchCode}]`, `Textbook Supplier [${branchCode}]`];
}

function complaintSubjects(branchCode: string): [string, string] {
  return [`Fee clarification [${branchCode}]`, `Timetable request [${branchCode}]`];
}

function certTitle(branchCode: string): string {
  return `Demo Completion Certificate [${branchCode}]`;
}

export { inquiryNames, visitorNames, complaintSubjects, certTitle };

export async function seedFrontOfficeAndCertificates(
  prisma: PrismaClient,
  ctx: DemoContext,
): Promise<void> {
  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;

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

  const certTemplate = await prisma.certificateTemplate.findFirst({
    where: { type: 'certificate', isActive: true },
  });

  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const receptionistId = staffUserId(ctx, branchCode, 'receptionist') ?? adminId;
    const names = inquiryNames(branchCode);
    const visitors = visitorNames(branchCode);
    const subjects = complaintSubjects(branchCode);

    await prisma.admissionInquiry.deleteMany({
      where: { branchId, fullName: { in: [...names] } },
    });
    await prisma.visitor.deleteMany({
      where: { branchId, fullName: { in: [...visitors] } },
    });
    await prisma.complaintRequest.deleteMany({
      where: { branchId, subject: { in: [...subjects] } },
    });
    await prisma.receptionActivity.deleteMany({
      where: {
        branchId,
        OR: [
          { summary: { contains: `(inquiry) [${branchCode}]` } },
          { summary: { contains: visitors[0] } },
          { summary: { contains: subjects[0] } },
        ],
      },
    });
    await prisma.certificateIssue.deleteMany({
      where: { branchId, title: certTitle(branchCode) },
    });

    const inquiries = [
      {
        fullName: names[0],
        phone: branchCode === 'LAHORE' ? '0300-1112244' : '0300-1112233',
        email: `ahmed.inquiry.${branchCode.toLowerCase()}@example.com`,
        programInterest: branchCode === 'LAHORE' ? 'MDCAT Lahore' : 'MDCAT Morning',
        status: 'new',
        notes: 'Called from Facebook ad',
      },
      {
        fullName: names[1],
        phone: branchCode === 'LAHORE' ? '0321-4455668' : '0321-4455667',
        email: `fatima.inquiry.${branchCode.toLowerCase()}@example.com`,
        programInterest: branchCode === 'LAHORE' ? 'ECAT Lahore' : 'HSSC Pre-Med',
        status: 'contacted',
        notes: 'Follow-up scheduled',
      },
      {
        fullName: names[2],
        phone: branchCode === 'LAHORE' ? '0333-9988777' : '0333-9988776',
        programInterest: branchCode === 'LAHORE' ? 'MDCAT Evening' : 'Entry Test',
        status: 'enrolled',
        notes: 'Converted to admission — demo sample',
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
        fullName: visitors[0],
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
        summary: `Visitor checked in: ${visitors[0]}`,
        createdById: receptionistId,
      },
    });

    await prisma.visitor.create({
      data: {
        branchId,
        fullName: visitors[1],
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
        subject: subjects[0],
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
        summary: `Request opened: ${subjects[0]}`,
        createdById: receptionistId,
      },
    });

    await prisma.complaintRequest.create({
      data: {
        branchId,
        type: 'complaint',
        subject: subjects[1],
        body: 'Student requested section change for evening class.',
        status: 'in_progress',
        priority: 'high',
        requesterName: 'Sara Khan',
        createdById: receptionistId,
      },
    });

    const studentId = ctx.studentIds.get(featuredStudentDemoKey(branchCode));
    if (studentId && certTemplate) {
      await prisma.certificateIssue.create({
        data: {
          branchId,
          studentId,
          templateId: certTemplate.id,
          title: certTitle(branchCode),
          serialNo: `DEMO-CERT-${branchCode}-001`,
          issuedById: adminId,
          meta: { _demo: true, branchCode },
        },
      });
    }
  }
}
