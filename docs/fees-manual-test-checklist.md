# Fees — Manual Test Checklist

**Page:** `/dashboard/fees`  
**Suggested login:** `fees@nexium.edu.pk` / `Nexium@2026!` (MAIN accountant)  
**Also try:** `lahore.fees@nexium.edu.pk` for branch isolation  

**Status:** `Pass` · `Fail` · `Blocked` · `Skip` · _(blank = not run)_

---

## Checklist

| # | Area | Feature | Steps | Expected | Status | Remarks |
|---|------|---------|-------|----------|--------|---------|
| 1 | Fees | Page load + stats cards | Open `/dashboard/fees` | Outstanding / Collected (30d) / Overdue invoices / Invoices issued show values | | |
| 2 | Fees | Revenue trend chart | View “Revenue trend” | Chart renders for last 6 months | | |
| 3 | Fees | Tabs — Fees invoices list | Open **Fees** tab | Invoice table loads (student, fee type, amount, due, status) | | |
| 4 | Fees | Tabs — Fee Defaulter list | Open **Fee Defaulter** tab | Overdue / unpaid list loads | | |
| 5 | Fees | Fee types / fee structures UI | Search Settings / Fees for manage types or structures | Dedicated create/edit UI if present; otherwise note “API only / not exposed” | | |
| 6 | Fees | Create invoice (single) | **New invoice** → student / fee type / amount → create | Invoice appears in list | | |
| 6a | Fees | Generate invoices (bulk) | **Generate invoices** → batch + fee type | Student list loads with default amounts | | |
| 6b | Fees | Generate — edit amounts | Change one student’s amount up/down | Row amount updates; total reflects change | | |
| 6c | Fees | Generate — skip student | Uncheck one student → Generate | Only selected students get invoices | | |
| 6d | Fees | Generate — apply default | Change default amount → **Apply to all** → Generate | All selected invoices use that amount (before sibling discount) | | |
| 7 | Fees | Record payment (partial) | Row → **Record payment** → amount less than remaining → method → save | Status becomes Partial; amount cannot exceed remaining | | |
| 8 | Fees | Pay in full | Row → **Pay in full** | Dialog opens with method; amount locked to remaining; invoice becomes Paid | | |
| 9 | Fees | Invoice list pagination | Change page / page size | List updates without errors | | |
| 10 | Fees | Invoice filters (if present) | Apply any status / search filters | Results match filter | | |
| 11 | Fees | Defaulters list | Confirm amounts / students | Remaining amounts look correct; actions work | | |
| 12 | Fees | Branch scope | Switch branch (or use LAHORE accountant) | Only that campus’s invoices/stats; no cross-branch leakage | | |
| 13 | Fees | Print invoice (optional) | Print voucher from row | Print page opens with fee type / amounts | | |
| 14 | Fees | Print receipt (optional) | After payment → print receipt | Receipt opens with correct amount / method | | |
| 15 | Accounting | Fee payment → voucher fee type | After a fee payment → Accounting → Vouchers | Receipt voucher shows correct **Fee type** | | |

---

## How invoice creation works today (clarification)

There are **two different ideas** that are easy to mix up:

### A) One invoice for one student (what the UI does now)

**New invoice** on the Fees page = pick **one student**, one fee type, one amount, create **one** invoice.

That is correct for:

- Admission / registration / one-off fees  
- Corrections / special cases  
- A single student who joined mid-month  

You do **not** want to do this for every student every month by hand.

### B) Bulk / monthly invoices (what you are describing)

What you want sounds like:

> “Generate this month’s **Monthly Fee** for everyone in batch X / program MDCAT / whole campus.”

That is a **bulk generate** flow, not “open New invoice 200 times.”

**Already in the backend (no UI yet):**

- `POST /fee-structures/generate-invoices`  
- Needs: branch + **batch** (+ optional fee structure IDs + due date)  
- Creates invoices for **all students in that batch** from matching **fee structures**

**Fee structure** (data model) is the template, e.g.:

| Fee type | Scope | Amount |
|----------|--------|--------|
| Monthly Fee | Batch: MDCAT Morning A | Rs 8,000 |
| Monthly Fee | Program: MDCAT (all batches) | Rs 8,000 |
| Admission Fee | Branch MAIN | Rs 5,000 |

So the intended product flow is:

1. Define **fee types** (Monthly, Admission, Test, …) — once  
2. Define **fee structures** (who pays what: branch / program / batch + amount) — once / rarely  
3. Each billing cycle: **Generate invoices** for a batch (or structures) → many invoices at once  
4. Collect via **Record payment** / **Pay in full**

### What is missing in the product UI

| Capability | API | Web UI |
|------------|-----|--------|
| Create single invoice | Yes | Yes (`New invoice`) |
| Manage fee types | Yes | No dedicated screen |
| Manage fee structures | Yes | No dedicated screen |
| Bulk generate invoices for a batch | Yes | Yes (`Generate invoices`) |

So today, for a real monthly run, use **Generate invoices** on the Fees page (batch + fee type + per-student amounts). Keep **New invoice** for one-offs. Fee type/structure CRUD screens are still API-only.

---

## Suggested product direction (for later — not part of this checklist)

If we build the monthly / batch billing feature, a sensible UX is:

1. **Fees → Generate invoices** (or “Billing run”)  
2. Choose: Branch → Batch (or Program → all batches) → Fee type / structures → Due date / billing month  
3. Preview: “Will create N invoices for M students”  
4. Confirm → bulk create  

Keep **New invoice** for one-off cases.

---

## Notes while testing recent payment fixes

- **Pay in full** must open the payment dialog (method required), not silently mark paid.  
- **Record payment** amount must not exceed remaining; paying exact remaining should result in **Paid**, not stuck on Partial.  
- Partially paid invoices should default/cap to **remaining**, not original invoice total.
