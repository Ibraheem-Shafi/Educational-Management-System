# Naming Conventions

Consistent naming across the monorepo makes the codebase navigable and the copy-paste deployment model reliable. Follow these rules in all apps and packages.

## General Rules

1. **English only** for code identifiers (variables, functions, files)
2. **No institution names** in identifiers (no `rekhta`, `RekhtaAcademy`)
3. **No abbreviations** unless widely understood (`id`, `url`, `api`, `dto`)
4. **Be descriptive** — `createStudentSchema` not `csSchema`

## Files & Folders

| Item | Convention | Example |
|------|------------|---------|
| Folders | kebab-case | `form-builder/`, `fee-types/` |
| React components | PascalCase file | `StudentProfileCard.tsx` |
| Hooks | camelCase with `use` prefix | `use-students.ts` or `useStudents.ts` |
| NestJS modules | kebab-case + suffix | `students.module.ts` |
| NestJS services | kebab-case + suffix | `students.service.ts` |
| NestJS controllers | kebab-case + suffix | `students.controller.ts` |
| Utilities | kebab-case | `grade-calculator.ts` |
| Zod schemas | kebab-case + `.schema.ts` | `create-student.schema.ts` |
| Types files | kebab-case | `student.response.ts` |
| Test files | same name + `.spec.ts` or `.test.ts` | `students.service.spec.ts` |
| Constants | kebab-case | `pakistan.ts`, `permissions.ts` |

### NestJS Module Folder

```
modules/students/
├── students.module.ts
├── students.controller.ts
├── students.service.ts
├── students.service.spec.ts
└── dto/
    ├── create-student.dto.ts
    └── update-student.dto.ts
```

### React Feature Folder

```
components/features/students/
├── student-table.tsx
├── student-form.tsx
├── student-profile-card.tsx
└── index.ts                  # Barrel export (optional)
```

## Database (Prisma)

| Item | Convention | Example |
|------|------------|---------|
| Models | PascalCase singular | `Student`, `AssessmentRecord` |
| Fields | camelCase | `branchId`, `obtainedMarks` |
| Foreign keys | `{entity}Id` | `studentId`, `batchId` |
| Booleans | `is` or `has` prefix | `isActive`, `hasScholarship` |
| Timestamps | `createdAt`, `updatedAt`, `deletedAt` | Standard audit fields |
| Enums (technical only) | PascalCase | `SortOrder` |
| Indexes | `@@index([field])` | `@@index([branchId])` |
| Unique constraints | `@@unique([a, b])` | `@@unique([branchId, code])` |

### Model Example

```prisma
model Student {
  id          String    @id @default(cuid())
  branchId    String
  fullName    String
  dateOfBirth DateTime?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  branch Branch @relation(fields: [branchId], references: [id])

  @@index([branchId])
  @@index([deletedAt])
}
```

**Do not** use Prisma enums for business concepts (student status, attendance status). Use `LookupStatus` table with `code` + `label`.

## API Routes

| Item | Convention | Example |
|------|------------|---------|
| Base path | `/api/v1` | Versioned |
| Resources | kebab-case plural | `/students`, `/fee-types` |
| Nested resources | parent/child | `/batches/:id/students` |
| Actions | POST to sub-path | `POST /invitations/send` |
| Query params | camelCase | `?branchId=xxx&page=1` |

### REST Mapping

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/v1/students` | List |
| GET | `/api/v1/students/:id` | Get one |
| POST | `/api/v1/students` | Create |
| PATCH | `/api/v1/students/:id` | Partial update |
| DELETE | `/api/v1/students/:id` | Soft delete |

## TypeScript

| Item | Convention | Example |
|------|------------|---------|
| Interfaces | PascalCase | `Student`, `InstitutionSettings` |
| Types | PascalCase | `CreateStudentRequest` |
| Enums (technical) | PascalCase | `SortOrder` |
| Variables | camelCase | `branchId`, `studentList` |
| Constants | SCREAMING_SNAKE | `MAX_UPLOAD_SIZE` |
| Functions | camelCase verb-first | `calculateGrade()`, `formatCurrency()` |
| React components | PascalCase | `StudentTable` |
| Props interfaces | Component name + `Props` | `StudentTableProps` |
| Generic types | Single uppercase letter | `T`, `K`, `V` |

### Request/Response Naming

```
{Action}{Entity}Request   → CreateStudentRequest
{Entity}Response          → StudentResponse
{Entity}ListResponse      → StudentListResponse
List{Entity}Query         → ListStudentsQuery
```

## Environment Variables

| Item | Convention | Example |
|------|------------|---------|
| All env vars | SCREAMING_SNAKE | `DATABASE_URL` |
| Public (Next.js) | `NEXT_PUBLIC_` prefix | `NEXT_PUBLIC_SUPABASE_URL` |
| Institution config | `INSTITUTION_` prefix | `INSTITUTION_NAME` |

### Standard Variables

```
# Database
DATABASE_URL
DIRECT_URL

# Supabase
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Institution (white-label)
INSTITUTION_NAME
INSTITUTION_TYPE
INSTITUTION_TIMEZONE

# App URLs
NEXT_PUBLIC_APP_URL
API_URL

# Security
JWT_SECRET
```

## Git

| Item | Convention | Example |
|------|------------|---------|
| Branches | kebab-case | `feature/student-admission` |
| Commits | Conventional Commits | `feat(students): add admission form` |
| Tags (releases) | semver | `v1.0.0` |

### Commit Prefixes

| Prefix | Use |
|--------|-----|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change, no behavior change |
| `test` | Tests |
| `chore` | Tooling, deps |

## Permissions

Permission codes use dot-separated lowercase:

```
students.read
students.create
students.update
students.delete
attendance.mark
fees.collect
reports.view
settings.manage
```

Stored in database, referenced by string constant in `packages/shared/constants/permissions.ts`.

## Storage Paths (Supabase)

```
{bucket}/{branchId}/{entityId}/{filename}

Examples:
logos/default/logo.png
student-photos/{branchId}/{studentId}/avatar.jpg
documents/{branchId}/{studentId}/b-form.pdf
```

## CSS & Tailwind

| Item | Convention | Example |
|------|------------|---------|
| CSS variables | kebab-case | `--primary`, `--institution-primary` |
| Custom classes | kebab-case | `sidebar-header` |
| Component classes | Tailwind utilities | Standard Tailwind |

## What NOT to Name

| Avoid | Use instead |
|-------|-------------|
| `RekhtaStudent` | `Student` |
| `COACHING_BATCH` enum | `LookupStatus` with `code: 'active'` |
| `getData()` | `getStudents()` |
| `temp`, `tmp`, `data` | Descriptive names |
| `handler1`, `service2` | Domain names |

## Related Documents

- [06-types-and-contracts.md](06-types-and-contracts.md) — type naming patterns
- [09-api-design.md](09-api-design.md) — API route standards
- [04-monorepo-structure.md](04-monorepo-structure.md) — folder layout
