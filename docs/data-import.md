# Dashboard data import

UI: **Data import** (`/dashboard/imports`). Pipelines include Students & parents, Fee register, Academic, Staff, Timetable, Notices.

## Database connection (required for speed and stability)

The import **worker** uses `DIRECT_URL` when set, otherwise falls back to `DATABASE_URL`.

| Variable | Use |
|---|---|
| `DIRECT_URL` | **Preferred** — Supabase **session** pooler (`:5432`) or direct `db.*.supabase.co` |
| `DATABASE_URL` | Transaction pooler (`:6543`) — fine for short API requests; **drops** long import runs |

Set in `apps/api/.env`:

```env
DIRECT_URL="postgresql://...@aws-0-....pooler.supabase.com:5432/postgres?pgbouncer=true"
```

(or the non-pooler `db.<project>.supabase.co:5432` URL from the Supabase dashboard).

Without `DIRECT_URL`, large imports are slower and more likely to fail with `Can't reach database server …:6543` / `P1001` / `P1017`.

## Performance notes

- Rows are applied in chunks of **15**, with mini-batches of **4** concurrent writes. Progress `%` is written after every mini-batch so the UI advances smoothly.
- Program/batch and parent lookups are cached per job (repeated class names / fathers do not re-query).
- Row errors are inserted with `createMany` once per chunk.
- Re-running an import is upsert-safe on `branchId` + `admissionNumber` (students).

## Resume interrupted jobs

If a job is **failed** or **cancelled** after some progress (`processedRows > 0`):

1. Open the job detail page.
2. Click **Resume from N/T** — the worker skips the first `N` sheet data rows and continues.
3. Student upserts remain idempotent if counters slightly lag behind writes.

Fresh **Start import** (from the wizard dry-run) always resets counters to zero.

## Scope

- **Super Admin** sees import jobs for every campus.
- A campus admin sees jobs for the campus they are scoped to.
- Select the target campus before starting a new import.
- Staff rows can include an email, a phone number, or both. A row needs at least one of those.
