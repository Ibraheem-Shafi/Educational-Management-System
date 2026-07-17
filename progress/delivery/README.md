# Feature-details delivery progress

**Last updated:** 2026-07-17  
**Source:** [docs/feature-details.md](../../docs/feature-details.md)  
**Phase 1–3 archive:** [progress/README.md](../README.md)

Tracks product scope from the feature-details appendix. Phases 4–6 are shipped; Phase 7 (Android + biometric) is **deferred**.

**Gap close-out (2026-07-17):** employee leave, absence alerts, transfer/character certificates, public `/apply` inquiry form, assessment CSV export. SkoolZoom-only extras (hostel, inventory, events, teacher portal) remain out of appendix scope.

[How to update this folder](HOW-TO-UPDATE.md)

---

## Audit rollup (feature-details sections)

| Section | File | Overall | Notes |
|---------|------|---------|-------|
| §1 Front office and admissions | [sections/01-front-office.md](sections/01-front-office.md) | done | Phase 4 |
| §2 Student information system | [sections/02-student-information.md](sections/02-student-information.md) | done | |
| §3 HR and staff management | [sections/03-hr-staff.md](sections/03-hr-staff.md) | done | Payroll Phase 6 |
| §4 Attendance management | [sections/04-attendance.md](sections/04-attendance.md) | partial | Biometric deferred |
| §5 Academic management | [sections/05-academic.md](sections/05-academic.md) | done | |
| §6 Examinations and results | [sections/06-examinations.md](sections/06-examinations.md) | done | |
| §7 Fees and finance | [sections/07-fees-finance.md](sections/07-fees-finance.md) | done | Payment gateway Phase 6 |
| §8 Library | [sections/08-library.md](sections/08-library.md) | done | |
| §9 Transport | [sections/09-transport.md](sections/09-transport.md) | done | |
| §10 Payroll | [sections/10-payroll.md](sections/10-payroll.md) | done | Phase 6 |
| §11 Accounting | [sections/11-accounting.md](sections/11-accounting.md) | done | Phase 6 |
| §12 Learning resources | [sections/12-learning.md](sections/12-learning.md) | done | |
| §13 Parent portal | [sections/13-parent-portal.md](sections/13-parent-portal.md) | partial | Web done; Android deferred |
| §14 Student portal | [sections/14-student-portal.md](sections/14-student-portal.md) | partial | Web done; Android deferred |
| §15 Communications | [sections/15-communications.md](sections/15-communications.md) | done | |
| §16 Android applications | [sections/16-android-apps.md](sections/16-android-apps.md) | deferred | Phase 7 paused |
| §17 Analytics and AI | [sections/17-analytics-ai.md](sections/17-analytics-ai.md) | done | |
| §18 Security and admin | [sections/18-security-admin.md](sections/18-security-admin.md) | done | |
| §19 White-label | [sections/19-white-label.md](sections/19-white-label.md) | done | |
| §21 Future AI Academic Suite | [sections/21-future-ai-suite.md](sections/21-future-ai-suite.md) | deferred | |

**Section counts:** 14 done · 3 partial · 0 not_started · 2 deferred

---

## Delivery phases

| Phase | Scope | Modules | Status |
|-------|-------|---------|--------|
| **Phase 4** | Front office, expanded HR, certificates, exam publishing | 4 | **done** |
| **Phase 5** | Library, transport (+ GPS readiness), online-class scheduling | 3 | **done** |
| **Phase 6** | Payroll, double-entry accounting, online payment gateway | 3 | **done** |
| **Phase 7** | Parent + student Android apps, biometric attendance readiness | 2 | **deferred** |

---

## Module matrix (delivery)

| Module | Phase | Overall | File |
|--------|-------|---------|------|
| front-office | 4 | done | [modules/front-office.md](modules/front-office.md) |
| hr-expanded | 4 | done | [modules/hr-expanded.md](modules/hr-expanded.md) |
| certificates | 4 | done | [modules/certificates.md](modules/certificates.md) |
| exam-publishing | 4 | done | [modules/exam-publishing.md](modules/exam-publishing.md) |
| library | 5 | done | [modules/library.md](modules/library.md) |
| transport | 5 | done | [modules/transport.md](modules/transport.md) |
| online-classes | 5 | done | [modules/online-classes.md](modules/online-classes.md) |
| payroll | 6 | done | [modules/payroll.md](modules/payroll.md) |
| accounting | 6 | done | [modules/accounting.md](modules/accounting.md) |
| payment-gateway | 6 | done | [modules/payment-gateway.md](modules/payment-gateway.md) |
| android-apps | 7 | deferred | [modules/android-apps.md](modules/android-apps.md) |
| biometric-readiness | 7 | deferred | [modules/biometric-readiness.md](modules/biometric-readiness.md) |

---

## Phase 6 ship notes

- Payroll hub: `/dashboard/payroll` (Structures | Runs | History); slips at `/print/salary-slips/[lineId]`
- Payments: mock (default) + Stripe Checkout; portal Pay online; `FeePayment` partial/full
- Accounting hub: `/dashboard/accounting`; system CoA 1000/4000/5000; auto-post on fee pay + payroll finalize
- Demo seed: `nexium-v1.4`
- Env: `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_WEB_URL`

## Phase 7 status (deferred)

- Native Android apps and biometric hardware integration are **out of current ship scope**.
- Supported mobile experience: parent/student **web portals** + PWA.
- Push-token **API readiness** exists (`POST/DELETE /device-tokens`, `DevicePushToken` model) for when native clients resume.
- Future app build/Play Console notes: [docs/18-android-apps.md](../../docs/18-android-apps.md)
