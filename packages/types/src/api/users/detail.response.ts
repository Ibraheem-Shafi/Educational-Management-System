export interface UserPermissionDetail {
  code: string;
  /** Human-readable description (from Permission.name). */
  name: string;
  module: string;
}

export interface UserDetailRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface UserDetailResponse {
  id: string;
  staffCode: string;
  email: string;
  fullName: string;
  phone: string | null;
  gender: string | null;
  cnic: string | null;
  department: string | null;
  designation: string | null;
  branchId: string | null;
  branch: { id: string; name: string; code: string } | null;
  isActive: boolean;
  roles: UserDetailRole[];
  permissions: UserPermissionDetail[];
  lastLoginAt: string | null;
  createdAt: string;
}
