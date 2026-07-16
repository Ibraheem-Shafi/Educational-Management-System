# E2E Bugs — Run 01

**Run ID:** 01  
**Date:** 2026-07-11  
**Environment:** `http://localhost:3000` (API `http://localhost:3001/api/v1`)  
**Seed:** `nexium-v1` (verify failed thresholds; docs expect `nexium-v1.1`)  
**Tester:** Agent (Chrome DevTools MCP + Browser MCP)  
**Guide:** [e2e-testing-guide.md](e2e-testing-guide.md) · **Cases:** [e2e-test-cases.md](e2e-test-cases.md)

Do not overwrite this file in later runs. Create `e2e-bugs-02.md` next.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 6 |
| Medium | 7 |
| Low | 4 |
| Limitation | 3 |

---

## Findings

### BUG-01-001 — Staff Learning page crashes on load
- Severity: Critical
- Module / Route: Learning / `/dashboard/learning`
- Role / Account: Super Admin (`admin@nexium.edu.pk`)
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Sign in as Super Admin.
  2. Navigate directly to `http://localhost:3000/dashboard/learning` (Learning is not in the sidebar).
  3. Observe the page.
- Expected: Learning list loads with seeded materials; create/edit available.
- Actual: Error boundary: **"Something went wrong — Cannot read properties of undefined (reading 'filter')"**. Console shows TypeError in `ClientPageRoot`. Navigation timed out (~10s) before error UI.
- Evidence: Console TypeError; likely `LEARNING_RESOURCE_TYPES.filter` in `create-learning-dialog.tsx` when shared export is undefined. Related: learning permissions missing from seed (see BUG-01-002).
- Related TC IDs: LRN-001, LRN-002, TECH-003

### BUG-01-002 — Learning missing from staff sidebar (permissions not seeded)
- Severity: High
- Module / Route: Sidebar / all `/dashboard/*`
- Role / Account: Super Admin, Teacher (and any role that should have `learning.read`)
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Sign in as Super Admin or Teacher.
  2. Inspect left sidebar navigation.
- Expected: "Learning" item visible (`sidebar-nav.tsx` defines it with `learning.read`).
- Actual: Learning is absent for SA and Teacher.
- Evidence: `packages/database/prisma/seed.ts` `PERMISSION_LABELS` omits `learning.read` / `learning.publish`, so they never enter DB/`auth/me` permissions even though `DEFAULT_ROLE_PERMISSIONS` includes them.
- Related TC IDs: DASH-005, LRN-005, ROLE-001

### BUG-01-003 — Demo transactional seed incomplete (fees/assessments/notices/attendance/timetable/docs empty)
- Severity: High
- Module / Route: Cross-cutting data
- Role / Account: All
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. From repo root run `npm run db:seed:verify`.
  2. Open Fees, Assessments, Notices, Timetable, Documents as Super Admin.
- Expected (per [demo-seed.md](demo-seed.md)): ≥60 fee invoices, ≥5 assessments, ≥5 notices, ≥500 attendance, timetable slots, documents; seed version `nexium-v1.1`.
- Actual: Verify reports `demoSeedVersion: nexium-v1`, attendance **6**, assessments **0**, feeInvoices **0**, notices **0**. UI shows empty fees (Rs 0 / 0 invoices), no assessments, empty timetable, no documents. Students (49) and parents (48) are present.
- Evidence: `npm run db:seed:verify` exit 1; Fees API `GET /fee-invoices?...` returns `total: 0`; Fees stats all zeros.
- Related TC IDs: FEE-002, ASM-001, NTC-001, TIME-002, DOC-001, DASH-002, TECH-001

### BUG-01-004 — KPI cards always show "+100%" regardless of real change
- Severity: Medium
- Module / Route: Dashboard, Students, Parents, Branches, Users, Attendance, Reports, Academic, etc.
- Role / Account: Super Admin (also Teacher/Accountant)
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Open `/dashboard`, `/dashboard/students`, `/dashboard/parents`, `/dashboard/branches`.
  2. Look at the small percent badges on KPI cards.
- Expected: Meaningful period-over-period change, or hide when `changePercent` is null/N/A.
- Actual: Nearly every card shows **+100%** even when totals are stable or APIs return `changePercent: null` (fees).
- Evidence: Visual on multiple pages; fees API returns `"changePercent":null` but other modules still paint +100%.
- Related TC IDs: DASH-002, STU-001, UI-006

### BUG-01-005 — Dashboard monthly revenue always PKR 0
- Severity: High (compounded by empty fee seed; still wrong UX if invoices exist later)
- Module / Route: Dashboard / `/dashboard`
- Role / Account: Super Admin, Teacher, Accountant, Lahore Branch Admin
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Sign in as any staff user.
  2. View "Monthly Revenue" chart on dashboard.
- Expected: Reflect collected/billed revenue for fiscal year (or honest empty state when no invoices).
- Actual: Chart shows **PKR 0** for all months. With current DB this matches empty invoices, but dashboard still presents a full chart axis as if data pipeline is live.
- Evidence: UI snapshot; seed has 0 fee invoices.
- Related TC IDs: DASH-002, FEE-001

### BUG-01-006 — Notices draft KPI stays 0 after creating a draft
- Severity: Medium
- Module / Route: Notices / `/dashboard/notices`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Open Notices → New notice.
  2. Title `E2E-TEST-Notice`, body any text, Audience **Everyone**, Save draft.
  3. Observe toast "Notice created" and list row (Draft).
  4. Look at KPI "Drafts".
- Expected: Drafts count increments to at least 1.
- Actual: List shows the draft; **Drafts KPI remains 0** (Published/Scheduled/Total views also 0).
- Evidence: UI after successful create.
- Related TC IDs: NTC-002

### BUG-01-007 — Login ignores `?error=parent_portal_disabled` / `student_portal_disabled`
- Severity: Medium
- Module / Route: Auth / `/login`
- Role / Account: Public
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Open `http://localhost:3000/login?error=parent_portal_disabled`.
  2. Open `http://localhost:3000/login?error=student_portal_disabled`.
- Expected: Visible message explaining the portal is disabled.
- Actual: Standard login form only; no error banner/toast for the query param.
- Evidence: A11y snapshot of login with query present.
- Related TC IDs: AUTH-023, AUTH-024

### BUG-01-008 — Lahore Branch Admin dashboard shows Islamabad MAIN metrics
- Severity: High
- Module / Route: Dashboard / `/dashboard`
- Role / Account: Branch Admin LAHORE (`lahore.admin@nexium.edu.pk`)
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Sign in as `lahore.admin@nexium.edu.pk` / `Nexium@2026!`.
  2. View dashboard KPIs and Branch Performance table.
  3. Open `/dashboard/students` and compare.
- Expected: Lahore-scoped stats (~13 students); Branch Performance shows Lahore campus.
- Actual: Dashboard shows **Total Students 36**, Branch Performance **Islamabad Main Campus** only. Students list correctly shows **13** Lahore students.
- Evidence: Side-by-side UI; branch scoping inconsistent between dashboard stats API and students list.
- Related TC IDs: ROLE-005, AUTH-006, DASH-002

### BUG-01-009 — Quick Actions ignore role permissions
- Severity: Medium
- Module / Route: Dashboard Quick Actions
- Role / Account: Teacher (`ahmed.teacher@nexium.edu.pk`), Accountant (`fees@nexium.edu.pk`)
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Sign in as Teacher or Accountant.
  2. Scroll to Quick Actions on `/dashboard`.
- Expected: Only actions the role can perform (no Add Branch / Add Teacher / etc. without permission).
- Actual: Same shortcuts as admin: **Add Branch**, **Add Teacher**, **View Analytics** (accountant), etc., even when sidebar hides those modules.
- Evidence: Teacher/Accountant dashboard snapshots.
- Related TC IDs: ROLE-001, ROLE-002, ROLE-006

### BUG-01-010 — Users list mixes portal Parent/Student into "Staff accounts"
- Severity: Medium
- Module / Route: Users / `/dashboard/users`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Open `/dashboard/users`.
  2. Scan the table for `ali.khan@nexium.edu.pk` and `rashid.ahmad@nexium.edu.pk`.
- Expected: Staff users page lists staff roles only; portal users managed elsewhere or clearly filtered.
- Actual: Parent and Student appear with **STF-*** IDs under "Staff accounts and invitations".
- Evidence: Users table snapshot.
- Related TC IDs: USR-001

### BUG-01-011 — Academic programs include unexpected "1st grade"; KPI vs list mismatch
- Severity: Low
- Module / Route: Academic / `/dashboard/academic`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Open Academic → Programs tab.
- Expected: Coaching programs (SSC, HSSC, MDCAT, ECAT) consistent with demo docs; KPI matches list count.
- Actual: List includes **"1st grade"**; KPI shows Programs **7** while list header says **Programs (5)**.
- Evidence: Academic page snapshot.
- Related TC IDs: ACAD-002

### BUG-01-012 — Parent leave form: child selection does not stick; Submit stays disabled
- Severity: High
- Module / Route: Parent Leave / `/portal/parent/leave`
- Role / Account: Parent (`rashid.ahmad@nexium.edu.pk`)
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Sign in as parent → Leave requests.
  2. Under New request, open Select child → choose Muhammad Ali Khan.
  3. Fill From/To dates and Reason (`E2E-TEST...`).
  4. Observe Select child label and Submit button.
- Expected: Selected child name shown; Submit enabled when required fields valid; request created.
- Actual: Button label remains **"Select child"**; **Submit request stays disabled** despite dates + reason. Duplicate Select child controls (filter + form). URL may gain `childId` but form state does not enable submit.
- Evidence: Interactive DevTools session.
- Related TC IDs: PP-014, XMOD-001

### BUG-01-013 — Parent AI summary API returns 403
- Severity: Medium
- Module / Route: Parent dashboard / `GET /api/v1/ai-insights/portal/parent-summary`
- Role / Account: Parent
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Sign in as parent; open `/portal/parent`.
  2. Inspect Network for `ai-insights/portal/parent-summary`.
- Expected: 200 with empty/limited payload, or UI omits the call when unauthorized.
- Actual: **403 Forbidden** (repeated); console "Failed to load resource".
- Evidence: Network + console on parent dashboard.
- Related TC IDs: PP-001, PP-017, AI-003

### BUG-01-014 — Parent/Student learning resources empty despite Learning nav
- Severity: High (data + product gap vs demo-seed claims)
- Module / Route: `/portal/parent/learning`, `/portal/student/learning`
- Role / Account: Parent, Student
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. As parent, open Learning, select Muhammad Ali Khan.
  2. As student Ali, open Learning.
- Expected: Seeded notes/materials/homework for MDCAT Morning Batch A (per demo-seed).
- Actual: **Resources (0) / No learning resources found** for both portals. Staff Learning also broken (BUG-01-001).
- Evidence: Portal UI; incomplete seed verify.
- Related TC IDs: PP-009, SP-007, LRN-001

### BUG-01-015 — AI Insights / AI Attendance are empty stubs
- Severity: Limitation
- Module / Route: `/dashboard/ai-insights`, `/dashboard/ai-attendance`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Open AI Insights and AI Attendance as admin.
- Expected: Documented as stub/empty for demo.
- Actual: Pages load; At-risk students (0); no AI attendance workflow content. Matches demo-seed note that AI is intentionally empty.
- Evidence: UI snapshot.
- Related TC IDs: AI-001, AI-002, AI-003

### BUG-01-016 — Analytics weak-subject threshold spinbutton has valuemax=0
- Severity: Low
- Module / Route: Analytics / `/dashboard/analytics`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Open Analytics; inspect "Below __ %" threshold control.
- Expected: Valid min/max (e.g. 0–100).
- Actual: A11y tree shows `spinbutton value="50" valuemax="0"`.
- Evidence: Snapshot.
- Related TC IDs: ANL-001, UI-010

### BUG-01-017 — Settings page lacks visible fee policy fields (sibling discount / late fee)
- Severity: Low
- Module / Route: Settings / `/dashboard/settings`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Open Settings; scan for sibling discount / late fee configuration described in demo-seed.
- Expected: Fee settings (10% sibling discount, Rs 500 late fee after 7 days) editable or at least visible.
- Actual: Branding, terminology, feature flags, student statuses only — no fee policy section on the page.
- Evidence: Settings snapshot.
- Related TC IDs: SET-004

### BUG-01-018 — Accept-invite while authenticated redirects away (cannot open invite form)
- Severity: Low
- Module / Route: `/accept-invite`
- Role / Account: Logged-in Student
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. While signed in as student, open `/accept-invite`.
- Expected: Invite form or clear message; or force sign-out then show form.
- Actual: Redirects to `/portal` → student portal; invite UI not reachable while session exists.
- Evidence: Navigation ended on `/portal/student`.
- Related TC IDs: AUTH-017

### BUG-01-019 — Incomplete attendance seed vs UI month grid (mostly unmarked)
- Severity: Limitation (environment) / Medium if seed claimed complete
- Module / Route: Attendance / `/dashboard/attendance`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. Open Attendance for July 2026.
  2. Observe student day cells.
- Expected: ~20 weekdays of marks per active student (demo-seed).
- Actual: Only a few marked days (e.g. Present/Absent/Leave on sparse dates); most cells "unmarked". Matches verify count of 6 attendance records.
- Evidence: Attendance grid + seed verify.
- Related TC IDs: ATT-003

### BUG-01-020 — Parent portal Select child controls do not show selected label
- Severity: Medium
- Module / Route: Parent Learning / Leave (and likely other child-scoped pages)
- Role / Account: Parent
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce:
  1. On Learning or Leave, choose a child from the dropdown.
- Expected: Trigger button text updates to the child name.
- Actual: Remains **"Select child"** even when URL updates with `childId`.
- Evidence: Parent learning/leave snapshots after selection.
- Related TC IDs: PP-009, PP-014, UI-006

### BUG-01-021 — Software limitations observed this run
- Severity: Limitation
- Module / Route: Product-wide
- Role / Account: —
- Environment: localhost:3000, 2026-07-11
- Steps to reproduce: N/A (summary)
- Expected: Documented capabilities match runtime.
- Actual limitations:
  1. AI modules stubbed/empty (by design for demo).
  2. Demo DB not fully seeded to documented thresholds — many modules appear "broken" but are empty-data.
  3. Learning feature incomplete end-to-end (permissions + crash + empty portal data).
  4. Email flows (forgot-password / invite delivery) not verified (SMTP out of scope).
- Related TC IDs: AI-003, FEE-002, LRN-001

---

## Notes for next run

1. Re-seed with `npm run db:seed:all` and confirm `db:seed:verify` passes before attributing empty modules solely to product bugs.
2. After seed fix, re-test Fees, Assessments, Notices, Timetable, Documents, Learning, Attendance density.
3. Create `e2e-bugs-02.md` for the next run; keep this file immutable.
