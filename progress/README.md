# EIMS Progress Dashboard

**Last updated:** 2026-07-01  
**Current target:** Rekhta Academy — **Sprint 6 security & QA complete**  
**Reference deployment:** coaching center profile

Track implementation against:

- **Client scope:** [docs/ERP-Requirements.docx](../docs/ERP-Requirements.docx) → [`requirements/`](requirements/)
- **Engineering modules:** [docs/13-feature-modules.md](../docs/13-feature-modules.md) → [`modules/`](modules/)

[How to update this folder](HOW-TO-UPDATE.md)

---

## Phase rollup

| Phase | Scope | Features done | Features total | Progress |
|-------|-------|---------------|----------------|----------|
| **Phase 1** | MVP — auth, branches, academic, students, attendance, assessments, fees, notices, audit, settings | 52 | 52 | **100%** |
| **Phase 2** | Timetable, form builder, analytics, documents | 18 | 18 | **100%** |
| **Phase 3** | AI attendance, SMS/WhatsApp, AI insights, PWA mobile portal | 9 | 12 | **75%** (native apps deferred) |

*Sibling auto-discount and batch-subject advanced workflows are Phase 2 stretch items per client brief.*

---

## Module matrix (engineering)

| Module | Phase | Overall | DB | API | Web | File |
|--------|-------|---------|----|-----|-----|------|
| infrastructure | — | done | done | done | done | [modules/infrastructure.md](modules/infrastructure.md) |
| auth | 1 | done | done | done | done | [modules/auth.md](modules/auth.md) |
| settings | 1 | done | done | done | done | [modules/settings.md](modules/settings.md) |
| branches | 1 | done | done | done | done | [modules/branches.md](modules/branches.md) |
| academic | 1 | done | done | done | done | [modules/academic.md](modules/academic.md) |
| students | 1 | done | done | done | done | [modules/students.md](modules/students.md) |
| parents | 1 | done | done | done | done | [modules/parents.md](modules/parents.md) |
| users | 1 | done | done | done | done | [modules/users.md](modules/users.md) |
| attendance | 1 | done | done | done | done | [modules/attendance.md](modules/attendance.md) |
| assessments | 1 | done | done | done | done | [modules/assessments.md](modules/assessments.md) |
| fees | 1 | done | done | done | done | [modules/fees.md](modules/fees.md) |
| notices | 1 | done | done | done | done | [modules/notices.md](modules/notices.md) |
| audit | 1 | done | done | done | done | [modules/audit.md](modules/audit.md) |
| timetable | 2 | done | done | done | done | [modules/timetable.md](modules/timetable.md) |
| form-builder | 2 | done | done | done | done | [modules/form-builder.md](modules/form-builder.md) |
| analytics | 2 | done | done | done | done | [modules/analytics.md](modules/analytics.md) |
| documents | 2 | done | done | done | done | [modules/documents.md](modules/documents.md) |
| phase-3-future | 3 | done | done | done | done | [modules/phase-3-future.md](modules/phase-3-future.md) |

---

## Go-live checklist

1. `npm run db:push` — uses `DIRECT_URL` from `apps/api/.env` (session pooler port 5432)
2. `npm run db:seed:all` — foundation + Pakistani demo data + Supabase auth accounts
3. `npm run db:seed:verify` — confirm counts (students ≥ 45, batches ≥ 6, etc.)
4. **Demo logins (emails, passwords, roles):** [docs/demo-seed.md](../docs/demo-seed.md)
5. Supabase: enable Realtime on `Notice` table; create buckets `student-photos`, `student-documents`, `institution-assets`, `attendance-registers`
6. Supabase: run `packages/database/supabase/rls.sql` in SQL editor (branch isolation RLS)
7. Env: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`; optional `TWILIO_*`, `OPENAI_API_KEY`
8. Enable MFA in Supabase project settings (TOTP); enforce for `super_admin` / `branch_admin` at login
9. Smoke + critical-path tests: `npm run test:e2e -w @eims/web`

## Documentation vs code

| Area | Status |
|------|--------|
| Architecture docs (`docs/01`–`17`) | done |
| NestJS API modules registered | 21 of 21 Phase 1–3 modules |
| Next.js dashboard + portal pages | 30+ pages |
| CI build workflow | done |
| Supabase RLS policies (`packages/database/supabase/rls.sql`) | done |
| MFA enforcement (admin AAL2 + enrollment) | done |
| Playwright smoke + critical-path e2e | done | CI e2e job on push/PR |
