export interface LearningAttachmentResponse {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface LearningResourceResponse {
  id: string;
  branchId: string;
  type: string;
  title: string;
  description: string | null;
  body: string | null;
  programId: string | null;
  batchId: string | null;
  subjectId: string | null;
  visibilityScope: string;
  audience: string;
  dueAt: string | null;
  maxMarks: number | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: LearningAttachmentResponse[];
  batch?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  program?: { id: string; name: string } | null;
  createdBy?: { id: string; fullName: string } | null;
}
