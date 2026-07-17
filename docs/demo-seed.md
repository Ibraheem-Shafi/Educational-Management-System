# Nexium Academy — Demo Seed Reference

Single reference for database seeding, demo logins, and what data is created for client presentations.

**Institution:** Nexium Academy Pakistan (Pakistani coaching center)  
**Demo version:** `nexium-v1.4`  
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
| rashid.ahmad@nexium.edu.pk | Nexium@2026! | Rashid Ahmad Khan | Parent | — | `/portal/parent` |
| ali.khan@nexium.edu.pk | Nexium@2026! | Muhammad Ali Khan | Student | — | `/portal/student` |

### Portal notes

- **Parent** (`rashid.ahmad@nexium.edu.pk`) is linked to **Ali Khan** and **Zainab Hussain** (sibling discount demo).
- **Student** (`ali.khan@nexium.edu.pk`) must match the student record email in the database.
- Staff accounts use the main login page; parent/student use the same login and are routed to their portal by role.
- **Learning:** demo seed creates published notes, materials, syllabus, resources, and homework (with due dates) for the MAIN campus first batch. Browse under **Learning** in `/dashboard`, `/portal/student/learning`, and `/portal/parent/learning`.

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
| `npm run db:seed:verify` | Print counts; exit 1 if below thresholds |

**Re-seed demo without touching foundation:**

```bash
npm run db:seed:demo
npm run db:seed:auth
```

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

### Phase 2 — Demo data (`nexium.demo.json`)

| Data | Count / detail |
|------|----------------|
| Students | 49 (mixed statuses: active, inactive, suspended, graduated, transferred, dropped) |
| Parents | 48 |
| Batches | 6 (MDCAT morning/evening, HSSC, SSC, MDCAT Lahore, ECAT Lahore) |
| Attendance | ~20 weekdays per active student |
| Assessments | 5 (weekly, monthly, FLP-1/2, grand test) with marks |
| Fee structures | MDCAT / HSSC / SSC monthly + admission + test (PKR) |
| Fee invoices | 3 months × up to 30 students (paid / pending / overdue) |
| Notices | 6 (PMC registration, Ramadan timings, PTM, fee challan, etc.) |
| Timetable | MDCAT Morning Batch A weekly grid |
| Documents | Fee policy, prospectus, sample admission form |
| Communications | 5 SMS/WhatsApp log entries |
| Audit log | Sample entries |

**Fee settings:** 10% sibling discount, Rs 500 late fee after 7 days.

**Featured student for demos:** Muhammad Ali Khan — `ali.khan@nexium.edu.pk`, MDCAT Morning Batch A, Islamabad.

### Phase 3 — Auth (`seed-auth.ts`)

- Creates or finds each demo user in Supabase Auth
- Sets `app_metadata.role` and `app_metadata.branch_id` for RLS
- Updates `User.supabaseUserId` in the app database

---

## Verification thresholds

`npm run db:seed:verify` expects at least:

| Entity | Minimum |
|--------|---------|
| students | 45 |
| batches | 6 |
| parents | 30 |
| attendance records | 500 |
| assessments | 5 |
| fee invoices | 60 |
| notices | 5 |
| users | 8 |

Plus `terminology._demoSeedVersion` = `nexium-v1.4` on institution settings.

---

## Screens you can demo (non-AI)

| Module | Sample login |
|--------|----------------|
| Dashboard, branches, academic | `admin@nexium.edu.pk` or `branchadmin@nexium.edu.pk` |
| Students, parents, attendance | `ahmed.teacher@nexium.edu.pk` |
| Fees, reports, accounting, payroll | `fees@nexium.edu.pk` |
| Users, communications, front office | `reception@nexium.edu.pk` |
| Lahore campus data | `lahore.admin@nexium.edu.pk` |
| Learning + online classes | `admin@nexium.edu.pk` or `ahmed.teacher@nexium.edu.pk` |
| Library | `branchadmin@nexium.edu.pk` |
| Transport (+ GPS last ping) | `branchadmin@nexium.edu.pk` |
| Assessments publish / report cards | `branchadmin@nexium.edu.pk` |
| Certificates & ID cards | `admin@nexium.edu.pk` |
| HR (contracts / reviews on user detail) | `admin@nexium.edu.pk` |
| Portal fee pay online (mock) | `rashid.ahmad@nexium.edu.pk` or `ali.khan@nexium.edu.pk` |
| Parent portal (+ Learning for children) | `rashid.ahmad@nexium.edu.pk` |
| Student portal (+ Learning / due soon) | `ali.khan@nexium.edu.pk` |

AI attendance and AI insights are intentionally empty/stubbed for demo.

---

## Related docs

- [15-deployment.md](15-deployment.md) — production deployment
- [17-clone-and-rebrand.md](17-clone-and-rebrand.md) — new institution from templates
- [templates/institution-seed.example.json](templates/institution-seed.example.json) — foundation JSON schema
- [progress/README.md](../progress/README.md) — go-live checklist summary
