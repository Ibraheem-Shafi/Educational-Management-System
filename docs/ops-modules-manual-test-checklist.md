# Ops modules & catalog reports — Manual Test Checklist

Use this to click through the **four new modules** and the **27 catalog reports** that used to be coming soon.

**Status:** `Pass` · `Fail` · `Blocked` · `Skip` · _(blank = not run)_

**Suggested login:** `admin@nexium.edu.pk` / `Nexium@2026!` (Super Admin)  
**Also try:** `branchadmin@nexium.edu.pk` (Islamabad only) and `fees@nexium.edu.pk` (finance ops, no academic/HR manage)

**App:** http://localhost:3000  
**Pick one campus first** (e.g. Islamabad Main Campus). These pages need a single branch; “All branches” should ask you to select one.

Demo seed may already have rows whose title/name contains **`SAMPLE-CSV-CHECK`**. You can use those, or create your own with a unique word (e.g. `QA-TEST`) and search the CSV for it.

---

## What was added (not 27 sidebar apps)

| Sidebar | URL | What you can record |
|---------|-----|---------------------|
| Academic operations | `/dashboard/academic-ops` | Syllabus, lesson plans, observations, events, discipline, improvement/challenges, training |
| Finance operations | `/dashboard/finance-ops` | Petty cash, vendors, bills, bank rec, POs, assets, forecast |
| HR operations | `/dashboard/hr` | Applicants, training, contract list |
| Campus operations | `/dashboard/campus-ops` | Work orders, safety, IT outages, compliance |

---

## 0. Hub smoke

| # | Area | Feature | Steps | Expected | Status | Remarks |
|---|------|---------|-------|----------|--------|---------|
| 0.1 | Nav | Four new links | Sidebar: Academics, Finance, People, Administration | Academic operations, Finance operations, HR operations, Campus operations are present | | |
| 0.2 | Reports hub | No coming soon | Open `/dashboard/reports` | Academic 20/20 ready, Finance 20/20 ready, Admin 10/10 ready, **0 coming soon** | | |
| 0.3 | Branch | Single campus | Super Admin: switch app branch to Islamabad, then Lahore, then back | Pages do not crash (previously academic-ops crashed on campus change) | | |

---

## 1. Academic operations — `/dashboard/academic-ops`

On each tab: list loads, **Add** opens without spinning forever, save works, row appears, search finds it, edit (where shown) works.

| # | Tab | Create | Expected in table | Status | Remarks |
|---|-----|--------|-------------------|--------|---------|
| 1.1 | Syllabus | Add unit: title, subject, planned 10, completed 4 | Coverage **40%**, status in progress | | |
| 1.2 | Lesson plans | Add: date, title, teacher, subject, batch, status taught | Row with teacher / subject / batch | | |
| 1.3 | Observations | Add: date, teacher, score, summary | Summary visible | | |
| 1.4 | School life | Add event kind **co_curricular** | Kind badge + title | | |
| 1.5 | School life | Add event kind **ptm** | Second row, kind ptm | | |
| 1.6 | Discipline | Add: student, type, action, notes with your marker | Student / type / action. **Notes are not a table column** — they show in edit and in the CSV | | |
| 1.7 | Academic actions | Add kind **improvement_plan** | Title + kind | | |
| 1.8 | Academic actions | Add kind **challenge** | Title + kind | | |
| 1.9 | Training | Add: staff, title, date, hours | Same row also appears under HR → Training | | |

| # | Area | Feature | Steps | Expected | Status | Remarks |
|---|------|---------|-------|----------|--------|---------|
| 1.10 | Dialog | No infinite loop | Open Add on any tab, close, open again | Dialog opens once; no “Maximum update depth” / frozen page | | |
| 1.11 | Scope | Other campus | Switch to Lahore | Islamabad rows disappear; no crash | | |

---

## 2. Finance operations — `/dashboard/finance-ops`

Create via the UI (not only looking at sample rows). Money posts should show in Accounting after petty cash / bill payment.

| # | Tab | Create / action | Expected | Status | Remarks |
|---|-----|-----------------|----------|--------|---------|
| 2.1 | Petty cash | Add fund (name + opening balance) | Fund row | | |
| 2.2 | Petty cash | Add voucher against that fund | Disbursement row; Accounting has a matching payment | | |
| 2.3 | Vendors | Add vendor | Name in list | | |
| 2.4 | Bills / AP | Add bill category **utility** | Row remaining = amount, status open | | |
| 2.5 | Bills / AP | Add bill category **maintenance** | Separate row | | |
| 2.6 | Bills / AP | Add bill category **general** | Separate row | | |
| 2.7 | Bills / AP | Record payment (partial) on one open bill | Remaining drops; status partial or paid | | |
| 2.8 | Bank rec | Add statement (from/to dates) | Statement row, 0 lines | | |
| 2.9 | Bank rec | Add line on that statement | Line count becomes 1. Line **description is not a table column** | | |
| 2.10 | Procurement | Add PO with item/qty/unit cost | PO no, vendor, total = qty × cost | | |
| 2.11 | Procurement | Receive (if shown) | Status received | | |
| 2.12 | Assets | Add asset name/category/cost | Row in list | | |
| 2.13 | Forecast | Add forecast month (budget, month 1–12, amount) | Row; unique per budget+month (updating same month overwrites) | | |

---

## 3. HR operations — `/dashboard/hr`

| # | Tab | Steps | Expected | Status | Remarks |
|---|-----|-------|----------|--------|---------|
| 3.1 | Recruitment | Add applicant: name, role, date, stage | Row in list | | |
| 3.2 | Training | Confirm academic training row, or add another | Staff + title + hours | | |
| 3.3 | Turnover | Open tab | Existing contracts list (start/end/status). **No Add** — this is join/leave history, not a new hire form | | |

---

## 4. Campus operations — `/dashboard/campus-ops` (Administration)

| # | Tab | Steps | Expected | Status | Remarks |
|---|-----|-------|----------|--------|---------|
| 4.1 | Infrastructure | Add work order: location, issue, cost | Row open | | |
| 4.2 | Safety | Add incident: severity, summary, action | Row in list | | |
| 4.3 | IT & ERP | Check Live checks | Device / last punch text (may be empty). Add an outage | Outage row; open outage listed in Live checks if unresolved | | |
| 4.4 | Compliance | Add control: title, category | Row in register | | |

---

## 5. Catalog Generate — the 27 former coming-soon reports

For each row: **Generate** is enabled, a CSV downloads, no error toast. If you created a `QA-TEST` (or `SAMPLE-CSV-CHECK`) row, that text should appear in the CSV unless the notes say otherwise.

**Academic** — `/dashboard/reports/academic`

| # | Report | CSV file | Must contain your new row? | Status | Remarks |
|---|--------|----------|----------------------------|--------|---------|
| 5.1 | Syllabus Coverage Report | `syllabus-coverage.csv` | Yes (unit title) | | |
| 5.2 | Curriculum Implementation Report | `curriculum-implementation.csv` | Yes (same syllabus units) | | |
| 5.3 | Lesson Plan Compliance Report | `lesson-plan-compliance.csv` | Yes | | |
| 5.4 | Classroom Observation Report | `classroom-observation.csv` | Yes (summary) | | |
| 5.5 | Teacher Training & PD Report | `teacher-training-pd.csv` | Yes | | |
| 5.6 | Co-curricular Report | `co-curricular.csv` | Yes (co_curricular events only) | | |
| 5.7 | PTM Report | `ptm.csv` | Yes (ptm events only) | | |
| 5.8 | Discipline & Behaviour Report | `discipline-behaviour.csv` | Yes (**including notes**) | | |
| 5.9 | Academic Improvement Plan Report | `academic-improvement-plan.csv` | Yes (improvement_plan only) | | |
| 5.10 | Academic Challenges & Action Taken Report | `academic-challenges.csv` | Yes (challenge only) | | |

**Finance** — `/dashboard/reports/finance`

| # | Report | CSV file | Must contain your new row? | Status | Remarks |
|---|--------|----------|----------------------------|--------|---------|
| 5.11 | Petty Cash Report | `petty-cash.csv` | Yes (vouchers) | | |
| 5.12 | Accounts Payable Report | `accounts-payable.csv` | Yes (all categories) | | |
| 5.13 | Utility Bills Report | `utility-bills.csv` | Yes (utility only) | | |
| 5.14 | Maintenance & Repair Expense Report | `maintenance-repair-expense.csv` | Yes (maintenance only) | | |
| 5.15 | Bank Reconciliation Report | `bank-reconciliation.csv` | Statement row (from/to, line count). **Line description is not in this CSV** | | |
| 5.16 | Procurement Report | `procurement.csv` | Yes (PO no / vendor) | | |
| 5.17 | Inventory & Fixed Assets Report | `inventory-fixed-assets.csv` | Yes | | |
| 5.18 | Financial Forecast Report | `financial-forecast.csv` | Yes (amount / month) | | |
| 5.19 | Cash Flow Report | `cash-flow.csv` | Totals for last month from the **ledger**. Your new bill appears here only if it posted as a payment in that month | | |
| 5.20 | Campus Profitability Report | `campus-profitability.csv` | Same: campus income / expense / net from the ledger | | |
| 5.21 | Financial Risk Report | `financial-risk.csv` | Metrics (AR, AP, cash). Top vendor may be your new vendor if it has the largest unpaid AP | | |

**Admin** — `/dashboard/reports/administration`

| # | Report | CSV file | Must contain your new row? | Status | Remarks |
|---|--------|----------|----------------------------|--------|---------|
| 5.22 | Staff Recruitment Report | `staff-recruitment.csv` | Yes | | |
| 5.23 | Staff Turnover Report | `staff-turnover.csv` | Contract rows (existing staff). Not a SAMPLE applicant | | |
| 5.24 | Infrastructure & Maintenance Report | `infrastructure-maintenance.csv` | Yes (issue text) | | |
| 5.25 | Safety & Security Report | `safety-security.csv` | Yes | | |
| 5.26 | IT & ERP Status Report | `it-erp-status.csv` | Devices + last punch + **Outage** line with your summary. Retry if you see a database timeout | | |
| 5.27 | Compliance Report | `compliance-register.csv` | Yes | | |

Open existing (optional): each of these catalog rows should have **Open existing** pointing at the matching module above.

---

## 6. Extra checks (worth doing once)

| # | Area | Feature | Steps | Expected | Status | Remarks |
|---|------|---------|-------|----------|--------|---------|
| 6.1 | Permissions | Accountant | Log in as `fees@nexium.edu.pk` | Finance ops + finance reports work. Academic ops / HR / campus-ops hidden or read-denied | | |
| 6.2 | Permissions | Teacher | `ahmed.teacher@nexium.edu.pk` | Cannot manage ops records they have no permission for | | |
| 6.3 | Catalog | Teacher Performance Evaluation | Academic reports #12 | **Ready** but **no Generate** (opens Users). Not one of the 27 | | |
| 6.4 | Empty | All branches | Super Admin: set scope to All, open an ops page | Prompt to select a single branch; no crash | | |
| 6.5 | Search | Filter | Type part of your title in Search on a populated tab | Only matching rows | | |

---

## Known gotchas

- **One campus at a time** on the four ops pages.
- **Custom dropdowns** (subject, batch, vendor, staff): click the control, then the option. Keyboard-only may not select.
- **Discipline notes** and **bank line descriptions** are on the record, but not in the main table columns.
- **Cash flow / profitability** ignore bills that were never posted through Accounting.
- **IT & ERP Generate** can fail with `Can't reach database server` if the pooler blips; retry once.
- Seeded `SAMPLE-CSV-CHECK` rows are demo data. Delete or leave them; they do not replace creating a row yourself.
