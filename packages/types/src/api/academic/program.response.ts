export interface ProgramBatchSummary {
  id: string;
  name: string;
}

export interface ProgramSubjectSummary {
  id: string;
  name: string;
  code: string | null;
}

export interface ProgramBatchDetail extends ProgramBatchSummary {
  subjects: ProgramSubjectSummary[];
}

export interface ProgramListItem {
  id: string;
  branchId: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  batches: ProgramBatchSummary[];
}

export interface ProgramListResponse {
  data: ProgramListItem[];
}

export interface ProgramDetailResponse {
  id: string;
  branchId: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  batches: ProgramBatchDetail[];
}
