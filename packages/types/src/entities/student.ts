export interface Student {
  id: string;
  branchId: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  cnicOrBForm: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  photographUrl: string | null;
  programId: string | null;
  batchId: string | null;
  statusId: string;
  createdAt: string;
  updatedAt: string;
}
