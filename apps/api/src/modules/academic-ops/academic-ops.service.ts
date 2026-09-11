import { narrowScope, prismaBranchFilter } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { paginatedResult } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import { asNumber, containsSearch, parseYmd, toIso, toYmd } from '../../common/ops/date.util';
import type { AuthUser } from '@eims/types';
import type {
  CreateAcademicActionInput,
  CreateClassroomObservationInput,
  CreateDisciplineIncidentInput,
  CreateLessonPlanInput,
  CreateSchoolEventInput,
  CreateStaffTrainingInput,
  CreateSyllabusUnitInput,
  ListAcademicActionsQuery,
  ListClassroomObservationsQuery,
  ListDisciplineIncidentsQuery,
  ListLessonPlansQuery,
  ListSchoolEventsQuery,
  ListStaffTrainingsQuery,
  ListSyllabusUnitsQuery,
  UpdateAcademicActionInput,
  UpdateClassroomObservationInput,
  UpdateDisciplineIncidentInput,
  UpdateLessonPlanInput,
  UpdateSchoolEventInput,
  UpdateStaffTrainingInput,
  UpdateSyllabusUnitInput,
} from '@eims/shared';

const userSelect = { select: { id: true, fullName: true } } as const;
const namedSelect = { select: { id: true, name: true } } as const;
const studentSelect = { select: { id: true, fullName: true, admissionNumber: true } } as const;

@Injectable()
export class AcademicOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Syllabus units ---

  async listSyllabusUnits(query: ListSyllabusUnitsQuery, scope: BranchScope) {
    const where: Prisma.SyllabusUnitWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...containsSearch(query.search, ['title', 'notes']),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      this.prisma.syllabusUnit.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { subject: namedSelect, batch: namedSelect },
      }),
      this.prisma.syllabusUnit.count({ where }),
    ]);
    return paginatedResult(rows.map((row) => this.toSyllabus(row)), total, page, limit);
  }

  async createSyllabusUnit(input: CreateSyllabusUnitInput, user: AuthUser) {
    const row = await this.prisma.syllabusUnit.create({
      data: {
        branchId: input.branchId,
        subjectId: input.subjectId,
        batchId: input.batchId ?? null,
        title: input.title,
        plannedTopics: input.plannedTopics,
        completedTopics: input.completedTopics ?? 0,
        status: input.status ?? 'planned',
        notes: input.notes ?? null,
      },
      include: { subject: namedSelect, batch: namedSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.syllabus.created',
      entityType: 'SyllabusUnit',
      entityId: row.id,
      newValue: row,
    });
    return this.toSyllabus(row);
  }

  async updateSyllabusUnit(id: string, input: UpdateSyllabusUnitInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireSyllabus(id, scope);
    const row = await this.prisma.syllabusUnit.update({
      where: { id },
      data: {
        ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
        ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.plannedTopics !== undefined ? { plannedTopics: input.plannedTopics } : {}),
        ...(input.completedTopics !== undefined ? { completedTopics: input.completedTopics } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: { subject: namedSelect, batch: namedSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.syllabus.updated',
      entityType: 'SyllabusUnit',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toSyllabus(row);
  }

  async removeSyllabusUnit(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireSyllabus(id, scope);
    await this.prisma.syllabusUnit.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.syllabus.deleted',
      entityType: 'SyllabusUnit',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Lesson plans ---

  async listLessonPlans(query: ListLessonPlansQuery, scope: BranchScope) {
    const where: Prisma.LessonPlanWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.batchId ? { batchId: query.batchId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...containsSearch(query.search, ['title', 'notes']),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      this.prisma.lessonPlan.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { subject: namedSelect, batch: namedSelect, teacher: userSelect },
      }),
      this.prisma.lessonPlan.count({ where }),
    ]);
    return paginatedResult(rows.map((row) => this.toLesson(row)), total, page, limit);
  }

  async createLessonPlan(input: CreateLessonPlanInput, user: AuthUser) {
    const row = await this.prisma.lessonPlan.create({
      data: {
        branchId: input.branchId,
        date: parseYmd(input.date, 'date'),
        batchId: input.batchId,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        title: input.title,
        status: input.status ?? 'planned',
        notes: input.notes ?? null,
      },
      include: { subject: namedSelect, batch: namedSelect, teacher: userSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.lesson.created',
      entityType: 'LessonPlan',
      entityId: row.id,
      newValue: row,
    });
    return this.toLesson(row);
  }

  async updateLessonPlan(id: string, input: UpdateLessonPlanInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireLesson(id, scope);
    const row = await this.prisma.lessonPlan.update({
      where: { id },
      data: {
        ...(input.date !== undefined ? { date: parseYmd(input.date, 'date') } : {}),
        ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
        ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
        ...(input.teacherId !== undefined ? { teacherId: input.teacherId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: { subject: namedSelect, batch: namedSelect, teacher: userSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.lesson.updated',
      entityType: 'LessonPlan',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toLesson(row);
  }

  async removeLessonPlan(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireLesson(id, scope);
    await this.prisma.lessonPlan.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.lesson.deleted',
      entityType: 'LessonPlan',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Observations ---

  async listObservations(query: ListClassroomObservationsQuery, scope: BranchScope) {
    const where: Prisma.ClassroomObservationWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...containsSearch(query.search, ['summary']),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      this.prisma.classroomObservation.findMany({
        where,
        orderBy: { observedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { teacher: userSelect, observer: userSelect },
      }),
      this.prisma.classroomObservation.count({ where }),
    ]);
    return paginatedResult(rows.map((row) => this.toObservation(row)), total, page, limit);
  }

  async createObservation(input: CreateClassroomObservationInput, user: AuthUser) {
    const row = await this.prisma.classroomObservation.create({
      data: {
        branchId: input.branchId,
        observedAt: parseYmd(input.observedAt, 'observedAt'),
        teacherId: input.teacherId,
        observerId: input.observerId ?? user.id,
        score: input.score ?? null,
        summary: input.summary,
      },
      include: { teacher: userSelect, observer: userSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.observation.created',
      entityType: 'ClassroomObservation',
      entityId: row.id,
      newValue: row,
    });
    return this.toObservation(row);
  }

  async updateObservation(
    id: string,
    input: UpdateClassroomObservationInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.requireObservation(id, scope);
    const row = await this.prisma.classroomObservation.update({
      where: { id },
      data: {
        ...(input.observedAt !== undefined ? { observedAt: parseYmd(input.observedAt, 'observedAt') } : {}),
        ...(input.teacherId !== undefined ? { teacherId: input.teacherId } : {}),
        ...(input.observerId !== undefined ? { observerId: input.observerId } : {}),
        ...(input.score !== undefined ? { score: input.score } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
      },
      include: { teacher: userSelect, observer: userSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.observation.updated',
      entityType: 'ClassroomObservation',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toObservation(row);
  }

  async removeObservation(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireObservation(id, scope);
    await this.prisma.classroomObservation.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.observation.deleted',
      entityType: 'ClassroomObservation',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- School events ---

  async listEvents(query: ListSchoolEventsQuery, scope: BranchScope) {
    const where: Prisma.SchoolEventWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.kind ? { kind: query.kind } : {}),
      ...containsSearch(query.search, ['title', 'notes']),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      this.prisma.schoolEvent.findMany({
        where,
        orderBy: { eventDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.schoolEvent.count({ where }),
    ]);
    return paginatedResult(rows.map((row) => this.toEvent(row)), total, page, limit);
  }

  async createEvent(input: CreateSchoolEventInput, user: AuthUser) {
    const row = await this.prisma.schoolEvent.create({
      data: {
        branchId: input.branchId,
        kind: input.kind,
        title: input.title,
        eventDate: parseYmd(input.eventDate, 'eventDate'),
        attendeeCount: input.attendeeCount ?? null,
        notes: input.notes ?? null,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.event.created',
      entityType: 'SchoolEvent',
      entityId: row.id,
      newValue: row,
    });
    return this.toEvent(row);
  }

  async updateEvent(id: string, input: UpdateSchoolEventInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireEvent(id, scope);
    const row = await this.prisma.schoolEvent.update({
      where: { id },
      data: {
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.eventDate !== undefined ? { eventDate: parseYmd(input.eventDate, 'eventDate') } : {}),
        ...(input.attendeeCount !== undefined ? { attendeeCount: input.attendeeCount } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.event.updated',
      entityType: 'SchoolEvent',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toEvent(row);
  }

  async removeEvent(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireEvent(id, scope);
    await this.prisma.schoolEvent.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.event.deleted',
      entityType: 'SchoolEvent',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Discipline ---

  async listDiscipline(query: ListDisciplineIncidentsQuery, scope: BranchScope) {
    const where: Prisma.DisciplineIncidentWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...containsSearch(query.search, ['type', 'action', 'notes']),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      this.prisma.disciplineIncident.findMany({
        where,
        orderBy: { incidentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { student: studentSelect },
      }),
      this.prisma.disciplineIncident.count({ where }),
    ]);
    return paginatedResult(rows.map((row) => this.toDiscipline(row)), total, page, limit);
  }

  async createDiscipline(input: CreateDisciplineIncidentInput, user: AuthUser) {
    const row = await this.prisma.disciplineIncident.create({
      data: {
        branchId: input.branchId,
        studentId: input.studentId,
        incidentDate: parseYmd(input.incidentDate, 'incidentDate'),
        type: input.type,
        action: input.action,
        notes: input.notes ?? null,
      },
      include: { student: studentSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.discipline.created',
      entityType: 'DisciplineIncident',
      entityId: row.id,
      newValue: row,
    });
    return this.toDiscipline(row);
  }

  async updateDiscipline(
    id: string,
    input: UpdateDisciplineIncidentInput,
    user: AuthUser,
    scope: BranchScope,
  ) {
    const existing = await this.requireDiscipline(id, scope);
    const row = await this.prisma.disciplineIncident.update({
      where: { id },
      data: {
        ...(input.studentId !== undefined ? { studentId: input.studentId } : {}),
        ...(input.incidentDate !== undefined
          ? { incidentDate: parseYmd(input.incidentDate, 'incidentDate') }
          : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.action !== undefined ? { action: input.action } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: { student: studentSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.discipline.updated',
      entityType: 'DisciplineIncident',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toDiscipline(row);
  }

  async removeDiscipline(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireDiscipline(id, scope);
    await this.prisma.disciplineIncident.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.discipline.deleted',
      entityType: 'DisciplineIncident',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Academic actions ---

  async listActions(query: ListAcademicActionsQuery, scope: BranchScope) {
    const where: Prisma.AcademicActionWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...containsSearch(query.search, ['title', 'notes']),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      this.prisma.academicAction.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { owner: userSelect },
      }),
      this.prisma.academicAction.count({ where }),
    ]);
    return paginatedResult(rows.map((row) => this.toAction(row)), total, page, limit);
  }

  async createAction(input: CreateAcademicActionInput, user: AuthUser) {
    const row = await this.prisma.academicAction.create({
      data: {
        branchId: input.branchId,
        kind: input.kind,
        title: input.title,
        status: input.status ?? 'open',
        ownerUserId: input.ownerUserId ?? user.id,
        dueDate: input.dueDate ? parseYmd(input.dueDate, 'dueDate') : null,
        notes: input.notes ?? null,
      },
      include: { owner: userSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.action.created',
      entityType: 'AcademicAction',
      entityId: row.id,
      newValue: row,
    });
    return this.toAction(row);
  }

  async updateAction(id: string, input: UpdateAcademicActionInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireAction(id, scope);
    const row = await this.prisma.academicAction.update({
      where: { id },
      data: {
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ? parseYmd(input.dueDate, 'dueDate') : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: { owner: userSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.action.updated',
      entityType: 'AcademicAction',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toAction(row);
  }

  async removeAction(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireAction(id, scope);
    await this.prisma.academicAction.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.action.deleted',
      entityType: 'AcademicAction',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  // --- Training ---

  async listTrainings(query: ListStaffTrainingsQuery, scope: BranchScope) {
    const where: Prisma.StaffTrainingWhereInput = {
      deletedAt: null,
      ...prismaBranchFilter(narrowScope(scope, query.branchId)),
      ...(query.userId ? { userId: query.userId } : {}),
      ...containsSearch(query.search, ['title', 'notes']),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;
    const [rows, total] = await Promise.all([
      this.prisma.staffTraining.findMany({
        where,
        orderBy: { trainedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: userSelect },
      }),
      this.prisma.staffTraining.count({ where }),
    ]);
    return paginatedResult(rows.map((row) => this.toTraining(row)), total, page, limit);
  }

  async createTraining(input: CreateStaffTrainingInput, user: AuthUser) {
    const row = await this.prisma.staffTraining.create({
      data: {
        branchId: input.branchId,
        userId: input.userId,
        title: input.title,
        trainedAt: parseYmd(input.trainedAt, 'trainedAt'),
        hours: input.hours,
        notes: input.notes ?? null,
      },
      include: { user: userSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.training.created',
      entityType: 'StaffTraining',
      entityId: row.id,
      newValue: row,
    });
    return this.toTraining(row);
  }

  async updateTraining(id: string, input: UpdateStaffTrainingInput, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireTraining(id, scope);
    const row = await this.prisma.staffTraining.update({
      where: { id },
      data: {
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.trainedAt !== undefined ? { trainedAt: parseYmd(input.trainedAt, 'trainedAt') } : {}),
        ...(input.hours !== undefined ? { hours: input.hours } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: { user: userSelect },
    });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.training.updated',
      entityType: 'StaffTraining',
      entityId: id,
      previousValue: existing,
      newValue: row,
    });
    return this.toTraining(row);
  }

  async removeTraining(id: string, user: AuthUser, scope: BranchScope) {
    const existing = await this.requireTraining(id, scope);
    await this.prisma.staffTraining.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'academic_ops.training.deleted',
      entityType: 'StaffTraining',
      entityId: id,
      previousValue: existing,
    });
    return { success: true };
  }

  private async requireSyllabus(id: string, scope: BranchScope) {
    const row = await this.prisma.syllabusUnit.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Syllabus unit not found');
    return row;
  }

  private async requireLesson(id: string, scope: BranchScope) {
    const row = await this.prisma.lessonPlan.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Lesson plan not found');
    return row;
  }

  private async requireObservation(id: string, scope: BranchScope) {
    const row = await this.prisma.classroomObservation.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Observation not found');
    return row;
  }

  private async requireEvent(id: string, scope: BranchScope) {
    const row = await this.prisma.schoolEvent.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Event not found');
    return row;
  }

  private async requireDiscipline(id: string, scope: BranchScope) {
    const row = await this.prisma.disciplineIncident.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Discipline incident not found');
    return row;
  }

  private async requireAction(id: string, scope: BranchScope) {
    const row = await this.prisma.academicAction.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Academic action not found');
    return row;
  }

  private async requireTraining(id: string, scope: BranchScope) {
    const row = await this.prisma.staffTraining.findFirst({
      where: { id, deletedAt: null, ...prismaBranchFilter(scope) },
    });
    if (!row) throw new NotFoundException('Training record not found');
    return row;
  }

  private toSyllabus(row: {
    id: string;
    branchId: string;
    subjectId: string;
    batchId: string | null;
    title: string;
    plannedTopics: number;
    completedTopics: number;
    status: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    subject: { id: string; name: string };
    batch: { id: string; name: string } | null;
  }) {
    const coveragePercent =
      row.plannedTopics > 0 ? Math.round((row.completedTopics / row.plannedTopics) * 1000) / 10 : 0;
    return {
      id: row.id,
      branchId: row.branchId,
      subjectId: row.subjectId,
      batchId: row.batchId,
      title: row.title,
      plannedTopics: row.plannedTopics,
      completedTopics: row.completedTopics,
      coveragePercent,
      status: row.status,
      notes: row.notes,
      subject: row.subject,
      batch: row.batch,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toLesson(row: {
    id: string;
    branchId: string;
    date: Date;
    batchId: string;
    subjectId: string;
    teacherId: string;
    title: string;
    status: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    subject: { id: string; name: string };
    batch: { id: string; name: string };
    teacher: { id: string; fullName: string };
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      date: toYmd(row.date),
      batchId: row.batchId,
      subjectId: row.subjectId,
      teacherId: row.teacherId,
      title: row.title,
      status: row.status,
      notes: row.notes,
      subject: row.subject,
      batch: row.batch,
      teacher: row.teacher,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toObservation(row: {
    id: string;
    branchId: string;
    observedAt: Date;
    teacherId: string;
    observerId: string | null;
    score: Prisma.Decimal | number | null;
    summary: string;
    createdAt: Date;
    updatedAt: Date;
    teacher: { id: string; fullName: string };
    observer: { id: string; fullName: string } | null;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      observedAt: toYmd(row.observedAt),
      teacherId: row.teacherId,
      observerId: row.observerId,
      score: row.score != null ? asNumber(row.score) : null,
      summary: row.summary,
      teacher: row.teacher,
      observer: row.observer,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toEvent(row: {
    id: string;
    branchId: string;
    kind: string;
    title: string;
    eventDate: Date;
    attendeeCount: number | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      kind: row.kind,
      title: row.title,
      eventDate: toYmd(row.eventDate),
      attendeeCount: row.attendeeCount,
      notes: row.notes,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toDiscipline(row: {
    id: string;
    branchId: string;
    studentId: string;
    incidentDate: Date;
    type: string;
    action: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    student: { id: string; fullName: string; admissionNumber: string | null };
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      studentId: row.studentId,
      incidentDate: toYmd(row.incidentDate),
      type: row.type,
      action: row.action,
      notes: row.notes,
      student: row.student,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toAction(row: {
    id: string;
    branchId: string;
    kind: string;
    title: string;
    status: string;
    ownerUserId: string | null;
    dueDate: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    owner: { id: string; fullName: string } | null;
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      kind: row.kind,
      title: row.title,
      status: row.status,
      ownerUserId: row.ownerUserId,
      dueDate: toYmd(row.dueDate),
      notes: row.notes,
      owner: row.owner,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private toTraining(row: {
    id: string;
    branchId: string;
    userId: string;
    title: string;
    trainedAt: Date;
    hours: Prisma.Decimal | number;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: { id: string; fullName: string };
  }) {
    return {
      id: row.id,
      branchId: row.branchId,
      userId: row.userId,
      title: row.title,
      trainedAt: toYmd(row.trainedAt),
      hours: asNumber(row.hours),
      notes: row.notes,
      user: row.user,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }
}
