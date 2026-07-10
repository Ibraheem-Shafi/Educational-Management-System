/**
 * Manual testing readiness verification — hits live API with Supabase auth.
 * Run: node scripts/verify-app-readiness.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function parseEnv(filePath) {
  const env = {};
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="(.*)"/);
      if (m) env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
  return env;
}

const apiEnv = parseEnv(resolve(root, 'apps/api/.env'));
const webEnv = parseEnv(resolve(root, 'apps/web/.env.local'));

const SUPABASE_URL = apiEnv.SUPABASE_URL || webEnv.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = apiEnv.SUPABASE_ANON_KEY || webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_URL = webEnv.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PASSWORD = 'Rekhta@2026!';

const ACCOUNTS = {
  superAdmin: 'admin@rekhta.edu.pk',
  branchAdmin: 'branchadmin@rekhta.edu.pk',
  lahoreAdmin: 'lahore.admin@rekhta.edu.pk',
  teacher: 'ahmed.teacher@rekhta.edu.pk',
  accountant: 'fees@rekhta.edu.pk',
  receptionist: 'reception@rekhta.edu.pk',
  parent: 'rashid.ahmad@rekhta.edu.pk',
  student: 'ali.khan@rekhta.edu.pk',
};

const results = [];

function pass(id, detail = '') {
  results.push({ id, status: 'PASS', detail });
  console.log(`  ✓ ${id}${detail ? ` — ${detail}` : ''}`);
}

function fail(id, detail = '') {
  results.push({ id, status: 'FAIL', detail });
  console.log(`  ✗ ${id}${detail ? ` — ${detail}` : ''}`);
}

async function supabaseLogin(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed for ${email}: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function apiGet(token, path) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function apiPost(token, path, payload) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function checkOk(id, token, path, predicate) {
  try {
    const { status, body } = await apiGet(token, path);
    if (status === 200 && (!predicate || predicate(body))) {
      pass(id, `GET ${path}`);
      return body;
    }
    fail(id, `GET ${path} → ${status}`);
    return null;
  } catch (e) {
    fail(id, e.message);
    return null;
  }
}

async function main() {
  console.log('\n=== App Testing Readiness Verification ===\n');

  // Health (public)
  try {
    const health = await fetch(`${API_URL}/api/v1/health`);
    const h = await health.json();
    if (health.ok && h.status === 'ok') pass('health', 'API is up');
    else fail('health', JSON.stringify(h));
  } catch (e) {
    fail('health', e.message);
    console.error('\nAPI not reachable. Start with: npm run dev\n');
    process.exit(1);
  }

  console.log('\n--- 1. Auth & onboarding ---');
  let adminToken;
  try {
    adminToken = await supabaseLogin(ACCOUNTS.superAdmin);
    pass('1.1-login-admin', ACCOUNTS.superAdmin);
  } catch (e) {
    fail('1.1-login-admin', e.message);
    process.exit(1);
  }

  const me = await checkOk('1.3-auth-me', adminToken, '/auth/me', (b) => b.user?.email === ACCOUNTS.superAdmin);
  if (me) pass('1.2-mfa-skip', `email=${me.user?.email}`);

  await checkOk('1.6-profile-sessions', adminToken, '/auth/sessions', (b) => Array.isArray(b.data));

  // Role redirects (API perspective — portal endpoints per role)
  try {
    const parentToken = await supabaseLogin(ACCOUNTS.parent);
    pass('1.3-login-parent', ACCOUNTS.parent);
    await checkOk('12.1-portal-parent', parentToken, '/portal/parent', (b) => b.children?.length > 0);
  } catch (e) {
    fail('1.3-login-parent', e.message);
  }

  try {
    const studentToken = await supabaseLogin(ACCOUNTS.student);
    pass('1.3-login-student', ACCOUNTS.student);
    await checkOk('12.2-portal-student', studentToken, '/portal/student', (b) => b.student != null);
  } catch (e) {
    fail('1.3-login-student', e.message);
  }

  // Invite flow — validate pending invitation token exists
  const invites = await checkOk('1.5-invitations-list', adminToken, '/users/invitations', (b) => Array.isArray(b.data ?? b));
  const inviteList = invites?.data ?? invites;
  if (inviteList?.length) {
    const token = inviteList[0].token;
    const pub = await fetch(`${API_URL}/api/v1/auth/invitations/${token}`);
    if (pub.ok) pass('1.5-invite-token-public', 'Public invitation validation works');
    else fail('1.5-invite-token-public', `status ${pub.status}`);
  }

  console.log('\n--- 2. Dashboard & reporting ---');
  await checkOk('2.1-dashboard-overview', adminToken, '/reports/overview');
  await checkOk('2.2-reports', adminToken, '/reports/fee-defaulters');
  await checkOk('2.3-analytics', adminToken, '/analytics/dashboard');
  await checkOk('2.4-audit', adminToken, '/audit-logs?limit=5');

  console.log('\n--- 3. Student lifecycle ---');
  const students = await checkOk('3.1-students-list', adminToken, '/students?limit=5', (b) => b.data?.length > 0);
  await checkOk('3.1-students-stats', adminToken, '/students/stats');
  if (students?.data?.[0]?.id) {
    const sid = students.data[0].id;
    await checkOk('3.3-student-profile', adminToken, `/students/${sid}`);
    await checkOk('3.3-student-subjects', adminToken, `/students/${sid}/subjects`);
  }
  await checkOk('3.4-form-fields', adminToken, '/form-fields');

  console.log('\n--- 4. Academic structure ---');
  await checkOk('4.1-programs', adminToken, '/programs');
  await checkOk('4.2-batches', adminToken, '/batches');
  await checkOk('4.3-subjects', adminToken, '/subjects');
  await checkOk('4.4-sessions', adminToken, '/academic-sessions');

  console.log('\n--- 5. Attendance ---');
  const batches = await apiGet(adminToken, '/batches?limit=5');
  let sampleBatch = null;
  if (batches.status === 200 && batches.body?.data?.length) {
    sampleBatch = batches.body.data[0];
    const sheetDate = '2026-04-15';
    const branchParam = sampleBatch.branchId ? `&branchId=${sampleBatch.branchId}` : '';
    const sheet = await apiGet(
      adminToken,
      `/attendance/sheet?batchId=${sampleBatch.id}&date=${sheetDate}${branchParam}`,
    );
    if (sheet.status === 200) pass('5.1-attendance-sheet', `GET sheet for ${sheetDate}`);
    else fail('5.1-attendance-sheet', `GET sheet → ${sheet.status}: ${JSON.stringify(sheet.body).slice(0, 120)}`);
  } else {
    fail('5.1-attendance-sheet', 'No batch available');
  }
  await checkOk('5.4-ai-attendance', adminToken, '/ai-attendance/sessions');

  console.log('\n--- 6. Assessments ---');
  await checkOk('6.1-assessment-types', adminToken, '/assessment-types');
  await checkOk('6.1-assessment-series', adminToken, '/assessment-series');
  const assessments = await checkOk('6.2-assessments', adminToken, '/assessments?limit=10');
  if (assessments?.data?.length) {
    const assessment = assessments.data[0];
    const branchBatches = await apiGet(adminToken, `/batches?branchId=${assessment.branchId}&limit=1`);
    const marksBatchId = branchBatches.body?.data?.[0]?.id;
    if (marksBatchId) {
      await checkOk(
        '6.3-marks-sheet',
        adminToken,
        `/assessments/${assessment.id}/marks-sheet?batchId=${marksBatchId}`,
      );
    } else {
      fail('6.3-marks-sheet', 'No batch in assessment branch');
    }
  }

  console.log('\n--- 7. Fees ---');
  await checkOk('7.1-fee-types', adminToken, '/fee-types');
  await checkOk('7.1-fee-structures', adminToken, '/fee-structures');
  await checkOk('7.2-invoices', adminToken, '/fee-invoices?limit=5');
  await checkOk('7.4-defaulters', adminToken, '/reports/fee-defaulters');

  console.log('\n--- 8. Timetable ---');
  await checkOk('8.1-timetable', adminToken, '/timetable');
  await checkOk('8.3-conflicts', adminToken, '/timetable/conflicts');

  console.log('\n--- 9. Parents & communications ---');
  await checkOk('9.1-parents', adminToken, '/parents?limit=5');
  await checkOk('9.2-notices', adminToken, '/notices?limit=5');
  await checkOk('9.3-comms-logs', adminToken, '/communications/logs?limit=5');
  await checkOk('9.4-ai-insights', adminToken, '/ai-insights/at-risk');

  console.log('\n--- 10. Documents & branches ---');
  await checkOk('10.1-documents', adminToken, '/documents?limit=5');
  await checkOk('10.2-branches', adminToken, '/branches');

  console.log('\n--- 11. Users & settings ---');
  await checkOk('11.1-users', adminToken, '/users?limit=5');
  await checkOk('11.2-settings', adminToken, '/settings/institution');

  console.log('\n--- Role-based access ---');
  try {
    const teacherToken = await supabaseLogin(ACCOUNTS.teacher);
    pass('role-teacher-login', ACCOUNTS.teacher);
    const tStudents = await apiGet(teacherToken, '/students?limit=1');
    if (tStudents.status === 200) pass('role-teacher-students', 'Can access students');
    else fail('role-teacher-students', `status ${tStudents.status}`);
  } catch (e) {
    fail('role-teacher-login', e.message);
  }

  try {
    const accountantToken = await supabaseLogin(ACCOUNTS.accountant);
    pass('role-accountant-login', ACCOUNTS.accountant);
    const fees = await apiGet(accountantToken, '/fee-invoices?limit=1');
    if (fees.status === 200) pass('role-accountant-fees', 'Can access fees');
    else fail('role-accountant-fees', `status ${fees.status}`);
  } catch (e) {
    fail('role-accountant-login', e.message);
  }

  try {
    const branchToken = await supabaseLogin(ACCOUNTS.branchAdmin);
    pass('role-branch-admin-login', ACCOUNTS.branchAdmin);
    const branchStudents = await apiGet(branchToken, '/students?limit=50');
    if (branchStudents.status === 200) {
      pass('role-branch-admin-students', `${branchStudents.body?.data?.length ?? 0} students visible`);
    } else fail('role-branch-admin-students', `status ${branchStudents.status}`);
  } catch (e) {
    fail('role-branch-admin-login', e.message);
  }

  try {
    const lahoreToken = await supabaseLogin(ACCOUNTS.lahoreAdmin);
    pass('role-lahore-admin-login', ACCOUNTS.lahoreAdmin);
    const lahoreStudents = await apiGet(lahoreToken, '/students?limit=50');
    if (lahoreStudents.status === 200) {
      pass('role-lahore-admin-students', `${lahoreStudents.body?.data?.length ?? 0} students (branch-scoped)`);
    } else fail('role-lahore-admin-students', `status ${lahoreStudents.status}`);
  } catch (e) {
    fail('role-lahore-admin-login', e.message);
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
