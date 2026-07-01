import type { Page } from '@playwright/test';

export const MOCK_STAFF_USER = {
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

const MOCK_BRANCH = { id: 'branch-1', name: 'Main Campus', code: 'MAIN' };
const MOCK_ROLE = { id: 'role-1', code: 'teacher', name: 'Teacher' };
const MOCK_STATUS = { id: 'status-1', code: 'active', label: 'Active' };
const MOCK_STUDENT = { id: 'student-1', fullName: 'Ali Khan' };
const MOCK_FEE_TYPE = { id: 'fee-1', name: 'Tuition' };
const MOCK_BATCH = { id: 'batch-1', name: 'Batch A', branchId: 'branch-1', programId: 'prog-1' };

/** Mock API responses for authenticated staff dashboard flows (no live backend). */
export async function setupMockStaffApi(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '') || '/';

    if (path === '/auth/me' && route.request().method() === 'GET') {
      return route.fulfill({ json: { user: MOCK_STAFF_USER } });
    }

    if (path === '/users/roles' && route.request().method() === 'GET') {
      return route.fulfill({ json: { data: [MOCK_ROLE] } });
    }

    if (path === '/users' && route.request().method() === 'GET') {
      return route.fulfill({
        json: { data: [MOCK_STAFF_USER], meta: { total: 1, page: 1, limit: 20 } },
      });
    }

    if (path === '/users/invitations' && route.request().method() === 'GET') {
      return route.fulfill({ json: { data: [] } });
    }

    if (path === '/users/invitations' && route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: { token: 'invite-token-test', id: 'inv-1', email: 'new@test.pk' },
      });
    }

    if (path === '/branches' && route.request().method() === 'GET') {
      return route.fulfill({ json: { data: [MOCK_BRANCH] } });
    }

    if (path.startsWith('/batches') && route.request().method() === 'GET') {
      return route.fulfill({ json: { data: [MOCK_BATCH] } });
    }

    if (path.startsWith('/programs') && route.request().method() === 'GET') {
      return route.fulfill({ json: { data: [{ id: 'prog-1', name: 'Matric', branchId: 'branch-1' }] } });
    }

    if (path.startsWith('/settings/lookups/student_status') || path.includes('student_status')) {
      return route.fulfill({ json: { statuses: [MOCK_STATUS] } });
    }

    if (path.startsWith('/settings/lookups/attendance_status')) {
      return route.fulfill({
        json: {
          statuses: [
            { id: 'att-present', code: 'present', label: 'Present' },
            { id: 'att-absent', code: 'absent', label: 'Absent' },
          ],
        },
      });
    }

    if (path === '/form-fields' && route.request().method() === 'GET') {
      return route.fulfill({ json: { data: [] } });
    }

    if (path === '/students' && route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { id: 'student-new-1', fullName: 'New Student' } });
    }

    if (path.startsWith('/students') && route.request().method() === 'GET') {
      return route.fulfill({
        json: { data: [MOCK_STUDENT], meta: { total: 1, page: 1, limit: 100 } },
      });
    }

    if (path.includes('/attendance/sheet') && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          batchName: 'Batch A',
          students: [{ studentId: 'student-1', fullName: 'Ali Khan', attendance: null }],
          summary: { total: 1, marked: 0, unmarked: 1 },
        },
      });
    }

    if (path === '/attendance/bulk' && route.request().method() === 'POST') {
      return route.fulfill({ json: { marked: 1 } });
    }

    if (path === '/fee-types' && route.request().method() === 'GET') {
      return route.fulfill({ json: { data: [MOCK_FEE_TYPE] } });
    }

    if (path.startsWith('/fee-invoices') && route.request().method() === 'GET') {
      return route.fulfill({ json: { data: [], meta: { total: 0, page: 1, limit: 20 } } });
    }

    if (path === '/fee-invoices' && route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { id: 'inv-1' } });
    }

    if (path.startsWith('/reports/fee-defaulters')) {
      return route.fulfill({ json: { data: [], total: 0 } });
    }

    if (path.startsWith('/reports/overview')) {
      return route.fulfill({
        json: {
          students: { total: 42 },
          fees: { pendingCount: 3, paidCount: 10, pendingAmount: 15000, collectedAmount: 85000 },
          attendanceMarkedToday: 12,
          parents: 30,
          staffUsers: 5,
        },
      });
    }

    if (path.includes('/analytics/attendance-performance-correlation')) {
      return route.fulfill({ json: { periodDays: 30, correlation: null, students: [] } });
    }

    if (path.startsWith('/fee-structures')) {
      return route.fulfill({ json: { data: [] } });
    }

    if (path === '/auth/sessions' && route.request().method() === 'GET') {
      return route.fulfill({ json: { data: [] } });
    }

    if (path === '/settings/institution' && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          name: 'Test Institution',
          primaryColor: '#2563eb',
          terminology: { batch: 'Batch', program: 'Program' },
          featureFlags: {},
        },
      });
    }

    return route.fulfill({ json: {} });
  });
}

/** Inject a mock Supabase session before navigation so AuthProvider loads a staff user. */
export async function injectMockSession(page: Page): Promise<void> {
  const session = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: 'sb-user-1', email: 'admin@test.pk', aud: 'authenticated', role: 'authenticated' },
  };

  await page.addInitScript((stored) => {
    const url = stored.supabaseUrl as string;
    let key = 'sb-placeholder-auth-token';
    try {
      const host = new URL(url).hostname.split('.')[0];
      key = `sb-${host}-auth-token`;
    } catch {
      /* use default */
    }
    localStorage.setItem(key, JSON.stringify(stored.session));
  }, { session, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co' });

  await page.route('**/auth/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/user')) {
      return route.fulfill({
        json: { id: 'sb-user-1', email: 'admin@test.pk', aud: 'authenticated', role: 'authenticated' },
      });
    }
    if (path.includes('/token')) {
      return route.fulfill({ json: session });
    }
    if (path.includes('/factors')) {
      return route.fulfill({ json: { all: [], totp: [], phone: [] } });
    }
    return route.fulfill({ json: {} });
  });
}

export async function setupMockStaffSession(page: Page): Promise<void> {
  await setupMockStaffApi(page);
  await injectMockSession(page);
}
