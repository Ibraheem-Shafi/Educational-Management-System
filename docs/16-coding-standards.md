# Coding Standards

## General Principles

1. **Minimize scope** — smallest correct change; no unrelated edits
2. **Match existing patterns** — read surrounding code before writing
3. **No institution-specific code** — branding via config only
4. **No hardcoded business enums** — use database lookups
5. **Types everywhere** — no `any` without explicit justification
6. **Validate at boundaries** — Zod on API inputs and forms

## TypeScript

| Rule | Standard |
|------|----------|
| Strict mode | `"strict": true` in all tsconfigs |
| No `any` | Use `unknown` + type guards if type is uncertain |
| Explicit return types | On exported functions and service methods |
| Prefer `interface` | For object shapes; `type` for unions/intersections |
| Import types | `import type { X }` for type-only imports |
| No unused vars | ESLint `@typescript-eslint/no-unused-vars` |

```typescript
// Good
export async function getStudents(query: ListStudentsQuery): Promise<PaginatedResponse<StudentResponse>> {
  // ...
}

// Bad
export async function getStudents(query: any) {
  // ...
}
```

## ESLint & Prettier

Shared config in `packages/config/eslint/` and root `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### Commands

```bash
pnpm lint          # Lint all packages
pnpm format        # Prettier write
pnpm format:check  # Prettier check (CI)
```

## Git Workflow

### Branches

```
main              — production-ready
develop           — integration branch (optional)
feature/xxx       — new features
fix/xxx           — bug fixes
docs/xxx          — documentation
```

### Commits (Conventional Commits)

```
feat(students): add admission form with custom fields
fix(fees): correct net amount calculation with discount
docs(architecture): add branch isolation diagram
refactor(auth): extract JWT verification to guard
test(attendance): add bulk mark unit tests
chore(deps): upgrade prisma to 6.1
```

### Pull Requests

- One feature/fix per PR
- Include description of what and why
- Link to relevant doc or issue
- Must pass CI (lint, test, build)
- Squash merge to `main`

## Error Handling

### Backend

```typescript
// Use NestJS HTTP exceptions
throw new NotFoundException('Student not found');
throw new BadRequestException({ message: 'Validation failed', details });

// Catch unexpected errors in global filter — log full error, return generic 500
// Never expose stack traces in production
```

### Frontend

```typescript
// API client throws typed ApiClientError
try {
  await createStudent(data);
  toast.success('Student admitted');
} catch (error) {
  if (error instanceof ApiClientError) {
    toast.error(error.message);
    if (error.details) setFormErrors(error.details);
  } else {
    toast.error('Something went wrong');
  }
}
```

### Rules

- Never swallow errors silently
- Log unexpected errors server-side
- Show user-friendly messages client-side
- Return consistent error shape from API (see [09-api-design.md](09-api-design.md))

## Testing

### What to Test

| Layer | Tool | Focus |
|-------|------|-------|
| Shared utils | Vitest | Grade calc, currency format, CNIC validation |
| Services | Vitest | Business logic, branch filtering, validation |
| API endpoints | Supertest / e2e | Auth, CRUD flows |
| Critical UI flows | Playwright | Login, admission, fee payment |

### What Not to Test

- shadcn component rendering (already tested by library)
- Prisma query syntax (test service behavior instead)
- Trivial getters/setters

### Test Naming

```typescript
describe('StudentsService', () => {
  describe('create', () => {
    it('should reject batch from different branch', async () => { /* ... */ });
    it('should audit log on successful creation', async () => { /* ... */ });
  });
});
```

### Coverage Target

- Services: 80%+ coverage
- Utils: 90%+ coverage
- Controllers: integration tests for happy path + auth failures

## Code Review Checklist

- [ ] No hardcoded institution names
- [ ] Branch scoping enforced in service layer
- [ ] Zod validation on inputs
- [ ] Audit log for mutations
- [ ] Permission guard on endpoints
- [ ] Types from `@eims/types`, schemas from `@eims/shared`
- [ ] No secrets in code
- [ ] Tests for business logic
- [ ] Error handling with proper HTTP status codes

## File Organization Rules

- One component per file (React)
- One service per module (NestJS)
- Co-locate tests: `*.spec.ts` next to source
- Barrel exports (`index.ts`) only at package boundaries, not every folder

## Comments

- Code should be self-explanatory
- Comment only non-obvious business logic:

```typescript
// Sibling discount: 10% off if parent has 2+ active students in same branch
const siblingDiscount = await this.calculateSiblingDiscount(parentId, branchId);
```

- No commented-out code in commits
- No TODO without issue reference: `// TODO(#42): implement auto late fee`

## Dependencies

- Pin major versions in `package.json`
- Update deps in dedicated PRs, not mixed with features
- Audit with `pnpm audit` before releases
- No unnecessary dependencies — justify each addition

## Performance Guidelines

| Area | Guideline |
|------|-----------|
| API lists | Always paginated, max 100 per page |
| DB queries | Use `select` / `include` intentionally; avoid N+1 |
| Images | `next/image` with proper sizes |
| Bundle | Dynamic import heavy components (charts) |
| Caching | TanStack Query `staleTime` per data type |

## Security in Code

- Never log passwords, tokens, or CNIC numbers
- Never use `eval()` or `dangerouslySetInnerHTML` without sanitization
- Parameterized queries only (Prisma handles this)
- Validate file uploads server-side (type, size)
- Check permissions in service layer, not just controller

## Related Documents

- [05-naming-conventions.md](05-naming-conventions.md) — naming rules
- [06-types-and-contracts.md](06-types-and-contracts.md) — type patterns
- [10-frontend-guidelines.md](10-frontend-guidelines.md) — React patterns
- [11-backend-guidelines.md](11-backend-guidelines.md) — NestJS patterns
