# Module: payroll

- **Phase:** 6
- **Feature-details:** §10
- **API base:** `/api/v1/payroll`
- **Overall status:** done
- **Last updated:** 2026-07-17

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Employee salary structures | done | done | done | — | done | |
| Allowances, bonuses, deductions, adjustments | done | done | done | — | done | |
| Attendance and leave inputs for payroll | done | done | done | — | done | Staff attendance counts |
| Monthly payroll processing | done | done | done | — | done | |
| Salary slips and payroll history | done | done | done | — | done | `/print/salary-slips/[lineId]` |
| Payroll summaries and exports | done | done | done | — | done | CSV export |
| Approval before finalization | done | done | done | — | done | draft → pending → approved → finalized |

## Blockers

- None

## Related docs

- [docs/feature-details.md](../../docs/feature-details.md) §10
- [sections/10-payroll.md](../sections/10-payroll.md)
- [modules/hr-expanded.md](hr-expanded.md)
