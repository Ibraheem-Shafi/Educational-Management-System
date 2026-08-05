# Demo feature checklist (by role)

Client-demo walkthrough list. Mark each item done as you test. Order: **Super Admin → Branch Admin → Teacher → Accountant → Receptionist → Parent → Student**.

**Credentials & seed:** [demo-seed.md](demo-seed.md) (password for all: `Nexium@2026!`)  
**Security / RBAC leave-behind:** [client-security-rbac-brief.md](client-security-rbac-brief.md)  
**Security / RBAC live demo (10–15 min):** [rise-shine-security-demo-script.md](rise-shine-security-demo-script.md)  
**Deep E2E regression:** [e2e-test-cases.md](e2e-test-cases.md) · [e2e-testing-guide.md](e2e-testing-guide.md)

### How to use

1. Seed and start the app (`npm run db:seed:all` → `npm run db:seed:verify` → `npm run dev`).
2. Open http://localhost:3000 and log in with the account for the section you are testing.
3. Check off `- [ ]` items as you verify them in the UI.
4. For admin MFA friction, set `NEXT_PUBLIC_SKIP_ADMIN_MFA=1` and `SKIP_ADMIN_MFA=1` (see demo-seed).

---

## 1. Super Admin

**Login:** `admin@nexium.edu.pk` → `/dashboard`

### Auth & shell

- [x] Login succeeds and lands on `/dashboard`
- [x] Sidebar shows all staff modules
- [x] Profile page opens (`/dashboard/profile`)
- [x] Logout works

### Global branch scope (Super Admin only)

- [x] Header shows the app branch scope selector (desktop and mobile), defaulting to **All branches**
- [x] Selector supports **All / one / many** branches (multi-select checkboxes; "All branches" is mutually exclusive with specific picks)
- [x] Selection persists across reloads (stored in `localStorage` per user) and stale branch IDs are pruned when the branch list loads
- [x] Dashboard, students, fees, learning, notices, documents, assessments, reports, certificates, analytics, attendance stats, users, parents, communications, and leave-request lists reload when scope changes (lists + stats reflect selected branch(es))
- [x] Page-level override control ("Using app selection" + **Reset to app selection**) temporarily narrows scope on a page without changing the app selection; navigating away and back resets it
- [x] Single-branch modules (front office, library, transport, payroll, accounting, biometric, timetable grid, AI attendance) prompt to pick a single branch when scope is All / multiple
- [x] Write forms (admit student, create program/batch, invoice, notice, learning content, document upload, assessment) require an explicit branch pick when scope is All / multiple, and preselect the branch when scope is exactly one
- [x] Non-super-admin users are locked to their assigned branch (selector shows the branch name, no dropdown)

### Dashboard

- [x] KPI summary cards load
- [x] Recent activity shows across branches (`dashboard.activities.read_all`)
- [x] Today attendance / revenue widgets load when data exists

### Students (`/dashboard/students`)

- [x] Student list loads (search / filters)
- [x] Open student detail
- [x] Admit new student (`/dashboard/students/new` or admission flow)
- [x] Edit student
- [x] Assign / view subjects
- [x] Soft-delete or deactivate (if exposed in UI)
- [ ] Student documents section visible from student context

### Parents (`/dashboard/parents`)

- [x] Parent list loads
- [x] Open parent detail
- [x] Create parent
- [x] Link student to parent
- [x] Unlink student from parent

### Front office (`/dashboard/front-office`)

- [ ] Inquiries list / detail
- [ ] Create or update inquiry
- [ ] Convert inquiry to admission (preview + convert)
- [ ] Visitors CRUD
- [ ] Complaints CRUD
- [ ] Reception activity history

### Library (`/dashboard/library`)

- [ ] Catalog / books list
- [ ] Manage categories / copies (create or edit)
- [ ] Issue loan
- [ ] Return / renew loan
- [ ] Reservations
- [ ] Fines

### Attendance (`/dashboard/attendance`)

- [ ] Student attendance sheet / grid for a date
- [ ] Mark student attendance (bulk save)
- [ ] Staff / teacher attendance mode
- [ ] History / trends view

### Leave requests (`/dashboard/leave-requests`)

- [ ] List leave requests (student + employee)
- [ ] Approve a leave request
- [ ] Reject a leave request
- [ ] Submit own employee leave request

### Assessments (`/dashboard/assessments`)

- [ ] Assessment list / stats
- [ ] Open assessment detail
- [ ] Enter / save marks
- [ ] Submit for review (if flow exists)
- [ ] Publish / unpublish assessment
- [ ] Report card / export (CSV or print) if available
- [ ] Assessment types / series managed via Academic where applicable

### Fees (`/dashboard/fees`)

- [ ] Fee types list / manage
- [ ] Fee structures
- [ ] Invoices list
- [ ] Generate invoice
- [ ] Record payment / collect fee
- [ ] Print fee voucher / challan
- [ ] Print payment receipt (after collection)
- [ ] Revenue trend / stats

### Settings — Print templates

- [ ] Open Settings → Print templates
- [ ] Change paper size and field toggles for fee invoice / roll slip
- [ ] Save template

### Accounting (`/dashboard/accounting`)

- [ ] Chart of accounts
- [ ] Create / edit account
- [ ] Vouchers list + create
- [ ] Post / unpost voucher
- [ ] Print voucher
- [ ] Budgets
- [ ] Trial balance
- [ ] Income / expense report
- [ ] Account statement
- [ ] Budget vs actual

### Students — roll numbers

- [ ] Set roll / admission on admit or edit
- [ ] Search by roll / admission
- [ ] Generate roll numbers for a batch (Attendance page)
- [ ] Print roll slip from student detail
- [ ] Print roster / attendance sheet from Attendance

### Timetable (`/dashboard/timetable`)

- [ ] Schedule list / stats
- [ ] Create schedule entry
- [ ] Edit / delete schedule
- [ ] Filter by teacher / batch
- [ ] Conflict detection visible when conflicting

### Analytics (`/dashboard/analytics`)

- [ ] Analytics dashboard loads
- [ ] Attendance trends
- [ ] Batch / student performance
- [ ] Rankings
- [ ] Weak-subject alerts

### Reports (`/dashboard/reports`)

- [ ] Overview report
- [ ] Fee defaulters report

### Documents (`/dashboard/documents`)

- [ ] Document list / stats
- [ ] Upload document
- [ ] Open signed URL / download
- [ ] Delete document (if exposed)

### Certificates (`/dashboard/certificates`)

- [ ] Templates list
- [ ] Issued certificates list
- [ ] Issue certificate (transfer / character / similar)
- [ ] ID card / certificate print data opens

### Transport (`/dashboard/transport`)

- [ ] Vehicles list / manage
- [ ] Routes list / manage
- [ ] Student assignments
- [ ] Trips list / manage
- [ ] Trip attendance (if exposed)

### Biometric (`/dashboard/biometric`)

- [ ] Devices list / manage
- [ ] User mappings
- [ ] Punch logs

### Payroll (`/dashboard/payroll`)

- [ ] Salary structures
- [ ] Create / manage payroll run
- [ ] Generate / submit run
- [ ] Approve / finalize run
- [ ] Export or salary-slip print data

### Notices (`/dashboard/notices`)

- [ ] Notices list / stats
- [ ] Create notice (draft)
- [ ] Publish / target recipients
- [ ] Edit / delete notice

### Learning (`/dashboard/learning`)

- [ ] Resource list / stats
- [ ] Create learning resource
- [ ] Edit resource
- [ ] Upload attachment
- [ ] Publish / unpublish

### Academic (`/dashboard/academic`)

- [ ] Programs list
- [ ] Create / edit program
- [ ] Batches list / manage
- [ ] Subjects list / manage
- [ ] Academic sessions
- [ ] Assign subjects to batch

### Branches (`/dashboard/branches`) — Super Admin exclusive manage

- [ ] Branches list / stats
- [ ] Open branch detail
- [ ] **Create branch** (`/dashboard/branches/new`) — requires `branches.manage`
- [ ] Edit branch
- [ ] Deactivate branch (if exposed)

### Users (`/dashboard/users`)

- [ ] Users list / stats
- [ ] Roles list visible
- [ ] Invite user
- [ ] Open user detail
- [ ] HR: contracts / performance reviews (from user context if exposed)

### Audit (`/dashboard/audit`)

- [ ] Audit log list loads
- [ ] Filters work
- [ ] Audit stats

### AI Insights (`/dashboard/ai-insights`)

- [ ] At-risk students list
- [ ] Student insight summary

### AI Attendance (`/dashboard/ai-attendance`)

- [ ] Create / open OCR session
- [ ] Analyze image
- [ ] Confirm suggestions into attendance

### Communications (`/dashboard/communications`)

- [ ] Logs / stats
- [ ] Send direct SMS / WhatsApp
- [ ] Fee reminders
- [ ] Notice broadcast
- [ ] Absence alerts (if exposed)

### Settings (`/dashboard/settings`)

- [ ] Institution branding / preferences
- [ ] Terminology
- [ ] Portal feature flags (parent / student portal)
- [ ] Lookup statuses (student statuses, etc.)

### Form fields (`/dashboard/form-fields`)

- [ ] Admission form fields list
- [ ] Create / update / delete field

---

## 2. Branch Admin

**Login:** `branchadmin@nexium.edu.pk` (MAIN) and/or `lahore.admin@nexium.edu.pk` (LAHORE) → `/dashboard`

### Auth & scope

- [ ] Login succeeds and lands on `/dashboard`
- [ ] MFA path works or is skipped per env flags
- [ ] Profile opens
- [ ] Data is **branch-scoped** (MAIN admin does not see LAHORE-only records and vice versa)
- [ ] Recent activity is branch-only (not all-institution)

### Modules (same operational coverage as Super Admin, branch-scoped)

Repeat the Super Admin checks for these modules, confirming create/edit where the UI allows:

- [ ] Dashboard
- [ ] Students (list, admit, edit, delete)
- [ ] Parents (list, create, link/unlink)
- [ ] Front office
- [ ] Library
- [ ] Attendance (mark + read)
- [ ] Leave (read, manage, request)
- [ ] Assessments (marks, publish)
- [ ] Fees (collect)
- [ ] Accounting
- [ ] Timetable (manage)
- [ ] Analytics
- [ ] Reports
- [ ] Documents (upload)
- [ ] Certificates (issue)
- [ ] Transport
- [ ] Biometric
- [ ] Payroll (manage + approve)
- [ ] Notices
- [ ] Learning (publish)
- [ ] Academic (manage)
- [ ] Users (invite / manage)
- [ ] Audit
- [ ] AI Insights
- [ ] AI Attendance
- [ ] Communications
- [ ] Settings
- [ ] Form fields

### Branches — limited vs Super Admin

- [ ] Branches list / detail **visible** (`branches.read`)
- [ ] **Cannot** create branch — `/dashboard/branches/new` denied or hidden (`branches.manage` missing)
- [ ] Cannot manage institution-wide branch create/deactivate beyond assigned scope

### Branch isolation demo (recommended for clients)

- [ ] Log in as MAIN branch admin → note student / fee counts
- [ ] Log in as LAHORE branch admin → counts and lists differ / are LAHORE-only
- [ ] Switch accounts and confirm no cross-branch leakage in lists

---

## 3. Teacher

**Login:** `ahmed.teacher@nexium.edu.pk` (MAIN) or `lahore.teacher@nexium.edu.pk` (LAHORE) → `/dashboard`

### Auth & sidebar

- [ ] Login lands on `/dashboard`
- [ ] Sidebar includes: Dashboard, Students, Parents, Notices, Attendance, Leave, Assessments, Timetable, Analytics, Reports, Documents, Learning, AI Insights, AI Attendance
- [ ] Sidebar **does not** include: Fees, Accounting, Front office, Library, Academic, Branches, Users, Audit, Communications, Settings, Payroll, Transport, Biometric, Certificates, Form fields
- [ ] Profile opens

### Students & parents

- [ ] Students list (read-only — no admit/delete if UI gated)
- [ ] Open student detail
- [ ] Parents list / detail (read)

### Notices

- [ ] Notices list visible (read via `students.read`)

### Attendance

- [ ] Open attendance sheet
- [ ] Mark student attendance and save

### Leave

- [ ] Submit own leave request (`leave.request`)
- [ ] View own leave requests

### Assessments

- [ ] Assessments list
- [ ] Enter / save marks
- [ ] Cannot publish if UI requires `assessments.publish` (default teacher lacks publish — confirm expected behavior)

### Timetable

- [ ] View timetable (filter by self / batch if available)
- [ ] Cannot create schedules (no `timetable.manage`)

### Analytics & reports

- [ ] Analytics dashboard loads
- [ ] Reports overview / fee defaulters view (read)

### Documents & learning

- [ ] Documents list (read)
- [ ] Learning list
- [ ] Create / publish learning resource
- [ ] Edit resource / attachments

### AI

- [ ] AI Insights loads
- [ ] AI Attendance session → analyze → confirm

---

## 4. Accountant

**Login:** `fees@nexium.edu.pk` (MAIN) or `lahore.fees@nexium.edu.pk` (LAHORE) → `/dashboard`

### Auth & sidebar

- [ ] Login lands on `/dashboard`
- [ ] Sidebar includes: Dashboard, Fees, Accounting, Reports, Payroll, Communications, Leave
- [ ] Sidebar **does not** include Students, Attendance, Assessments, Academic, Users, Settings, etc.
- [ ] Profile opens

### Fees

- [ ] Fee types / structures
- [ ] Invoices
- [ ] Generate invoice
- [ ] Record payment / collect

### Accounting

- [ ] Chart of accounts
- [ ] Vouchers create / post
- [ ] Budgets
- [ ] Trial balance / income-expense / statements

### Payroll

- [ ] Structures list
- [ ] Payroll runs (create / generate / submit)
- [ ] Note: `payroll.approve` is **not** on default accountant — approve/finalize may be denied (confirm expected)

### Reports & communications

- [ ] Reports overview / fee defaulters
- [ ] Send fee reminder / communications send
- [ ] Communication logs

### Leave

- [ ] Submit own leave request

---

## 5. Receptionist

**Login:** `reception@nexium.edu.pk` (MAIN) or `lahore.reception@nexium.edu.pk` (LAHORE) → `/dashboard`

### Auth & sidebar

- [ ] Login lands on `/dashboard`
- [ ] Sidebar includes: Dashboard, Students, Parents, Notices, Front office, Documents, Learning, Academic, AI Attendance, Leave
- [ ] Sidebar **does not** include Fees, Accounting, Assessments, Users, Settings, Branches, Audit, Communications, Payroll, etc.
- [ ] Profile opens

### Students & parents

- [ ] Students list
- [ ] Admit / create student
- [ ] Edit student
- [ ] Parents list / create / link (via `students.update`)
- [ ] Notices list / create if UI allows (`students.update`)

### Front office

- [ ] Inquiries CRUD + convert
- [ ] Visitors CRUD
- [ ] Complaints CRUD
- [ ] Reception activity

### Documents & learning

- [ ] Documents list
- [ ] Upload document
- [ ] Learning list (read-only — no publish)

### Academic

- [ ] Programs / batches / subjects **read**
- [ ] Cannot create program (no `academic.manage`)

### Leave & AI

- [ ] Leave list (read)
- [ ] Approve / reject leave (manage)
- [ ] Submit own leave
- [ ] AI Attendance use

---

## 6. Parent

**Login:** `rashid.ahmad@nexium.edu.pk` → `/portal/parent`  
**Linked children (seed):** Ali Khan, Zainab Hussain

### Auth & shell

- [ ] Login redirects to `/portal/parent` (not staff dashboard)
- [ ] Parent sidebar: Dashboard, My children, Attendance, Assessments, Fees, Timetable, Notices, Learning, Documents, Calendar, Leave requests
- [ ] Profile opens (`/portal/parent/profile`)
- [ ] Logout works

### Dashboard

- [ ] Aggregated stats for linked children
- [ ] Announcements / homework / fee highlights if seeded

### My children

- [ ] Children list
- [ ] Open child detail (`/portal/parent/children/[id]`)
- [ ] Child selector switches context on other pages

### Attendance

- [ ] Attendance for selected child loads

### Assessments

- [ ] Marks / results for selected child

### Fees

- [ ] Outstanding / invoice list for children
- [ ] Start checkout / pay flow (`/portal/parent/fees/pay/[paymentId]`) when a payable exists

### Timetable, notices, learning, documents, calendar

- [ ] Timetable for selected child
- [ ] Notices list
- [ ] Learning list + open resource detail
- [ ] Documents list
- [ ] Calendar view

### Leave requests

- [ ] View / submit leave for child (`/portal/parent/leave`)

### Optional — mobile Parent app

- [ ] Tabs: Home, Attendance, Fees, Learning, More
- [ ] More: Notices, Timetable, Documents, Profile, Leave, child switch

---

## 7. Student

**Login:** `ali.khan@nexium.edu.pk` → `/portal/student`

### Auth & shell

- [ ] Login redirects to `/portal/student`
- [ ] Student sidebar: Dashboard, Attendance, Assessments, Fees, Timetable, Notices, Learning, Documents, Calendar, Insights
- [ ] Profile opens (`/portal/student/profile`)
- [ ] Logout works

### Dashboard

- [ ] Attendance rate / mix, outstanding fees, grades, weekly classes, homework, announcements

### Core pages

- [ ] Attendance
- [ ] Assessments / grades
- [ ] Fees list
- [ ] Fee checkout (`/portal/student/fees/pay/[paymentId]`) when payable exists
- [ ] Timetable
- [ ] Notices
- [ ] Learning list + resource detail
- [ ] Documents
- [ ] Calendar
- [ ] AI study insights (`/portal/student/insights`)

### Optional — mobile Student app

- [ ] Tabs: Home, Attendance, Fees, Learning, More
- [ ] More: Notices, Timetable, Documents, Profile, Insights

---

## Negative access (quick client trust checks)

Use after the positive demos above. Expect denied UI, redirect, or API error — not another role’s data.

For a timed client follow-up (Rise and Shine or similar), use the scripted walkthrough: [rise-shine-security-demo-script.md](rise-shine-security-demo-script.md).

| Actor | Action | Expected |
|-------|--------|----------|
| Teacher | Open `/dashboard/fees` | Denied / no menu |
| Teacher | Open `/dashboard/users` | Denied |
| Teacher | Open `/dashboard/settings` | Denied |
| Accountant | Open `/dashboard/students` | Denied / no menu |
| Accountant | Open `/dashboard/attendance` | Denied |
| Receptionist | Open `/dashboard/fees` | Denied |
| Receptionist | Open `/dashboard/accounting` | Denied |
| Branch Admin | Open `/dashboard/branches/new` | Denied (no `branches.manage`) |
| Parent | Open `/dashboard` | Redirected away / not staff shell |
| Student | Open `/portal/parent` | No parent nav / not authorized for parent data |
| Parent | Open another family’s student data by ID | Forbidden / empty |
| Student | Open another student’s fees by ID | Forbidden / own data only |

Checklist:

- [ ] Teacher cannot access Fees / Users / Settings
- [ ] Accountant cannot access Students / Attendance
- [ ] Receptionist cannot access Fees / Accounting
- [ ] Branch Admin cannot create branches
- [ ] Parent cannot use staff dashboard
- [ ] Student cannot use parent portal as parent
- [ ] Parent only sees linked children
- [ ] Student only sees own record

---

## Demo day progress (optional)

| Role | Tester | Date | Status |
|------|--------|------|--------|
| Super Admin | | | |
| Branch Admin (MAIN) | | | |
| Branch Admin (LAHORE) | | | |
| Teacher | | | |
| Accountant | | | |
| Receptionist | | | |
| Parent | | | |
| Student | | | |

**Status:** `Not started` · `In progress` · `Done` · `Blocked`
