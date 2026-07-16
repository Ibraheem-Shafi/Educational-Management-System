# Clone & Rebrand Guide

Step-by-step guide for deploying the system for a **new institution**. No code changes required — only configuration and infrastructure setup.

**Estimated time:** 2–4 hours (excluding DNS propagation).

## Prerequisites

- Access to the product repository (or a release tag)
- New domain for the institution (e.g. `erp.alnoorcollege.edu.pk`)
- Supabase account
- Hosting accounts (Vercel/Railway or VPS)
- Institution details from customer: name, logo, address, phone, email, type

## Overview

```mermaid
flowchart LR
  A[Copy codebase] --> B[New Supabase project]
  B --> C[Configure env]
  C --> D[Fill institution JSON]
  D --> E[Migrate and seed]
  E --> F[Upload logo]
  F --> G[Deploy API and Web]
  G --> H[DNS setup]
  H --> I[Verify and handoff]
```

## Step 1 — Prepare the Codebase

### Option A: Fork / Copy Repository

```bash
# Clone the product repo for the new customer
git clone <product-repo-url> alnoor-erp
cd alnoor-erp
git checkout v1.0.0   # Use a stable release tag
```

### Option B: Deploy from Release Tag

Use CI/CD to deploy tag `v1.0.0` to new hosting — no separate repo needed if using the same repo with different env configs.

**Do not modify source code.** Only configuration files change.

## Step 2 — Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → name: `alnoor-college-erp` (internal name)
3. Region: `ap-south-1` (Mumbai) or nearest to Pakistan
4. Set strong database password — store securely
5. Wait for project provisioning (~2 min)

### Collect Credentials

| Credential | Where to find |
|------------|---------------|
| Project URL | Settings → API → Project URL |
| Anon key | Settings → API → anon public |
| Service role key | Settings → API → service_role (secret) |
| Database URL | Settings → Database → Connection string (URI) |

### Configure Auth

- Authentication → Providers → Email: enabled
- Authentication → URL Configuration → Site URL: `https://erp.alnoorcollege.edu.pk`
- Authentication → MFA: enable TOTP

### Create Storage Buckets

| Bucket | Public |
|--------|--------|
| `logos` | Yes |
| `student-photos` | No |
| `documents` | No |

## Step 3 — Configure Environment

```bash
cp docs/templates/.env.api.example apps/api/.env
cp docs/templates/.env.web.example apps/web/.env.local
```

Fill in values for the new institution:

```bash
# apps/api/.env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
INSTITUTION_NAME="Al-Noor College"
INSTITUTION_TYPE="college"
INSTITUTION_TIMEZONE="Asia/Karachi"
NEXT_PUBLIC_APP_URL="https://erp.alnoorcollege.edu.pk"
PORT=3001

# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
NEXT_PUBLIC_API_URL="https://api.alnoorcollege.edu.pk"
NEXT_PUBLIC_APP_URL="https://erp.alnoorcollege.edu.pk"
INSTITUTION_NAME="Al-Noor College"
```

## Step 4 — Create Institution Seed File

Copy the template and fill in customer details:

```bash
cp docs/templates/institution-seed.example.json docs/templates/alnoor.institution.json
```

Edit `alnoor.institution.json`:

```json
{
  "institution": {
    "name": "Al-Noor College",
    "institutionType": "college",
    "primaryColor": "#059669",
    "address": "123 Main Boulevard",
    "city": "Lahore",
    "province": "Punjab",
    "country": "Pakistan",
    "phone": "+923001234567",
    "email": "info@alnoorcollege.edu.pk",
    "website": "https://alnoorcollege.edu.pk",
    "timezone": "Asia/Karachi",
    "currency": "PKR"
  },
  "branches": [
    {
      "name": "Main Campus",
      "code": "MAIN",
      "address": "123 Main Boulevard",
      "city": "Lahore",
      "phone": "+923001234567"
    }
  ],
  "superAdmin": {
    "email": "admin@alnoorcollege.edu.pk",
    "fullName": "College Administrator"
  }
}
```

See [institution-seed.example.json](templates/institution-seed.example.json) for full schema.

## Step 5 — Install, Migrate, Seed

```bash
pnpm install
pnpm db:migrate
pnpm db:seed -- --config docs/templates/alnoor.institution.json
```

Seed script creates:

- `InstitutionSettings` row
- Default roles and permissions
- Lookup statuses (student, attendance)
- Branches from JSON
- Super Admin invitation

## Step 6 — Upload Logo

1. Get logo file from customer (PNG, 256×256 recommended)
2. Upload to Supabase Storage: `logos/default/logo.png`
3. Update `InstitutionSettings.logoUrl`:

```bash
# Via seed script (if logo path in JSON) or admin UI after first login
```

Optional: upload favicon to `logos/default/favicon.png`.

## Step 7 — Deploy

### API

```bash
pnpm --filter @eims/api build
# Deploy dist/ to Railway, Fly.io, or VPS
# Ensure all apps/api/.env vars are set in hosting dashboard
```

### Web

```bash
pnpm --filter @eims/web build
# Deploy to Vercel or VPS
# Ensure all apps/web/.env.local vars are set
```

## Step 8 — DNS Configuration

| Record | Host | Type | Value |
|--------|------|------|-------|
| Web | `erp` | CNAME | Vercel/hosting target |
| API | `api` | CNAME | API hosting target |

Wait for DNS propagation (up to 48 hours, usually minutes).

Update Supabase Auth → Site URL to match `NEXT_PUBLIC_APP_URL`.

## Step 9 — Verification Checklist

Run through before customer handoff:

### Branding
- [ ] Login page shows correct institution name
- [ ] Logo displays in sidebar and login page
- [ ] Primary color applied to buttons/links
- [ ] Browser tab title shows institution name

### Functionality
- [ ] Super Admin can log in (via invitation email)
- [ ] Super Admin can create/edit branches
- [ ] Branch Admin invitation works
- [ ] Student admission flow works
- [ ] Attendance can be marked
- [ ] Assessment marks can be entered
- [ ] Fee invoice can be created
- [ ] Notice can be published

### Security
- [ ] HTTPS on web and API
- [ ] MFA can be enabled for admin
- [ ] Wrong-branch data returns 404
- [ ] Service role key not exposed to frontend

### Contact Info
- [ ] Footer/settings show correct phone, email, address

## Step 10 — Customer Handoff

Provide the customer:

| Item | Details |
|------|---------|
| Web URL | `https://erp.alnoorcollege.edu.pk` |
| Super Admin credentials | Via secure channel (not email plaintext) |
| Quick start guide | Login → create branch → invite staff → admit students |
| Support contact | Your team's support email/phone |

**Do not provide:** Supabase dashboard access, service role key, or database credentials (unless customer manages their own infra).

## What You Do NOT Change

| Item | Reason |
|------|--------|
| `apps/` source code | Same product for all customers |
| `packages/` shared code | Same types, schemas, utils |
| Prisma schema | Same data model |
| API routes | Same endpoints |
| UI components | Same layouts and flows |

If a customer needs custom behavior, use **feature flags** in `InstitutionSettings` — not code forks.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login page shows wrong name | Check `InstitutionSettings` in DB; re-run seed or update via admin |
| Logo not loading | Verify Storage bucket is public; check `logoUrl` in settings |
| API 401 errors | Verify `SUPABASE_URL` and keys match between web and api |
| CORS errors | Set `NEXT_PUBLIC_APP_URL` in API CORS config |
| Migration fails | Check `DATABASE_URL`; ensure Supabase project is active |
| Invitation email not sent | Configure Supabase Auth email templates or SMTP |

## Reference: Nexium Academy

The first deployment uses [nexium.institution.json](templates/nexium.institution.json). Use it as a reference for field values and structure — replace all nexium-specific data with the new customer's information.

## Related Documents

- [14-white-label-config.md](14-white-label-config.md) — configuration schema
- [15-deployment.md](15-deployment.md) — detailed deployment steps
- [templates/institution-seed.example.json](templates/institution-seed.example.json) — seed file template
