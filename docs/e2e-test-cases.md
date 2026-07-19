# E2E Test Cases (Master Catalog)

Single source of truth for all manual E2E cases. **Do not split this file by run.** Append new cases at the bottom under “New cases”. Update the **Run 01** status column (or add later run columns) in place.

**Status values:** `Pass` | `Fail` | `Blocked` | `Limitation` | `Skip` | `—` (not run)

**Roles:** `SA` Super Admin · `BA` Branch Admin · `T` Teacher · `AC` Accountant · `R` Receptionist · `P` Parent · `S` Student

**Credentials:** [demo-seed.md](demo-seed.md) · **Guide:** [e2e-testing-guide.md](e2e-testing-guide.md) · **Run 02 plan:** [e2e-run-02-plan.md](e2e-run-02-plan.md) · **Bugs (run 01):** [e2e-bugs-01.md](e2e-bugs-01.md) · **Bugs (run 02):** [e2e-bugs-02.md](e2e-bugs-02.md)

---

## Run results legend

| Column | Meaning |
|--------|---------|
| Run 01 | 2026-07-11 — localhost:3000 |
| Run 02 | 2026-07-18 — localhost:3000 — [e2e-run-02-plan.md](e2e-run-02-plan.md) |

---


## Run 01 execution summary (2026-07-11)

Executed via Chrome DevTools MCP against localhost with demo accounts. Many Fail/Blocked cases are tied to incomplete demo seed (`db:seed:verify` failed) and Learning permission/crash issues. See [e2e-bugs-01.md](e2e-bugs-01.md).

| Metric | Count |
|--------|-------|
| Catalog cases | ~200 |
| Marked this run | ~170 |
| Pass | see column |
| Fail / Blocked / Limitation / Skip | see column + bugs file |

## Run 02 execution summary (2026-07-18 / 2026-07-19)

Multi-portal deep pass per [e2e-run-02-plan.md](e2e-run-02-plan.md). Findings in [e2e-bugs-02.md](e2e-bugs-02.md).

| Metric | Count |
|--------|-------|
| Roles tested | 8/8 (SA, BA MAIN, BA LAHORE, Teacher, Accountant, Receptionist, Parent, Student) |
| New catalog cases | ~95 appended (Run 02 column) |
| Bugs logged | 38 entries (`BUG-02-001` … `BUG-02-038`) — 2 Critical, 11 High, 22 Medium, 6 Low, 3 Limitation |
| Seed verify | **PASS** — `nexium-v1.4` |
| Top blockers | Communications `totalPages` crash; portal parent/student profiles not linked; ID search broken (students/users/branches) |

## AUTH — Authentication

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| AUTH-001 | Login page loads | Public | Open `/login` | Brand, email, password, Sign in, Forgot password link | Pass | — |
| AUTH-002 | Invalid credentials | Public | Submit wrong password | Error toast/message; stay on login | Pass | — |
| AUTH-003 | Empty form validation | Public | Submit empty | Client validation; no crash | Skip | — |
| AUTH-004 | Super Admin login redirect | SA | Login `admin@nexium.edu.pk` | Land `/dashboard`; MFA skipped if flags set | Pass | Pass |
| AUTH-005 | Branch Admin MAIN login | BA | Login `branchadmin@nexium.edu.pk` | `/dashboard`; MAIN-scoped data | Skip | — |
| AUTH-006 | Branch Admin LAHORE login | BA | Login `lahore.admin@nexium.edu.pk` | `/dashboard`; LAHORE-scoped data | Pass | — |
| AUTH-007 | Teacher login | T | Login `ahmed.teacher@nexium.edu.pk` | `/dashboard`; teacher sidebar | Pass | Pass |
| AUTH-008 | Accountant login | AC | Login `fees@nexium.edu.pk` | `/dashboard`; fees-focused nav | Pass | Pass |
| AUTH-009 | Receptionist login | R | Login `reception@nexium.edu.pk` | `/dashboard`; receptionist nav | Skip | — |
| AUTH-010 | Parent login → portal | P | Login `rashid.ahmad@nexium.edu.pk` | `/portal/parent` | Pass | Pass |
| AUTH-011 | Student login → portal | S | Login `ali.khan@nexium.edu.pk` | `/portal/student` | Pass | Pass |
| AUTH-012 | Staff cannot stay on portal home wrongly | SA | After SA login open `/portal` | Redirect to staff dashboard or role-appropriate path | Skip | — |
| AUTH-013 | Parent blocked from `/dashboard` | P | Login as parent; open `/dashboard` | Redirect to `/portal` (or parent portal) | Skip | — |
| AUTH-014 | Student blocked from `/dashboard` | S | Login as student; open `/dashboard` | Redirect to portal | Pass | — |
| AUTH-015 | Forgot password page | Public | Open `/forgot-password`; submit valid email format | Success/ack UI; Back to sign in works | Pass | — |
| AUTH-016 | Forgot password empty | Public | Submit empty email | Validation | Skip | — |
| AUTH-017 | Accept invite missing token | Public | Open `/accept-invite` | Error/empty state; no crash | Fail | — |
| AUTH-018 | Accept invite invalid token | Public | Open `/accept-invite?token=invalid` | Clear error | Skip | — |
| AUTH-019 | Sign out staff | SA | Sign out from dashboard | Session cleared; `/login` | Pass | — |
| AUTH-020 | Sign out parent | P | Sign out from portal | Lands on login promptly | Pass | — |
| AUTH-021 | Sign out student | S | Sign out from portal | Lands on login promptly | Skip | — |
| AUTH-022 | Unauthenticated deep link | Public | Open `/dashboard/students` logged out | Redirect `/login` | Skip | — |
| AUTH-023 | Portal disabled query (parent) | Public | Open `/login?error=parent_portal_disabled` | User-visible error message | Fail | — |
| AUTH-024 | Portal disabled query (student) | Public | Open `/login?error=student_portal_disabled` | User-visible error message | Fail | — |
| AUTH-025 | Session persists refresh | SA | Login; refresh `/dashboard` | Still authenticated | Pass | — |
| AUTH-026 | Login branding | Public | View `/login` | Institution name/logo consistent with settings | Pass | — |

---

## DASH — Staff dashboard home & profile

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| DASH-001 | Dashboard loads KPIs | SA | Open `/dashboard` | Stats/cards load; no blank error | Pass | Pass |
| DASH-002 | Dashboard real counts | SA | Compare student/fee/attendance widgets to seed | Plausible non-zero seeded data | Fail | — |
| DASH-003 | Dashboard console clean | SA | Check console on `/dashboard` | No unexpected errors | Pass | — |
| DASH-004 | Profile page | SA | Open `/dashboard/profile` | Name/email/role shown; editable fields behave | Skip | — |
| DASH-005 | Sidebar all modules (SA) | SA | Inspect sidebar | All SA modules visible per inventory | Fail | — |
| DASH-006 | Mobile sidebar | SA | 375px width; open nav | Usable menu; no overlap | Pass | — |

---

## STU — Students

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| STU-001 | Students list loads | SA | `/dashboard/students` | Table/list with seeded students | Pass | Pass |
| STU-002 | Student count ≥ 45 | SA | Note total/pagination | Matches seed threshold | Pass | — |
| STU-003 | Search by name | SA | Search `Ali Khan` | Finds featured student | Pass | — |
| STU-004 | Filter by status | SA | Filter active/inactive | Results update correctly | Skip | — |
| STU-005 | Filter by branch | SA | Filter MAIN / LAHORE | Branch-scoped results | Skip | — |
| STU-006 | Open student detail | SA | Click a student | `/dashboard/students/[id]` with profile data | Skip | — |
| STU-007 | Detail shows batch/program | SA | On Ali Khan detail | MDCAT Morning / MAIN consistent | Pass | — |
| STU-008 | Detail linked parents | SA | Parents section | Linked parent(s) visible | Pass | — |
| STU-009 | New student form | SA | `/dashboard/students/new` | Form fields load (incl. custom form fields) | Skip | — |
| STU-010 | New student validation | SA | Submit empty | Required field errors | Skip | — |
| STU-011 | Create E2E student | SA | Create `E2E-TEST-Student` with valid data | Success; appears in list | Skip | — |
| STU-012 | Edit student | SA | Edit E2E student minor field | Saves; reflects on detail | Skip | — |
| STU-013 | Teacher view-only students | T | Login teacher; students list | Can view; limited write | Pass | — |
| STU-014 | Accountant students view | AC | Open students | View allowed; admit may be hidden/denied | Pass | — |
| STU-015 | Receptionist admit access | R | Open new student | Can access admit flow per role | Skip | — |
| STU-016 | Pagination / load more | SA | Navigate pages | Stable data; no duplicates crash | Pass | Pass |
| STU-017 | Empty search | SA | Search nonsense | Empty state, not error | Skip | — |
| STU-018 | Network errors on list | SA | Check network for `/students` | 200; payload has data | Pass | — |
| STU-019 | Mobile students table | SA | 375px | Horizontal scroll or cards; usable | Skip | — |
| STU-020 | Cross-link to fees/attendance | SA | From detail navigate related | Links work or sections present | Skip | — |

---

## PAR-STAFF — Parents (staff)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| PARS-001 | Parents list | SA | `/dashboard/parents` | List loads; ≥ 30 parents | Pass | — |
| PARS-002 | Search parent Rashid | SA | Search Rashid | Finds parent | Pass | — |
| PARS-003 | Parent detail / children | SA | Open Rashid | Ali + Zainab linked | Pass | — |
| PARS-004 | Create/link parent UI | SA | Open create/link actions | Forms work; validation | Skip | — |
| PARS-005 | Teacher parents view | T | Open parents | View allowed | Skip | — |

---

## ATT — Attendance

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ATT-001 | Attendance page loads | SA | `/dashboard/attendance` | Batch/date selectors; grid or list | Pass | — |
| ATT-002 | Select batch + date | SA | Pick MDCAT Morning + weekday | Roster loads | Pass | — |
| ATT-003 | Seeded attendance present | SA | Browse past dates | Historical marks exist | Fail | — |
| ATT-004 | Mark present/absent | SA | Toggle statuses; save | Persists after reload | Skip | — |
| ATT-005 | Teacher can mark | T | Mark attendance | Allowed | Skip | — |
| ATT-006 | Accountant hidden/denied | AC | Open `/dashboard/attendance` | Hidden nav or denied | Pass | — |
| ATT-007 | Receptionist attendance | R | Open attendance | Can use per matrix | Skip | — |
| ATT-008 | Validation no batch | SA | Save without selection | Clear error | Skip | — |
| ATT-009 | Mobile attendance UI | SA | 375px | Usable marking UI | Skip | — |

---

## ASM — Assessments

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ASM-001 | Assessments list | SA | `/dashboard/assessments` | ≥ 5 seeded assessments | Fail | — |
| ASM-002 | Open marks entry | SA | Open assessment marks | Roster + score inputs | Blocked | — |
| ASM-003 | Enter/save marks | SA | Edit a mark; save | Persists | Blocked | — |
| ASM-004 | Create assessment | SA/T | Create `E2E-TEST` assessment | Appears in list | Skip | — |
| ASM-005 | Teacher marks access | T | Open marks | Can enter marks | Skip | — |
| ASM-006 | Accountant no assessments | AC | Check sidebar | Assessments hidden | Pass | — |
| ASM-007 | Marks validation | SA | Enter out-of-range | Rejected with message | Skip | — |
| ASM-008 | Filter/search assessments | SA | Filter by type/batch | Correct subset | Skip | — |

---

## FEE — Fees

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| FEE-001 | Fees page loads | SA | `/dashboard/fees` | Invoices/structures UI | Pass | — |
| FEE-002 | Invoice count substantial | SA | List invoices | Dozens of invoices (seed ≥ 60) | Fail | — |
| FEE-003 | PKR currency display | SA | Inspect amounts | PKR / Rs formatting | Pass | — |
| FEE-004 | Filter paid/pending/overdue | SA | Apply status filters | Correct statuses | Blocked | — |
| FEE-005 | Record payment / update | AC | Pay or update an invoice carefully | Status updates | Blocked | — |
| FEE-006 | Accountant full fees | AC | Login fees user | Fees primary workflow works | Pass | — |
| FEE-007 | Teacher fees hidden | T | Check sidebar | Fees hidden | Pass | — |
| FEE-008 | Fee structures tab | SA | View structures | MDCAT/HSSC/SSC structures | Skip | — |
| FEE-009 | Sibling discount visible | SA | Settings or invoice notes | 10% sibling discount reflected somewhere | Fail | — |
| FEE-010 | Mobile fees | SA | 375px | Usable | Skip | — |

---

## TIME — Timetable

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| TIME-001 | Timetable loads | SA | `/dashboard/timetable` | Grid for batch | Pass | — |
| TIME-002 | MDCAT Morning grid | SA | Select MDCAT Morning Batch A | Weekly slots populated | Fail | — |
| TIME-003 | Teacher view | T | Open timetable | Can view | Skip | — |
| TIME-004 | Edit slot (if allowed) | SA | Edit/create slot | Saves or clear permission error | Skip | — |
| TIME-005 | Empty batch state | SA | Select batch without TT | Empty state not crash | Pass | — |

---

## ANL — Analytics

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ANL-001 | Analytics loads | SA | `/dashboard/analytics` | Charts/stats render | Pass | — |
| ANL-002 | Data non-empty | SA | Inspect widgets | Seeded-backed numbers | Limitation | — |
| ANL-003 | Teacher view | T | Open analytics | View allowed | Skip | — |
| ANL-004 | Console/network clean | SA | Check tools | No failed chart APIs | Pass | — |

---

## RPT — Reports

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| RPT-001 | Reports page | SA | `/dashboard/reports` | Report types listed | Pass | — |
| RPT-002 | Generate/view report | SA | Run a report | Output or download works | Pass | — |
| RPT-003 | Accountant reports | AC | Open reports | View allowed | Pass | — |
| RPT-004 | Receptionist hidden | R | Check nav | Reports hidden | Skip | — |

---

## DOC — Documents

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| DOC-001 | Documents list | SA | `/dashboard/documents` | Seeded docs (policy, prospectus, etc.) | Fail | — |
| DOC-002 | Open/download | SA | Open a document | Signed URL or preview works | Blocked | — |
| DOC-003 | Upload E2E doc | SA | Upload small file named E2E-TEST | Appears in list | Skip | — |
| DOC-004 | Teacher view | T | Open documents | View | Skip | — |

---

## NTC — Notices

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| NTC-001 | Notices list | SA | `/dashboard/notices` | ≥ 5 notices | Fail | — |
| NTC-002 | Create notice | SA | Create `E2E-TEST-Notice` | Published/listed | Pass | — |
| NTC-003 | Edit notice | SA | Edit E2E notice | Saves | Skip | — |
| NTC-004 | Audience targeting | SA | Set audience if UI allows | Saves correctly | Pass | — |
| NTC-005 | Teacher view notices | T | Open notices | Can view | Skip | — |

---

## LV — Leave requests (staff)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| LV-001 | Leave list loads | SA | `/dashboard/leave-requests` | Page loads | Pass | — |
| LV-002 | Approve/reject UI | SA | If pending exists, action | Status updates | Blocked | — |
| LV-003 | Empty state | SA | If none pending | Honest empty state | Pass | — |

---

## LRN — Learning (staff)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| LRN-001 | Learning list | SA | `/dashboard/learning` | Seeded materials listed | Fail | — |
| LRN-002 | Create learning item | SA | `/dashboard/learning/new` create E2E | Created | Blocked | — |
| LRN-003 | Edit learning item | SA | Edit E2E item | Saves | Blocked | — |
| LRN-004 | Publish/unpublish | SA | Toggle publish | Reflects in portals later | Blocked | — |
| LRN-005 | Teacher learning | T | Open learning | Can manage/view | Fail | — |
| LRN-006 | Accountant hidden | AC | Check nav | Learning hidden | Pass | — |

---

## ACAD — Academic

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ACAD-001 | Academic page | SA | `/dashboard/academic` | Programs/batches/subjects/sessions | Pass | — |
| ACAD-002 | Programs listed | SA | View programs | SSC, HSSC, MDCAT, ECAT | Fail | — |
| ACAD-003 | Batches ≥ 6 | SA | View batches | Includes MAIN + LAHORE batches | Pass | — |
| ACAD-004 | Subjects | SA | View subjects | Physics, Chem, Bio, Math, English | Pass | — |
| ACAD-005 | Session 2026 | SA | View sessions | 2026 present | Pass | — |
| ACAD-006 | Teacher academic hidden | T | Check nav | Hidden | Pass | — |
| ACAD-007 | Receptionist view | R | Open academic | View per matrix | Skip | — |

---

## BR — Branches

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| BR-001 | Branches list | SA | `/dashboard/branches` | MAIN + LAHORE | Pass | — |
| BR-002 | Branch detail | SA | Open MAIN | Details correct | Skip | — |
| BR-003 | New branch form | SA | `/dashboard/branches/new` | Form loads | Skip | — |
| BR-004 | BA cannot create (API) | BA | Try create as branchadmin | UI/API denies manage create | Skip | — |
| BR-005 | Teacher hidden | T | Check nav | Hidden | Pass | — |

---

## USR — Users

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| USR-001 | Users list | SA | `/dashboard/users` | Demo staff users present | Fail | — |
| USR-002 | User stats | SA | Stats widgets | Non-zero | Pass | — |
| USR-003 | Invite form | SA | `/dashboard/users/invite` | Form validation works | Skip | — |
| USR-004 | Invite E2E user | SA | Invite `e2e-test+…@` role teacher | Invitation created (email may not arrive) | Skip | — |
| USR-005 | Roles list | SA | Open role picker | 7 roles available | Skip | — |
| USR-006 | Teacher users hidden | T | Check nav | Hidden | Pass | — |
| USR-007 | BA users manage | BA | Open users | Can manage within scope | Skip | — |

---

## AUD — Audit

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| AUD-001 | Audit log loads | SA | `/dashboard/audit` | Entries listed | Skip | — |
| AUD-002 | Filter/search | SA | Apply filters | Results change | Skip | — |
| AUD-003 | Teacher hidden | T | Check nav | Hidden | Pass | — |

---

## AI — AI Insights & Attendance

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| AI-001 | AI Insights page | SA | `/dashboard/ai-insights` | Loads; may be empty stub | Limitation | — |
| AI-002 | AI Attendance page | SA | `/dashboard/ai-attendance` | Loads; may be empty stub | Limitation | — |
| AI-003 | Document stub limitation | SA | Note if no real AI | Record Limitation not Fail if intentional | Limitation | — |
| AI-004 | Teacher AI attendance | T | Open AI attendance | Accessible | Skip | — |

---

## COM — Communications

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| COM-001 | Communications page | SA | `/dashboard/communications` | Log/list of SMS/WhatsApp | Skip | — |
| COM-002 | Seeded comms entries | SA | Browse | ~5 demo entries | Skip | — |
| COM-003 | Send UI | SA | Open compose if present | Validation; send or clear error | Skip | — |
| COM-004 | Accountant access | AC | Open communications | Allowed | Pass | — |
| COM-005 | Teacher hidden | T | Check nav | Hidden | Pass | — |

---

## SET — Settings & form fields

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| SET-001 | Settings page | SA | `/dashboard/settings` | Institution settings load | Pass | — |
| SET-002 | Branding fields | SA | View name/colors/logo | Nexium Academy values | Pass | — |
| SET-003 | Feature flags visible | SA | parentPortal/studentPortal | Toggles present | Pass | — |
| SET-004 | Fee settings | SA | Sibling discount / late fee | 10% / Rs 500 after 7 days | Fail | — |
| SET-005 | Save settings | SA | Minor safe edit or cancel | No crash; save works if changed | Skip | — |
| SET-006 | Form fields page | SA | `/dashboard/form-fields` | Custom fields listed | Skip | — |
| SET-007 | Form field CRUD | SA | Create E2E field or edit | Persists | Skip | — |
| SET-008 | Teacher settings hidden | T | Check nav | Hidden | Pass | — |

---

## ROLE — Role matrix & branch scope

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ROLE-001 | Teacher sidebar subset | T | Compare to SA | Fees/Users/Settings/etc hidden | Pass | — |
| ROLE-002 | Accountant sidebar | AC | Inspect | Fees/Comms/Reports; no assessments | Pass | — |
| ROLE-003 | Receptionist sidebar | R | Inspect | Students/Attendance/AI Att; limited | Skip | — |
| ROLE-004 | BA MAIN data scope | BA | Students/fees as branchadmin | MAIN campus data | Skip | — |
| ROLE-005 | BA LAHORE data scope | BA | Login lahore.admin; students | LAHORE data; not full MAIN set | Fail | Pass |
| ROLE-006 | Unauthorized mutation | T | Attempt forbidden write if UI shows | API 403; UI handles gracefully | Fail | — |
| ROLE-007 | Deep link forbidden page | T | Open `/dashboard/settings` | Denied/redirect/empty | Skip | — |

---

## PP — Parent portal

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| PP-001 | Parent dashboard | P | `/portal/parent` | Children cards; stats | Pass | — |
| PP-002 | Children list | P | `/portal/parent/children` | Ali + Zainab | Pass | — |
| PP-003 | Child detail | P | Open Ali | Correct profile/batch | Skip | — |
| PP-004 | Attendance | P | `/portal/parent/attendance` | Real attendance data | Skip | — |
| PP-005 | Assessments | P | `/portal/parent/assessments` | Marks visible | Skip | — |
| PP-006 | Fees | P | `/portal/parent/fees` | Invoices PKR; statuses | Skip | — |
| PP-007 | Timetable | P | `/portal/parent/timetable` | Schedule for child batch | Skip | — |
| PP-008 | Notices | P | `/portal/parent/notices` | Notices listed | Skip | — |
| PP-009 | Learning list | P | `/portal/parent/learning` | Materials for children | Fail | — |
| PP-010 | Learning detail | P | Open an item | Content/files load | Blocked | — |
| PP-011 | Documents | P | `/portal/parent/documents` | Docs accessible | Skip | — |
| PP-012 | Calendar | P | `/portal/parent/calendar` | Events/dates render | Skip | — |
| PP-013 | Leave list | P | `/portal/parent/leave` | Page loads | Pass | — |
| PP-014 | Submit leave | P | Create leave for child | Success; appears staff side later | Fail | — |
| PP-015 | Profile | P | `/portal/parent/profile` | Parent info; edit if allowed | Skip | — |
| PP-016 | Mobile bottom nav | P | 375px | Bottom nav works | Skip | — |
| PP-017 | Console clean | P | Spot-check pages | No critical console errors | Fail | — |
| PP-018 | Cross-check staff notice | P | After NTC-002 | E2E notice visible if audience includes parents | Blocked | — |

---

## SP — Student portal

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| SP-001 | Student dashboard | S | `/portal/student` | Personal stats for Ali | Pass | — |
| SP-002 | Attendance | S | `/portal/student/attendance` | Own attendance | Skip | — |
| SP-003 | Assessments | S | `/portal/student/assessments` | Own marks | Skip | — |
| SP-004 | Fees | S | `/portal/student/fees` | Own invoices | Skip | — |
| SP-005 | Timetable | S | `/portal/student/timetable` | Own batch grid | Skip | — |
| SP-006 | Notices | S | `/portal/student/notices` | Notices | Skip | — |
| SP-007 | Learning list | S | `/portal/student/learning` | Materials + due soon | Fail | — |
| SP-008 | Learning detail | S | Open item | Detail works | Blocked | — |
| SP-009 | Documents | S | `/portal/student/documents` | Docs | Skip | — |
| SP-010 | Calendar | S | `/portal/student/calendar` | Calendar | Skip | — |
| SP-011 | Insights | S | `/portal/student/insights` | Page loads (may be limited) | Skip | — |
| SP-012 | Profile | S | `/portal/student/profile` | Profile; edit allowed fields | Skip | — |
| SP-013 | Mobile nav | S | 375px | Usable | Pass | — |
| SP-014 | No other students’ data | S | Inspect lists | Only Ali’s data | Pass | — |
| SP-015 | Console/network | S | Check tools | Healthy APIs | Skip | — |

---

## XMOD — Cross-module & consistency

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| XMOD-001 | Parent leave → staff list | P/SA | Submit leave; check staff leave | Request visible | Fail | — |
| XMOD-002 | Staff notice → portals | SA/P/S | Publish notice; check portals | Visible when targeted | Blocked | — |
| XMOD-003 | Learning publish → portals | SA/S | Publish learning; student sees | Consistent | Blocked | — |
| XMOD-004 | Fee update → parent fees | AC/P | Update invoice; parent view | Status matches | Blocked | — |
| XMOD-005 | Attendance → parent/student | T/P/S | Mark day; portals reflect | Same status | Blocked | — |
| XMOD-006 | Branding consistency | All | Login, dashboard, portals | Same institution branding | Pass | — |
| XMOD-007 | Timezone/date display | SA | Dates on attendance/fees | Asia/Karachi sensible | Pass | — |

---

## UI — UI consistency, responsiveness, tech

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| UI-001 | Login mobile | Public | 375px `/login` | No overflow; usable | Skip | — |
| UI-002 | Dashboard mobile | SA | 375px | Layout OK | Pass | — |
| UI-003 | Portal mobile | P | 375px key pages | OK | Pass | — |
| UI-004 | Loading states | SA | Slow network observe | Skeletons/spinners not blank forever | Skip | — |
| UI-005 | Error states | SA | Note failed API handling | User-friendly errors | Skip | — |
| UI-006 | Button consistency | SA | Spot-check modules | Primary actions consistent | Fail | — |
| UI-007 | No horizontal page scroll desktop | SA | 1280px key pages | No unintended overflow | Pass | — |
| UI-008 | Broken images/icons | SA | Visual pass | Icons render | Pass | — |
| UI-009 | Unresponsive click targets | SA | Click primary CTAs | Immediate feedback | Pass | — |
| UI-010 | Accessibility basics | SA | Snapshot labels | Forms have labels | Fail | — |

---

## TECH — Technical / network / console

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| TECH-001 | Health API | — | GET `/api/v1/health` | 200 | Pass | — |
| TECH-002 | Auth me after login | SA | Network `auth/me` | 200 with roles | Pass | — |
| TECH-003 | No systematic 500s | SA | Sweep modules | No repeated 500 | Fail | — |
| TECH-004 | No systematic CORS failures | SA | Console/network | Clean | Pass | — |
| TECH-005 | Portal APIs 200 | P/S | Portal pages | `/api/v1/portal/*` OK | Pass | — |
| TECH-006 | Slow pages noted | All | Note >5s loads | Document if chronic | Skip | — |

---

## New cases

_Append future cases below this heading. Do not create a second catalog file._

### UI — Cross-cutting (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| UI-011 | Dropdown closes on outside click | All | Open any filter Select; click outside | Dropdown closes | — | Fail |
| UI-012 | Consistent table UI across modules | SA | Compare Students, Parents, Users, Notices, Documents tables | Same table component chrome | — | Fail |
| UI-013 | Sidebar related items grouped | SA | Inspect sidebar order Attendance vs Leave requests | Related modules grouped or adjacent | — | Fail |
| UI-014 | Backend pagination on all list tables | SA | Open list modules; check UI + network `page`/`limit`/`totalPages` | Paginated API + paginated table UI | — | Fail |
| UI-015 | No in-row edit — modal only | SA | Scan Form fields and other tables for inline edit | Edit opens modal; single modal component | — | Fail |
| UI-016 | No window.alert — reusable popup | SA | Trigger delete/cancel flows | Confirmation uses reusable popup not alert | — | Skip |
| UI-017 | More menu icons not all eye | SA | Open More on Users, Form fields | Correct action icons per item | — | Fail |

### AUTH — Run 02 additions

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| AUTH-027 | Credential probe Rekhta vs Nexium | Public | Try login with both domain/password sets | Record working credentials in bug file | — | Pass |
| AUTH-028 | Receptionist login + sidebar | R | Login reception@; inspect sidebar | 10 receptionist modules visible | — | Pass |
| AUTH-029 | Branch Admin MAIN scope | BA | Login branchadmin@; check students count | MAIN-scoped data only | — | Pass |
| AUTH-030 | Forbidden deep link per role | T | Login teacher; open `/dashboard/settings` | Denied or redirect; no settings access | — | Pass |

### STU — Students regressions (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| STU-021 | Create student field-level validation | SA | `/dashboard/students/new`; submit empty/invalid | Field errors before API; show invalid field names | — | Skip |
| STU-022 | Search student by ID STD-* | SA | Search `STD-LY8OD7` or seeded ID | Student found | — | Fail |
| STU-023 | Super Admin edit student full form | SA | Open student; edit with same UI as create | Edit saves; same form layout as create | — | Fail |
| STU-024 | Status filter intermittent failure | SA | Toggle status filter repeatedly; reload | No "Failed to load students" | — | Skip |
| STU-025 | Branch Admin edit student | BA | Login BA; edit student | Same edit UI as create; saves | — | Pass |

### ATT — Attendance regressions (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ATT-010 | Date range selector not day-stepper | SA | Open attendance; try jump to date 1 year ago | Date range or calendar picker; not ~360 back clicks | — | Fail |
| ATT-011 | No default program in filter | SA | Load attendance filters | Program filter empty by default | — | Fail |
| ATT-012 | Today's rate chip vs yesterday | SA | View Today's rate stat card chip | Shows sensible % delta from yesterday; not -110% | — | Fail |
| ATT-013 | Month average chip and calculation | SA | View Month average card | No spurious 0% top chip; avg excludes current partial month | — | Fail |
| ATT-014 | Calendar navigation parity | SA | Compare attendance calendar to timetable | Consistent calendar-style navigation | — | Fail |

### ASM — Assessments UX (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ASM-009 | Series/types as tabs not Manage pages | SA | Open assessments | Tabs like Academic; no separate Manage series/types | — | Fail |
| ASM-010 | Series CRUD tab + modal | SA | Series tab table + add/edit modal | Read table + modal CRUD like Academic | — | Fail |
| ASM-011 | Types CRUD tab + modal | SA | Types tab table + add/edit modal | Read table + modal CRUD like Academic | — | Fail |

### FEE — Fees UX (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| FEE-011 | Fees and Fee Defaulter tabs | SA | Open fees page | Tabs "Fees" and "Fee Defaulter" not two stacked tables | — | Fail |
| FEE-012 | Both fee tabs paginated | SA | Both tabs; check UI + API | Paginated table + API pagination | — | Fail |
| FEE-013 | Defaulter tab accuracy | SA | Compare defaulter tab to overdue invoices | Data consistent | — | Skip |

### TIME — Timetable (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| TIME-006 | View beyond one week | SA | Timetable navigation | Can view beyond Mon–Sun single week | — | Fail |
| TIME-007 | Calendar UI like attendance | SA | Compare timetable to attendance calendar | Same calendar-like UI | — | Fail |
| TIME-008 | Drag/move scheduled items | SA | Try move slot room/day/time | Reschedule works for SA | — | Skip |

### NTC — Notices (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| NTC-006 | Notice ID column in table | SA | Notices list | ID column visible | — | Fail |
| NTC-007 | Search notice by ID | SA | Search by notice ID | Finds notice | — | Fail |
| NTC-008 | Notices paginated | SA | List + network | API pagination + table UI | — | Fail |
| NTC-009 | View full notice body in modal | SA | More → View on notice | Full body in modal like create | — | Fail |
| NTC-010 | Edit draft notice | SA | Edit draft | Saves successfully | — | Fail |
| NTC-011 | Published notice not editable | SA | Try edit published | Edit blocked for published | — | Pass |

### DOC — Documents (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| DOC-005 | Upload modal title field on top | SA | Open upload modal | Title field first | — | Fail |
| DOC-006 | Open document no Object not found | SA | Open/download seeded doc | Preview/download works | — | Fail |
| DOC-007 | Upload document no Bucket not found | SA | Upload small test file | Upload succeeds | — | Skip |
| DOC-008 | Delete confirmation modal | SA | Delete document | Reusable confirmation modal | — | Skip |
| DOC-009 | Delete loading toast | SA | Delete document | Loading toast during delete | — | Skip |
| DOC-010 | Documents paginated | SA | List + network | Paginated API + UI | — | Fail |

### PARS — Parents staff (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| PARS-006 | Add parent field validation | SA | Add parent empty submit | Field-level errors not only "Validation failed" | — | Fail |
| PARS-007 | Parent ID column and search | SA | Table + search by parent ID | ID shown; search by ID works | — | Fail |
| PARS-008 | No unlink in More menu on list | SA | More options on list row | Unlink student absent from list More menu | — | Fail |
| PARS-009 | View parent detail page | SA | More → View | Separate page with parent info | — | Fail |
| PARS-010 | Link/unlink on detail page | SA | Parent detail page | Link/unlink students on detail only | — | Fail |

### BR / USR / AUD / COM / SET — Run 02

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| BR-006 | Search branch by ID BR-LAHORE | SA | Search `BR-LAHORE` | Branch found | — | Fail |
| USR-008 | Search user by STF-* ID | SA | Search `STF-BPREG7` or seeded ID | User found | — | Fail |
| USR-009 | Users default page size 8 | SA | Users table pagination | Default 8 per page not 10 | — | Fail |
| AUD-004 | Audit default page size 8 | SA | Audit table pagination | Default 8 per page not 20 | — | Fail |
| COM-006 | Communications page loads | SA/AC | Open `/dashboard/communications` | No totalPages undefined crash | — | Fail |
| SET-009 | Form fields pagination search | SA | Form fields table | Pagination and search present | — | Fail |
| SET-010 | Form fields add modal UI | SA | Add field modal | Same modal pattern as Notices | — | Skip |
| SET-011 | Form field order field UX | SA | Create field with order | Clear purpose or order editable only in edit | — | Skip |
| SET-012 | Form field edit modal | SA | Edit field | Modal edit not in-row | — | Fail |
| SET-013 | Form fields layout full width | SA | Compare to Students page | No extra left/right margins | — | Fail |
| SET-014 | Settings layout full width | SA | Compare to Students page | No extra left/right margins | — | Fail |

### ANL — Analytics deep (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ANL-005 | Analytics filters and widgets | SA | All filters/widgets | Render; no crash | — | Pass |
| ANL-006 | Weak subject threshold min/max | SA | Inspect threshold spinbutton | Valid range e.g. 0–100 | — | Skip |
| ANL-007 | Analytics console/network clean | SA | DevTools on page | No 4xx/5xx on chart APIs | — | Pass |
| ANL-008 | Teacher analytics access | T | Open analytics | View allowed per role | — | Pass |

### RPT — Reports deep (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| RPT-005 | Each report type listed | SA | Scan all report types | All types visible | — | Pass |
| RPT-006 | Generate report output | SA | Run one report | Output or download | — | Skip |
| RPT-007 | Reports console clean | SA | Network on generate | No errors | — | Pass |
| RPT-008 | Accountant reports access | AC | Open reports | Full view access | — | Pass |
| RPT-009 | Teacher reports access | T | Open reports | View access | — | Pass |
| RPT-010 | Receptionist reports hidden | R | Check sidebar | Reports not in nav | — | Pass |

### LV — Leave requests deep (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| LV-004 | Leave list filters | SA | Apply filters | Results update | — | Fail |
| LV-005 | Leave pagination | SA | List + network | Paginated if applicable | — | Skip |
| LV-006 | Approve/reject pending | SA | Action on pending leave | Status updates | — | Skip |
| LV-007 | Parent leave on staff list | P/SA | Parent submits; staff views | Request visible staff side | — | Blocked |
| LV-008 | Receptionist leave access | R | Open leave requests | Manage per role | — | Fail |

### FOFF — Front office (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| FOFF-001 | Front office page loads | SA/R | `/dashboard/front-office` | Page loads no crash | — | Pass |
| FOFF-002 | Front office list/search | SA | Search/filter | Results update | — | Skip |
| FOFF-003 | Front office pagination | SA | List + network | Pagination if list exists | — | Skip |
| FOFF-004 | Front office create modal | R | Create record if UI exists | Modal validation works | — | Skip |
| FOFF-005 | Receptionist front office | R | Full checklist on page | Same depth as SA modules | — | Blocked |
| FOFF-006 | Teacher front office hidden | T | Sidebar | Not visible | — | Pass |

### LIB — Library (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| LIB-001 | Library page loads | SA | `/dashboard/library` | Catalog UI loads | — | Pass |
| LIB-002 | Library search/filter | SA | Search catalog | Results update | — | Skip |
| LIB-003 | Issue/return flow | SA | Issue or return if UI | Works or clear empty state | — | Skip |
| LIB-004 | Library fines display | SA | Overdue/fines section | Renders or honest empty | — | Skip |
| LIB-005 | Library table UI consistency | SA | Compare table chrome | Matches shared table pattern | — | Skip |

### ACC — Accounting (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ACC-001 | Accounting page loads | SA/AC | `/dashboard/accounting` | Page loads | — | Pass |
| ACC-002 | Accounting entries list | AC | View entries | List or empty state | — | Skip |
| ACC-003 | Accounting filters | AC | Apply filters | Results update | — | Skip |
| ACC-004 | Accountant accounting access | AC | Sidebar + page | Full access | — | Pass |
| ACC-005 | Teacher accounting hidden | T | Sidebar | Hidden | — | Pass |

### CERT — Certificates (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| CERT-001 | Certificates page loads | SA | `/dashboard/certificates` | Page loads | — | Pass |
| CERT-002 | Generate certificate UI | SA | Open generate flow | Form/modal works | — | Skip |
| CERT-003 | ID card generation | SA | ID card flow if present | Works or documented gap | — | Skip |
| CERT-004 | Print path | SA | Preview/print | No crash | — | Skip |

### TRN — Transport (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| TRN-001 | Transport page loads | SA | `/dashboard/transport` | Page loads | — | Pass |
| TRN-002 | Routes list | SA | View routes | List or empty state | — | Skip |
| TRN-003 | Vehicles list | SA | View vehicles | List or empty state | — | Skip |
| TRN-004 | GPS/trip data | SA | Trip section | Data or stub documented | — | Skip |
| TRN-005 | Transport console clean | SA | DevTools | No uncaught errors | — | Pass |

### BIO — Biometric (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| BIO-001 | Biometric page loads | SA/R | `/dashboard/biometric` | Page loads | — | Pass |
| BIO-002 | Device list | SA | View devices | List or empty state | — | Skip |
| BIO-003 | Receptionist biometric | R | Open page | Access per role | — | Skip |
| BIO-004 | Biometric console clean | SA | DevTools | No uncaught errors | — | Pass |

### PAY — Payroll (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| PAY-001 | Payroll page loads | SA/AC | `/dashboard/payroll` | Page loads | — | Pass |
| PAY-002 | Payroll run UI | AC | View run payroll | UI works or empty | — | Skip |
| PAY-003 | Salary slips | AC | View slips | List or empty | — | Skip |
| PAY-004 | Payroll approval flow | SA | Approval if UI | Works or documented | — | Skip |
| PAY-005 | Teacher payroll hidden | T | Sidebar | Hidden | — | Pass |

### PP / SP — Portal deep (Run 02)

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| PP-019 | Parent child selector label | P | Select child on Learning/Leave | Button shows child name | — | Blocked |
| PP-020 | Parent leave submit enables | P | Fill leave form completely | Submit enabled; request created | — | Blocked |
| PP-021 | Parent AI summary error handling | P | Dashboard network ai-insights | Graceful UI if 403 | — | Pass |
| PP-022 | Parent all pages checklist | P | Every `/portal/parent/*` route | Full checklist per run plan | — | Fail |
| SP-016 | Student all pages checklist | S | Every `/portal/student/*` route | Full checklist per run plan | — | Fail |
| SP-017 | Student dropdown outside click | S | Portal filters if any | Dropdown closes on outside click | — | Skip |

### XMOD — Cross-module Run 02

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| XMOD-008 | Notice publish → portals | SA/P/S | Publish; check portals | Visible when targeted | — | Skip |
| XMOD-009 | Staff leave approve → parent | SA/P | Approve; parent checks | Status synced | — | Blocked |
| XMOD-010 | Fee status staff ↔ parent | AC/P | Update fee; parent view | Status matches | — | Skip |
| XMOD-011 | Attendance mark → portals | T/P/S | Mark; portal views | Same status | — | Skip |
| XMOD-012 | Learning publish → portals | SA/S/P | Publish; portal learning | Student/parent see item | — | Skip |

### DASH — Run 02

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| DASH-007 | Quick Actions respect role | T/AC | Dashboard Quick Actions | No forbidden shortcuts | — | Pass |

### ROLE — Run 02 BA scope

| ID | Title | Role | Steps | Expected | Run 01 | Run 02 |
|----|-------|------|-------|----------|--------|--------|
| ROLE-008 | BA LAHORE dashboard vs students | BA | lahore.admin dashboard + students | Consistent LAHORE scope | — | Pass |
| ROLE-009 | BA cannot create branch | BA | `/dashboard/branches/new` | Denied or hidden | — | Pass |
