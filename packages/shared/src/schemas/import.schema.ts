import { z } from 'zod';
import { MSG, optionalString, requiredId, requiredString } from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const IMPORT_PIPELINES = [
  'academic',
  'students',
  'fee_register',
  'staff',
  'timetable',
  'notices',
] as const;

export type ImportPipelineType = (typeof IMPORT_PIPELINES)[number];

export const IMPORT_JOB_STATUSES = [
  'draft',
  'validating',
  'ready',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export type ImportJobStatusType = (typeof IMPORT_JOB_STATUSES)[number];

export const FEE_REGISTER_MODES = ['flat', 'wide'] as const;

export type ImportFieldType = 'string' | 'number' | 'date' | 'boolean' | 'enum';

export interface ImportFieldDef {
  key: string;
  label: string;
  required?: boolean;
  type?: ImportFieldType;
  hint?: string;
  enumValues?: string[];
}

/** Column key → spreadsheet header name (exact header cell text). */
export type ImportColumnMapping = Record<string, string>;

export interface FeeWideMonthGroup {
  billingPeriod: string;
  columns: {
    tuition?: string;
    arrears?: string;
    paid?: string;
    due?: string;
    voucherNo?: string;
    annual?: string;
    party?: string;
  };
}

export interface ImportMappingPayload {
  columns: ImportColumnMapping;
  /** Fee register wide mode month groups. */
  monthGroups?: FeeWideMonthGroup[];
}

export const feeWideMonthGroupSchema = z.object({
  billingPeriod: requiredString('Billing period', 1, 20),
  columns: z.object({
    tuition: z.string().optional(),
    arrears: z.string().optional(),
    paid: z.string().optional(),
    due: z.string().optional(),
    voucherNo: z.string().optional(),
    annual: z.string().optional(),
    party: z.string().optional(),
  }),
});

export const importMappingSchema = z.object({
  columns: z.record(z.string()),
  monthGroups: z.array(feeWideMonthGroupSchema).optional(),
});

export type ImportMappingInput = z.infer<typeof importMappingSchema>;

export const importJobOptionsSchema = z.object({
  feeMode: z.enum(FEE_REGISTER_MODES).optional(),
  createMissingStudents: z.boolean().optional(),
  timetableMode: z.enum(['append', 'replace']).optional(),
  defaultRoleCode: z.string().optional(),
  generateStaffPasswords: z.boolean().optional(),
});

export type ImportJobOptionsInput = z.infer<typeof importJobOptionsSchema>;

export const prepareImportUploadSchema = z.object({
  fileName: requiredString('File name', 1, 240),
  mimeType: optionalString(120),
  branchId: requiredId('Branch').optional(),
});

export type PrepareImportUploadInput = z.infer<typeof prepareImportUploadSchema>;

export const parseImportFileSchema = z.object({
  filePath: requiredString('File path', 1, 500),
  sheetName: z.string().optional(),
  /** Omit or null to auto-detect the header row (title rows are skipped). */
  headerRow: z.coerce.number().int().min(0).max(50).nullish(),
});

export type ParseImportFileInput = z.infer<typeof parseImportFileSchema>;

export const createImportJobSchema = z.object({
  pipeline: z.enum(IMPORT_PIPELINES, { errorMap: () => ({ message: MSG.select('pipeline') }) }),
  branchId: requiredId('Branch'),
  filePath: requiredString('File path', 1, 500),
  fileName: optionalString(240),
  sheetName: optionalString(120),
  headerRow: z.coerce.number().int().min(0).max(50).default(0),
  mapping: importMappingSchema,
  options: importJobOptionsSchema.optional(),
});

export type CreateImportJobInput = z.infer<typeof createImportJobSchema>;

export const listImportJobsQuerySchema = paginationQuerySchema.extend({
  pipeline: z.enum(IMPORT_PIPELINES).optional(),
  status: z.enum(IMPORT_JOB_STATUSES).optional(),
  /** Super Admin only — ignored for campus-scoped roles (always their branch). */
  branchId: requiredId('Branch').optional(),
});

export type ListImportJobsQuery = z.infer<typeof listImportJobsQuerySchema>;

export const listImportErrorsQuerySchema = paginationQuerySchema;

export type ListImportErrorsQuery = z.infer<typeof listImportErrorsQuerySchema>;

export const createImportMappingProfileSchema = z.object({
  name: requiredString('Name', 1, 120),
  pipeline: z.enum(IMPORT_PIPELINES),
  branchId: requiredId('Branch').optional(),
  mapping: importMappingSchema,
  options: importJobOptionsSchema.optional(),
});

export type CreateImportMappingProfileInput = z.infer<typeof createImportMappingProfileSchema>;

export const updateImportMappingProfileSchema = createImportMappingProfileSchema.partial().extend({
  name: requiredString('Name', 1, 120).optional(),
});

export type UpdateImportMappingProfileInput = z.infer<typeof updateImportMappingProfileSchema>;

export const listImportProfilesQuerySchema = z.object({
  pipeline: z.enum(IMPORT_PIPELINES).optional(),
  branchId: z.string().optional(),
});

export type ListImportProfilesQuery = z.infer<typeof listImportProfilesQuerySchema>;

/** Field catalogs per pipeline (UI mapping targets). */
export const IMPORT_PIPELINE_FIELDS: Record<ImportPipelineType, ImportFieldDef[]> = {
  academic: [
    { key: 'programName', label: 'Program name', required: true },
    { key: 'programCode', label: 'Program code' },
    { key: 'batchName', label: 'Batch / class name', required: true },
    { key: 'batchCode', label: 'Batch code' },
    { key: 'sessionName', label: 'Academic session name' },
    { key: 'subjectName', label: 'Subject name' },
    { key: 'subjectCode', label: 'Subject code' },
    { key: 'linkSubjectToBatch', label: 'Link subject to batch (yes/no)', type: 'boolean' },
  ],
  students: [
    { key: 'fullName', label: 'Student full name', required: true },
    { key: 'admissionNumber', label: 'Admission / enrollment number', required: true },
    { key: 'rollNumber', label: 'Roll number' },
    { key: 'statusCode', label: 'Status code (e.g. active)' },
    { key: 'programName', label: 'Program name' },
    { key: 'batchName', label: 'Batch / class name' },
    { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
    { key: 'gender', label: 'Gender' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    { key: 'cnic', label: 'CNIC / B-form' },
    { key: 'fatherName', label: 'Father name' },
    { key: 'motherName', label: 'Mother name' },
    { key: 'guardianPhone', label: 'Guardian phone' },
  ],
  fee_register: [
    { key: 'admissionNumber', label: 'Admission / enrollment number', required: true },
    { key: 'fullName', label: 'Student full name' },
    { key: 'fatherName', label: 'Father name' },
    { key: 'className', label: 'Class / batch name' },
    { key: 'billingPeriod', label: 'Billing period (YYYY-MM) — flat mode', hint: 'Required in flat mode' },
    { key: 'tuition', label: 'Tuition / monthly amount — flat mode', type: 'number' },
    { key: 'arrears', label: 'Arrears / previous — flat mode', type: 'number' },
    { key: 'paid', label: 'Paid amount — flat mode', type: 'number' },
    { key: 'due', label: 'Due amount — flat mode', type: 'number' },
    { key: 'voucherNo', label: 'Voucher / challan no — flat mode' },
    { key: 'annual', label: 'Annual fee — flat mode', type: 'number' },
    { key: 'party', label: 'Party / other fee — flat mode', type: 'number' },
    { key: 'phone', label: 'Contact phone' },
  ],
  staff: [
    { key: 'fullName', label: 'Full name', required: true },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'roleCode', label: 'System role code (teacher, receptionist, …)' },
    { key: 'designation', label: 'Designation' },
    { key: 'gender', label: 'Gender' },
    { key: 'cnic', label: 'CNIC' },
    { key: 'joiningDate', label: 'Joining date', type: 'date' },
    { key: 'department', label: 'Department' },
  ],
  timetable: [
    { key: 'batchName', label: 'Batch / class name', required: true },
    { key: 'subjectName', label: 'Subject name', required: true },
    { key: 'dayOfWeek', label: 'Day of week (1=Mon … 7=Sun or name)', required: true },
    { key: 'startTime', label: 'Start time (HH:MM)', required: true },
    { key: 'endTime', label: 'End time (HH:MM)', required: true },
    { key: 'teacherPhoneOrEmail', label: 'Teacher phone or email' },
    { key: 'room', label: 'Room' },
  ],
  notices: [
    { key: 'title', label: 'Title', required: true },
    { key: 'body', label: 'Body', required: true },
    {
      key: 'audience',
      label: 'Audience',
      required: true,
      type: 'enum',
      enumValues: ['all', 'parents', 'students', 'staff', 'teachers'],
    },
    { key: 'publishedAt', label: 'Published at', type: 'date' },
  ],
};

export const IMPORT_PIPELINE_LABELS: Record<ImportPipelineType, string> = {
  academic: 'Academic (programs / batches / subjects)',
  students: 'Students & parents',
  fee_register: 'Fee register',
  staff: 'Staff users',
  timetable: 'Timetable',
  notices: 'Notices',
};
