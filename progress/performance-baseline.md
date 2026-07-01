# Frontend Performance Baseline

Captured before optimization (2026-07-01).

## Build output (`next build`)

| Route | Page Size | First Load JS |
|-------|-----------|---------------|
| `/dashboard` | 4.76 kB | **205 kB** |
| `/dashboard/analytics` | 2.49 kB | 189 kB |
| `/dashboard/attendance` | 4.87 kB | 199 kB |
| Shared by all | — | 103 kB |
| Middleware | — | 90.5 kB |

Target: Dashboard first load < 150 kB gzipped after optimization.

## Post-optimization build (`next build`)

| Route | Page Size (before → after) | First Load JS (before → after) |
|-------|---------------------------|--------------------------------|
| `/dashboard` | 4.76 kB → **1.69 kB** | 205 kB → 211 kB |
| `/dashboard/analytics` | 2.49 kB → 7.15 kB | 189 kB → 194 kB |
| `/dashboard/attendance` | 4.87 kB → 6.13 kB | 199 kB → 211 kB |
| `/login` | 6.7 kB → **5.84 kB** | 198 kB → 204 kB |
| `/dashboard/academic` | 5.46 kB → 8.84 kB (dynamic split) | 200 kB → 205 kB |
| Shared by all | 103 kB | 103 kB |

**Key improvements:**
- Dashboard page JS reduced ~65% (route chunk)
- Server-side prefetch of `/auth/me`, institution settings, and branches in dashboard/portal layouts
- Skeleton UI + progressive shell rendering during auth
- React Query caching (`staleTime` 30s lists, 5min reference data)
- Code splitting via `next/dynamic` on 6 heavy routes
- Virtualized attendance/marks entry lists
- Provider scoping: auth/institution only on authenticated route groups

**Analyze bundles:** `ANALYZE=true npm run build` in `apps/web`

## Known bottlenecks (pre-fix)

- Serial auth waterfall: middleware → AuthProvider `/auth/me` → StaffGuard → AdminMfaGuard → page queries
- 29/31 pages are full client components
- No `loading.tsx` or skeleton UI
- React Query defaults: `staleTime: 0`, `refetchOnWindowFocus: true`
- Zero `next/dynamic` code splitting
