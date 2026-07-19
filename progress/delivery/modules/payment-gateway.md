# Module: payment-gateway

- **Phase:** 6
- **Feature-details:** §7
- **API base:** `/api/v1/payments`, `/api/v1/payments/webhooks`
- **Overall status:** done
- **Last updated:** 2026-07-17

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Supported provider integration (checkout) | done | done | done | — | done | mock + Stripe |
| Payment webhooks and reconciliation | done | done | — | — | done | |
| Parent/student online pay from portal | done | done | done | — | done | |
| Receipt linkage to gateway transactions | done | done | done | — | done | FeePayment rows |

## Blockers

- None

## Related docs

- [docs/feature-details.md](../../docs/feature-details.md) §7
- [sections/07-fees-finance.md](../sections/07-fees-finance.md)
