export const DEMO_SEED_VERSION = 'nexium-v1.6';

export interface DemoConfig {
  version: string;
  institution: {
    siblingDiscountPercent: number;
    lateFeeAmount: number;
    lateFeeDaysAfterDue: number;
  };
  accounts: DemoAccount[];
  batches: DemoBatch[];
  students: DemoStudent[];
  parents: DemoParent[];
  links: DemoParentLink[];
  assessments: DemoAssessment[];
  feeStructures: DemoFeeStructure[];
  notices: DemoNotice[];
  timetable: DemoTimetableSlot[];
  documents: DemoDocument[];
  communications: DemoCommunication[];
}

export interface DemoAccount {
  email: string;
  fullName: string;
  role: string;
  branchCode?: string | null;
  phone?: string;
  gender?: 'male' | 'female' | 'other';
  cnic?: string;
}

export interface DemoBatch {
  code: string;
  name: string;
  branchCode: string;
  programCode: string;
  scheduleType: string;
  subjects: string[];
}

export interface DemoStudent {
  demoKey: string;
  batchCode: string;
  fullName: string;
  gender: 'male' | 'female';
  dob: string;
  cnic: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  status: string;
  customFields: Record<string, string>;
}

export interface DemoParent {
  demoKey: string;
  fullName: string;
  phone: string;
  email?: string;
  cnic: string;
  address?: string;
}

export interface DemoParentLink {
  studentDemoKey: string;
  parentDemoKey: string;
  relationship: string;
}

export interface DemoAssessment {
  demoKey: string;
  branchCode: string;
  name: string;
  typeCode: string;
  seriesCode?: string | null;
  totalMarks: number;
  daysAgo: number;
  batchCode: string;
  subjectCodes: string[];
}

export interface DemoFeeStructure {
  feeTypeCode: string;
  branchCode: string;
  programCode: string;
  amount: number;
  dueDayOfMonth?: number | null;
}

export interface DemoNotice {
  branchCode: string;
  title: string;
  body: string;
  audience: string;
  published: boolean;
  daysAgo: number;
}

export interface DemoTimetableSlot {
  batchCode: string;
  branchCode: string;
  teacherEmail?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectCode: string;
  room?: string;
}

export interface DemoDocument {
  branchCode: string;
  studentDemoKey?: string | null;
  category: string;
  title: string;
  storagePath: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface DemoCommunication {
  channel: string;
  recipient: string;
  subject?: string | null;
  body: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface DemoContext {
  branchMap: Map<string, string>;
  roleMap: Map<string, string>;
  subjectMap: Map<string, string>;
  programMap: Map<string, string>;
  batchMap: Map<string, string>;
  feeTypeMap: Map<string, string>;
  assessmentTypeMap: Map<string, string>;
  seriesMap: Map<string, string>;
  sessionId: string;
  statusIds: {
    student: Record<string, string>;
    attendance: Record<string, string>;
    fee: Record<string, string>;
  };
  userIds: Map<string, string>;
  studentIds: Map<string, string>;
  parentIds: Map<string, string>;
  config: DemoConfig;
}

export interface RunDemoSeedOptions {
  force?: boolean;
  configPath?: string;
}
