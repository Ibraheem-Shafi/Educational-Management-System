export interface AuthUser {
  id: string;
  supabaseUserId: string;
  email: string;
  fullName: string;
  branchId: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthMeResponse {
  user: AuthUser;
}
