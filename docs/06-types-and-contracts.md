# Types & Contracts

## Philosophy

Types are the contract between frontend, backend, and database. Define them once, use everywhere. **Never duplicate** the same shape in `apps/web` and `apps/api`.

```
Zod Schema (packages/shared)
    ↓ infer
TypeScript Type (packages/types)
    ↓ used by
NestJS DTO + Validation Pipe
Next.js Form + API Client
```

## Package Boundaries

### packages/types — Pure TypeScript

No runtime code. No imports from `zod`, `@prisma/client`, or NestJS.

```
packages/types/src/
├── entities/           # Mirror DB models (without Prisma decorators)
├── api/                # Request/response shapes per endpoint
├── enums/              # Technical enums only
└── index.ts
```

### packages/shared — Runtime Validation

Zod schemas, constants, utilities. Imports types from `@eims/types` where needed.

```
packages/shared/src/
├── schemas/            # Zod — single source of validation truth
├── constants/
└── utils/
```

## Entity Types

Entity types mirror Prisma models but are independent (no Prisma dependency in types package).

```typescript
// packages/types/src/entities/student.ts

export interface Student {
  id: string;
  branchId: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  cnicOrBForm: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  photographUrl: string | null;
  programId: string | null;
  batchId: string | null;
  statusId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

```typescript
// packages/types/src/entities/institution-settings.ts

export interface InstitutionSettings {
  id: string;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  currency: string;
  institutionType: InstitutionType;
  terminology: TerminologyMap;
  featureFlags: FeatureFlags;
  updatedAt: string;
}

export type InstitutionType = 'coaching' | 'school' | 'college';

export interface TerminologyMap {
  batch: string;       // "Batch" | "Class" | "Section"
  program: string;     // "Program" | "Grade" | "Degree"
  assessment: string;  // "Test" | "Exam"
}

export interface FeatureFlags {
  timetable: boolean;
  formBuilder: boolean;
  aiAttendance: boolean;
  parentPortal: boolean;
  studentPortal: boolean;
}
```

## API Contract Types

Organized by module under `packages/types/src/api/`:

```
api/
├── common/
│   ├── pagination.ts
│   └── api-error.ts
├── students/
│   ├── create-student.request.ts
│   ├── update-student.request.ts
│   ├── list-students.query.ts
│   ├── student.response.ts
│   └── student-list.response.ts
└── settings/
    └── institution-settings.response.ts
```

### Pagination (shared)

```typescript
// packages/types/src/api/common/pagination.ts

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### API Error (shared)

```typescript
// packages/types/src/api/common/api-error.ts

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, string[]>;
}
```

### Request/Response Example

```typescript
// packages/types/src/api/students/create-student.request.ts

export interface CreateStudentRequest {
  branchId: string;
  fullName: string;
  dateOfBirth?: string;
  gender?: string;
  cnicOrBForm?: string;
  phone?: string;
  email?: string;
  address?: string;
  programId?: string;
  batchId?: string;
  statusId: string;
  subjectIds?: string[];
}
```

```typescript
// packages/types/src/api/students/student.response.ts

import type { Student } from '../../entities/student';

export interface StudentResponse extends Student {
  program?: { id: string; name: string };
  batch?: { id: string; name: string };
  status?: { id: string; code: string; label: string };
  subjects?: { id: string; name: string }[];
}
```

## Zod Schemas

Schemas live in `packages/shared` and infer types used in both apps.

```typescript
// packages/shared/src/schemas/student.schema.ts

import { z } from 'zod';
import { CNIC_REGEX, PHONE_REGEX } from '../constants/pakistan';

export const createStudentSchema = z.object({
  branchId: z.string().cuid(),
  fullName: z.string().min(2).max(200),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  cnicOrBForm: z.string().regex(CNIC_REGEX).optional(),
  phone: z.string().regex(PHONE_REGEX).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  programId: z.string().cuid().optional(),
  batchId: z.string().cuid().optional(),
  statusId: z.string().cuid(),
  subjectIds: z.array(z.string().cuid()).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = createStudentSchema.partial().omit({ branchId: true });

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  batchId: z.string().cuid().optional(),
  statusId: z.string().cuid().optional(),
  sortBy: z.enum(['fullName', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

### Pakistan Constants

```typescript
// packages/shared/src/constants/pakistan.ts

export const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/;
export const B_FORM_REGEX = /^\d{5}-\d{7}-\d{1}$/;
export const PHONE_REGEX = /^\+92\d{10}$/;

export const PROVINCES = [
  'Punjab', 'Sindh', 'KPK', 'Balochistan', 'ICT', 'GB', 'AJK',
] as const;

export const DEFAULT_TIMEZONE = 'Asia/Karachi';
export const DEFAULT_CURRENCY = 'PKR';
```

## Technical Enums Only

`packages/types/src/enums/` contains **technical** enums only — never business concepts.

```typescript
// packages/types/src/enums/sort-order.ts
export type SortOrder = 'asc' | 'desc';

// packages/types/src/enums/institution-type.ts
export type InstitutionType = 'coaching' | 'school' | 'college';
```

**Business statuses** (student active/inactive, attendance present/absent) are **not** TypeScript enums. They are database `LookupStatus` records with `code` and `label`.

## Usage in NestJS

```typescript
// apps/api/src/common/pipes/zod-validation.pipe.ts

import { PipeTransform, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
```

```typescript
// apps/api/src/modules/students/students.controller.ts

@Post()
@Permissions('students.create')
create(
  @Body(new ZodValidationPipe(createStudentSchema)) body: CreateStudentInput,
  @CurrentUser() user: AuthUser,
) {
  return this.studentsService.create(body, user);
}
```

## Usage in Next.js

```typescript
// apps/web — form with shared schema

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createStudentSchema, type CreateStudentInput } from '@eims/shared/schemas';

const form = useForm<CreateStudentInput>({
  resolver: zodResolver(createStudentSchema),
});
```

```typescript
// apps/web — typed API client

import type { StudentResponse, PaginatedResponse } from '@eims/types';

export async function getStudents(query: ListStudentsQuery): Promise<PaginatedResponse<StudentResponse>> {
  return apiClient.get('/students', { params: query });
}
```

## Prisma ↔ Types Relationship

Prisma generates its own types (`@prisma/client`). Map between Prisma and API types in the service layer:

```typescript
// apps/api/src/modules/students/students.service.ts

private toResponse(student: PrismaStudentWithRelations): StudentResponse {
  return {
    id: student.id,
    branchId: student.branchId,
    fullName: student.fullName,
    // ... map fields
    program: student.program ? { id: student.program.id, name: student.program.name } : undefined,
  };
}
```

**Do not** export `@prisma/client` types to the frontend.

## Barrel Exports

```typescript
// packages/types/src/index.ts

export * from './entities/student';
export * from './entities/institution-settings';
export * from './api/common/pagination';
export * from './api/common/api-error';
export * from './api/students/create-student.request';
export * from './api/students/student.response';
export * from './enums/institution-type';
```

```typescript
// packages/shared/src/index.ts

export * from './schemas/student.schema';
export * from './constants/pakistan';
export * from './utils/grade';
export * from './utils/currency';
```

## Anti-Patterns

| Anti-pattern | Correct approach |
|--------------|------------------|
| Duplicate interface in web and api | Single source in `@eims/types` |
| `enum StudentStatus { Active, Inactive }` | `LookupStatus` table |
| Import Prisma types in frontend | Use `@eims/types` API responses |
| `any` for API responses | Typed `StudentResponse` |
| Inline Zod in controller | Import from `@eims/shared/schemas` |
| Business logic in Zod schema | Validation only; logic in service |

## Related Documents

- [05-naming-conventions.md](05-naming-conventions.md) — naming rules
- [07-database-design.md](07-database-design.md) — Prisma models
- [09-api-design.md](09-api-design.md) — API response formats
- [11-backend-guidelines.md](11-backend-guidelines.md) — NestJS usage
