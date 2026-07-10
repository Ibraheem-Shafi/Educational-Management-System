export type StaffListStatus = 'active' | 'inactive' | 'invited';

export interface StaffListRow {
  id: string;
  staffCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  cnic: string | null;
  gender: string | null;
  branchName: string | null;
  roleName: string;
  roleId: string | null;
  status: StaffListStatus;
  isInvitation: boolean;
}
