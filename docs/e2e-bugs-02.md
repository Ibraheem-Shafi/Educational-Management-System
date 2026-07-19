# E2E Bugs — Run 02

**Run ID:** 02  
**Date:** 2026-07-18 / 2026-07-19  
**Environment:** `http://localhost:3000` (API `http://localhost:3001/api/v1`)  
**Seed:** `nexium-v1.4` (verify **passed** on 2026-07-19)  
**Credentials:** `Nexium@2026!` — demo accounts from [demo-seed.md](demo-seed.md) (`admin@nexium.edu.pk`, etc.)  
**Tester:** Agent (Chrome DevTools MCP + Browser MCP)  
**Guide:** [e2e-testing-guide.md](e2e-testing-guide.md) · **Plan:** [e2e-run-02-plan.md](e2e-run-02-plan.md) · **Cases:** [e2e-test-cases.md](e2e-test-cases.md)

Do not overwrite this file in later runs. Create `e2e-bugs-03.md` next.

## What was tested (Run 02 scope)

Multi-portal deep pass per [e2e-run-02-plan.md](e2e-run-02-plan.md) — same interaction depth as your Super Admin manual testing (search by ID, filters, modals, pagination, More menus, stat cards, console/network), applied across **all 8 roles**:

| Role | Account | Landing | Modules / pages tested |
|------|---------|---------|------------------------|
| Super Admin | `admin@nexium.edu.pk` | `/dashboard` | All 29 sidebar modules + pre-reported issue regression |
| Branch Admin MAIN | `branchadmin@nexium.edu.pk` | `/dashboard` | Full sidebar, students scope, edit student, branches/new |
| Branch Admin LAHORE | `lahore.admin@nexium.edu.pk` | `/dashboard` | Dashboard vs list counts, branch isolation, 29 modules smoke |
| Teacher | `ahmed.teacher@nexium.edu.pk` | `/dashboard` | 13 sidebar modules, Quick Actions, batch filter API |
| Accountant | `fees@nexium.edu.pk` | `/dashboard` | Fees, Accounting, Payroll, Reports, Communications |
| Receptionist | `reception@nexium.edu.pk` | `/dashboard` | Login + sidebar (module sweep partially blocked by session) |
| Parent | `rashid.ahmad@nexium.edu.pk` | `/portal/parent` | All 11 portal routes + leave/learning/child selector |
| Student | `ali.khan@nexium.edu.pk` | `/portal/student` | All 10 portal routes + data isolation |

**Tooling:** Chrome DevTools MCP (navigate, snapshot, fill, click, console, network). No product code fixes during the run.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 11 |
| Medium | 22 |
| Low | 6 |
| Limitation | 3 |

**Total findings:** 44 (including 1 confirmed PASS for published-notice edit block)

---

## Findings

### BUG-02-001 — Communications page crashes on load (`totalPages` undefined)
- Severity: Critical
- Module / Route: Communications / `/dashboard/communications`
- Role / Account: Super Admin, Accountant
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Sign in as Super Admin or Accountant.
  2. Open `/dashboard/communications` from sidebar or direct URL.
  3. Observe the page.
- Expected: Communications log loads with paginated table.
- Actual: Error boundary — **"Cannot read properties of undefined (reading 'totalPages')"**. Console TypeError in `<CommunicationsPage>`. API `GET /communications/logs?page=1&limit=8` returns 200 but pagination metadata missing or not handled.
- Evidence: Console TypeError; pre-report confirmed (COM-006).
- Related TC IDs: COM-006

### BUG-02-002 — Parent and student portal profiles not linked to auth users
- Severity: Critical
- Module / Route: Parent & Student portals
- Role / Account: Parent (`rashid.ahmad@nexium.edu.pk`), Student (`ali.khan@nexium.edu.pk`)
- Environment: localhost:3000, 2026-07-19
- Steps to reproduce:
  1. Sign in as parent → `/portal/parent`.
  2. Sign in as student → `/portal/student`.
  3. Inspect UI and network responses.
- Expected: Parent linked to Ali Khan + Zainab Hussain; student profile for Ali Khan (per demo-seed).
- Actual: Parent API returns `parent: null`, `children: []`, message "No parent profile linked…". Student API returns `student: null`; attendance/fees/learning APIs return **403** "No student profile linked". Dashboard shows **"No linked children"** / **"No student profile linked to your email"**.
- Evidence: `GET /api/v1/portal/parent`, `/portal/student`; blocks PP-019, PP-020, SP-014 despite seed verify PASS.
- Related TC IDs: PP-001–PP-020, SP-001–SP-015, PP-019, PP-020, SP-014, PP-022, SP-016

### BUG-02-003 — Select dropdown does not close on outside click
- Severity: Medium
- Module / Route: Cross-cutting (Students, Attendance, etc.)
- Role / Account: Super Admin (likely all roles)
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open `/dashboard/students`.
  2. Open **Filter by batch** (or status) dropdown.
  3. Click page heading or outside the dropdown.
- Expected: Dropdown closes.
- Actual: Listbox stays open; `expanded` state persists on the trigger button.
- Evidence: UI snapshot after outside click; user pre-report confirmed.
- Related TC IDs: UI-011

### BUG-02-004 — Inconsistent table UI across modules; no shared table component
- Severity: Medium
- Module / Route: Students, Parents, Users, Notices, Documents, Form fields, etc.
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Students, Parents, Users, Notices, Documents in sequence.
  2. Compare table headers, actions, pagination chrome.
- Expected: Single reusable table component with consistent styling.
- Actual: Mixed table layouts, column sets, and action patterns across modules.
- Evidence: Visual comparison; user pre-report Overall item 2.
- Related TC IDs: UI-012

### BUG-02-005 — Sidebar not grouped; Leave requests missing for Super Admin
- Severity: Medium
- Module / Route: Staff sidebar / `/dashboard/leave-requests`
- Role / Account: Super Admin (also Teacher, Accountant, Receptionist)
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Sign in as Super Admin; inspect sidebar order.
  2. Note Attendance position vs Leave requests.
  3. Navigate to `/dashboard/leave-requests` directly.
- Expected: Related links grouped (Attendance near Leave requests); Leave requests visible for roles with `leave.request`.
- Actual: Attendance is early in sidebar; **Leave requests not in sidebar at all** for Super Admin. Direct URL shows **"Access denied"**. Same absence on Teacher, Accountant, Receptionist sidebars despite permissions in seed.
- Evidence: Sidebar snapshot; BUG-02-022 overlap.
- Related TC IDs: UI-013, LV-004, LV-008

### BUG-02-006 — Many list tables lack backend pagination
- Severity: Medium
- Module / Route: Notices, Documents, Parents, Form fields, Fee defaulters
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Notices — observe all rows loaded; check network for `page`/`limit`.
  2. Repeat for Documents, Form fields.
  3. Open Fees — defaulter table shows all rows.
- Expected: Every list table paginates from API with matching UI controls (default page size 8 where specified).
- Actual: Notices loads all 8 rows with no pagination params on API. Documents has no pagination UI. Form fields has no pagination or search. Fee defaulter list shows ~39 rows unpaginated (invoices tab partially paginated).
- Evidence: Network requests; user pre-report Overall item 4.
- Related TC IDs: UI-014, NTC-008, DOC-010, SET-009, FEE-012

### BUG-02-007 — In-row edit on Form fields; should use modal only
- Severity: Medium
- Module / Route: Form fields / `/dashboard/form-fields`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Form fields.
  2. Attempt to edit a field from the table row.
- Expected: Edit opens a modal (same pattern as Notices); no inline/in-row editing.
- Actual: In-row edit approach used; Add field modal does not match Notices modal UI. Order field on create is confusing when order is editable later.
- Evidence: UI inspection; user pre-report SET-010, SET-011, SET-012.
- Related TC IDs: UI-015, SET-010, SET-011, SET-012

### BUG-02-008 — More menu uses eye icon for every action
- Severity: Low
- Module / Route: Users, Parents, Form fields
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Users table → Row actions (More menu).
  2. Repeat on Parents and Form fields.
- Expected: Distinct icons per action (view, edit, delete, link).
- Actual: **Eye icon** on View details, Edit, Deactivate, Link student, Unlink, Remove, etc.
- Evidence: UI snapshot; user pre-report on Users and Form fields.
- Related TC IDs: UI-017, USR-008 (menu UX)

### BUG-02-009 — Student create lacks field-level validation; API errors not mapped to fields
- Severity: High
- Module / Route: Students / `/dashboard/students/new`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Admit student form.
  2. Submit with missing/invalid required fields.
- Expected: Client-side validation before API call; each invalid field highlighted with message.
- Actual: Form submits to API; generic validation error without indicating which field failed (user pre-report).
- Evidence: User manual pass; STU-021 not fully re-run this session.
- Related TC IDs: STU-021, STU-010

### BUG-02-010 — Student search by ID fails (e.g. STD-LY8OD7)
- Severity: High
- Module / Route: Students / `/dashboard/students`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Students list; note visible ID **STD-LY8OD7** (Nida Khan).
  2. Enter `STD-LY8OD7` in search box.
- Expected: Matching student returned.
- Actual: **"No students found"** while ID was visible in unfiltered list.
- Evidence: UI snapshot after search; search placeholder says "Search by name, ID," but ID search broken.
- Related TC IDs: STU-022, STU-003

### BUG-02-011 — Super Admin cannot edit students with create-style form
- Severity: High
- Module / Route: Students / `/dashboard/students/[id]`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Sign in as Super Admin.
  2. Open a student from the list.
  3. Look for full edit flow matching `/dashboard/students/new`.
- Expected: Super Admin and Branch Admin can edit with same UI as create screen.
- Actual: Super Admin lacks equivalent edit UI (user pre-report). **Branch Admin CAN edit** — Edit student form with Save works (STU-025 PASS).
- Evidence: BA edit PASS vs SA gap; user pre-report.
- Related TC IDs: STU-023, STU-025, STU-012

### BUG-02-012 — Students status filter sometimes causes "Failed to load students"
- Severity: High
- Module / Route: Students / `/dashboard/students`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Students.
  2. Toggle status filter repeatedly; reload page.
- Expected: Stable filtered results.
- Actual: Intermittent **"Failed to load students"** error on status filter (user pre-report).
- Evidence: User manual pass; STU-024 not consistently reproduced in automated run.
- Related TC IDs: STU-024, STU-004

### BUG-02-013 — Attendance uses day stepper only; no date range or calendar jump
- Severity: Medium
- Module / Route: Attendance / `/dashboard/attendance`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Attendance.
  2. Try to view attendance from ~1 year ago.
- Expected: Date range selector or calendar picker (like desired timetable UX).
- Actual: **Previous day / Next day** buttons only — ~360 clicks for one year back.
- Evidence: UI controls; user pre-report ATT-010 confirmed.
- Related TC IDs: ATT-010, ATT-014

### BUG-02-014 — Attendance batch filter has default pre-selected value
- Severity: Medium
- Module / Route: Attendance / `/dashboard/attendance`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Load Attendance page fresh.
  2. Inspect batch/program filter.
- Expected: No default selected program/batch.
- Actual: Batch filter pre-selected to **"hello"** (seed batch name).
- Evidence: UI snapshot; user pre-report ATT-011 confirmed.
- Related TC IDs: ATT-011

### BUG-02-015 — Attendance Today's rate stat chip shows nonsense percentage
- Severity: Medium
- Module / Route: Attendance / `/dashboard/attendance`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. View **Today's rate** stat card.
  2. Inspect top-right chip percentage.
- Expected: Sensible delta vs yesterday's attendance (user reported -110%; run observed **-100%** with 0% main value).
- Actual: Nonsensical negative chip; does not reflect meaningful day-over-day change.
- Evidence: UI snapshot; user pre-report ATT-012 confirmed.
- Related TC IDs: ATT-012

### BUG-02-016 — Attendance Month average chip shows spurious 0%; calculation includes current month
- Severity: Medium
- Module / Route: Attendance / `/dashboard/attendance`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. View **Month average** stat card.
  2. Compare top chip vs bottom percentage.
- Expected: Remove spurious top chip; month average uses **completed months only**, excluding current partial month.
- Actual: Top chip shows **0%** above main value (e.g. 78%); calculation logic wrong per user report.
- Evidence: UI snapshot; user pre-report ATT-013 confirmed.
- Related TC IDs: ATT-013

### BUG-02-017 — Assessments still use Manage series/types instead of Academic-style tabs
- Severity: Medium
- Module / Route: Assessments / `/dashboard/assessments`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Assessments.
  2. Look for series/types management UX.
- Expected: Tabs like Academic; series/types CRUD in table + modals.
- Actual: Separate **"Manage series"** and **"Manage types"** buttons/pages remain.
- Evidence: UI snapshot; user pre-report ASM-009 confirmed.
- Related TC IDs: ASM-009, ASM-010, ASM-011

### BUG-02-018 — Fees: no tabs; Fee defaulters and invoices stacked; defaulter table not paginated
- Severity: Medium
- Module / Route: Fees / `/dashboard/fees`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Fees page.
  2. Observe layout of invoices vs defaulters.
- Expected: Tabs **"Fees"** and **"Fee Defaulter"**; both with paginated API + UI.
- Actual: Two tables **stacked** on one page. Invoices partially paginated (`limit=8`); defaulter list shows all ~39 rows without pagination.
- Evidence: UI + network; user pre-report FEE-011 confirmed.
- Related TC IDs: FEE-011, FEE-012, FEE-013

### BUG-02-019 — Timetable limited to single Mon–Sun week; no calendar navigation or drag/move
- Severity: Medium
- Module / Route: Timetable / `/dashboard/timetable`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Timetable.
  2. Try to navigate to another week/month.
  3. Try to move a scheduled slot to another room/day/time.
- Expected: Calendar-style UI like Attendance; drag/reschedule for Super Admin.
- Actual: **Mon–Sun single week** only; no week navigation; cannot move scheduled items (user pre-report).
- Evidence: UI; user pre-report TIME-006, TIME-007, TIME-008.
- Related TC IDs: TIME-006, TIME-007, TIME-008

### BUG-02-020 — Notices missing ID column, search, pagination, View and Edit in More menu
- Severity: Medium
- Module / Route: Notices / `/dashboard/notices`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Notices list — check columns (Title, Audience, Status, Publish at — **no ID**).
  2. Use search bar — observe whether list filters.
  3. Open More menu on draft row.
- Expected: ID column; search by ID; paginated API + UI; **View** full body in modal; **Edit** draft notices.
- Actual: No ID column; search does not filter list; no pagination; draft More menu has Publish/Delete only — **no View, no Edit**; table truncates notice body.
- Evidence: UI + API without pagination params; user pre-report NTC-006–010.
- Related TC IDs: NTC-006, NTC-007, NTC-008, NTC-009, NTC-010

### BUG-02-021 — Published notices correctly not editable (PASS — not a bug)
- Severity: N/A (expected behavior confirmed)
- Module / Route: Notices / `/dashboard/notices`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open More menu on a **published** notice.
- Expected: Edit blocked for published notices.
- Actual: Published row menu shows **Delete only** — edit correctly blocked.
- Evidence: UI snapshot; user expected draft editable (NTC-010 still FAIL).
- Related TC IDs: NTC-011

### BUG-02-022 — Documents: upload modal field order wrong; open fails; pagination missing
- Severity: High
- Module / Route: Documents / `/dashboard/documents`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Upload document modal — note field order.
  2. More → Open on any seeded document.
  3. Check list pagination.
- Expected: Title field on top; open/download works; paginated list; delete uses confirmation modal + loading toast (user report — delete UX not re-verified).
- Actual: Upload modal order **Student → Category → Title → File** (Title not first). Open shows toast **"Object not found"** (network 404). No pagination UI. Upload **"Bucket not found"** reported by user — not re-tested this run.
- Evidence: Modal snapshot + network 404; user pre-report DOC-005, DOC-006, DOC-007, DOC-010.
- Related TC IDs: DOC-005, DOC-006, DOC-007, DOC-008, DOC-009, DOC-010

### BUG-02-023 — Parents: no validation messages, no ID column, unlink in list More menu
- Severity: Medium
- Module / Route: Parents / `/dashboard/parents`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Parents table — columns: Parent, Email/Phone, Linked students (**no Parent ID**).
  2. Add parent with invalid data.
  3. Open More menu on a row.
- Expected: Field-level validation (not just "Validation failed"); ID column + ID search; **View** detail page with link/unlink on detail only; remove Unlink from list More menu.
- Actual: Save disabled on empty name but no field error messages; no ID column; More menu includes **Link student / Unlink** with eye icons; no separate View page.
- Evidence: UI snapshot; user pre-report PARS-006–010.
- Related TC IDs: PARS-006, PARS-007, PARS-008, PARS-009, PARS-010

### BUG-02-024 — Branch search by ID fails (e.g. BR-LAHORE)
- Severity: High
- Module / Route: Branches / `/dashboard/branches`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Branches; note **BR-LAHORE** visible in table.
  2. Search `BR-LAHORE`.
- Expected: Lahore branch found.
- Actual: **"No branches found"**.
- Evidence: Client-side search failure; user pre-report BR-006 confirmed.
- Related TC IDs: BR-006

### BUG-02-025 — User search by staff ID fails; wrong default page size
- Severity: High
- Module / Route: Users / `/dashboard/users`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Users; note a visible `STF-*` ID.
  2. Search e.g. `STF-BPREG7`.
  3. Count rows on page 1.
- Expected: User found by ID; default **8** rows per page.
- Actual: **"No users found"**; API `limit=10` shows **10 rows** on page 1.
- Evidence: Network `GET /users?page=1&limit=10&search=STF-BPREG7`; user pre-report USR-008, USR-009.
- Related TC IDs: USR-008, USR-009

### BUG-02-026 — Audit default page size 20 instead of 8
- Severity: Medium
- Module / Route: Audit / `/dashboard/audit`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open Audit log.
  2. Count rows on page 1.
- Expected: Default **8** records per page.
- Actual: **20 rows** on page 1 (Page 1 of 3); API uses `limit=20`.
- Evidence: UI + network; user pre-report AUD-004 confirmed.
- Related TC IDs: AUD-004

### BUG-02-027 — Form fields and Settings use narrow layout with extra side margins
- Severity: Medium
- Module / Route: Form fields, Settings
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open `/dashboard/form-fields` and `/dashboard/settings`.
  2. Compare content width to `/dashboard/students`.
- Expected: Full-width body consistent with other screens.
- Actual: Form fields content ~**896px** vs Students ~**1158px**; Settings max-width ~**672px** centered with extra left/right space.
- Evidence: Layout measurement; user pre-report SET-013, SET-014.
- Related TC IDs: SET-013, SET-014

### BUG-02-028 — Teacher batch filter API returns 403
- Severity: Medium
- Module / Route: Students / `/dashboard/students`
- Role / Account: Teacher (`ahmed.teacher@nexium.edu.pk`)
- Environment: localhost:3000, 2026-07-19
- Steps to reproduce:
  1. Sign in as Teacher.
  2. Open Students; observe network for batch filter.
- Expected: Batch dropdown populated or gracefully hidden.
- Actual: `GET /api/v1/batches?branchId=…` → **403 Forbidden**; console errors.
- Evidence: Network 403 on Teacher session.
- Related TC IDs: STU-013, ROLE-006

### BUG-02-029 — Teacher sees Notices in sidebar; Leave requests missing despite permission
- Severity: Medium
- Module / Route: Sidebar
- Role / Account: Teacher, Accountant, Receptionist
- Environment: localhost:3000, 2026-07-19
- Steps to reproduce:
  1. Sign in as Teacher — inspect sidebar (13 items including Notices, missing Leave requests).
  2. Repeat for Accountant (6 items) and Receptionist (9 items).
- Expected: Leave requests visible for roles with `leave.request` in permissions.
- Actual: **Leave requests absent** from all three sidebars. Teacher also sees **Notices** (via `students.read`) — extra vs role matrix.
- Evidence: Sidebar snapshots vs `permissions.ts`.
- Related TC IDs: LV-008, ROLE-001

### BUG-02-030 — Parent AI summary API returns 403 (UI graceful)
- Severity: Medium
- Module / Route: Parent dashboard / `GET /api/v1/ai-insights/portal/parent-summary`
- Role / Account: Parent
- Environment: localhost:3000, 2026-07-19
- Steps to reproduce:
  1. Sign in as parent; open `/portal/parent`.
  2. Inspect network for `parent-summary`.
- Expected: 200 with data, or UI omits/hides call when unauthorized.
- Actual: **403** `"No branch assigned"` — dashboard **does not crash** (PP-021 PASS for graceful handling). Same class as BUG-01-013.
- Evidence: Network 403; UI still renders.
- Related TC IDs: PP-021, BUG-01-013

### BUG-02-031 — Parent leave submit blocked (no linked children)
- Severity: High
- Module / Route: Parent Leave / `/portal/parent/leave`
- Role / Account: Parent
- Environment: localhost:3000, 2026-07-19
- Steps to reproduce:
  1. Sign in as parent → Leave requests.
  2. Try to fill and submit a leave request.
- Expected: Select child, fill dates/reason, Submit enabled, request created.
- Actual: **0 linked children** — cannot select child or enable submit (blocked by BUG-02-002). Matches BUG-01-012 pattern when data exists.
- Evidence: UI "No linked children"; API `children: []`.
- Related TC IDs: PP-014, PP-020, XMOD-001, BUG-01-012

### BUG-02-032 — Student portal sub-pages return 403 (no profile linked)
- Severity: High
- Module / Route: Student portal (`/portal/student/*`)
- Role / Account: Student (`ali.khan@nexium.edu.pk`)
- Environment: localhost:2026-07-19
- Steps to reproduce:
  1. Sign in as student.
  2. Open Attendance, Fees, Learning, etc.
- Expected: Own data for Ali Khan.
- Actual: Routes load but APIs return **403** "No student profile linked"; dashboard shows contact institution message. Notices page on parent works; most student data pages empty/blocked.
- Evidence: Network 403 on `/portal/student/*` sub-resources.
- Related TC IDs: SP-002–SP-011, SP-016, SP-014

### BUG-02-033 — Branch Admin LAHORE dashboard scope fixed (Run 01 regression PASS)
- Severity: N/A (fixed since Run 01)
- Module / Route: Dashboard / `/dashboard`
- Role / Account: Branch Admin LAHORE (`lahore.admin@nexium.edu.pk`)
- Environment: localhost:3000, 2026-07-19
- Steps to reproduce:
  1. Sign in as Lahore admin.
  2. Compare dashboard Total Students to `/dashboard/students` count.
- Expected: Lahore-scoped only (~13 students).
- Actual: Dashboard **13** = Students list **13**; all rows Lahore Campus — Gulberg only. **BUG-01-008 fixed.**
- Evidence: Side-by-side counts; ROLE-008 PASS.
- Related TC IDs: ROLE-005, ROLE-008, BUG-01-008

### BUG-02-034 — KPI cards may still show misleading +100% badges
- Severity: Medium
- Module / Route: Dashboard, Students, etc.
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-19
- Steps to reproduce:
  1. Open dashboard and module KPI cards.
  2. Compare badge percentages to API `changePercent` values.
- Expected: Meaningful change or hide when null.
- Actual: Not fully re-swept this run; **BUG-01-004 likely still open** from Run 01.
- Evidence: Run 01 finding; partial re-test only.
- Related TC IDs: DASH-002, UI-006, BUG-01-004

### BUG-02-035 — Smoke modules load successfully (informational PASS)
- Severity: N/A
- Module / Route: Front office, Library, Accounting, Certificates, Transport, Biometric, Payroll, Analytics, Reports
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Navigate to each route as Super Admin.
- Expected: Page loads without crash.
- Actual: All load with correct headings; Analytics/Reports console clean. Deep CRUD not fully exercised.
- Evidence: FOFF-001, LIB-001, ACC-001, CERT-001, TRN-001, BIO-001, PAY-001, ANL-005, RPT-005 PASS.
- Related TC IDs: FOFF-001, LIB-001, ACC-001, CERT-001, TRN-001, BIO-001, PAY-001, ANL-005, RPT-005

### BUG-02-036 — Environment: web build blocked by missing UI components (resolved for run)
- Severity: Limitation
- Module / Route: Environment / all pages
- Role / Account: All
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Start `npm run dev` when `leave-requests/page.tsx` imports missing `@/components/ui/label` and `textarea`.
- Expected: Login and dashboard compile.
- Actual: Initial run hit **Module not found** build error on `/login` (500). Missing shadcn components added to unblock testing only.
- Evidence: Next.js build overlay; `/login` returned 500 before fix.
- Related TC IDs: TECH-003

### BUG-02-037 — API dev watcher TypeScript compile errors
- Severity: Limitation
- Module / Route: Environment / API
- Role / Account: All
- Environment: localhost:3000, 2026-07-19
- Steps to reproduce:
  1. Run `npm run dev`; observe `@eims/api` errors (e.g. `ai-attendance.service.ts:165` missing `notifyAbsences`, `notifyChannel`).
- Expected: API listens on `:3001` reliably.
- Actual: API may fail to start via watcher; intermittent `ERR_CONNECTION_REFUSED` on login until prebuilt dist used.
- Evidence: Terminal TS errors during Run 02.
- Related TC IDs: TECH-001, AUTH-002

### BUG-02-038 — AI Insights / AI Attendance remain stubs
- Severity: Limitation
- Module / Route: `/dashboard/ai-insights`, `/dashboard/ai-attendance`
- Role / Account: Super Admin
- Environment: localhost:3000, 2026-07-18
- Steps to reproduce:
  1. Open AI Insights and AI Attendance.
- Expected: Documented demo stub or real workflow.
- Actual: Pages load; minimal/empty content — intentional demo gap (same as BUG-01-015).
- Evidence: UI snapshot; not re-tested in depth.
- Related TC IDs: AI-001, AI-002, AI-003, BUG-01-015

---

## Run 01 cross-reference

| BUG-01 ID | Status after Run 02 | Notes |
|-----------|----------------------|-------|
| BUG-01-001 | Not re-tested | Learning crash — verify in Run 03 |
| BUG-01-002 | Not re-tested | Learning sidebar permissions |
| BUG-01-003 | **Fixed** | Seed verify PASS — 150 invoices, 1101 attendance, 8 notices |
| BUG-01-004 | Likely open | KPI +100% badges — not fully re-swept (BUG-02-034) |
| BUG-01-005 | **Fixed** | Dashboard shows PKR 2.78M monthly revenue |
| BUG-01-006 | Not re-tested | Notices draft KPI |
| BUG-01-007 | Likely open | Login query param errors |
| BUG-01-008 | **Fixed** | BA LAHORE 13=13 (BUG-02-033) |
| BUG-01-009 | **Fixed (Teacher)** | DASH-007 PASS — no admin Quick Actions |
| BUG-01-010 | Not re-tested | Portal users in staff Users list |
| BUG-01-011 | Not re-tested | Academic programs KPI mismatch |
| BUG-01-012 | **Blocked** | Parent leave — no linked children (BUG-02-031) |
| BUG-01-013 | Still open | Parent AI 403 — graceful UI (BUG-02-030) |
| BUG-01-014 | **Blocked** | Portal learning empty — profile linking (BUG-02-002) |
| BUG-01-015 | Limitation | AI stubs unchanged (BUG-02-038) |
| BUG-01-016 | Not re-tested | Analytics threshold spinbutton |
| BUG-01-017 | Not re-tested | Settings fee policy fields |
| BUG-01-018 | Not re-tested | Accept-invite while logged in |
| BUG-01-019 | **Fixed** | Attendance seed now 1101 records |
| BUG-01-020 | **Blocked** | Child selector — 0 children (BUG-02-002) |
| BUG-01-021 | Partial | Demo limitations — seed fixed; portal linking still broken |

---

## Notes for next run

1. **Fix first:** BUG-02-001 (Communications crash), BUG-02-002 (portal profile linking), BUG-02-010/024/025 (ID search).
2. Batch **UI platform** fixes: shared Table, Modal, ConfirmDialog, pagination, dropdown dismiss (BUG-02-003–008).
3. Fix Leave requests sidebar + route access for Super Admin (BUG-02-005).
4. Re-test parent/student portals after profile linking fix.
5. Create `e2e-bugs-03.md` for Run 03; do not overwrite this file.
