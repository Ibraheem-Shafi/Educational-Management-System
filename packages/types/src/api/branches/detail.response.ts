import type { Branch } from '../../entities/branch';
import type { DashboardRecentActivity } from '../dashboard/recent-activities.response';

export interface BranchPrincipalDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  gender: string | null;
}

export interface BranchStaffMember {
  id: string;
  fullName: string;
  roleName: string;
  gender: string | null;
}

export interface BranchDetailResponse extends Branch {
  addressLabel: string;
  principalName: string | null;
  principal: BranchPrincipalDetail | null;
  studentCount: number;
  staffCount: number;
  classCount: number;
  staff: BranchStaffMember[];
  recentActivities: DashboardRecentActivity[];
}
