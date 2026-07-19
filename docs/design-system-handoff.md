# Design System Handoff

Agent-oriented visual recreation guide for the Educational Institution Management System web UI (`apps/web`). Use this doc to implement the **same look and feel** in another project.

Related docs (not substitutes for this file):

- [10-frontend-guidelines.md](./10-frontend-guidelines.md) — routing, auth, white-label wiring
- [ui-ux-page-inventory.md](./ui-ux-page-inventory.md) — page inventory and shared chrome list
- [14-white-label-config.md](./14-white-label-config.md) — institution branding config

**Scope:** Web ERP UI only. Light mode only. Do not use the auth/marketing purple shell on dashboard or portal pages.

---

## 1. Purpose and stack snapshot

### Goal

Recreate this ERP’s visual language: soft gray borders, white panels, Inter typography, midnight-blue primary CTAs, segmented tabs, native data tables, Recharts area charts, and KPI stat rows.

### Actual stack (installed)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS **v4** via `@import "tailwindcss"` — **no** `tailwind.config.ts` |
| Tokens | CSS variables in `apps/web/src/app/globals.css` + `@theme inline` |
| Primitives | shadcn-style: Radix Dialog/Slot + CVA + `cn()` (`clsx` + `tailwind-merge`) |
| Icons | `lucide-react` |
| Charts | `recharts` only |
| Toasts | `sonner` |

### Documented elsewhere but **not** used

Do not pull these in for visual parity:

- Tremor
- TanStack Table (tables are native `<table>` + shared class constants)
- react-hook-form (forms use local state + shared field classes)

### Exception: auth / marketing shell

`apps/web/src/components/auth/auth-shell.tsx` uses a separate purple palette (`#3B1FA8` → `#5B2FE0` → `#7C4DFF`, panel `#0B1024`, accent `#6B4EFF`). **Do not** apply this to ERP dashboard/portal pages.

---

## 2. Design tokens (source of truth)

**File:** `apps/web/src/app/globals.css`

### 2.1 CSS variables

```css
:root {
  --background: #ffffff;
  --foreground: #0f172a;
  --institution-primary: #2563eb;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --border: #e2e8f0;
  --radius: 0.5rem;

  /* Figma / ERP palette */
  --neutral-0: #ffffff;
  --neutral-50: #f7f9fb;
  --stroke-soft-200: #e2e4e9;
  --text-soft-400: #868c98;
  --text-main-900: #0a0d14;
  --text-sub-500: #525866;
  --icon-primary: #c3ccd4;
  --success-soft: #ecfdf3;
  --success-text: #16a34a;
  --error-soft: #fef2f2;
  --error-text: #dc2626;
  --midnight-blue-950: #01366c;
  --base-muted-foreground: #71717a;
  --base-foreground: #18181b;
  --base-input: #e4e4e7;
  --base-background: #ffffff;
  --green-light: #cbf5e5;
  --green-darker: #176448;
  --red-light: #f8c9d2;
  --red-darker: #710e21;
}
```

### 2.2 Tailwind v4 bridge (`@theme inline`)

Maps CSS vars to utilities such as `bg-background`, `text-muted-foreground`, `border-border`, `bg-neutral-0`, `border-stroke-soft-200`, `text-text-main-900`, `text-text-sub-500`, `text-text-soft-400`, `bg-midnight-blue-950`, `text-success-text`, etc.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--institution-primary);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-neutral-0: var(--neutral-0);
  --color-neutral-50: var(--neutral-50);
  --color-stroke-soft-200: var(--stroke-soft-200);
  --color-text-soft-400: var(--text-soft-400);
  --color-text-main-900: var(--text-main-900);
  --color-text-sub-500: var(--text-sub-500);
  --color-icon-primary: var(--icon-primary);
  --color-success-soft: var(--success-soft);
  --color-success-text: var(--success-text);
  --color-error-soft: var(--error-soft);
  --color-error-text: var(--error-text);
  --color-midnight-blue-950: var(--midnight-blue-950);
}
```

Usage styles you will see mixed in code:

- Tailwind alias: `bg-neutral-0`, `text-text-main-900`, `border-stroke-soft-200`
- Arbitrary var: `bg-[var(--midnight-blue-950)]`, `text-[var(--text-sub-500)]`

### 2.3 Dual brand rule (critical)

| Token | Default | Dynamic? | Use for |
|-------|---------|----------|---------|
| `--institution-primary` | `#2563eb` | Yes — set at runtime from institution settings | Focus rings, links, default `Button`, portal active accents |
| `--midnight-blue-950` | `#01366c` | No | Page-header primary CTAs, dialog submit buttons, print accents |

Runtime override (do not hardcode institution color in components):

```ts
document.documentElement.style.setProperty('--institution-primary', settings.primaryColor);
```

Source: `apps/web/src/providers/institution-provider.tsx`

### 2.4 Radii convention

| Surface | Radius |
|---------|--------|
| Buttons, inputs, search, select triggers, tabs track | `rounded-[10px]` |
| Cards, content panels, chart cards | `rounded-xl` (16px) or form sections `rounded-[16px]` |
| Dialogs | `rounded-[20px]` |
| Status / trend pills | `rounded-full` |
| Icon circles (page header) | `rounded-full` |
| shadcn Button default | `rounded-md` (legacy; prefer 10px for Figma CTAs) |

### 2.5 Shadows

| Context | Value |
|---------|-------|
| Modal / form fields | `shadow-[0px_1px_2px_rgba(228,229,231,0.24)]` |
| Secondary / soft elevation | `shadow-[0px_1px_2px_rgba(82,88,102,0.06)]` |
| Primary midnight CTA (when used) | `shadow-[0px_1px_2px_rgba(55,93,251,0.08)]` |
| Dialogs / menus | `shadow-lg` / `shadow-md` |
| Auth card (exception) | `shadow-[0_16px_48px_rgba(15,23,42,0.08)]` |

### 2.6 Scrollbars

Thin soft scrollbars app-wide:

```css
* {
  scrollbar-width: thin;
  scrollbar-color: var(--stroke-soft-200) transparent;
}
*::-webkit-scrollbar { width: 5px; height: 5px; }
*::-webkit-scrollbar-thumb {
  background-color: var(--stroke-soft-200);
  border-radius: 9999px;
}
```

### 2.7 Dark mode

**Not implemented.** White / `neutral-0` surfaces only.

---

## 3. Typography

### Font

- **Inter** via `next/font/google`, CSS variable `--font-inter` on `<html>`
- Body fallback in CSS is `system-ui`; shells/pages **opt in** with:

```txt
font-[family-name:var(--font-inter)]
```

Apply on dashboard `main`, sidebar, and page roots.

### Scale (exact class recipes)

| Role | Classes |
|------|---------|
| Page title (`h1`) | `text-lg font-medium leading-6 tracking-[-0.015em] text-[var(--text-main-900)]` |
| Section / panel / dialog title | `text-base font-medium leading-6 tracking-[-0.015em]` (or without tracking) `text-text-main-900` |
| Body / table cells / labels | `text-sm font-normal leading-5 tracking-[-0.006em]` |
| Secondary description | `text-sm ... text-[var(--text-sub-500)]` |
| Soft / placeholder | `text-[var(--text-soft-400)]` |
| Stat value (main KPIs) | `text-3xl font-semibold leading-9 text-[var(--base-foreground)]` |
| Stat value (card row) | `text-2xl font-semibold leading-8 tracking-[-0.02em] text-text-main-900` |
| Chart total | `text-xl font-semibold leading-7 tracking-[-0.02em]` |
| Sidebar section label | `text-xs font-medium uppercase tracking-[0.04em] text-text-soft-400` |
| Trend badge | `text-[11px] font-medium leading-3 tracking-[0.02em] uppercase` |

---

## 4. Layout chrome

### 4.1 Dashboard shell

```tsx
<div className="flex h-screen min-w-0 overflow-hidden">
  <Sidebar /> {/* hidden below lg; sticky h-screen */}
  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <DashboardHeader /> {/* mobile only */}
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-6 font-[family-name:var(--font-inter)] lg:p-6">
      {children}
    </main>
  </div>
</div>
```

### 4.2 Sidebar

| Property | Value |
|----------|-------|
| Surface | `border-r border-stroke-soft-200 bg-neutral-0` |
| Expanded width | `w-[clamp(220px,19vw,272px)]` |
| Collapsed width | `w-[clamp(56px,4.5vw,72px)]` |
| Nav link | `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-main-900` |
| Active | `bg-neutral-50` (+ chevron) |
| Hover | `hover:bg-neutral-50/60` |
| Separators | `h-px w-[80%] bg-stroke-soft-200` |

### 4.3 Page composition (canonical)

```tsx
<div className="space-y-6 font-[family-name:var(--font-inter)]">
  <PageHeader icon={Icon} title="..." description="..." actions={...} />
  {/* optional: Tabs + FilterBar */}
  <ContentPanel title="..." actions={...}>
    {/* filters, table, etc. */}
  </ContentPanel>
</div>
```

### 4.4 Page header

**File:** `apps/web/src/components/layout/page-header.tsx`

- Layout: `flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`
- Icon circle: `h-10 w-10 rounded-full border border-[var(--stroke-soft-200)] bg-neutral-0`
- Icon: `h-[18px] w-[18px]`, `strokeWidth={1.5}`, `text-[var(--text-main-900)]`

**Primary CTA (use this, not default Button, for page actions):**

```ts
pageHeaderActionClassName =
  'inline-flex h-10 items-center justify-center gap-1 rounded-[10px] p-2.5 bg-[var(--midnight-blue-950)] text-white text-sm font-medium leading-5 tracking-[-0.006em] hover:opacity-90';
```

Plus icon: Lucide `Plus`, `h-4 w-4 text-white`, `strokeWidth={2.25}`.

### 4.5 Content panel / card shell

**ContentPanel** (`content-panel.tsx`):

```txt
overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0
```

Header (optional): `border-b border-stroke-soft-200 px-5 py-4`, title `text-base font-medium leading-6 text-text-main-900`.

**Dashboard card shell** (same visual language):

```tsx
<div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0">
  <div className="border-b border-stroke-soft-200 px-5 py-4">
    <h3 className="text-base font-medium leading-6 text-text-main-900">Title</h3>
    <p className="text-sm font-normal leading-5 text-text-sub-500">Subtitle</p>
  </div>
  <div className="px-5 py-4">{children}</div>
</div>
```

Chart cards often use a single `p-5` wrapper instead of a split header.

### 4.6 Outline secondary action

```txt
h-9 rounded-[10px] border border-stroke-soft-200 bg-white px-3 text-sm font-medium hover:bg-neutral-50
```

---

## 5. Tables

**No TanStack Table.** Use native `<table>` + shared classes.

**File:** `apps/web/src/components/layout/data-table-styles.ts`

```ts
export const dataTableThClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';

export const dataTableTdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

export const dataTableWrapperClass = 'overflow-x-auto bg-white';
export const dataTableClass = 'w-full min-w-[960px] border-separate border-spacing-0';
export const dataTableRowHoverClass = 'hover:bg-[var(--neutral-50)]/50';
```

### Canonical structure

```tsx
<ContentPanel title={`Catalog (${rows.length})`} actions={...}>
  <div className="border-b border-stroke-soft-200 px-5 py-4">
    <FilterBar>{/* SearchInput + SelectDropdown */}</FilterBar>
  </div>
  <div className={cn(dataTableWrapperClass, 'border-0')}>
    <table className={dataTableClass}>
      <thead>
        <tr>
          <th className={dataTableThClass}>Title</th>
          {/* ... */}
        </tr>
      </thead>
      <tbody>
        {isLoading && <DataTableSkeletonRows columns={6} />}
        {!isLoading && rows.length === 0 ? (
          <tr>
            <td colSpan={6} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
              No books in catalog
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className={dataTableRowHoverClass}>
              <td className={dataTableTdClass}>...</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
  <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
</ContentPanel>
```

Optional last-row border removal: `tbody className="[&>tr:last-child>td]:border-b-0"`.

### Skeleton rows

**File:** `data-table-skeleton.tsx` — default 8 rows; each cell:

```tsx
<div className="h-4 animate-pulse rounded bg-[var(--neutral-50)]" />
```

### Pagination bar

**File:** `pagination-bar.tsx`

- Container: `flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`
- Label: `text-sm ... text-[var(--text-sub-500)]` → `Page X of Y`
- Page buttons: `h-8 w-8 rounded-md border border-[var(--stroke-soft-200)]`
  - Active: `bg-[#F8F8F8] text-[var(--text-main-900)]`
  - Inactive: `bg-white text-[var(--text-sub-500)]`
- Chevrons: borderless, `hover:bg-[var(--neutral-50)]`

### Row actions

Menu: portaled `rounded-[10px] border ... bg-white py-1 shadow-md`.  
Item: `px-3 py-2 text-sm hover:bg-[var(--neutral-50)]`.  
Inline icons: `rounded p-1.5 text-[var(--text-sub-500)] hover:bg-neutral-50`.

### Alternate: avatar list (`PanelTable`)

Header: uppercase `text-xs font-medium tracking-[0.04em] text-text-soft-400`, `bg-neutral-50`.  
Row dividers: centered `h-px w-[80%] bg-stroke-soft-200`.

### Progress bar in table cells

Track: `h-1.5 rounded-full bg-[#E2E4E9]`  
Fill: `bg-[#003E73]`

---

## 6. Stats, KPIs, and badges

### 6.1 Main stats section (dashed borders)

**File:** `main-stats-section.tsx`

- Outer: `py-[11px]` with dashed top/bottom borders via:

```js
backgroundImage: [
  'repeating-linear-gradient(to right, #E2E4E9 0 12px, transparent 12px 24px)',
  'repeating-linear-gradient(to right, #E2E4E9 0 12px, transparent 12px 24px)',
].join(', ')
// backgroundPosition: 'top left, bottom left'; backgroundRepeat: 'repeat-x'; backgroundSize: '100% 1px'
```

- Layout: `flex flex-col lg:flex-row lg:items-stretch lg:gap-2`
- Label: `text-sm font-medium leading-5 text-[var(--base-muted-foreground)]`
- Value: `text-3xl font-semibold leading-9 text-[var(--base-foreground)]`
- Desktop divider: `h-[80%] min-h-[48px] w-px bg-[#E2E4E9]`
- Mobile divider: `h-px w-[80%] bg-[#E2E4E9]`
- Optional `TrendBadge` per stat

### 6.2 Bordered metrics row

**File:** `stat-metrics-row.tsx`

```txt
rounded-xl border border-stroke-soft-200 bg-neutral-0
```

- Label: `text-sm font-medium text-text-soft-400`
- Value: `text-2xl font-semibold leading-8 tracking-[-0.02em] text-text-main-900`
- Subtext: `text-xs text-text-sub-500`

### 6.3 Trend badge

**File:** `trend-badge.tsx`

```txt
inline-flex h-4 min-w-9 items-center justify-center rounded-full px-1.5 py-0.5
text-[11px] font-medium leading-3 tracking-[0.02em] uppercase
```

| Direction | Classes |
|-----------|---------|
| Positive | `bg-[var(--green-light)] text-[var(--green-darker)]` |
| Negative | `bg-[var(--red-light)] text-[var(--red-darker)]` |
| Zero | `bg-[var(--neutral-50)] text-[var(--text-soft-400)]` |

Label format: `+12%` / `-5%`.

Chart trend text (not the pill): green `#16A34A` / red `#DC2626`, `text-xs font-medium`, optional `TrendingUp` icon.

### 6.4 Status badge

**File:** `status-badge.tsx`

```txt
inline-flex h-6 items-center gap-1 rounded-full border border-[var(--stroke-soft-200)] bg-white
py-1 pl-1 pr-2 text-xs font-medium text-[var(--text-sub-500)]
```

Dot: `h-1.5 w-1.5 rounded-full`

| Status codes | Dot color |
|--------------|-----------|
| `active`, `present`, `paid` | `#38C793` |
| `inactive`, `absent`, `withdrawn`, `cancelled` | `#EF4444` |
| `pending`, `draft` | `#F59E0B` |
| default | `var(--text-soft-400)` |

### 6.5 Donut KPIs (custom SVG, not Recharts)

**File:** `attendance-donut.tsx`

- Size `104×104`, stroke `9`
- Track: `stroke="var(--stroke-soft-200)"`
- Center: `text-lg font-semibold ... text-[var(--text-main-900)]` → `{rate}%`

**Ring colors** (`today-attendance-card.tsx`):

| Metric | Color |
|--------|-------|
| Students | `var(--midnight-blue-950, #01366C)` |
| Teachers / staff | `#16A34A` |
| Overall | `#F59E0B` |

### 6.6 Activity timeline icon colors

| Kind | Background | Icon |
|------|------------|------|
| student / branch | `bg-[#EFF6FF]` | `text-[#2563EB]` |
| teacher / attendance | `bg-[#ECFDF3]` | `text-[#16A34A]` |
| fee | `bg-[#FFF7ED]` | `text-[#EA580C]` |
| report | `bg-[#F4F4F5]` | `text-[#71717A]` |

Connector: `absolute left-[17px] top-9 bottom-0 w-px bg-stroke-soft-200`.

### 6.7 Quick action tiles

Grid: `grid grid-cols-2 gap-3 p-5`  
Tile: `rounded-xl border border-stroke-soft-200 bg-white px-3 py-4 hover:bg-neutral-50`  
Icon circle: `h-10 w-10 rounded-full bg-[#EFF6FF]`, icon `text-[#2563EB]`

---

## 7. Charts

**Library:** Recharts only. Primary reusable component: `apps/web/src/components/dashboard/trend-area-chart.tsx`.

### Card wrapper

```txt
rounded-xl border border-stroke-soft-200 bg-neutral-0 p-5
```

Default chart height: `220`.

### Area chart config (copy exactly)

| Element | Spec |
|---------|------|
| Gradient top | `#00A5FF` @ opacity `0.6` |
| Gradient bottom | `#CEF0FF` @ opacity `0.09` |
| Stroke | `#003E73`, `strokeWidth={2.5}` |
| Active dot | `r: 4`, fill `#003E73` |
| Dots | `dot={false}` |
| Grid | `strokeDasharray="4 4"`, `vertical={false}`, stroke `var(--stroke-soft-200)` |
| Axes | No axis/tick lines; tick `fontSize: 12`, `fill: var(--text-soft-400)` |
| Tooltip | `borderRadius: 8`, border `1px solid var(--stroke-soft-200)`, `fontSize: 12` |
| Margins | `{ top: 8, right: 4, left: -12, bottom: 0 }` |
| Curve | `type="monotone"` |

```tsx
<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stopColor="#00A5FF" stopOpacity={0.6} />
  <stop offset="100%" stopColor="#CEF0FF" stopOpacity={0.09} />
</linearGradient>
```

**Rule:** Pass a unique `gradientId` when multiple charts appear on one page (SVG `id` collisions).

`MonthlyRevenueCard` uses the same styling with gradient id `dashboardRevenueGradient`.

---

## 8. Controls

### 8.1 Buttons

**File:** `apps/web/src/components/ui/button.tsx` (CVA)

| Variant | Classes |
|---------|---------|
| `default` | `bg-[var(--institution-primary)] text-white hover:opacity-90` |
| `outline` | `border border-border bg-background hover:bg-muted` |
| `ghost` | `hover:bg-muted` |
| `link` | `text-[var(--institution-primary)] underline-offset-4 hover:underline` |

Sizes: `default h-10 px-4`, `sm h-9 px-3`, `lg h-11 px-8`.  
Base: `rounded-md text-sm font-medium`, focus ring `ring-2`.

**Page / dialog primary CTAs** should use **midnight blue** (`pageHeaderActionClassName` / dialog submit), not `variant="default"`, so they stay consistent when institution primary changes.

Dialog footer buttons:

```txt
/* Cancel */
h-10 flex-1 rounded-[10px] border border-[var(--stroke-soft-200)] bg-white text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)]

/* Submit */
h-10 flex-1 rounded-[10px] bg-[var(--midnight-blue-950)] text-white hover:opacity-90
```

### 8.2 Inputs

**Base Input** (`ui/input.tsx`):

```txt
h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm
focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)]
```

**Modal / form field (preferred in dialogs)** — `modalFieldClassName` in `invite-form-fields.tsx`:

```ts
'flex h-10 w-full items-center rounded-[10px] border border-[var(--stroke-soft-200)] bg-white
 py-[10px] pl-3 pr-[10px] text-sm ... text-[var(--text-main-900)]
 shadow-[0px_1px_2px_rgba(228,229,231,0.24)]
 placeholder:text-[var(--text-soft-400)]
 focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)]'
```

Textarea: `cn(modalFieldClassName, 'min-h-[80px] resize-y py-3')`.

**SearchInput:** `h-10 max-w-[322px] rounded-[10px] border border-[var(--base-input)] bg-white`, focus-within institution ring; Lucide Search `h-3 w-3`; debounce 300ms.

**SelectDropdown:** trigger `h-10 rounded-[10px] border border-[var(--base-input)]` + soft field shadow; menu `rounded-[10px] border bg-white shadow-lg`; selected check in midnight blue.

**FilterBar:** `flex flex-wrap items-end gap-3`.

**Form labels:** `text-sm font-medium text-[var(--text-main-900)]`; required asterisk `#FF3B30`.

### 8.3 Tabs (segmented)

**File:** `apps/web/src/components/ui/tabs.tsx`

```txt
/* Track */
inline-flex h-10 rounded-[10px] bg-[#E8E8E8] p-1

/* Tab */
h-8 rounded-lg px-4 text-sm font-normal leading-5 tracking-[-0.006em]

/* Active */
bg-white text-[var(--text-main-900)] shadow-sm

/* Inactive */
text-[var(--text-sub-500)] hover:text-[var(--text-main-900)]
```

Focus: `ring-2 ring-[var(--institution-primary)]`.

Aliases: `SegmentedTabs`, `PageTabs` — same visual.

### 8.4 Dialogs

**File:** `apps/web/src/components/ui/dialog.tsx` (Radix)

| Part | Spec |
|------|------|
| Overlay | `bg-[#00000026] backdrop-blur-[4px]` |
| Content | `max-w-[492px] rounded-[20px] border border-[var(--stroke-soft-200)] bg-white pb-5 shadow-lg` |
| Title | `text-base font-medium tracking-[-0.015em] text-[var(--text-main-900)]` |
| Description | `text-sm text-[var(--text-sub-500)]` |
| Default footer | `flex flex-col-reverse gap-2 px-5 sm:flex-row sm:justify-end` |

**Feature dialog pattern** (CRUD):

```tsx
<DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0">
  {/* Header: border-b, icon circle h-11 w-11, title, X close */}
  <form className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">{/* fields */}</div>
    <div className="flex gap-4 border-t px-4 pb-5 pt-4">{/* Cancel + Submit flex-1 */}</div>
  </form>
</DialogContent>
```

Two-column fields: `grid gap-4 sm:grid-cols-2`.

### 8.5 Sheet (mobile nav)

Left sheet, width `w-[min(100vw,272px)]`, renders same sidebar nav.

---

## 9. Empty and loading states

### Table empty

```tsx
<td
  colSpan={N}
  className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
>
  No {entity} found
</td>
```

Or with `dataTableTdClass` + `text-center text-[var(--text-sub-500)]` and `py-8`.

Error row: `text-center text-sm text-red-600`.

### Panel empty

```tsx
<p className="py-6 text-sm text-text-sub-500">No recent activity yet.</p>
```

### Loading

| Pattern | Spec |
|---------|------|
| In-table | `DataTableSkeletonRows` — do not render data rows at the same time |
| Stats | `MainStatsSection isLoading` (dashed wrapper + pulse blocks) |
| Cards / charts | Keep card shell; fill with `Skeleton` (`animate-pulse rounded-md bg-muted`) |
| Page | `DashboardPageSkeleton`, `PageContentSkeleton`, `ListLoadingSkeleton` (`space-y-3` of `h-10` bars) |

Base Skeleton: `apps/web/src/components/ui/skeleton.tsx`.

### Toasts

Sonner, typically top-right for success/error feedback.

---

## 10. Agent recreation checklist

1. Copy CSS variables + `@theme inline` from `globals.css`; keep light mode only.
2. Load Inter as `--font-inter`; apply `font-[family-name:var(--font-inter)]` on shells/pages.
3. Implement dual brand: institution primary for focus/links/default button; **midnight `#01366c`** for primary page/dialog CTAs.
4. Build shell: sticky sidebar + scrollable main (`p-4 lg:p-6`).
5. Page recipe: `space-y-6` → `PageHeader` → optional segmented `Tabs` / `FilterBar` → `ContentPanel`.
6. Tables: shared `dataTable*` classes, min-width 960px, gray `#F8F8F8` header, hover `neutral-50/50`.
7. Stats: dashed `MainStatsSection` and/or bordered `StatMetricsRow` + `TrendBadge` / `StatusBadge`.
8. Charts: Recharts area with `#00A5FF`→`#CEF0FF` fill and `#003E73` stroke; unique gradient IDs.
9. Dialogs: Radix, `rounded-[20px]`, blur overlay, `modalFieldClassName` fields, dual footer buttons.
10. Match empty/loading patterns before shipping list pages.

### Key file index (copy from these)

| Concern | Path |
|---------|------|
| Tokens | `apps/web/src/app/globals.css` |
| Institution color | `apps/web/src/providers/institution-provider.tsx` |
| `cn()` | `apps/web/src/lib/utils.ts` |
| Page header / CTA | `apps/web/src/components/layout/page-header.tsx` |
| Content panel | `apps/web/src/components/layout/content-panel.tsx` |
| Table styles | `apps/web/src/components/layout/data-table-styles.ts` |
| Table skeleton | `apps/web/src/components/layout/data-table-skeleton.tsx` |
| Pagination | `apps/web/src/components/layout/pagination-bar.tsx` |
| Main KPIs | `apps/web/src/components/layout/main-stats-section.tsx` |
| Card KPIs | `apps/web/src/components/layout/stat-metrics-row.tsx` |
| Trend / status badges | `trend-badge.tsx`, `status-badge.tsx` |
| Area chart | `apps/web/src/components/dashboard/trend-area-chart.tsx` |
| Donut | `apps/web/src/components/dashboard/attendance-donut.tsx` |
| Button | `apps/web/src/components/ui/button.tsx` |
| Tabs | `apps/web/src/components/ui/tabs.tsx` |
| Dialog | `apps/web/src/components/ui/dialog.tsx` |
| Modal fields | `apps/web/src/components/features/users/invite-form-fields.tsx` |
| Search / select / filters | `search-input.tsx`, `select-dropdown.tsx`, `filter-bar.tsx` |
| Shell / sidebar | `dashboard-shell.tsx`, `sidebar.tsx`, `sidebar-nav.tsx` |
| Reference list panel | `apps/web/src/components/features/library/catalog-panel.tsx` |
| Reference home page | `apps/web/src/app/(dashboard)/dashboard/page.tsx` |

### Visual language summary

Light ERP UI: white panels, soft `#E2E4E9` borders, Inter with tight tracking, gray `#F8F8F8` table headers, midnight-blue primary actions, blue area charts, green/red trend pills, and segmented gray/white tabs. No dark mode, no purple on ERP surfaces.
