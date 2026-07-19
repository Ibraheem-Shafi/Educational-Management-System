import type { Session } from '@supabase/supabase-js';
import type { AuthUser } from '@eims/types';

/** Staff user with permissions for critical-path e2e (see e2e/helpers/mock-api.ts). */
export const E2E_MOCK_USER: AuthUser = {
  id: 'user-test-1',
  supabaseUserId: 'sb-user-1',
  email: 'admin@test.pk',
  fullName: 'Test Admin',
  branchId: 'branch-1',
  roles: ['teacher'],
  permissions: [
    'students.create',
    'students.read',
    'attendance.mark',
    'attendance.read',
    'fees.collect',
    'fees.read',
    'users.manage',
    'reports.view',
    'analytics.read',
  ],
};

export const E2E_MOCK_SESSION: Session = {
  access_token: 'e2e-mock-access-token',
  refresh_token: 'e2e-mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: 'sb-user-1',
    email: 'admin@test.pk',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};

export function isE2eAuthBypass(): boolean {
  return process.env.NEXT_PUBLIC_E2E_SKIP_AUTH === '1';
}

export const E2E_MOCK_USER_STORAGE_KEY = 'e2e:mock-user';

/** Tests can override the bypass user (e.g. super admin) via localStorage before load. */
export function readE2eMockUserOverride(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(E2E_MOCK_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}
