export interface BranchListRow {
  id: string;
  code: string;
  name: string;
  addressLabel: string;
  email: string | null;
  phone: string | null;
  principalName: string | null;
  studentCount: number;
  staffCount: number;
  isActive: boolean;
}
