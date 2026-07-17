# How to Update Delivery Progress

Manual markdown tracking for **feature-details delivery scope**. Same status vocabulary as the Phase 1–3 tracker.

**Source of truth (product):** [docs/feature-details.md](../../docs/feature-details.md)  
**Parent conventions:** [progress/HOW-TO-UPDATE.md](../HOW-TO-UPDATE.md)

## Status values

| Status | When to use |
|--------|-------------|
| `not_started` | No meaningful implementation |
| `partial` | Some layers done (e.g. core exists; delivery gap remains) |
| `in_progress` | Actively being built this sprint |
| `done` | Meets delivery scope for this feature |
| `deferred` | Explicitly out of current delivery phases (e.g. §21 Future AI Suite) |

## Layer columns (engineering modules)

| Column | Means |
|--------|-------|
| DB | Prisma model exists + migrations applied |
| API | NestJS endpoints implemented |
| Web | Next.js pages/components implemented |
| Tests | Unit or e2e tests exist |

Use `—` when a layer does not apply.

## Update workflow

1. **Ship a feature** → edit the relevant file in [`modules/`](modules/).
2. **Update feature rows** — set DB/API/Web/Tests and Status per row.
3. **Update overall status** at the top of the module file.
4. **Update linked section** in [`sections/`](sections/) acceptance rows.
5. **Update [`README.md`](README.md)** rollup tables and "Last updated" date.
6. Set **Last updated** on every file you touch.

## Definition of done

For user-facing features, mark `done` only when **DB + API + Web** are complete. Tests are optional unless explicitly required for the phase.

## Do not

- Edit [docs/feature-details.md](../../docs/feature-details.md) commercial/roadmap wording from this folder alone.
- Mark a module `done` because only the Prisma schema exists.
- Confuse this tracker with Phase 1–3 files under [`progress/modules/`](../modules/) — those remain the historical ERP build archive.
- Put §21 Future AI Academic Suite into Phase 4–7; keep it `deferred`.

## Which file to update?

| You changed… | Update… |
|--------------|---------|
| NestJS module / API route for a delivery gap | `progress/delivery/modules/{module}.md` |
| Next.js page or component | Same delivery module file (Web column) |
| Prisma schema for a new delivery domain | Delivery module file |
| Product bullet from feature-details | Delivery module + `sections/{NN}-*.md` |
| Phase completion shift | `progress/delivery/README.md` rollup |
