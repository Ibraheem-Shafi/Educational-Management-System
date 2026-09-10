# Module: payroll

- **Phase:** 6
- **Feature-details:** §10
- **API base:** `/api/v1/payroll`
- **Overall status:** done
- **Last updated:** 2026-09-09

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Employee salary structures | done | done | done | — | done | Deactivates previous active structure for same user/branch |
| Allowances, deductions, statutory, adjustments | done | done | done | — | done | Kinds: allowance, deduction, tax, eobi, provident_fund |
| Attendance and leave inputs for payroll | done | done | done | — | done | Unpaid absences only; approved employee leave is paid; no attendance → full pay |
| Monthly payroll processing | done | done | done | — | done | LWP deduction line; send back to draft; mark as paid |
| Salary slips and payroll history | done | done | done | — | done | `/print/salary-slips/[lineId]`; paid vs unpaid history |
| Payroll summaries and exports | done | done | done | — | done | CSV export |
| Approval before finalization | done | done | done | — | done | draft → pending → approved → finalized → paid |

## Blockers

- None

## Related docs

- [docs/feature-details.md](../../docs/feature-details.md) §10
- [sections/10-payroll.md](../sections/10-payroll.md)
- [modules/hr-expanded.md](hr-expanded.md)
