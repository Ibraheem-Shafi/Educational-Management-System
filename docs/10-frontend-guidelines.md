# Frontend Guidelines

## Overview

The frontend is a **Next.js 15** application using the App Router, **shadcn/ui** components, and **Tailwind CSS**. All institution branding is dynamic — never hardcode names or logos.

For visual tokens, tables, stats, charts, and UI recipes to recreate this design elsewhere, see [design-system-handoff.md](./design-system-handoff.md).

## Project Structure

```
apps/web/src/
├── app/                    # Routes (App Router)
├── components/
│   ├── ui/                 # shadcn primitives
│   ├── layout/             # Sidebar, Header, PageShell
│   └── features/           # Domain components by module
├── hooks/
├── lib/
└── providers/
```

## Routing

### Route Groups

| Group | Purpose | Auth |
|-------|---------|------|
| `(auth)` | Login, forgot password, invite accept | Public |
| `(dashboard)` | All authenticated pages | Required |

### Role-Based Dashboards

Do not create separate apps per role. Use a single dashboard layout with permission-driven navigation:

```tsx
// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <InstitutionProvider>
      <Sidebar />
      <main>{children}</main>
    </InstitutionProvider>
  );
}
```

Menu items filtered by `usePermissions()`:

```tsx
const navItems = ALL_NAV_ITEMS.filter(item =>
  !item.permission || hasPermission(item.permission)
);
```

### Middleware

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* ... */);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session && !isPublicRoute(request.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}
```

## White-Label Theming

### Institution Provider

```tsx
// providers/institution-provider.tsx
export function InstitutionProvider({ children }) {
  const { data: settings } = useQuery({
    queryKey: ['institution-settings'],
    queryFn: () => apiClient<InstitutionSettingsResponse>('/settings/institution'),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty('--institution-primary', settings.primaryColor);
    }
  }, [settings?.primaryColor]);

  return (
    <InstitutionContext.Provider value={settings}>
      {children}
    </InstitutionContext.Provider>
  );
}
```

### Where Branding Appears

| Location | Source |
|----------|--------|
| Login page | `settings.name`, `settings.logoUrl` |
| Sidebar header | `settings.name`, `settings.logoUrl` |
| Browser tab title | `settings.name` via `metadata` |
| Favicon | `settings.faviconUrl` |
| PDF receipts/reports | `settings` via API |
| Email templates | `settings` passed to template renderer |

```tsx
// components/layout/sidebar-header.tsx
export function SidebarHeader() {
  const { name, logoUrl } = useInstitution();
  return (
    <div className="flex items-center gap-2 p-4">
      {logoUrl && <Image src={logoUrl} alt={name} width={32} height={32} />}
      <span className="font-semibold">{name}</span>
    </div>
  );
}
```

### CSS Variables

```css
/* globals.css */
:root {
  --institution-primary: #2563eb;
}
```

Tailwind references `var(--institution-primary)` for buttons, links, and accents.

## Component Patterns

### Page Shell

Every dashboard page uses a consistent shell:

```tsx
export default function StudentsPage() {
  return (
    <PageShell
      title="Students"
      description={`Manage ${terminology.batch} enrollments`}
      actions={<Button>Admit Student</Button>}
    >
      <StudentTable />
    </PageShell>
  );
}
```

### Data Tables

Use TanStack Table + shadcn DataTable pattern:

- Server-side pagination via API query params
- Column sorting via `sortBy` / `sortOrder`
- Search debounced (300ms)
- Row actions in dropdown menu
- Empty state with illustration + CTA

### Forms

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createStudentSchema } from '@eims/shared/schemas';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

export function StudentForm({ onSubmit, defaultValues }) {
  const form = useForm({
    resolver: zodResolver(createStudentSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField name="fullName" render={({ field }) => (
          <FormItem>
            <FormLabel>Full Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {/* ... */}
      </form>
    </Form>
  );
}
```

### Dialogs vs Sheets

| Use Dialog when | Use Sheet when |
|-----------------|----------------|
| Confirmation prompts | Multi-field forms |
| Small forms (1-3 fields) | Detail views |
| Alerts | Filter panels |

## Data Fetching

### TanStack Query

```typescript
// hooks/features/use-students.ts
export function useStudents(query: ListStudentsQuery) {
  return useQuery({
    queryKey: ['students', query],
    queryFn: () => apiClient<PaginatedResponse<StudentResponse>>('/students', { params: query }),
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStudentInput) =>
      apiClient<StudentResponse>('/students', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student admitted successfully');
    },
    onError: (error: ApiClientError) => {
      toast.error(error.message);
    },
  });
}
```

### Query Key Convention

```
['entity']                    — list with default params
['entity', queryParams]       — list with filters
['entity', id]                — single record
['entity', id, 'sub-entity']  — nested data
```

## Notifications (Sonner)

```tsx
// app/layout.tsx
import { Toaster } from 'sonner';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
```

| Action | Toast |
|--------|-------|
| Create success | `toast.success('Student admitted')` |
| Update success | `toast.success('Changes saved')` |
| Delete success | `toast.success('Student removed')` |
| API error | `toast.error(error.message)` |
| Loading (long ops) | `toast.loading()` → `toast.dismiss()` |

## Charts

### When to Use What

| Library | Use for |
|---------|---------|
| **Tremor** | Dashboard KPI cards, sparklines, summary metrics |
| **Recharts** | Detailed charts: performance trends, attendance over time, fee collection |

### Tremor Example (Dashboard)

```tsx
import { Card, Metric, Text } from '@tremor/react';

<Card>
  <Text>Total Students</Text>
  <Metric>{stats.totalStudents}</Metric>
</Card>
```

### Recharts Example (Performance)

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={performanceData}>
    <XAxis dataKey="month" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="percentage" stroke="var(--institution-primary)" />
  </LineChart>
</ResponsiveContainer>
```

## Terminology (Institution Type)

Use dynamic labels from `InstitutionSettings.terminology`:

```tsx
const { terminology } = useInstitution();

// "Batch" for coaching, "Class" for school, "Section" for college
<h1>{terminology.batch} Management</h1>
```

Never hardcode "Batch" or "Class" in UI strings.

## File Uploads

Student photos and documents upload to Supabase Storage:

```typescript
async function uploadStudentPhoto(file: File, studentId: string, branchId: string) {
  const path = `${branchId}/${studentId}/avatar.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage
    .from('student-photos')
    .upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from('student-photos').getPublicUrl(path).data.publicUrl;
}
```

Then save URL via API: `PATCH /students/:id { photographUrl }`.

## Accessibility

- All shadcn/Radix components are accessible by default
- Form fields must have labels (`FormLabel`)
- Tables must have proper `thead`/`tbody`
- Color contrast: test institution primary color against white/dark backgrounds
- Keyboard navigation for all interactive elements

## Performance

- Use Server Components for static/read-heavy pages where possible
- Client Components only when interactivity is needed (`'use client'`)
- `next/image` for all images with proper `width`/`height`
- Lazy load heavy chart components
- TanStack Query `staleTime` tuned per data type (settings: Infinity, lists: 30s)

## i18n Structure (Future)

Prepare but do not implement Urdu yet:

```
messages/
├── en.json
└── ur.json    # future
```

Use `next-intl` message keys, not inline English strings in components:

```tsx
// Future: t('students.admit')
// Now: hardcode English but extract to a constants/messages file for easy migration
```

## Related Documents

- [14-white-label-config.md](14-white-label-config.md) — branding configuration
- [06-types-and-contracts.md](06-types-and-contracts.md) — shared types for forms
- [09-api-design.md](09-api-design.md) — API client patterns
