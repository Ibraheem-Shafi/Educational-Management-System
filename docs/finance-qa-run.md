# Finance Module QA Run

**Date:** 2026-08-05  
**Environment:** `http://localhost:3000` · demo seed · MFA skipped  
**Password (all):** `Nexium@2026!`  
**Out of scope:** Print voucher / receipt / slip pages  

**Status legend:** `Pass` · `Fail` · `Blocked` · `Skip`

## Summary

| Metric | Count |
|--------|------:|
| Pass | 47 |
| Fail | 4 |
| Blocked | 2 |
| Skip | 1 |
| Pending | 0 |

### Top bugs

1. **Create invoice — student picker empty** (`fees@nexium.edu.pk`, `/dashboard/fees`): New invoice dialog Student dropdown only shows “Select student”; no student options. Cannot create invoice.
2. **Fees stats stale after payment (accountant)**: After partial Rs 5,000 + pay-in-full, Outstanding stayed `Rs 1,413,000` and Collected (30d) stayed `Rs 0` on Fees page while Branch Admin later showed Collected `Rs 18,500` and Reports reflected payments.
3. **Branch label shows raw ID for accountants**: Header/branch chip shows `cmr21ku…` instead of campus name (Branch Admin / Super Admin show proper names).
4. **Account statement empty for Cash** despite receipt vouchers in the selected period.
5. **Post draft voucher no-op**: Post on `JV-MAIN-DEMO-002` left status Draft with no error toast.
6. **Parent portal home**: `/portal/parent` shows “Unable to load portal.” Fees subpage works.
7. **Pay online (parent/student)**: Button present; click produced no navigation, dialog, or toast (gateway/config likely missing) → Blocked.

---

## 1. Accountant MAIN — `fees@nexium.edu.pk`

| ID | Area | Feature | Steps | Expected | Status | Remarks / Bug |
|----|------|---------|-------|----------|--------|---------------|
| A-AUTH-01 | Auth | Login | Sign in → land on dashboard | Dashboard loads | Pass | Welcome back, Sadia Bano |
| A-AUTH-02 | Sidebar | Finance menus visible | Inspect sidebar | Fees, Accounting, Payroll, Reports, Communications, Leave present | Pass | Finance + Insights/Reports + Communication + Leave |
| A-AUTH-03 | Sidebar | Non-finance hidden | Inspect sidebar | No Students, Attendance, Assessments, Academic, Users, Settings | Pass | Academics only Leave requests |
| A-FEE-01 | Fees | Page load | Open `/dashboard/fees` | Page loads with header | Pass | |
| A-FEE-02 | Fees | Stats cards | View stats section | Outstanding / collected / overdue / issued show values | Fail | Cards render but Outstanding/Collected did not update after payments |
| A-FEE-03 | Fees | Revenue trend | View chart | Trend chart renders | Pass | |
| A-FEE-04 | Fees | Invoices tab | Open Fees tab | Invoice table with data | Pass | 90 invoices |
| A-FEE-05 | Fees | Defaulters tab | Open Fee Defaulter tab | Defaulter list loads | Pass | e.g. Muhammad Ali Khan |
| A-FEE-06 | Fees | Fee types / structures | Via invoice list / New invoice | Can view fee types | Pass | Monthly Fee on rows; no dedicated types CRUD UI |
| A-FEE-07 | Fees | Create invoice | New invoice → pick student → create | Invoice appears | Fail | Student dropdown empty |
| A-FEE-08 | Fees | Record payment | Record payment → submit | Payment succeeds | Pass | Nimra Ashraf Rs 5,000 → Partial; print tab opened (skipped) |
| A-FEE-09 | Fees | Pay in full | Pay in full on unpaid | Status paid | Pass | Nimra Jul → Paid |
| A-FEE-10 | Fees | Pagination | Page controls | List updates | Pass | Page 1 of 12 |
| A-ACC-01 | Accounting | Page load | Open accounting | Loads | Pass | |
| A-ACC-02 | Accounting | Chart of accounts | Accounts tab | List of accounts | Pass | |
| A-ACC-03 | Accounting | Create/edit account | Add account | Account saved | Pass | Created `5200-QA`; list refresh lag |
| A-ACC-04 | Accounting | Vouchers list | Vouchers tab | List loads | Pass | Incl. RCP-2026-0001/0002 |
| A-ACC-05 | Accounting | Create draft voucher | Balanced lines → create | Draft created | Pass | Toast “Voucher created” |
| A-ACC-06 | Accounting | Post voucher | Post a draft | Status posted | Fail | JV-MAIN-DEMO-002 stayed Draft |
| A-ACC-07 | Accounting | Unpost voucher | Unpost if allowed | Back to draft | Skip | No Unpost on posted receipts |
| A-ACC-08 | Accounting | Trial balance | Reports tab | Report renders | Pass | |
| A-ACC-09 | Accounting | Income / expense | Reports tab | Report renders | Pass | Net PKR 23,500 |
| A-ACC-10 | Accounting | Account statement | Reports tab | Statement renders | Fail | Cash → “No data for selected filters” |
| A-ACC-11 | Accounting | Budgets | Budgets tab | List present | Pass | 2026 Operating Budget [MAIN] |
| A-PAY-01 | Payroll | Page load | Open payroll | Loads | Pass | |
| A-PAY-02 | Payroll | Structures | Structures tab | List | Pass | 2 structures |
| A-PAY-03 | Payroll | Runs list | Runs tab | List loads | Pass | July 2026 Draft |
| A-PAY-04 | Payroll | Create / generate run | Generate | Lines created | Pass | 2 staff already generated |
| A-PAY-05 | Payroll | Submit / approve / finalize | Submit | Status progresses | Pass | → Pending Approval |
| A-PAY-06 | Payroll | History / export | History tab | Data available | Pass | June 2026 Finalized |
| A-REP-01 | Reports | Reports page | `/dashboard/reports` | Overview / defaulters | Pass | |
| A-COM-01 | Communications | Smoke | `/dashboard/communications` | Page loads | Pass | |
| A-NEG-01 | RBAC | No Students | `/dashboard/students` | Denied | Pass | Access denied |
| A-NEG-02 | RBAC | No Settings | `/dashboard/settings` | Denied | Pass | Access denied |

---

## 2. Accountant LAHORE — `lahore.fees@nexium.edu.pk`

| ID | Area | Feature | Steps | Expected | Status | Remarks / Bug |
|----|------|---------|-------|----------|--------|---------------|
| L-AUTH-01 | Auth | Login | Sign in | Dashboard loads | Pass | Imran Qureshi |
| L-FEE-01 | Fees | Branch isolation | Compare vs MAIN | LAHORE-only; no MAIN leakage | Pass | Saqlain Rizwan / Nida Khan; no Nimra / Ali Khan; Outstanding Rs 617,000 |
| L-ACC-01 | Accounting | Branch books | Open accounting | LAHORE books | Pass | `5100-LHR` LAHORE Utilities (not MAIN) |
| L-PAY-01 | Payroll | Branch payroll | Open payroll | LAHORE scoped | Pass | Farah Siddiqui / Imran Qureshi only |

---

## 3. Branch Admin MAIN — `branchadmin@nexium.edu.pk`

| ID | Area | Feature | Steps | Expected | Status | Remarks / Bug |
|----|------|---------|-------|----------|--------|---------------|
| B-AUTH-01 | Auth | Login | Sign in | Dashboard | Pass | Aisha Malik; branch “Islamabad Main Campus” |
| B-FEE-01 | Fees | Access | Open Fees | Page works | Pass | Collected (30d) Rs 18,500 (updated) |
| B-ACC-01 | Accounting | Access | Open Accounting | Page works | Pass | Shows 5200-QA (5 accounts) |
| B-PAY-01 | Payroll | Access | Open Payroll | Page works | Pass | MAIN structures |

---

## 4. Super Admin — `admin@nexium.edu.pk`

| ID | Area | Feature | Steps | Expected | Status | Remarks / Bug |
|----|------|---------|-------|----------|--------|---------------|
| S-AUTH-01 | Auth | Login | Sign in | Dashboard | Pass | Syed Kamran Shah; All branches |
| S-FEE-01 | Fees | All / multi branch | Fees with All scope | Consolidated stats/list | Pass | Outstanding Rs 2,011,500; 129 invoices; LAHORE+MAIN names |
| S-ACC-01 | Accounting | Single-branch pick | Accounting with All | Prompt to pick one branch | Pass | “Select a single branch… to manage accounting records.” |
| S-PAY-01 | Payroll | Single-branch pick | Payroll with All | Prompt | Pass | “Select a single branch… to manage payroll.” |

---

## 5. Teacher negative — `ahmed.teacher@nexium.edu.pk`

| ID | Area | Feature | Steps | Expected | Status | Remarks / Bug |
|----|------|---------|-------|----------|--------|---------------|
| T-NEG-01 | Sidebar | No finance menus | Inspect sidebar | No Fees / Accounting / Payroll | Pass | No Finance section |
| T-NEG-02 | URL | Fees denied | `/dashboard/fees` | Denied | Pass | Access denied |
| T-NEG-03 | URL | Accounting denied | `/dashboard/accounting` | Denied | Pass | Access denied |
| T-NEG-04 | URL | Payroll denied | `/dashboard/payroll` | Denied | Pass | Access denied |

---

## 6. Parent portal — `rashid.ahmad@nexium.edu.pk`

| ID | Area | Feature | Steps | Expected | Status | Remarks / Bug |
|----|------|---------|-------|----------|--------|---------------|
| P-FEE-01 | Portal | Fees page | Open parent fees | Linked children invoices | Pass | `/portal/parent/fees` — Muhammad Ali Khan; Outstanding Rs 76,000; 3 invoices. Home `/portal/parent` Failed to load. |
| P-FEE-02 | Portal | Checkout | Pay online | Checkout or Blocked | Blocked | Pay online visible; click no-op (no redirect/toast) |

---

## 7. Student portal — `ali.khan@nexium.edu.pk`

| ID | Area | Feature | Steps | Expected | Status | Remarks / Bug |
|----|------|---------|-------|----------|--------|---------------|
| ST-FEE-01 | Portal | Fees page | Open student fees | Own invoices only | Pass | Outstanding Rs 76,000; 3 Monthly Fee invoices (own) |
| ST-FEE-02 | Portal | Checkout | Pay online | Checkout or Blocked | Blocked | Same as parent — button present, no checkout path exercised |

---

## Session log

- Checklist created; accountant MAIN deep pass (Fees mutations, Accounting, Payroll, Reports, Communications, RBAC denials).
- LAHORE accountant: fees/accounting/payroll isolation confirmed vs MAIN.
- Branch Admin MAIN: finance smoke Pass; branch names display correctly.
- Super Admin: All-branch fees consolidated; Accounting/Payroll require single branch.
- Teacher: finance menus hidden; direct URLs Access denied.
- Parent: fees page Pass; home portal Fail; Pay online Blocked.
- Student: fees page Pass; Pay online Blocked.
- Print flows not tested (opened receipt tab after payment was closed without review).
