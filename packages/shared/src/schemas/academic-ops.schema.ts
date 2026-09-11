import { z } from 'zod';
import { MSG, optionalString, requiredId, requiredString } from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const syllabusUnitStatuses = ['planned', 'in_progress', 'completed'] as const;
export const lessonPlanStatuses = ['planned', 'taught', 'missed'] as const;
export const schoolEventKinds = ['co_curricular', 'ptm'] as const;
export const academicActionKinds = ['improvement_plan', 'challenge'] as const;
export const academicActionStatuses = ['open', 'in_progress', 'done'] as const;

const listBase = z
  .object({
    branchId: z.string().optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export const createSyllabusUnitSchema = z.object({
  branchId: requiredId('Branch'),
  subjectId: requiredId('Subject'),
  batchId: z.string().optional().nullable(),
  title: requiredString('Title', 1, 200),
  plannedTopics: z.coerce.number().int().min(0),
  completedTopics: z.coerce.number().int().min(0).optional(),
  status: z.enum(syllabusUnitStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  notes: optionalString(2000).nullable(),
});
export type CreateSyllabusUnitInput = z.infer<typeof createSyllabusUnitSchema>;
export const updateSyllabusUnitSchema = createSyllabusUnitSchema.omit({ branchId: true }).partial();
export type UpdateSyllabusUnitInput = z.infer<typeof updateSyllabusUnitSchema>;
export const listSyllabusUnitsQuerySchema = listBase.extend({
  subjectId: z.string().optional(),
  batchId: z.string().optional(),
  status: z.enum(syllabusUnitStatuses).optional(),
});
export type ListSyllabusUnitsQuery = z.infer<typeof listSyllabusUnitsQuerySchema>;

export const createLessonPlanSchema = z.object({
  branchId: requiredId('Branch'),
  date: requiredId('Date'),
  batchId: requiredId('Batch'),
  subjectId: requiredId('Subject'),
  teacherId: requiredId('Teacher'),
  title: requiredString('Title', 1, 200),
  status: z.enum(lessonPlanStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  notes: optionalString(2000).nullable(),
});
export type CreateLessonPlanInput = z.infer<typeof createLessonPlanSchema>;
export const updateLessonPlanSchema = createLessonPlanSchema.omit({ branchId: true }).partial();
export type UpdateLessonPlanInput = z.infer<typeof updateLessonPlanSchema>;
export const listLessonPlansQuerySchema = listBase.extend({
  batchId: z.string().optional(),
  subjectId: z.string().optional(),
  teacherId: z.string().optional(),
  status: z.enum(lessonPlanStatuses).optional(),
});
export type ListLessonPlansQuery = z.infer<typeof listLessonPlansQuerySchema>;

export const createClassroomObservationSchema = z.object({
  branchId: requiredId('Branch'),
  observedAt: requiredId('Observation date'),
  teacherId: requiredId('Teacher'),
  observerId: z.string().optional().nullable(),
  score: z.coerce.number().min(0).max(100).optional().nullable(),
  summary: requiredString('Summary', 1, 5000),
});
export type CreateClassroomObservationInput = z.infer<typeof createClassroomObservationSchema>;
export const updateClassroomObservationSchema = createClassroomObservationSchema
  .omit({ branchId: true })
  .partial();
export type UpdateClassroomObservationInput = z.infer<typeof updateClassroomObservationSchema>;
export const listClassroomObservationsQuerySchema = listBase.extend({
  teacherId: z.string().optional(),
});
export type ListClassroomObservationsQuery = z.infer<typeof listClassroomObservationsQuerySchema>;

export const createSchoolEventSchema = z.object({
  branchId: requiredId('Branch'),
  kind: z.enum(schoolEventKinds, { errorMap: () => ({ message: MSG.select('kind') }) }),
  title: requiredString('Title', 1, 200),
  eventDate: requiredId('Event date'),
  attendeeCount: z.coerce.number().int().min(0).optional().nullable(),
  notes: optionalString(2000).nullable(),
});
export type CreateSchoolEventInput = z.infer<typeof createSchoolEventSchema>;
export const updateSchoolEventSchema = createSchoolEventSchema.omit({ branchId: true }).partial();
export type UpdateSchoolEventInput = z.infer<typeof updateSchoolEventSchema>;
export const listSchoolEventsQuerySchema = listBase.extend({
  kind: z.enum(schoolEventKinds).optional(),
});
export type ListSchoolEventsQuery = z.infer<typeof listSchoolEventsQuerySchema>;

export const createDisciplineIncidentSchema = z.object({
  branchId: requiredId('Branch'),
  studentId: requiredId('Student'),
  incidentDate: requiredId('Incident date'),
  type: requiredString('Type', 1, 100),
  action: requiredString('Action', 1, 500),
  notes: optionalString(2000).nullable(),
});
export type CreateDisciplineIncidentInput = z.infer<typeof createDisciplineIncidentSchema>;
export const updateDisciplineIncidentSchema = createDisciplineIncidentSchema
  .omit({ branchId: true })
  .partial();
export type UpdateDisciplineIncidentInput = z.infer<typeof updateDisciplineIncidentSchema>;
export const listDisciplineIncidentsQuerySchema = listBase.extend({
  studentId: z.string().optional(),
});
export type ListDisciplineIncidentsQuery = z.infer<typeof listDisciplineIncidentsQuerySchema>;

export const createAcademicActionSchema = z.object({
  branchId: requiredId('Branch'),
  kind: z.enum(academicActionKinds, { errorMap: () => ({ message: MSG.select('kind') }) }),
  title: requiredString('Title', 1, 200),
  status: z.enum(academicActionStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  ownerUserId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: optionalString(2000).nullable(),
});
export type CreateAcademicActionInput = z.infer<typeof createAcademicActionSchema>;
export const updateAcademicActionSchema = createAcademicActionSchema.omit({ branchId: true }).partial();
export type UpdateAcademicActionInput = z.infer<typeof updateAcademicActionSchema>;
export const listAcademicActionsQuerySchema = listBase.extend({
  kind: z.enum(academicActionKinds).optional(),
  status: z.enum(academicActionStatuses).optional(),
});
export type ListAcademicActionsQuery = z.infer<typeof listAcademicActionsQuerySchema>;

export const createStaffTrainingSchema = z.object({
  branchId: requiredId('Branch'),
  userId: requiredId('Staff member'),
  title: requiredString('Title', 1, 200),
  trainedAt: requiredId('Training date'),
  hours: z.coerce.number().min(0).max(1000),
  notes: optionalString(2000).nullable(),
});
export type CreateStaffTrainingInput = z.infer<typeof createStaffTrainingSchema>;
export const updateStaffTrainingSchema = createStaffTrainingSchema.omit({ branchId: true }).partial();
export type UpdateStaffTrainingInput = z.infer<typeof updateStaffTrainingSchema>;
export const listStaffTrainingsQuerySchema = listBase.extend({
  userId: z.string().optional(),
});
export type ListStaffTrainingsQuery = z.infer<typeof listStaffTrainingsQuerySchema>;
