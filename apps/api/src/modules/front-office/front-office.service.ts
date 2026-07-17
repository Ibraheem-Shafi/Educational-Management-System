import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '@eims/types';
import type {
  ConvertInquiryInput,
  CreateActivityNoteInput,
  CreateComplaintInput,
  CreateInquiryInput,
  CreateVisitorInput,
  ListActivitiesQuery,
  ListComplaintsQuery,
  ListInquiriesQuery,
  ListVisitorsQuery,
  PublicInquiryInput,
  UpdateComplaintInput,
  UpdateInquiryInput,
  UpdateVisitorInput,
} from '@eims/shared';

@Injectable()
export class FrontOfficeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Inquiries ---

  async findAllInquiries(query: ListInquiriesQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const inquiries = await this.prisma.admissionInquiry.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { fullName: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: inquiries };
  }

  async findOneInquiry(id: string, branchId: string | null) {
    const inquiry = await this.prisma.admissionInquiry.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    return inquiry;
  }

  async createInquiry(input: CreateInquiryInput, user: AuthUser) {
    const inquiry = await this.prisma.admissionInquiry.create({
      data: {
        branchId: input.branchId,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        programInterest: input.programInterest,
        status: input.status ?? 'new',
        notes: input.notes,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : undefined,
        createdById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'inquiry.created',
      entityType: 'AdmissionInquiry',
      entityId: inquiry.id,
      newValue: inquiry,
    });

    await this.logReceptionActivity({
      branchId: inquiry.branchId,
      action: 'inquiry.created',
      entityType: 'AdmissionInquiry',
      entityId: inquiry.id,
      summary: `Admission inquiry created for ${inquiry.fullName}`,
      createdById: user.id,
    });

    return inquiry;
  }

  async createPublicInquiry(input: PublicInquiryInput) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, isActive: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const inquiry = await this.prisma.admissionInquiry.create({
      data: {
        branchId: input.branchId,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email && input.email.trim() ? input.email.trim() : undefined,
        programInterest: input.programInterest,
        status: 'new',
        notes: input.notes,
        createdById: null,
      },
    });

    await this.logReceptionActivity({
      branchId: inquiry.branchId,
      action: 'inquiry.public_submitted',
      entityType: 'AdmissionInquiry',
      entityId: inquiry.id,
      summary: `Public admission inquiry from ${inquiry.fullName}`,
      createdById: null,
    });

    return {
      id: inquiry.id,
      fullName: inquiry.fullName,
      status: inquiry.status,
      message: 'Thank you. Your inquiry has been submitted. Our team will contact you soon.',
    };
  }

  async listPublicBranches() {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, city: true },
    });
    return { data: branches };
  }

  async updateInquiry(
    id: string,
    input: UpdateInquiryInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.admissionInquiry.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Inquiry not found');

    const inquiry = await this.prisma.admissionInquiry.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.programInterest !== undefined
          ? { programInterest: input.programInterest }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.followUpAt !== undefined
          ? { followUpAt: input.followUpAt ? new Date(input.followUpAt) : null }
          : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'inquiry.updated',
      entityType: 'AdmissionInquiry',
      entityId: inquiry.id,
      previousValue: existing,
      newValue: inquiry,
    });

    await this.logReceptionActivity({
      branchId: inquiry.branchId,
      action: 'inquiry.updated',
      entityType: 'AdmissionInquiry',
      entityId: inquiry.id,
      summary: `Admission inquiry updated for ${inquiry.fullName}`,
      createdById: user.id,
    });

    return inquiry;
  }

  async removeInquiry(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.admissionInquiry.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Inquiry not found');

    const inquiry = await this.prisma.admissionInquiry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'inquiry.deleted',
      entityType: 'AdmissionInquiry',
      entityId: inquiry.id,
      previousValue: existing,
    });

    await this.logReceptionActivity({
      branchId: inquiry.branchId,
      action: 'inquiry.deleted',
      entityType: 'AdmissionInquiry',
      entityId: inquiry.id,
      summary: `Admission inquiry deleted for ${existing.fullName}`,
      createdById: user.id,
    });

    return { deleted: true };
  }

  async getConvertPayload(id: string, branchId: string | null) {
    const inquiry = await this.findOneInquiry(id, branchId);
    return { inquiry };
  }

  async convertInquiry(
    id: string,
    input: ConvertInquiryInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.admissionInquiry.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Inquiry not found');

    const student = await this.prisma.student.findFirst({
      where: {
        id: input.studentId,
        branchId: existing.branchId,
        deletedAt: null,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (existing.convertedStudentId && existing.convertedStudentId !== input.studentId) {
      throw new BadRequestException('Inquiry is already linked to another student');
    }

    const inquiry = await this.prisma.admissionInquiry.update({
      where: { id },
      data: {
        status: 'enrolled',
        convertedStudentId: input.studentId,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'inquiry.converted',
      entityType: 'AdmissionInquiry',
      entityId: inquiry.id,
      previousValue: existing,
      newValue: inquiry,
    });

    await this.logReceptionActivity({
      branchId: inquiry.branchId,
      action: 'inquiry.converted',
      entityType: 'AdmissionInquiry',
      entityId: inquiry.id,
      summary: `Admission inquiry for ${inquiry.fullName} enrolled as student ${student.fullName}`,
      createdById: user.id,
    });

    return { inquiry };
  }

  // --- Visitors ---

  async findAllVisitors(query: ListVisitorsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const visitors = await this.prisma.visitor.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.checkedInOnly ? { checkedOutAt: null } : {}),
        ...(query.search
          ? {
              OR: [
                { fullName: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search, mode: 'insensitive' } },
                { hostName: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: visitors };
  }

  async findOneVisitor(id: string, branchId: string | null) {
    const visitor = await this.prisma.visitor.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');
    return visitor;
  }

  async createVisitor(input: CreateVisitorInput, user: AuthUser) {
    const visitor = await this.prisma.visitor.create({
      data: {
        branchId: input.branchId,
        fullName: input.fullName,
        phone: input.phone,
        purpose: input.purpose,
        hostName: input.hostName,
        notes: input.notes,
        createdById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'visitor.created',
      entityType: 'Visitor',
      entityId: visitor.id,
      newValue: visitor,
    });

    await this.logReceptionActivity({
      branchId: visitor.branchId,
      action: 'visitor.created',
      entityType: 'Visitor',
      entityId: visitor.id,
      summary: `Visitor checked in: ${visitor.fullName}`,
      createdById: user.id,
    });

    return visitor;
  }

  async updateVisitor(
    id: string,
    input: UpdateVisitorInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.visitor.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Visitor not found');

    const checkingOut = input.checkOut === true && !existing.checkedOutAt;

    const visitor = await this.prisma.visitor.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
        ...(input.hostName !== undefined ? { hostName: input.hostName } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(checkingOut ? { checkedOutAt: new Date() } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: checkingOut ? 'visitor.checked_out' : 'visitor.updated',
      entityType: 'Visitor',
      entityId: visitor.id,
      previousValue: existing,
      newValue: visitor,
    });

    await this.logReceptionActivity({
      branchId: visitor.branchId,
      action: checkingOut ? 'visitor.checked_out' : 'visitor.updated',
      entityType: 'Visitor',
      entityId: visitor.id,
      summary: checkingOut
        ? `Visitor checked out: ${visitor.fullName}`
        : `Visitor record updated: ${visitor.fullName}`,
      createdById: user.id,
    });

    return visitor;
  }

  async removeVisitor(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.visitor.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Visitor not found');

    const visitor = await this.prisma.visitor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'visitor.deleted',
      entityType: 'Visitor',
      entityId: visitor.id,
      previousValue: existing,
    });

    await this.logReceptionActivity({
      branchId: visitor.branchId,
      action: 'visitor.deleted',
      entityType: 'Visitor',
      entityId: visitor.id,
      summary: `Visitor record deleted: ${existing.fullName}`,
      createdById: user.id,
    });

    return { deleted: true };
  }

  // --- Complaints ---

  async findAllComplaints(query: ListComplaintsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const complaints = await this.prisma.complaintRequest.findMany({
      where: {
        deletedAt: null,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.search
          ? {
              OR: [
                { subject: { contains: query.search, mode: 'insensitive' } },
                { body: { contains: query.search, mode: 'insensitive' } },
                { requesterName: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: complaints };
  }

  async findOneComplaint(id: string, branchId: string | null) {
    const complaint = await this.prisma.complaintRequest.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');
    return complaint;
  }

  async createComplaint(input: CreateComplaintInput, user: AuthUser) {
    const complaint = await this.prisma.complaintRequest.create({
      data: {
        branchId: input.branchId,
        type: input.type,
        subject: input.subject,
        body: input.body,
        status: input.status ?? 'open',
        priority: input.priority ?? 'normal',
        requesterName: input.requesterName,
        requesterPhone: input.requesterPhone,
        assignedToId: input.assignedToId,
        createdById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'complaint.created',
      entityType: 'ComplaintRequest',
      entityId: complaint.id,
      newValue: complaint,
    });

    await this.logReceptionActivity({
      branchId: complaint.branchId,
      action: 'complaint.created',
      entityType: 'ComplaintRequest',
      entityId: complaint.id,
      summary: `${complaint.type === 'complaint' ? 'Complaint' : 'Request'} logged: ${complaint.subject}`,
      createdById: user.id,
    });

    return complaint;
  }

  async updateComplaint(
    id: string,
    input: UpdateComplaintInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.complaintRequest.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Complaint not found');

    const resolving =
      input.status !== undefined &&
      (input.status === 'resolved' || input.status === 'closed') &&
      existing.status !== 'resolved' &&
      existing.status !== 'closed';

    const complaint = await this.prisma.complaintRequest.update({
      where: { id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.requesterName !== undefined ? { requesterName: input.requesterName } : {}),
        ...(input.requesterPhone !== undefined ? { requesterPhone: input.requesterPhone } : {}),
        ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
        ...(resolving ? { resolvedAt: new Date() } : {}),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: resolving ? 'complaint.resolved' : 'complaint.updated',
      entityType: 'ComplaintRequest',
      entityId: complaint.id,
      previousValue: existing,
      newValue: complaint,
    });

    await this.logReceptionActivity({
      branchId: complaint.branchId,
      action: resolving ? 'complaint.resolved' : 'complaint.updated',
      entityType: 'ComplaintRequest',
      entityId: complaint.id,
      summary: resolving
        ? `${complaint.type === 'complaint' ? 'Complaint' : 'Request'} resolved: ${complaint.subject}`
        : `${complaint.type === 'complaint' ? 'Complaint' : 'Request'} updated: ${complaint.subject}`,
      createdById: user.id,
    });

    return complaint;
  }

  async removeComplaint(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.complaintRequest.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Complaint not found');

    const complaint = await this.prisma.complaintRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      action: 'complaint.deleted',
      entityType: 'ComplaintRequest',
      entityId: complaint.id,
      previousValue: existing,
    });

    await this.logReceptionActivity({
      branchId: complaint.branchId,
      action: 'complaint.deleted',
      entityType: 'ComplaintRequest',
      entityId: complaint.id,
      summary: `${existing.type === 'complaint' ? 'Complaint' : 'Request'} deleted: ${existing.subject}`,
      createdById: user.id,
    });

    return { deleted: true };
  }

  // --- Reception activities ---

  async findAllActivities(query: ListActivitiesQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const activities = await this.prisma.receptionActivity.findMany({
      where: {
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: activities };
  }

  async createActivityNote(input: CreateActivityNoteInput, user: AuthUser) {
    const activity = await this.prisma.receptionActivity.create({
      data: {
        branchId: input.branchId,
        action: 'note.created',
        summary: input.summary,
        createdById: user.id,
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'reception.note.created',
      entityType: 'ReceptionActivity',
      entityId: activity.id,
      newValue: activity,
    });

    return activity;
  }

  private async logReceptionActivity(entry: {
    branchId: string;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    createdById: string | null;
  }) {
    await this.prisma.receptionActivity.create({
      data: entry,
    });
  }
}
