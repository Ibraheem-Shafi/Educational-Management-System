# UI color overhaul tracker

Working checklist for the lively palette (teal, orange, yellow, green, coral, purple, navy). This is the status board — do **not** use [ui-ux-page-inventory.md](./ui-ux-page-inventory.md) for color-pass status.

**Related:** [design-system-handoff.md](./design-system-handoff.md) · hex gate: `node apps/web/scripts/audit-ui-hex.mjs`

## Definition of done (per surface)

- Uses palette tokens (no `#00A5FF` / `#CEF0FF` / `#003E73` / purple auth hex / `--primary-base`)
- Visual check: sidebar navy, accents from the 7-color palette, contrast readable
- Smoke: at least one primary action still works
- No new copy, fields, widgets, or API calls

## Status vocabulary

`not_started` · `in_progress` · `token_inherited` · `hex_swept` · `visual_qa` · `done` · `excluded`

---

## Layer A — Tokens

| Token | Role | Status |
|-------|------|--------|
| `--palette-navy` / `--midnight-blue-950` | Sidebar, CTAs | done |
| `--palette-teal` | Active nav, primary accent | done |
| `--palette-orange` | Students, secondary | done |
| `--palette-yellow` | Staff, pending | done |
| `--palette-green` | Success, classes | done |
| `--palette-coral` | Alerts, parents | done |
| `--palette-purple` | Users, reports | done |
| `--palette-*-soft` | Icon tiles, donut-adjacent fills | done |
| `--sidebar-bg` / `--sidebar-active` / `--sidebar-text` | Dark navy chrome | done |
| `--chart-stop-1` … `--chart-stop-6` | Multi-color line graph | done |
| `--institution-primary` default `#0d9b8a` | White-label buttons/focus | done |
| `@theme inline` mappings | Tailwind utilities | done |
| `apps/web/src/lib/ui-palette.ts` | Semantic label/href/activity map | done |

---

## Layer B — Shared chrome

| Surface | File | Status | Notes |
|---------|------|--------|-------|
| Dashboard sidebar | `sidebar.tsx`, `sidebar-nav.tsx` | done | Navy bg, teal active, cycled icons |
| Portal sidebar | `portal-sidebar.tsx`, `portal-sidebar-nav.tsx` | done | Same chrome |
| Mobile nav sheets | `mobile-nav-sheet.tsx`, `portal-mobile-nav-sheet.tsx` | done | Navy sheet |
| Header | `dashboard-header.tsx` | done | Stays white; no dark-mode toggle added |
| PageHeader CTA | `page-header.tsx` | done | Navy (`--midnight-blue-950`) |
| Status / trend badges | `status-badge.tsx`, `trend-badge.tsx` | done | Green / yellow / coral |
| Tables | `data-table-styles.ts` | done | Teal-soft headers, teal hover |
| Pagination | `pagination-bar.tsx` | done | Active page uses teal-soft |
| Selects | `select-dropdown.tsx` | done | Open/selected use teal-soft, not gray |
| Tabs | `tabs.tsx` | done | Navy-soft track, white pill, teal active text |
| Empty state | `empty-state.tsx` | done | Icon well + navy-soft background |
| Dialogs | `dialog.tsx`, `confirm-dialog.tsx` | done | 4px teal header strip; coral when destructive |
| Skeletons | `skeleton.tsx`, `data-table-skeleton.tsx` | done | Navy-soft / teal-soft instead of muted gray |
| Content panels | `content-panel.tsx` | done | Navy-soft header + teal left accent |
| Row tints | `status-badge.tsx` | done | `statusRowClass`, `metricRowClass`, `categoryRowClass`, `seedRowClass`, `riskRowClass` |
| Auth shell | `auth-shell.tsx` + login/forgot links | done | Navy + teal, not purple |
| Coming soon | `coming-soon-banner.tsx` | done | Yellow-soft + yellow stripe |

---

## Layer C — Dashboard widgets

| Widget | File | Status | Notes |
|--------|------|--------|-------|
| KPI cards | `main-stats-section.tsx` | done | `filled` is the default on dashboard **and** list pages |
| Today's Attendance | `today-attendance-card.tsx` | done | Teal / orange / purple rings |
| Monthly Revenue graph | `monthly-revenue-card.tsx`, `palette-chart.tsx` | done | Multi-stop gradient + cycling dots; one series |
| Trend area (shared) | `trend-area-chart.tsx` | done | Same recipe |
| Branch Performance | `branch-performance-card.tsx` | done | Row dots + bar accents |
| Quick Actions | `quick-actions-card.tsx` | done | Solid palette tiles; same hrefs |
| Recent Activities | `recent-activities-card.tsx` | done | Kind → palette |

**Explicitly not built:** mockup footer stats bar (new metrics), dark-mode toggle.

---

## Layer D — Routes

Color pass: `token_inherited` means the page picks up sidebar + tables + badges + (if present) `MainStatsSection` accent / shared charts. `hex_swept` means leftover chart/status hex on that page was replaced.

### Auth

| URL | Shared | Color pass | Status |
|-----|--------|------------|--------|
| `/login` | AuthShell | hex_swept | done |
| `/forgot-password` | AuthShell | hex_swept | done |
| `/accept-invite` | AuthShell | token_inherited | done |

### Public

| URL | Shared | Color pass | Status |
|-----|--------|------------|--------|
| `/apply` | midnight CTAs | token_inherited | done |

### Staff dashboard

| URL | Shared | Color pass | Status |
|-----|--------|------------|--------|
| `/dashboard` | filled KPIs + all widgets | hex_swept | done |
| `/dashboard/profile` | seed-stripe sessions | hex_swept | done |
| `/dashboard/students` | MainStats accent, tables | hex_swept | done |
| `/dashboard/students/new` | forms | token_inherited | token_inherited |
| `/dashboard/students/[id]` | status/category/seed tables | hex_swept | done |
| `/dashboard/students/[id]/edit` | forms | token_inherited | token_inherited |
| `/dashboard/parents` | MainStats accent | token_inherited | token_inherited |
| `/dashboard/parents/[id]` | seed-stripe linked students | token_inherited | done |
| `/dashboard/users` | MainStats accent | hex_swept | token_inherited |
| `/dashboard/users/[id]` | contracts/reviews/files row tints | hex_swept | done |
| `/dashboard/users/invite` | | token_inherited | token_inherited |
| `/dashboard/front-office` | Tabs + row tints | token_inherited | token_inherited |
| `/dashboard/academic` | MainStats, sessions status, seed lists | hex_swept | done |
| `/dashboard/academic/programs/new` | ContentPanel left accent | token_inherited | done |
| `/dashboard/academic/programs/[id]/edit` | ContentPanel left accent | token_inherited | done |
| `/dashboard/assessments` | MainStats accent | token_inherited | token_inherited |
| `/dashboard/assessments/[id]/marks` | | token_inherited | token_inherited |
| `/dashboard/timetable` | slot cards + today stripe | hex_swept | done |
| `/dashboard/learning` | MainStats accent | token_inherited | token_inherited |
| `/dashboard/learning/new` | | token_inherited | token_inherited |
| `/dashboard/learning/[id]/edit` | | token_inherited | token_inherited |
| `/dashboard/attendance` | MainStats, navy-soft date headers | hex_swept | done |
| `/dashboard/leave-requests` | | token_inherited | token_inherited |
| `/dashboard/fees` | MainStats, donuts, trend chart | hex_swept | done |
| `/dashboard/accounting` | Tabs, category/seed tables | token_inherited | done |
| `/dashboard/payroll` | Tabs, seed line items | token_inherited | done |
| `/dashboard/library` | Tabs (no client stats endpoint wired) | token_inherited | token_inherited |
| `/dashboard/transport` | Tabs, direction category rows | token_inherited | done |
| `/dashboard/biometric` | Tabs, mapping category rows | hex_swept | done |
| `/dashboard/documents` | category rows | token_inherited | done |
| `/dashboard/certificates` | seed-stripe + avatars | token_inherited | done |
| `/dashboard/analytics` | metric bands on 3 tables | hex_swept | done |
| `/dashboard/reports` | correlation metric bands | hex_swept | done |
| `/dashboard/ai-insights` | risk row tints | hex_swept | done |
| `/dashboard/ai-attendance` | OCR suggestion status rows | hex_swept | done |
| `/dashboard/notices` | MainStats accent | token_inherited | token_inherited |
| `/dashboard/communications` | MainStats, donuts | hex_swept | done |
| `/dashboard/branches` | MainStats accent | hex_swept | token_inherited |
| `/dashboard/branches/new` | | token_inherited | token_inherited |
| `/dashboard/branches/[id]` | activity accents | hex_swept | token_inherited |
| `/dashboard/audit` | seed-stripe + avatars | hex_swept | done |
| `/dashboard/settings` | ContentPanel left accent | hex_swept | done |
| `/dashboard/form-fields` | required/optional row tints | token_inherited | done |

### Portal

| URL | Shared | Color pass | Status |
|-----|--------|------------|--------|
| `/portal` | redirect | token_inherited | token_inherited |
| `/portal/parent` | accent KPIs, donuts, chart | hex_swept | done |
| `/portal/parent/children` | | token_inherited | token_inherited |
| `/portal/parent/children/[id]` | donuts, chart | hex_swept | done |
| `/portal/parent/attendance` | donuts | hex_swept | done |
| `/portal/parent/assessments` | metric bands | token_inherited | done |
| `/portal/parent/fees` | pay CTA | hex_swept | token_inherited |
| `/portal/parent/fees/pay/[paymentId]` | pay CTA | hex_swept | token_inherited |
| `/portal/parent/timetable` | seed rows + today slot fills | token_inherited | done |
| `/portal/parent/notices` | | token_inherited | token_inherited |
| `/portal/parent/learning` | type category rows | token_inherited | done |
| `/portal/parent/learning/[id]` | | token_inherited | token_inherited |
| `/portal/parent/documents` | category rows | token_inherited | done |
| `/portal/parent/calendar` | | token_inherited | token_inherited |
| `/portal/parent/leave` | | token_inherited | token_inherited |
| `/portal/parent/profile` | | token_inherited | token_inherited |
| `/portal/student` | accent KPIs, donuts, chart | hex_swept | done |
| `/portal/student/attendance` | donuts | hex_swept | done |
| `/portal/student/assessments` | metric bands | token_inherited | done |
| `/portal/student/fees` | | hex_swept | token_inherited |
| `/portal/student/fees/pay/[paymentId]` | | hex_swept | token_inherited |
| `/portal/student/timetable` | seed rows + today slot fills | token_inherited | done |
| `/portal/student/notices` | | token_inherited | token_inherited |
| `/portal/student/learning` | type category rows | token_inherited | done |
| `/portal/student/learning/[id]` | | token_inherited | token_inherited |
| `/portal/student/documents` | category rows | token_inherited | done |
| `/portal/student/calendar` | | token_inherited | token_inherited |
| `/portal/student/insights` | | token_inherited | token_inherited |
| `/portal/student/profile` | | token_inherited | token_inherited |
| `/portal/fees/pay/[paymentId]` | shared pay | hex_swept | token_inherited |

### Print (excluded)

| URL | Status | Notes |
|-----|--------|-------|
| `/print/attendance-sheets` | excluded | Keep high-contrast / ink-safe |
| `/print/certificates/[issueId]` | excluded | |
| `/print/challans/[challanId]` | excluded | |
| `/print/fee-invoices/[invoiceId]` | excluded | |
| `/print/fee-receipts/[paymentId]` | excluded | |
| `/print/id-cards/[studentId]` | excluded | |
| `/print/report-cards/[studentId]` | excluded | |
| `/print/roll-slips/[studentId]` | excluded | |
| `/print/rosters` | excluded | |
| `/print/salary-slips/[lineId]` | excluded | |
| `/print/accounting-vouchers/[voucherId]` | excluded | |

`print-shell.tsx` screen button uses `--institution-primary` (token fix only).

### Mobile Expo

| Surface | Status |
|---------|--------|
| `apps/mobile` | excluded (Phase 7 deferred) |

---

## Layer E — Hex audit

| Check | Command | Status |
|-------|---------|--------|
| Forbidden leftover hex | `node apps/web/scripts/audit-ui-hex.mjs` | cleared |

Forbidden: `#00A5FF` `#CEF0FF` `#003E73` `#3B1FA8` `#5B2FE0` `#7C4DFF` `#6B4EFF` `#2563EB` `#38C793` `--primary-base`

Allowed leftovers: print layouts, box-shadow `rgba()`, true-neutral borders already on tokens (`#E2E4E9` via CSS var).

---

## Layer F — Every-page lively pass (2026-09-01)

Shared chrome first, then remaining gray tables and non-table sections. Semantic tints only (status / metric / category / seed stripe) — no random rainbow rows. Print and Expo still excluded. No new copy or APIs; Library KPIs skipped because the page does not already fetch stats.

| Surface | Status |
|---------|--------|
| Tabs / EmptyState / dialog strip / skeletons / pagination / selects | done |
| Remaining status, metric, category tables | done |
| Seed-stripe tables (audit, certificates, academic lists, budgets, profile, portal timetable, …) | done |
| Timetable slot cards, attendance grid chrome, settings left accent, coming-soon banner | done |

---

## Functionality smoke (do not skip)

- Dashboard home loads; KPI numbers unchanged; graph tooltip still shows Revenue + currency
- Quick action links unchanged
- Students list: search/filter/open student still works
- Login still submits
- White-label: Settings `primaryColor` still sets `--institution-primary`
