# §10 — Payroll management

- **Source:** [docs/feature-details.md](../../docs/feature-details.md) §10
- **Phase:** 6
- **Overall status:** done
- **Implemented by:** [payroll](../modules/payroll.md)
- **Last updated:** 2026-09-09

## Acceptance items

| Item | Module | Status | Notes |
|------|--------|--------|-------|
| Employee salary structures | payroll | done | One active structure per staff/branch; tax / EOBI / PF kinds |
| Basic salary, allowances, deductions, and adjustments | payroll | done | Fixed allowances not prorated; % of full basic wins if both filled |
| Attendance and leave inputs for payroll | payroll | done | No attendance → full pay; LWP only for unpaid absences; approved employee leave is paid |
| Monthly payroll processing | payroll | done | Generate confirm; send back to draft; mark as paid after finalize |
| Salary slips and payroll history | payroll | done | Full basic + LWP line; History shows paid vs finalized-unpaid |
| Payroll summaries and exports | payroll | done | CSV export |
| Approval controls before payroll finalization | payroll | done | `payroll.approve` is admin-only; UI explains when Approve is hidden |

## Out of scope (this pass)

- FBR income-tax slabs / employer EOBI GL split
- Holiday/academic calendar as working days
- Per-employee bank account master data
- Recreating a second run for a month already finalized
