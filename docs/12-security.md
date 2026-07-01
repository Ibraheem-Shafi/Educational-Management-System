# Security

## Security Requirements

Derived from the client requirements (§18) and extended for the copy-paste deployment model with Supabase.

## Authentication

| Requirement | Implementation |
|-------------|----------------|
| Email & password login | Supabase Auth `signInWithPassword` |
| Password reset | Supabase Auth `resetPasswordForEmail` |
| MFA for admins | Supabase TOTP; required for `super_admin`, `branch_admin` |
| Argon2id hashing | Supabase Auth default |
| Password complexity | Supabase Auth policies: min 8 chars, mixed case, number |
| Account lockout | Supabase rate limiting + custom failed-login counter |

### Password Policy

Configure in Supabase Dashboard → Authentication → Policies:

- Minimum length: 8 characters
- Require uppercase, lowercase, and number
- Prevent common passwords (Supabase built-in)

## Authorization

| Requirement | Implementation |
|-------------|----------------|
| RBAC | `Role`, `Permission`, `UserRole`, `RolePermission` tables |
| Granular permissions | Dot-separated codes checked by `PermissionsGuard` |
| Branch isolation | `BranchGuard` + service-layer filtering |
| No hardcoded roles | All role checks via permission codes |

## Session Security

| Requirement | Implementation |
|-------------|----------------|
| JWT tokens | Supabase-issued, short-lived access tokens |
| Refresh tokens | Supabase client auto-refresh |
| Device tracking | `UserSession` table |
| Forced logout | Revoke via Supabase Admin API + delete `UserSession` |
| Secure cookies | Supabase SSR client with `httpOnly` cookies |

### Token Lifecycle

```
Access token:  ~1 hour (Supabase default)
Refresh token: ~7 days (configurable in Supabase)
```

## Data Security

| Requirement | Implementation |
|-------------|----------------|
| HTTPS everywhere | Enforce TLS on all deployments (Vercel/Railway/VPS) |
| Encryption in transit | TLS 1.2+ |
| Encryption at rest | Supabase PostgreSQL encryption at rest (managed) |
| Sensitive fields | CNIC, phone stored in DB; no plaintext passwords in app DB |

### Environment Secrets

- Never commit `.env` files
- `SUPABASE_SERVICE_ROLE_KEY` only in `apps/api` — never in frontend
- `DATABASE_URL` only in `apps/api` and migration scripts
- Use separate secrets per deployment

## Branch Isolation

| Layer | Enforcement |
|-------|-------------|
| API (primary) | `BranchGuard` + service `where` clauses |
| Database (defense) | Supabase RLS policies on sensitive tables |
| Frontend (UX) | Permission-based UI hiding (not security) |

### RLS Policy Template

```sql
-- Applied to branch-scoped tables
ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "Student"
  FOR SELECT USING (
    "branchId" = coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'branch_id'),
      "branchId"
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
```

JWT `app_metadata` populated during invitation acceptance with `branch_id` and `role`.

### Applying RLS in production

Full policies for all branch-scoped tables live in [`packages/database/supabase/rls.sql`](../packages/database/supabase/rls.sql). After `prisma db push` or migrations, run that script in the Supabase SQL editor (or via `psql` against the project database). Policies use helper functions `jwt_branch_id()`, `jwt_role()`, `is_super_admin()`, and `branch_visible()`.

MFA is required for `super_admin` and `branch_admin`: the web login flow enforces TOTP enrollment and AAL2 verification; the API `AuthGuard` rejects non-`aal2` JWTs for those roles (except `@SkipMfa()` routes such as `GET /auth/me` during enrollment).

## Audit Logging

| Requirement | Implementation |
|-------------|----------------|
| Critical actions logged | `AuditService` on all mutations |
| Immutable logs | `AuditLog` table: no updates, no deletes |
| Log fields | user, action, entity, previous/new values, timestamp, IP |

### Logged Actions

- Attendance changes
- Marks updates
- Fee updates and payments
- User creation and role changes
- Permission changes
- Login success/failure
- Settings changes
- Document uploads/deletes

## Security Logging

| Event | Storage |
|-------|---------|
| Login success | `AuditLog` + `UserSession` |
| Login failure | `AuditLog` (action: `auth.login_failed`) |
| Permission violation | `AuditLog` (action: `auth.permission_denied`) |
| Account lockout | `AuditLog` (action: `auth.account_locked`) |
| Password reset request | `AuditLog` |
| MFA enrollment | `AuditLog` |

## File Upload Security

| Control | Implementation |
|---------|----------------|
| Bucket policies | Private buckets; signed URLs for access |
| File type validation | Allowlist: `image/jpeg`, `image/png`, `application/pdf` |
| Size limits | 5MB photos, 10MB documents |
| Path isolation | `{bucket}/{branchId}/{entityId}/{filename}` |
| No executable uploads | Reject `.exe`, `.sh`, `.php`, etc. |
| Virus scan | Future: ClamAV hook on upload (document as Phase 2) |

### Storage Bucket Policies

```
logos/           — public read, admin write
student-photos/  — authenticated read, staff write
documents/       — authenticated read, authorized roles write
```

## Pakistan Data Validation

| Field | Validation |
|-------|------------|
| CNIC | `^\d{5}-\d{7}-\d{1}$` |
| B-Form | Same format as CNIC |
| Phone | `^\+92\d{10}$` |
| Email | Standard email format |

Validated in Zod schemas (`packages/shared/constants/pakistan.ts`) on both frontend and backend.

## API Security

| Control | Implementation |
|---------|----------------|
| Rate limiting | `@nestjs/throttler` — 10/min auth, 100/min reads |
| CORS | Restrict to `NEXT_PUBLIC_APP_URL` only |
| Input validation | Zod schemas on all inputs |
| SQL injection | Prisma parameterized queries (no raw SQL unless necessary) |
| XSS | React auto-escaping; sanitize rich text if added later |
| CSRF | Not needed for JWT Bearer auth (no cookies for API) |

## Error Information Leakage

- Production 500 errors: generic message, no stack traces
- Cross-branch access: return 404, not 403
- Login failure: generic "Invalid credentials" (don't reveal if email exists)

## Deployment Security Checklist

Per deployment:

- [ ] HTTPS enabled on domain
- [ ] Supabase RLS enabled on sensitive tables
- [ ] Service role key only on API server
- [ ] MFA enabled for admin accounts
- [ ] Storage buckets have correct policies
- [ ] Rate limiting configured
- [ ] Audit logging verified
- [ ] Default passwords changed after seed
- [ ] Supabase dashboard access restricted to ops team

## Future Security Enhancements

| Enhancement | Phase |
|-------------|-------|
| Virus scanning on uploads | Phase 2 |
| IP allowlisting for admin | Phase 2 |
| Web Application Firewall | Phase 2 |
| Penetration testing | Before first customer handoff |
| SOC 2 / compliance audit | If enterprise customers require |

## Related Documents

- [08-auth-and-rbac.md](08-auth-and-rbac.md) — authentication and permissions
- [15-deployment.md](15-deployment.md) — deployment security checklist
- [11-backend-guidelines.md](11-backend-guidelines.md) — audit service patterns
