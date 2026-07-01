# API Performance Tracking

## Baseline (pre-optimization)

Captured: 2026-07-01 via `node scripts/api-benchmark.mjs` (10 runs per endpoint, p50/p95 in ms).

| Endpoint | p50 (ms) | p95 (ms) |
|----------|----------|----------|
| `GET /auth/me` | 3691 | 4583 |
| `GET /reports/overview` | 2767 | 4745 |
| `GET /analytics/dashboard` | 3690 | 4383 |
| `GET /students?limit=5` | 2552 | 3353 |
| `GET /attendance/sheet` | 2586 | 3414 |

**Target:** dashboard hot paths p50 < 200ms at demo scale.

## Post-optimization (note)

Post-run captured while `npm run dev` was still serving a stale build (compile errors for `jose` / old `prisma.$use`). **Restart the API** (`npm run dev` or `node apps/api/dist/main.js`) before re-benchmarking.

| Endpoint | p50 (ms) | p95 (ms) | Notes |
|----------|----------|----------|-------|
| `GET /dashboard/summary` | — | — | 404 until API restart (new route) |

Re-run: `node scripts/api-benchmark.mjs`

### Recommended env for max auth gain

Add to `apps/api/.env` (Supabase Dashboard → Project Settings → API → JWT Secret):

```
SUPABASE_JWT_SECRET="<your-jwt-secret>"
```

This enables local JWT verification and avoids per-request `getUser()` network calls.

## Changes implemented

- **Wave 1:** Composite DB indexes, collapsed fee/overview SQL, attendance `groupBy`, `select` projections, lookup cache, gzip compression
- **Wave 2:** `AuthCacheService` (60s TTL), `JwtVerifyService` (local JWT or cached `getUser`), slim `/auth/me`, global `GuardsModule`
- **Wave 3:** SQL aggregation for attendance trends, batch rankings query, `getWeakSubjects` via `groupBy` + `having`
- **Wave 4:** TTL cache for settings, branches, dashboard KPIs; `Cache-Control` on public settings routes
- **Wave 5:** `GET /api/v1/dashboard/summary`, `GET /students/:id?include=subjects`
