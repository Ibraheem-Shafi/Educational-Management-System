# E2E Manual Testing Guide (Browser + DevTools MCP)

Standing playbook for end-to-end manual testing of EIMS (Rekhta Academy demo). Use this with an agent or human tester. **Do not fix bugs during a run** — only record them.

## Related files

| File | Role |
|------|------|
| [e2e-test-cases.md](e2e-test-cases.md) | **Single** master catalog of all test cases. Append new cases here; never split by run. |
| [e2e-bugs-NN.md](e2e-bugs-01.md) | Per-run findings. This run: `e2e-bugs-01.md`. Next: `02`, `03`, … |
| [demo-seed.md](demo-seed.md) | Demo credentials and seed expectations |
| [ui-ux-page-inventory.md](ui-ux-page-inventory.md) | Page inventory and role matrix |

## Environment

| Item | Value |
|------|-------|
| Web | `http://localhost:3000` |
| API | `http://localhost:3001/api/v1` |
| Swagger (dev) | `http://localhost:3001/api/docs` |
| Start | `npm run dev` (from monorepo root) |
| Seed | `npm run db:seed:all` then `npm run db:seed:verify` |
| Seed version | `rekhta-v1.1` |

### MFA for local demos

Set both:

- `NEXT_PUBLIC_SKIP_ADMIN_MFA=1` in `apps/web/.env.local`
- `SKIP_ADMIN_MFA=1` in `apps/api/.env`

### Demo accounts

Password for all: see [demo-seed.md](demo-seed.md) (`Rekhta@2026!`).

| Role | Email | Landing |
|------|-------|---------|
| Super Admin | `admin@rekhta.edu.pk` | `/dashboard` |
| Branch Admin MAIN | `branchadmin@rekhta.edu.pk` | `/dashboard` |
| Branch Admin LAHORE | `lahore.admin@rekhta.edu.pk` | `/dashboard` |
| Teacher | `ahmed.teacher@rekhta.edu.pk` | `/dashboard` |
| Accountant | `fees@rekhta.edu.pk` | `/dashboard` |
| Receptionist | `reception@rekhta.edu.pk` | `/dashboard` |
| Parent | `rashid.ahmad@rekhta.edu.pk` | `/portal/parent` |
| Student | `ali.khan@rekhta.edu.pk` | `/portal/student` |

## How to start a new run

1. Confirm web + API are up (`/login` and `/api/v1/health`).
2. Open [e2e-test-cases.md](e2e-test-cases.md). Reset or add a dated **Run results** subsection for statuses; **keep all case definitions in that one file**.
3. Pick the next bug file:
   - List `docs/e2e-bugs-*.md`
   - Take highest `NN`, create `e2e-bugs-(NN+1).md` (zero-padded 2 digits)
   - First run → `e2e-bugs-01.md`
4. Bug IDs inside that file: `BUG-NN-001`, `BUG-NN-002`, …
5. Execute cases with Browser + Chrome DevTools MCP (below).
6. Update Pass/Fail/Blocked/Limitation on each case; append failures to the run’s bug file.
7. Update the **Latest run summary** section at the bottom of this guide.

## MCP workflow

**Primary:** Chrome DevTools MCP (`user-chrome-devtools`) — navigate, snapshot, fill, click, resize, console, network.

**Secondary:** Browser MCP (`user-browsermcp` or `cursor-ide-browser`) if DevTools tab fails.

### Per-page checklist

1. Navigate to URL; wait for content.
2. Take accessibility snapshot; note broken/missing controls.
3. `list_console_messages` — record errors/warnings that indicate app bugs.
4. `list_network_requests` — flag 4xx/5xx, empty unexpected payloads, hung calls.
5. Verify data against seed expectations (counts, names, PKR, branch scope).
6. Exercise primary actions (filter, open detail, create with `E2E-TEST-*` prefix when writing).
7. Resize to ~375px and ~1280px on high-traffic pages.
8. Mark TC status; if Fail/Limitation → write bug entry with manual repro steps.

### Write-action rules

- Prefer create/edit with names/emails like `E2E-TEST-*`.
- Do not hard-delete seed demo records; prefer reversible edits.
- Do not fix product code during the run.

## Severity rubric

| Severity | Meaning |
|----------|---------|
| Critical | Login broken, data loss, wrong portal access, crash on core path |
| High | Feature unusable, wrong/missing real data on primary screens, authz hole |
| Medium | Partial failure, UI broken but workaround exists, inconsistent cross-module link |
| Low | Cosmetic, minor copy, small responsive glitch |
| Limitation | Intentional stub/gap (e.g. AI empty in demo) — still document |

## Bug entry template

```markdown
### BUG-NN-XXX — Title
- Severity: Critical | High | Medium | Low | Limitation
- Module / Route:
- Role / Account:
- Environment: localhost:3000, YYYY-MM-DD
- Steps to reproduce:
  1. …
  2. …
- Expected:
- Actual:
- Evidence: console / network / UI notes
- Related TC IDs:
```

## Seed data spot-checks

| Check | Expectation |
|-------|-------------|
| Students | ≥ 45 (demo ~49) |
| Parent Rashid | Children: Ali Khan + Zainab Hussain |
| Student Ali | `ali.khan@rekhta.edu.pk`, MDCAT Morning Batch A, MAIN |
| Branches | Islamabad MAIN + Lahore LAHORE |
| Fees | PKR; sibling discount / late fee configured |
| Notices | ≥ 5 |
| Learning | Published materials for MAIN first batch |
| AI modules | Often empty/stubbed in demo — log as Limitation if incomplete |

## Latest run summary

| Field | Value |
|-------|-------|
| Run ID | 01 |
| Date | 2026-07-11 |
| Bug file | [e2e-bugs-01.md](e2e-bugs-01.md) |
| Seed | **rekhta-v1** (verify **failed**; docs expect v1.1 — incomplete transactional data) |
| Base URL | http://localhost:3000 |
| Cases marked | ~217 statuses updated in [e2e-test-cases.md](e2e-test-cases.md) |
| Bugs logged | 21 (`BUG-01-001` … `BUG-01-021`) — 1 Critical, 6 High, 7 Medium, 4 Low, 3 Limitation |
| Top blockers | Learning page crash; Learning permission not seeded; incomplete demo seed (0 fees/assessments/notices); Lahore admin dashboard wrong branch; parent leave submit stuck |
| Next bug file | `e2e-bugs-02.md` |

### Run 01 highlights

- **Working well:** Auth login/logout all major roles; Students/Parents lists with real seeded people; RBAC sidebar for Teacher/Accountant; Parent children Ali+Zainab; Student identity MDCAT Morning Batch A; Notice create draft; Branches MAIN+LAHORE; Settings branding/flags; mobile portal bottom nav.
- **Do before run 02:** `npm run db:seed:all` + `npm run db:seed:verify` until green; then re-test Fees/Assessments/Notices/Timetable/Documents/Learning/Attendance density.

---

## Agent prompt (reuse)

```
Run E2E manual testing per docs/e2e-testing-guide.md.
- Use existing cases in docs/e2e-test-cases.md (append new cases if needed; keep one file).
- Create the next docs/e2e-bugs-NN.md (do not overwrite prior runs).
- Test all portals with demo-seed credentials via Chrome DevTools MCP + Browser MCP.
- Do not fix bugs — only document with manual repro steps.
- Update Pass/Fail statuses and the Latest run summary in the guide.
```
