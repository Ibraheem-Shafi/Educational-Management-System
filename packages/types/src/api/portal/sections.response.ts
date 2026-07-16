import type { PaginatedResponse } from '../common/pagination';

export interface PortalAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  other: number;
  presentRate: number;
}

export interface PortalAttendanceRecord {
  id: string;
  date: string;
  status?: { label: string; code?: string } | null;
  remarks?: string | null;
}

export interface PortalAttendanceResponse {
  summary: PortalAttendanceSummary;
  records: PaginatedResponse<PortalAttendanceRecord>;
}

export interface PortalAssessmentRecord {
  id: string;
  assessment: string | null;
  subject: string | null;
  grade: string | null;
  percentage: number | null;
}

export interface PortalAssessmentsResponse {
  averagePercentage: number | null;
  bySubject: Array<{ subject: string; average: number; count: number }>;
  records: PaginatedResponse<PortalAssessmentRecord>;
}

export interface PortalFeeInvoice {
  id: string;
  feeType?: { name: string };
  netAmount: number;
  status?: { label: string; code?: string };
  paidAt?: string | null;
}

export interface PortalFeesResponse {
  outstanding: number;
  invoices: PaginatedResponse<PortalFeeInvoice>;
}

export interface PortalTimetableSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  subjectName: string | null;
  teacherName: string | null;
}

export interface PortalTimetableResponse {
  slots: PortalTimetableSlot[];
  todaySlots: PortalTimetableSlot[];
}

export interface PortalNoticeItem {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string | null;
}

export interface PortalDocumentItem {
  id: string;
  title: string;
  category: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface PortalCalendarEvent {
  date: string;
  title: string;
  type: 'notice' | 'homework' | 'assessment' | 'event';
  href?: string;
}

export interface PortalCalendarResponse {
  month: string;
  events: PortalCalendarEvent[];
}

export interface PortalStudentInsightsResponse {
  student: { id: string; fullName: string; batch?: string; program?: string };
  overallPercentage: number | null;
  narrative: string;
  recommendations: Array<{ subject: string; tip: string }>;
  subjects: Array<{ subjectName: string; averagePercentage: number | null }>;
}

export interface PortalStudentProfileResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    gender: string | null;
    roles: string[];
  };
  student: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    batch?: { name: string } | null;
    program?: { name: string } | null;
  } | null;
}

export interface PortalParentProfileResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    gender: string | null;
    roles: string[];
  };
  parent: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  children: Array<{ id: string; fullName: string; relationshipCode: string }>;
}

export interface LeaveRequestResponse {
  id: string;
  studentId: string;
  studentName: string;
  parentId: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  createdAt: string;
}
