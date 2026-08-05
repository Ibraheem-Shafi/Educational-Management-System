# Technical Security Note — Auth, JWT & RBAC

**Audience:** School IT / technical evaluators  
**Companion (non-technical):** [client-security-rbac-brief.md](client-security-rbac-brief.md)  
**Full engineering refs:** [08-auth-and-rbac.md](08-auth-and-rbac.md) · [12-security.md](12-security.md)

Short stack overview for evaluators who ask about tokens, sessions, and how permissions are enforced.

---

## Stack summary

| Concern | Approach |
|---------|----------|
| Identity provider | Supabase Auth (email/password; TOTP MFA for admins) |
| Password storage | Managed by Supabase (Argon2id); app DB never stores plaintext passwords |
| API authorization | NestJS guards on every protected route |
| App data | Dedicated PostgreSQL per institution deployment |
| Web session | Supabase client session (httpOnly cookies on SSR) + `Authorization: Bearer` to API |

---

## JWT & session lifecycle

```
Login (email + password)
  → Supabase issues access JWT + refresh token
  → Browser holds session; client refreshes access token automatically
  → Each API call: Authorization: Bearer <access_token>
  → NestJS verifies JWT signature/claims, loads app user + permissions
```

| Token | Typical lifetime | Purpose |
|-------|------------------|---------|
| **Access JWT** | ~1 hour | Proves identity to the API; short-lived by design |
| **Refresh token** | ~7 days (configurable) | Obtains a new access JWT without re-entering the password |

**Why short-lived access tokens matter:** If a token is copied from a device, it expires quickly. Refresh tokens stay with the auth client and can be revoked (forced logout / session revoke).

JWT `app_metadata` carries role and branch hints used for defense-in-depth database policies. Application permissions are still loaded from the app database and checked on the API — the JWT alone is not a permission list the client can forge to gain access.

---

## Request enforcement (API)

Every protected endpoint runs through layered checks:

1. **AuthGuard** — Valid JWT required; inactive users rejected; admin roles must satisfy MFA assurance (AAL2) unless the route explicitly skips MFA (e.g. enrollment helpers).
2. **PermissionsGuard** — Route declares required permission codes (e.g. `fees.collect`, `students.create`). User must have all of them.
3. **BranchGuard** — Non–super-admin users are forced to their assigned `branchId`; they cannot query another campus by swapping IDs in the request.

UI menu hiding is **not** the security boundary. The API refuses unauthorized calls even if a URL is typed manually.

---

## MFA (admins)

| Item | Detail |
|------|--------|
| Method | TOTP (authenticator app) |
| Required for | `super_admin`, `branch_admin` |
| Enforcement | Login challenge + API rejects admin JWTs that are not AAL2 |

---

## RBAC model (technical)

| Concept | Storage / behavior |
|---------|-------------------|
| Roles | Data rows (seeded defaults: super_admin, branch_admin, teacher, accountant, receptionist, parent, student) |
| Permissions | Dot-separated codes (`students.read`, `fees.collect`, …) |
| Mapping | Role ↔ Permission join; users may hold roles with optional branch scope |
| Checks | Always by permission code — not hardcoded role name strings in business logic |

Parents/students are further scoped to linked/own records in services (not only by menu).

---

## Branch isolation

| Layer | Role |
|-------|------|
| API (primary) | `BranchGuard` + service `WHERE branchId = …` |
| Database (defense) | Row Level Security policies on branch-scoped tables |
| Frontend | Hides out-of-scope UI only |

Super Admin may select one, many, or all branches via an explicit scope; branch staff cannot.

---

## Transport, secrets, audit

| Control | Practice |
|---------|----------|
| In transit | HTTPS / TLS 1.2+ in production |
| At rest | Managed PostgreSQL encryption |
| Secrets | Service role key and DB URL only on the API; never shipped to the browser |
| Audit | Critical mutations logged (user, action, entity, before/after, time, IP); logs are not edited in normal operation |
| Sessions | Device/session tracking; revoke via auth admin API + app session records |

---

## What this is not

- The browser is never trusted as the sole authorization check.
- Sharing one staff password across the office defeats individual accountability — the product is designed for **per-user** accounts.
- Demo passwords and MFA skip flags are for presentations only; production uses real MFA and unique credentials.

---

## Related

- Live proof script: [rise-shine-security-demo-script.md](rise-shine-security-demo-script.md)
- Demo accounts: [demo-seed.md](demo-seed.md)
