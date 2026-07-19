# How to Update Progress

Manual markdown tracking for the EIMS project. No automation — update files by hand when features ship.

For full agent context (architecture, stack, naming, and this tracker), see [docs/engineering-handoff.md](../docs/engineering-handoff.md) §9.

## Status values

| Status | When to use |
|--------|-------------|
| `not_started` | No meaningful implementation |
| `partial` | Some layers done (e.g. DB only, API without UI) |
| `in_progress` | Actively being built this sprint |
| `done` | Meets phase scope for this feature |
| `deferred` | Phase 2/3 — not in current sprint |

## Layer columns

| Column | Means |
|--------|-------|
| DB | Prisma model exists + migrations applied |
| API | NestJS endpoints implemented |
| Web | Next.js pages/components implemented |
| Tests | Unit or e2e tests exist |

Use `—` when a layer does not apply (e.g. health check has no DB).

## Update workflow

1. **Ship a feature** → edit the relevant file in [`modules/`](modules/).
2. **Update feature rows** — set DB/API/Web/Tests and Status per row.
3. **Update overall status** at the top of the module file.
4. **Update linked requirements** in [`requirements/`](requirements/) if client acceptance items are satisfied.
5. **Update [`README.md`](README.md)** rollup tables and "Last updated" date.
6. Set **Last updated** on every file you touch.

## Definition of done (MVP)

For user-facing features, mark `done` only when **DB + API + Web** are complete. Tests are optional for Phase 1 MVP unless explicitly required.

Infrastructure-only items (guards, seed scripts) can be `done` without Web.

## Do not

- Edit [`docs/ERP-Requirements.docx`](../docs/ERP-Requirements.docx) — it is the signed client brief; progress folder is the living tracker.
- Mark a module `done` because only the Prisma schema exists.
- Edit the plan file in `.cursor/plans/`.

## Which file to update?

| You changed… | Update… |
|--------------|---------|
| NestJS module / API route | `progress/modules/{module}.md` |
| Next.js page or component | Same module file (Web column) |
| Prisma schema | Module file + possibly `infrastructure.md` |
| Client-visible capability | Module file + `requirements/{section}.md` |
| Phase completion shift | `progress/README.md` rollup |
