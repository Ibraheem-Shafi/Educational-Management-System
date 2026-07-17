# §7 — Fees and finance operations

- **Source:** [docs/feature-details.md](../../docs/feature-details.md) §7
- **Phase:** 1–3 (core) · payment gateway Phase 6
- **Overall status:** done
- **Implemented by:** [fees](../../modules/fees.md), [phase-3-future](../../modules/phase-3-future.md), [payment-gateway](../modules/payment-gateway.md)
- **Last updated:** 2026-07-17

## Acceptance items

| Item | Module | Status | Notes |
|------|--------|--------|-------|
| Configurable fee types and fee structures | fees | done | |
| Student invoices and payment records | fees | done | FeePayment rows |
| Discounts, concessions, scholarships, and late fines | fees | done | |
| Due dates, outstanding balances, and defaulter reports | fees | done | |
| Payment receipts and collection summaries | fees | done | |
| Parent and student fee visibility | portals | done | |
| SMS/WhatsApp fee reminder workflows | phase-3-future | done | |
| Online payment-gateway integration through a supported provider | payment-gateway | done | mock + Stripe |
| Daily, monthly, branch-level, and consolidated collection reports | fees, analytics | done | |
