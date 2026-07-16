# E2E Test Cases (Master Catalog)

Single source of truth for all manual E2E cases. **Do not split this file by run.** Append new cases at the bottom under “New cases”. Update the **Run 01** status column (or add later run columns) in place.

**Status values:** `Pass` | `Fail` | `Blocked` | `Limitation` | `Skip` | `—` (not run)

**Roles:** `SA` Super Admin · `BA` Branch Admin · `T` Teacher · `AC` Accountant · `R` Receptionist · `P` Parent · `S` Student

**Credentials:** [demo-seed.md](demo-seed.md) · **Guide:** [e2e-testing-guide.md](e2e-testing-guide.md) · **Bugs (run 01):** [e2e-bugs-01.md](e2e-bugs-01.md)

---

## Run results legend

| Column | Meaning |
|--------|---------|
| Run 01 | 2026-07-11 — localhost:3000 |

---


## Run 01 execution summary (2026-07-11)

Executed via Chrome DevTools MCP against localhost with demo accounts. Many Fail/Blocked cases are tied to incomplete demo seed (`db:seed:verify` failed) and Learning permission/crash issues. See [e2e-bugs-01.md](e2e-bugs-01.md).

| Metric | Count |
|--------|-------|
| Catalog cases | ~200 |
| Marked this run | ~170 |
| Pass | see column |
| Fail / Blocked / Limitation / Skip | see column + bugs file |

## AUTH — Authentication

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| AUTH-001 | Login page loads | Public | Open `/login` | Brand, email, password, Sign in, Forgot password link | Pass |
| AUTH-002 | Invalid credentials | Public | Submit wrong password | Error toast/message; stay on login | Pass |
| AUTH-003 | Empty form validation | Public | Submit empty | Client validation; no crash | Skip |
| AUTH-004 | Super Admin login redirect | SA | Login `admin@nexium.edu.pk` | Land `/dashboard`; MFA skipped if flags set | Pass |
| AUTH-005 | Branch Admin MAIN login | BA | Login `branchadmin@nexium.edu.pk` | `/dashboard`; MAIN-scoped data | Skip |
| AUTH-006 | Branch Admin LAHORE login | BA | Login `lahore.admin@nexium.edu.pk` | `/dashboard`; LAHORE-scoped data | Pass |
| AUTH-007 | Teacher login | T | Login `ahmed.teacher@nexium.edu.pk` | `/dashboard`; teacher sidebar | Pass |
| AUTH-008 | Accountant login | AC | Login `fees@nexium.edu.pk` | `/dashboard`; fees-focused nav | Pass |
| AUTH-009 | Receptionist login | R | Login `reception@nexium.edu.pk` | `/dashboard`; receptionist nav | Skip |
| AUTH-010 | Parent login → portal | P | Login `rashid.ahmad@nexium.edu.pk` | `/portal/parent` | Pass |
| AUTH-011 | Student login → portal | S | Login `ali.khan@nexium.edu.pk` | `/portal/student` | Pass |
| AUTH-012 | Staff cannot stay on portal home wrongly | SA | After SA login open `/portal` | Redirect to staff dashboard or role-appropriate path | Skip |
| AUTH-013 | Parent blocked from `/dashboard` | P | Login as parent; open `/dashboard` | Redirect to `/portal` (or parent portal) | Skip |
| AUTH-014 | Student blocked from `/dashboard` | S | Login as student; open `/dashboard` | Redirect to portal | Pass |
| AUTH-015 | Forgot password page | Public | Open `/forgot-password`; submit valid email format | Success/ack UI; Back to sign in works | Pass |
| AUTH-016 | Forgot password empty | Public | Submit empty email | Validation | Skip |
| AUTH-017 | Accept invite missing token | Public | Open `/accept-invite` | Error/empty state; no crash | Fail |
| AUTH-018 | Accept invite invalid token | Public | Open `/accept-invite?token=invalid` | Clear error | Skip |
| AUTH-019 | Sign out staff | SA | Sign out from dashboard | Session cleared; `/login` | Pass |
| AUTH-020 | Sign out parent | P | Sign out from portal | Lands on login promptly | Pass |
| AUTH-021 | Sign out student | S | Sign out from portal | Lands on login promptly | Skip |
| AUTH-022 | Unauthenticated deep link | Public | Open `/dashboard/students` logged out | Redirect `/login` | Skip |
| AUTH-023 | Portal disabled query (parent) | Public | Open `/login?error=parent_portal_disabled` | User-visible error message | Fail |
| AUTH-024 | Portal disabled query (student) | Public | Open `/login?error=student_portal_disabled` | User-visible error message | Fail |
| AUTH-025 | Session persists refresh | SA | Login; refresh `/dashboard` | Still authenticated | Pass |
| AUTH-026 | Login branding | Public | View `/login` | Institution name/logo consistent with settings | Pass |

---

## DASH — Staff dashboard home & profile

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| DASH-001 | Dashboard loads KPIs | SA | Open `/dashboard` | Stats/cards load; no blank error | Pass |
| DASH-002 | Dashboard real counts | SA | Compare student/fee/attendance widgets to seed | Plausible non-zero seeded data | Fail |
| DASH-003 | Dashboard console clean | SA | Check console on `/dashboard` | No unexpected errors | Pass |
| DASH-004 | Profile page | SA | Open `/dashboard/profile` | Name/email/role shown; editable fields behave | Skip |
| DASH-005 | Sidebar all modules (SA) | SA | Inspect sidebar | All SA modules visible per inventory | Fail |
| DASH-006 | Mobile sidebar | SA | 375px width; open nav | Usable menu; no overlap | Pass |

---

## STU — Students

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| STU-001 | Students list loads | SA | `/dashboard/students` | Table/list with seeded students | Pass |
| STU-002 | Student count ≥ 45 | SA | Note total/pagination | Matches seed threshold | Pass |
| STU-003 | Search by name | SA | Search `Ali Khan` | Finds featured student | Pass |
| STU-004 | Filter by status | SA | Filter active/inactive | Results update correctly | Skip |
| STU-005 | Filter by branch | SA | Filter MAIN / LAHORE | Branch-scoped results | Skip |
| STU-006 | Open student detail | SA | Click a student | `/dashboard/students/[id]` with profile data | Skip |
| STU-007 | Detail shows batch/program | SA | On Ali Khan detail | MDCAT Morning / MAIN consistent | Pass |
| STU-008 | Detail linked parents | SA | Parents section | Linked parent(s) visible | Pass |
| STU-009 | New student form | SA | `/dashboard/students/new` | Form fields load (incl. custom form fields) | Skip |
| STU-010 | New student validation | SA | Submit empty | Required field errors | Skip |
| STU-011 | Create E2E student | SA | Create `E2E-TEST-Student` with valid data | Success; appears in list | Skip |
| STU-012 | Edit student | SA | Edit E2E student minor field | Saves; reflects on detail | Skip |
| STU-013 | Teacher view-only students | T | Login teacher; students list | Can view; limited write | Pass |
| STU-014 | Accountant students view | AC | Open students | View allowed; admit may be hidden/denied | Pass |
| STU-015 | Receptionist admit access | R | Open new student | Can access admit flow per role | Skip |
| STU-016 | Pagination / load more | SA | Navigate pages | Stable data; no duplicates crash | Pass |
| STU-017 | Empty search | SA | Search nonsense | Empty state, not error | Skip |
| STU-018 | Network errors on list | SA | Check network for `/students` | 200; payload has data | Pass |
| STU-019 | Mobile students table | SA | 375px | Horizontal scroll or cards; usable | Skip |
| STU-020 | Cross-link to fees/attendance | SA | From detail navigate related | Links work or sections present | Skip |

---

## PAR-STAFF — Parents (staff)

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| PARS-001 | Parents list | SA | `/dashboard/parents` | List loads; ≥ 30 parents | Pass |
| PARS-002 | Search parent Rashid | SA | Search Rashid | Finds parent | Pass |
| PARS-003 | Parent detail / children | SA | Open Rashid | Ali + Zainab linked | Pass |
| PARS-004 | Create/link parent UI | SA | Open create/link actions | Forms work; validation | Skip |
| PARS-005 | Teacher parents view | T | Open parents | View allowed | Skip |

---

## ATT — Attendance

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| ATT-001 | Attendance page loads | SA | `/dashboard/attendance` | Batch/date selectors; grid or list | Pass |
| ATT-002 | Select batch + date | SA | Pick MDCAT Morning + weekday | Roster loads | Pass |
| ATT-003 | Seeded attendance present | SA | Browse past dates | Historical marks exist | Fail |
| ATT-004 | Mark present/absent | SA | Toggle statuses; save | Persists after reload | Skip |
| ATT-005 | Teacher can mark | T | Mark attendance | Allowed | Skip |
| ATT-006 | Accountant hidden/denied | AC | Open `/dashboard/attendance` | Hidden nav or denied | Pass |
| ATT-007 | Receptionist attendance | R | Open attendance | Can use per matrix | Skip |
| ATT-008 | Validation no batch | SA | Save without selection | Clear error | Skip |
| ATT-009 | Mobile attendance UI | SA | 375px | Usable marking UI | Skip |

---

## ASM — Assessments

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| ASM-001 | Assessments list | SA | `/dashboard/assessments` | ≥ 5 seeded assessments | Fail |
| ASM-002 | Open marks entry | SA | Open assessment marks | Roster + score inputs | Blocked |
| ASM-003 | Enter/save marks | SA | Edit a mark; save | Persists | Blocked |
| ASM-004 | Create assessment | SA/T | Create `E2E-TEST` assessment | Appears in list | Skip |
| ASM-005 | Teacher marks access | T | Open marks | Can enter marks | Skip |
| ASM-006 | Accountant no assessments | AC | Check sidebar | Assessments hidden | Pass |
| ASM-007 | Marks validation | SA | Enter out-of-range | Rejected with message | Skip |
| ASM-008 | Filter/search assessments | SA | Filter by type/batch | Correct subset | Skip |

---

## FEE — Fees

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| FEE-001 | Fees page loads | SA | `/dashboard/fees` | Invoices/structures UI | Pass |
| FEE-002 | Invoice count substantial | SA | List invoices | Dozens of invoices (seed ≥ 60) | Fail |
| FEE-003 | PKR currency display | SA | Inspect amounts | PKR / Rs formatting | Pass |
| FEE-004 | Filter paid/pending/overdue | SA | Apply status filters | Correct statuses | Blocked |
| FEE-005 | Record payment / update | AC | Pay or update an invoice carefully | Status updates | Blocked |
| FEE-006 | Accountant full fees | AC | Login fees user | Fees primary workflow works | Pass |
| FEE-007 | Teacher fees hidden | T | Check sidebar | Fees hidden | Pass |
| FEE-008 | Fee structures tab | SA | View structures | MDCAT/HSSC/SSC structures | Skip |
| FEE-009 | Sibling discount visible | SA | Settings or invoice notes | 10% sibling discount reflected somewhere | Fail |
| FEE-010 | Mobile fees | SA | 375px | Usable | Skip |

---

## TIME — Timetable

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| TIME-001 | Timetable loads | SA | `/dashboard/timetable` | Grid for batch | Pass |
| TIME-002 | MDCAT Morning grid | SA | Select MDCAT Morning Batch A | Weekly slots populated | Fail |
| TIME-003 | Teacher view | T | Open timetable | Can view | Skip |
| TIME-004 | Edit slot (if allowed) | SA | Edit/create slot | Saves or clear permission error | Skip |
| TIME-005 | Empty batch state | SA | Select batch without TT | Empty state not crash | Pass |

---

## ANL — Analytics

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| ANL-001 | Analytics loads | SA | `/dashboard/analytics` | Charts/stats render | Pass |
| ANL-002 | Data non-empty | SA | Inspect widgets | Seeded-backed numbers | Limitation |
| ANL-003 | Teacher view | T | Open analytics | View allowed | Skip |
| ANL-004 | Console/network clean | SA | Check tools | No failed chart APIs | Pass |

---

## RPT — Reports

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| RPT-001 | Reports page | SA | `/dashboard/reports` | Report types listed | Pass |
| RPT-002 | Generate/view report | SA | Run a report | Output or download works | Pass |
| RPT-003 | Accountant reports | AC | Open reports | View allowed | Pass |
| RPT-004 | Receptionist hidden | R | Check nav | Reports hidden | Skip |

---

## DOC — Documents

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| DOC-001 | Documents list | SA | `/dashboard/documents` | Seeded docs (policy, prospectus, etc.) | Fail |
| DOC-002 | Open/download | SA | Open a document | Signed URL or preview works | Blocked |
| DOC-003 | Upload E2E doc | SA | Upload small file named E2E-TEST | Appears in list | Skip |
| DOC-004 | Teacher view | T | Open documents | View | Skip |

---

## NTC — Notices

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| NTC-001 | Notices list | SA | `/dashboard/notices` | ≥ 5 notices | Fail |
| NTC-002 | Create notice | SA | Create `E2E-TEST-Notice` | Published/listed | Pass |
| NTC-003 | Edit notice | SA | Edit E2E notice | Saves | Skip |
| NTC-004 | Audience targeting | SA | Set audience if UI allows | Saves correctly | Pass |
| NTC-005 | Teacher view notices | T | Open notices | Can view | Skip |

---

## LV — Leave requests (staff)

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| LV-001 | Leave list loads | SA | `/dashboard/leave-requests` | Page loads | Pass |
| LV-002 | Approve/reject UI | SA | If pending exists, action | Status updates | Blocked |
| LV-003 | Empty state | SA | If none pending | Honest empty state | Pass |

---

## LRN — Learning (staff)

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| LRN-001 | Learning list | SA | `/dashboard/learning` | Seeded materials listed | Fail |
| LRN-002 | Create learning item | SA | `/dashboard/learning/new` create E2E | Created | Blocked |
| LRN-003 | Edit learning item | SA | Edit E2E item | Saves | Blocked |
| LRN-004 | Publish/unpublish | SA | Toggle publish | Reflects in portals later | Blocked |
| LRN-005 | Teacher learning | T | Open learning | Can manage/view | Fail |
| LRN-006 | Accountant hidden | AC | Check nav | Learning hidden | Pass |

---

## ACAD — Academic

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| ACAD-001 | Academic page | SA | `/dashboard/academic` | Programs/batches/subjects/sessions | Pass |
| ACAD-002 | Programs listed | SA | View programs | SSC, HSSC, MDCAT, ECAT | Fail |
| ACAD-003 | Batches ≥ 6 | SA | View batches | Includes MAIN + LAHORE batches | Pass |
| ACAD-004 | Subjects | SA | View subjects | Physics, Chem, Bio, Math, English | Pass |
| ACAD-005 | Session 2026 | SA | View sessions | 2026 present | Pass |
| ACAD-006 | Teacher academic hidden | T | Check nav | Hidden | Pass |
| ACAD-007 | Receptionist view | R | Open academic | View per matrix | Skip |

---

## BR — Branches

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| BR-001 | Branches list | SA | `/dashboard/branches` | MAIN + LAHORE | Pass |
| BR-002 | Branch detail | SA | Open MAIN | Details correct | Skip |
| BR-003 | New branch form | SA | `/dashboard/branches/new` | Form loads | Skip |
| BR-004 | BA cannot create (API) | BA | Try create as branchadmin | UI/API denies manage create | Skip |
| BR-005 | Teacher hidden | T | Check nav | Hidden | Pass |

---

## USR — Users

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| USR-001 | Users list | SA | `/dashboard/users` | Demo staff users present | Fail |
| USR-002 | User stats | SA | Stats widgets | Non-zero | Pass |
| USR-003 | Invite form | SA | `/dashboard/users/invite` | Form validation works | Skip |
| USR-004 | Invite E2E user | SA | Invite `e2e-test+…@` role teacher | Invitation created (email may not arrive) | Skip |
| USR-005 | Roles list | SA | Open role picker | 7 roles available | Skip |
| USR-006 | Teacher users hidden | T | Check nav | Hidden | Pass |
| USR-007 | BA users manage | BA | Open users | Can manage within scope | Skip |

---

## AUD — Audit

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| AUD-001 | Audit log loads | SA | `/dashboard/audit` | Entries listed | Skip |
| AUD-002 | Filter/search | SA | Apply filters | Results change | Skip |
| AUD-003 | Teacher hidden | T | Check nav | Hidden | Pass |

---

## AI — AI Insights & Attendance

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| AI-001 | AI Insights page | SA | `/dashboard/ai-insights` | Loads; may be empty stub | Limitation |
| AI-002 | AI Attendance page | SA | `/dashboard/ai-attendance` | Loads; may be empty stub | Limitation |
| AI-003 | Document stub limitation | SA | Note if no real AI | Record Limitation not Fail if intentional | Limitation |
| AI-004 | Teacher AI attendance | T | Open AI attendance | Accessible | Skip |

---

## COM — Communications

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| COM-001 | Communications page | SA | `/dashboard/communications` | Log/list of SMS/WhatsApp | Skip |
| COM-002 | Seeded comms entries | SA | Browse | ~5 demo entries | Skip |
| COM-003 | Send UI | SA | Open compose if present | Validation; send or clear error | Skip |
| COM-004 | Accountant access | AC | Open communications | Allowed | Pass |
| COM-005 | Teacher hidden | T | Check nav | Hidden | Pass |

---

## SET — Settings & form fields

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| SET-001 | Settings page | SA | `/dashboard/settings` | Institution settings load | Pass |
| SET-002 | Branding fields | SA | View name/colors/logo | Nexium Academy values | Pass |
| SET-003 | Feature flags visible | SA | parentPortal/studentPortal | Toggles present | Pass |
| SET-004 | Fee settings | SA | Sibling discount / late fee | 10% / Rs 500 after 7 days | Fail |
| SET-005 | Save settings | SA | Minor safe edit or cancel | No crash; save works if changed | Skip |
| SET-006 | Form fields page | SA | `/dashboard/form-fields` | Custom fields listed | Skip |
| SET-007 | Form field CRUD | SA | Create E2E field or edit | Persists | Skip |
| SET-008 | Teacher settings hidden | T | Check nav | Hidden | Pass |

---

## ROLE — Role matrix & branch scope

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| ROLE-001 | Teacher sidebar subset | T | Compare to SA | Fees/Users/Settings/etc hidden | Pass |
| ROLE-002 | Accountant sidebar | AC | Inspect | Fees/Comms/Reports; no assessments | Pass |
| ROLE-003 | Receptionist sidebar | R | Inspect | Students/Attendance/AI Att; limited | Skip |
| ROLE-004 | BA MAIN data scope | BA | Students/fees as branchadmin | MAIN campus data | Skip |
| ROLE-005 | BA LAHORE data scope | BA | Login lahore.admin; students | LAHORE data; not full MAIN set | Fail |
| ROLE-006 | Unauthorized mutation | T | Attempt forbidden write if UI shows | API 403; UI handles gracefully | Fail |
| ROLE-007 | Deep link forbidden page | T | Open `/dashboard/settings` | Denied/redirect/empty | Skip |

---

## PP — Parent portal

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| PP-001 | Parent dashboard | P | `/portal/parent` | Children cards; stats | Pass |
| PP-002 | Children list | P | `/portal/parent/children` | Ali + Zainab | Pass |
| PP-003 | Child detail | P | Open Ali | Correct profile/batch | Skip |
| PP-004 | Attendance | P | `/portal/parent/attendance` | Real attendance data | Skip |
| PP-005 | Assessments | P | `/portal/parent/assessments` | Marks visible | Skip |
| PP-006 | Fees | P | `/portal/parent/fees` | Invoices PKR; statuses | Skip |
| PP-007 | Timetable | P | `/portal/parent/timetable` | Schedule for child batch | Skip |
| PP-008 | Notices | P | `/portal/parent/notices` | Notices listed | Skip |
| PP-009 | Learning list | P | `/portal/parent/learning` | Materials for children | Fail |
| PP-010 | Learning detail | P | Open an item | Content/files load | Blocked |
| PP-011 | Documents | P | `/portal/parent/documents` | Docs accessible | Skip |
| PP-012 | Calendar | P | `/portal/parent/calendar` | Events/dates render | Skip |
| PP-013 | Leave list | P | `/portal/parent/leave` | Page loads | Pass |
| PP-014 | Submit leave | P | Create leave for child | Success; appears staff side later | Fail |
| PP-015 | Profile | P | `/portal/parent/profile` | Parent info; edit if allowed | Skip |
| PP-016 | Mobile bottom nav | P | 375px | Bottom nav works | Skip |
| PP-017 | Console clean | P | Spot-check pages | No critical console errors | Fail |
| PP-018 | Cross-check staff notice | P | After NTC-002 | E2E notice visible if audience includes parents | Blocked |

---

## SP — Student portal

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| SP-001 | Student dashboard | S | `/portal/student` | Personal stats for Ali | Pass |
| SP-002 | Attendance | S | `/portal/student/attendance` | Own attendance | Skip |
| SP-003 | Assessments | S | `/portal/student/assessments` | Own marks | Skip |
| SP-004 | Fees | S | `/portal/student/fees` | Own invoices | Skip |
| SP-005 | Timetable | S | `/portal/student/timetable` | Own batch grid | Skip |
| SP-006 | Notices | S | `/portal/student/notices` | Notices | Skip |
| SP-007 | Learning list | S | `/portal/student/learning` | Materials + due soon | Fail |
| SP-008 | Learning detail | S | Open item | Detail works | Blocked |
| SP-009 | Documents | S | `/portal/student/documents` | Docs | Skip |
| SP-010 | Calendar | S | `/portal/student/calendar` | Calendar | Skip |
| SP-011 | Insights | S | `/portal/student/insights` | Page loads (may be limited) | Skip |
| SP-012 | Profile | S | `/portal/student/profile` | Profile; edit allowed fields | Skip |
| SP-013 | Mobile nav | S | 375px | Usable | Pass |
| SP-014 | No other students’ data | S | Inspect lists | Only Ali’s data | Pass |
| SP-015 | Console/network | S | Check tools | Healthy APIs | Skip |

---

## XMOD — Cross-module & consistency

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| XMOD-001 | Parent leave → staff list | P/SA | Submit leave; check staff leave | Request visible | Fail |
| XMOD-002 | Staff notice → portals | SA/P/S | Publish notice; check portals | Visible when targeted | Blocked |
| XMOD-003 | Learning publish → portals | SA/S | Publish learning; student sees | Consistent | Blocked |
| XMOD-004 | Fee update → parent fees | AC/P | Update invoice; parent view | Status matches | Blocked |
| XMOD-005 | Attendance → parent/student | T/P/S | Mark day; portals reflect | Same status | Blocked |
| XMOD-006 | Branding consistency | All | Login, dashboard, portals | Same institution branding | Pass |
| XMOD-007 | Timezone/date display | SA | Dates on attendance/fees | Asia/Karachi sensible | Pass |

---

## UI — UI consistency, responsiveness, tech

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| UI-001 | Login mobile | Public | 375px `/login` | No overflow; usable | Skip |
| UI-002 | Dashboard mobile | SA | 375px | Layout OK | Pass |
| UI-003 | Portal mobile | P | 375px key pages | OK | Pass |
| UI-004 | Loading states | SA | Slow network observe | Skeletons/spinners not blank forever | Skip |
| UI-005 | Error states | SA | Note failed API handling | User-friendly errors | Skip |
| UI-006 | Button consistency | SA | Spot-check modules | Primary actions consistent | Fail |
| UI-007 | No horizontal page scroll desktop | SA | 1280px key pages | No unintended overflow | Pass |
| UI-008 | Broken images/icons | SA | Visual pass | Icons render | Pass |
| UI-009 | Unresponsive click targets | SA | Click primary CTAs | Immediate feedback | Pass |
| UI-010 | Accessibility basics | SA | Snapshot labels | Forms have labels | Fail |

---

## TECH — Technical / network / console

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| TECH-001 | Health API | — | GET `/api/v1/health` | 200 | Pass |
| TECH-002 | Auth me after login | SA | Network `auth/me` | 200 with roles | Pass |
| TECH-003 | No systematic 500s | SA | Sweep modules | No repeated 500 | Fail |
| TECH-004 | No systematic CORS failures | SA | Console/network | Clean | Pass |
| TECH-005 | Portal APIs 200 | P/S | Portal pages | `/api/v1/portal/*` OK | Pass |
| TECH-006 | Slow pages noted | All | Note >5s loads | Document if chronic | Skip |

---

## New cases

_Append future cases below this heading. Do not create a second catalog file._

| ID | Title | Role | Steps | Expected | Run 01 |
|----|-------|------|-------|----------|--------|
| | | | | | |
