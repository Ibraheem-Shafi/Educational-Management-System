import { z } from 'zod';
import { optionalString, requiredString } from '../validation/messages';

export const printDocumentTypes = [
  'fee_invoice',
  'fee_receipt',
  'roll_slip',
  'attendance_sheet',
  'student_roster',
  'accounting_voucher',
  'id_card',
  'certificate',
  'salary_slip',
  'report_card',
] as const;

export type PrintDocumentType = (typeof printDocumentTypes)[number];

export const printPaperSizes = ['a4', 'a5', 'thermal80'] as const;
export type PrintPaperSize = (typeof printPaperSizes)[number];

export const DEFAULT_PRINT_TEMPLATE_FIELDS: Record<PrintDocumentType, Record<string, boolean>> = {
  fee_invoice: {
    showLogo: true,
    showStudentPhoto: false,
    showRollNumber: true,
    showAdmissionNumber: true,
    showProgram: true,
    showBatch: true,
    showDueDate: true,
    showDiscount: true,
    showFine: true,
    showRemarks: true,
    showBankNote: true,
  },
  fee_receipt: {
    showLogo: true,
    showRollNumber: true,
    showAdmissionNumber: true,
    showProgram: true,
    showBatch: true,
    showPaymentMethod: true,
    showInvoiceRef: true,
  },
  roll_slip: {
    showLogo: true,
    showPhoto: true,
    showRollNumber: true,
    showAdmissionNumber: true,
    showProgram: true,
    showBatch: true,
    showBranch: true,
    showCnic: false,
    showPhone: false,
  },
  attendance_sheet: {
    showLogo: true,
    showRollNumber: true,
    showAdmissionNumber: false,
    showSignatureColumn: true,
  },
  student_roster: {
    showLogo: true,
    showRollNumber: true,
    showAdmissionNumber: true,
    showPhone: true,
    showStatus: true,
  },
  accounting_voucher: {
    showLogo: true,
    showNarration: true,
    showPreparedBy: true,
  },
  id_card: {
    showLogo: true,
    showPhoto: true,
    showRollNumber: true,
    showAdmissionNumber: true,
    showProgram: true,
    showBatch: true,
    showCnic: true,
  },
  certificate: {
    showLogo: true,
    showProgram: true,
    showBatch: true,
    showIssueDate: true,
    showSerialNo: true,
  },
  salary_slip: {
    showLogo: true,
    showAttendance: true,
    showComponents: true,
    showStaffCode: true,
  },
  report_card: {
    showLogo: true,
    showRollNumber: true,
    showAdmissionNumber: true,
    showProgram: true,
    showBatch: true,
  },
};

export const DEFAULT_PRINT_TEMPLATE_NAMES: Record<PrintDocumentType, string> = {
  fee_invoice: 'Fee invoice / challan',
  fee_receipt: 'Fee payment receipt',
  roll_slip: 'Roll number slip',
  attendance_sheet: 'Attendance sheet',
  student_roster: 'Student roster',
  accounting_voucher: 'Accounting voucher',
  id_card: 'Student ID card',
  certificate: 'Certificate',
  salary_slip: 'Salary slip',
  report_card: 'Report card',
};

export const updatePrintTemplateSchema = z.object({
  name: requiredString('Name', 1, 120).optional(),
  paperSize: z.enum(printPaperSizes).optional(),
  fields: z.record(z.boolean()).optional(),
  headerText: optionalString(500).nullable().optional(),
  footerText: optionalString(500).nullable().optional(),
  extraNote: optionalString(1000).nullable().optional(),
  isActive: z.boolean().optional(),
  branchId: z.string().nullable().optional(),
});

export type UpdatePrintTemplateInput = z.infer<typeof updatePrintTemplateSchema>;

export const listPrintTemplatesQuerySchema = z.object({
  type: z.enum(printDocumentTypes).optional(),
  branchId: z.string().optional(),
});

export type ListPrintTemplatesQuery = z.infer<typeof listPrintTemplatesQuerySchema>;

export const generateRollNumbersSchema = z.object({
  batchId: requiredString('Batch'),
  startFrom: z.coerce.number().int().min(1).default(1),
  prefix: optionalString(20).optional(),
  padLength: z.coerce.number().int().min(1).max(8).default(3),
  overwriteExisting: z.boolean().default(false),
});

export type GenerateRollNumbersInput = z.infer<typeof generateRollNumbersSchema>;
