# Nexium Academy — Demo Seed Reference

Single reference for database seeding, demo logins, and what data is created for client presentations.

**Institution:** Nexium Academy Pakistan (Pakistani coaching center)  
**Demo version:** `nexium-v1.5`  
**Config files:** [`templates/nexium.institution.json`](templates/nexium.institution.json) (foundation) · [`templates/nexium.demo.json`](templates/nexium.demo.json) (transactional data)  
**Logo:** `apps/web/public/logo.png` — temporary asset until a new Nexium logo is provided (filename stays the same).

---

## Quick start

From the monorepo root:

```bash
npm run db:push
npm run db:seed:all
npm run db:seed:verify
npm run dev
```

Open **http://localhost:3000** and sign in with any account below.

### Environment prerequisites

| File | Purpose |
|------|---------|
| `apps/api/.env` | `DATABASE_URL`, `DIRECT_URL`, Supabase keys, SMTP |
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` |

Prisma seed scripts load `apps/api/.env` automatically via `dotenv-cli`.

---

## Demo login accounts

**Password for all accounts:** `Nexium@2026!`

Defined in `nexium.institution.json` → `demo.password` and synced to Supabase by `npm run db:seed:auth`.

| Email | Password | Full name | Role | Branch | Where to log in |
|-------|----------|-----------|------|--------|-----------------|
| admin@nexium.edu.pk | Nexium@2026! | Syed Kamran Shah | Super Admin | All | `/dashboard` |
| branchadmin@nexium.edu.pk | Nexium@2026! | Aisha Malik | Branch Admin | Islamabad (MAIN) | `/dashboard` |
| lahore.admin@nexium.edu.pk | Nexium@2026! | Usman Tariq | Branch Admin | Lahore (LAHORE) | `/dashboard` |
| ahmed.teacher@nexium.edu.pk | Nexium@2026! | Dr. Ahmed Hassan | Teacher | MAIN | `/dashboard` |
| fees@nexium.edu.pk | Nexium@2026! | Sadia Bano | Accountant | MAIN | `/dashboard` |
| reception@nexium.edu.pk | Nexium@2026! | Hina Batool | Receptionist | MAIN | `/dashboard` |
| lahore.teacher@nexium.edu.pk | Nexium@2026! | Dr. Farah Siddiqui | Teacher | LAHORE | `/dashboard` |
| lahore.fees@nexium.edu.pk | Nexium@2026! | Imran Qureshi | Accountant | LAHORE | `/dashboard` |
| lahore.reception@nexium.edu.pk | Nexium@2026! | Nadia Sheikh | Receptionist | LAHORE | `/dashboard` |
| rashid.ahmad@nexium.edu.pk | Nexium@2026! | Rashid Ahmad Khan | Parent | — | `/portal/parent` |
| ali.khan@nexium.edu.pk | Nexium@2026! | Muhammad Ali Khan | Student | — | `/portal/student` |

### Portal notes

- **Parent** (`rashid.ahmad@nexium.edu.pk`) is linked to **Ali Khan** and **Zainab Hussain** (sibling discount demo).
- **Student** (`ali.khan@nexium.edu.pk`) must match the student record email in the database.
- Staff accounts use the main login page; parent/student use the same login and are routed to their portal by role.
- **Learning:** demo seed creates published notes, materials, syllabus, resources, homework, and online classes **for each campus** (titles prefixed with `[MAIN]` / `[LAHORE]`).

### MFA

For frictionless demos, set **both**:

- `NEXT_PUBLIC_SKIP_ADMIN_MFA=1` in `apps/web/.env.local` (skips TOTP UI for `super_admin` / `branch_admin`)
- `SKIP_ADMIN_MFA=1` in `apps/api/.env` (allows API calls without JWT `aal2`)

Both are included in `.env.local.example` and `apps/api/.env.example`.

Alternatively, disable MFA in the Supabase project settings, or complete TOTP enrollment once on first admin login.

### Security reminder

Change the demo password (or delete demo Supabase users) before any production go-live. Do not use `Nexium@2026!` in production.

---

## npm scripts

| Command | What it does |
|---------|----------------|
| `npm run db:push` | Apply Prisma schema to Supabase (uses `DIRECT_URL`) |
| `npm run db:seed` | Phase 1 (foundation) + Phase 2 (demo data, DB only) |
| `npm run db:seed:auth` | Phase 3 — create/link Supabase Auth users + JWT metadata |
| `npm run db:seed:all` | `db:seed` then `db:seed:auth` (full client setup) |
| `npm run db:seed:demo` | Rebuild demo data only (targeted delete + re-insert) |
| `npm run db:seed:verify` | Print global + per-branch counts; exit 1 if below thresholds |

**Re-seed demo without touching foundation:**

```bash
npm run db:seed:demo -- --force-demo
npm run db:seed:auth
```

A version bump (for example `nexium-v1.4` → `nexium-v1.5`) also cleans and re-applies Phase 2 automatically on the next `db:seed` / `db:seed:demo`.

---

## What gets seeded

### Phase 1 — Foundation (`seed.ts` + `nexium.institution.json`)

- Institution settings (nexium branding, PKR, Asia/Karachi)
- Roles & permissions (7 roles)
- Branches: **Islamabad Main (MAIN)**, **Lahore Gulberg (LAHORE)**
- Lookup statuses (student, attendance, parent relationship, fee)
- Academic session **2026**
- Subjects: Physics, Chemistry, Biology, Math, English
- Programs: SSC, HSSC, MDCAT, ECAT (per branch)
- Assessment types & FLP series (FLP-1 … FLP-4)
- Fee types: admission, monthly, registration, test
- Form fields: previous school, board, emergency contact
- Super Admin invitation record (superseded once `db:seed:auth` runs)

### Phase 2 — Demo data (`nexium.demo.json` + seed steps)

Both **MAIN** and **LAHORE** receive representative operational data.

| Data | Detail |
|------|--------|
| Students | 49 (36 MAIN / 13 LAHORE; mixed statuses) |
| Parents | 48 (institution-wide) |
| Batches | 6 (4 MAIN + 2 LAHORE) |
| Staff accounts | Teacher, accountant, receptionist per branch (+ branch admins + super admin) |
| Attendance | ~20 weekdays per active student **and** staff/teacher attendance samples |
| Assessments | 8 (5 MAIN + 3 LAHORE) with marks |
| Fee structures | Per-branch monthly/admission (and MAIN test fee) |
| Fee invoices | 3 months × students per branch (paid / pending / overdue + discount samples) |
| Fee payments | Completed payment rows for paid invoices |
| Notices | Published + draft per campus |
| Timetable | MAIN MDCAT Morning A + LAHORE MDCAT/ECAT slots |
| Documents | Policy + student admission forms per campus |
| Learning | Notes, materials, syllabus, homework, online classes per campus |
| Front office | Inquiries (incl. enrolled), visitors, complaints, reception activity per campus |
| Certificates | Global templates + one issued certificate per campus |
| Library | Categories, books, copies, active loan, overdue fine, reservation per campus |
| Transport | Vehicle, route, stops, assignments, trip + attendance per campus |
| Payroll | Finalized prior-month run + current-month **draft** run per campus |
| Biometric | Device, student mappings, punch logs (matched + unmatched) per campus |
| HR | Employment contracts + performance reviews for branch staff |
| Leave | Pending/approved employee leave + parent-submitted student leave |
| Accounting | System COA, posted + draft vouchers, branch utility account, yearly budget |
| AI attendance | One analyzed OCR session sample per campus |
| Communications | SMS/WhatsApp log entries |
| Audit log | Sample entries |

**Fee settings:** 10% sibling discount, Rs 500 late fee after 7 days.

**Featured students:**  
- MAIN — Muhammad Ali Khan (`ali-khan`)  
- LAHORE — Ahmed Hassan (`ahmed-hassan`)

### Phase 3 — Auth (`seed-auth.ts`)

- Creates or finds each demo user in Supabase Auth
- Sets `app_metadata.role` and `app_metadata.branch_id` for RLS
- Updates `User.supabaseUserId` in the app database

---

## Verification

`npm run db:seed:verify` checks:

1. Global totals (students, batches, parents, attendance, assessments, invoices, notices, users)
2. `terminology._demoSeedVersion` = `nexium-v1.5`
3. **Per-branch matrix** for MAIN and LAHORE (students, fees, assessments, learning, FO, library, transport, payroll, biometric, HR/leave, accounting, AI OCR, …)
4. Cross-branch integrity (invoice/student, assessment/student, timetable/batch must share a branch)

---

## Screens you can demo

| Module | Sample login |
|--------|----------------|
| Dashboard (switch branch scope) | `admin@nexium.edu.pk` |
| Islamabad campus | `branchadmin@nexium.edu.pk` |
| Lahore campus | `lahore.admin@nexium.edu.pk` |
| Students, attendance, assessments | `ahmed.teacher@nexium.edu.pk` or `lahore.teacher@nexium.edu.pk` |
| Fees, reports, accounting, payroll | `fees@nexium.edu.pk` or `lahore.fees@nexium.edu.pk` |
| Front office, communications | `reception@nexium.edu.pk` or `lahore.reception@nexium.edu.pk` |
| Learning + online classes | Campus teacher or admin |
| Library / transport / biometric | Branch admin |
| HR contracts / reviews / leave | Super admin or branch admin |
| AI attendance history | Teacher (sample OCR sessions seeded) |
| Parent / student portals | `rashid.ahmad@nexium.edu.pk` / `ali.khan@nexium.edu.pk` |

---

## Related docs

- [15-deployment.md](15-deployment.md) — production deployment
- [17-clone-and-rebrand.md](17-clone-and-rebrand.md) — new institution from templates
- [templates/institution-seed.example.json](templates/institution-seed.example.json) — foundation JSON schema
- [demo-feature-checklist.md](demo-feature-checklist.md) — client walkthrough checklist
- [progress/README.md](../progress/README.md) — go-live checklist summary
