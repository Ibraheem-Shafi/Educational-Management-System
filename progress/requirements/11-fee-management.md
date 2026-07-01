# §11 — Fee Management

- **Source:** ERP-Requirements.docx §11
- **Phase:** 1
- **Overall status:** done
- **Implemented by:** [fees](../modules/fees.md)
- **Last updated:** 2026-07-01

## Acceptance items

| Item (from client doc) | Module | Status | Notes |
|------------------------|--------|--------|-------|
| Fee types (Tuition, Admission, etc.) | [fees](../modules/fees.md) | done | Seeded + POST/PATCH admin CRUD |
| Fee structures per program/batch | [fees](../modules/fees.md) | done | `FeeStructure` model + CRUD UI |
| Student fee assignments | [fees](../modules/fees.md) | done | Invoice per student |
| Bulk invoice generation | [fees](../modules/fees.md) | done | Generate from structures per batch |
| Payment recording | [fees](../modules/fees.md) | done | PATCH pay endpoint |
| Outstanding balance tracking | [fees](../modules/fees.md) | done | Status + portal views |
| Fee receipts / invoices | [fees](../modules/fees.md) | done | Print-friendly receipt view |
| Discounts and scholarships | [fees](../modules/fees.md) | done | Manual discount + sibling auto-discount |
| Late fee fines | [fees](../modules/fees.md) | done | Manual fine + auto late fee on overdue |
| Defaulter report | [fees](../modules/fees.md) | done | `/reports/fee-defaulters` + Reports page |
| Sibling auto-discount | [fees](../modules/fees.md) | done | `InstitutionSettings.siblingDiscountPercent` |
