# API Design

## Base URL & Versioning

```
Production:  https://api.{institution-domain}/api/v1
Development: http://localhost:3001/api/v1
```

- All routes prefixed with `/api/v1`
- Breaking changes require `/api/v2`
- Non-breaking additions (new fields, new endpoints) stay in v1

## REST Conventions

### Resource Naming

| Rule | Example |
|------|---------|
| Plural nouns | `/students`, `/fee-types` |
| kebab-case | `/assessment-records`, `/academic-sessions` |
| No verbs in URLs | `POST /students` not `POST /createStudent` |
| Actions as sub-resources | `POST /invitations/send`, `POST /attendance/mark` |

### HTTP Methods

| Method | Usage | Idempotent |
|--------|-------|------------|
| GET | Read one or list | Yes |
| POST | Create or action | No |
| PATCH | Partial update | Yes |
| PUT | Full replace (rare) | Yes |
| DELETE | Soft delete | Yes |

### Standard CRUD Endpoints

```
GET    /api/v1/students              List with pagination
GET    /api/v1/students/:id          Get one
POST   /api/v1/students              Create
PATCH  /api/v1/students/:id          Update
DELETE /api/v1/students/:id          Soft delete
```

### Nested Resources

```
GET    /api/v1/batches/:batchId/students
POST   /api/v1/assessments/:assessmentId/records
GET    /api/v1/students/:studentId/attendance
GET    /api/v1/students/:studentId/fee-invoices
```

## Request Format

### Headers

```
Authorization: Bearer <supabase_jwt>
Content-Type: application/json
Accept: application/json
```

### Query Parameters (lists)

```
GET /api/v1/students?page=1&limit=20&search=ahmad&batchId=xxx&sortBy=fullName&sortOrder=asc
```

| Param | Type | Default | Max |
|-------|------|---------|-----|
| `page` | integer | 1 | — |
| `limit` | integer | 20 | 100 |
| `search` | string | — | — |
| `sortBy` | string | `createdAt` | — |
| `sortOrder` | `asc` \| `desc` | `desc` | — |

Branch-scoped endpoints auto-filter by user's branch. Super Admin can pass `?branchId=xxx`.

### Request Body

```json
{
  "branchId": "clx...",
  "fullName": "Ahmad Khan",
  "phone": "+923001234567",
  "batchId": "clx...",
  "statusId": "clx..."
}
```

- camelCase keys
- Omit null/undefined fields on PATCH
- Validate with Zod schemas from `@eims/shared`

## Response Format

### Success — Single Resource

```json
{
  "id": "clx123",
  "branchId": "clx456",
  "fullName": "Ahmad Khan",
  "phone": "+923001234567",
  "batch": {
    "id": "clx789",
    "name": "HSSC Evening"
  },
  "status": {
    "id": "clx000",
    "code": "active",
    "label": "Active"
  },
  "createdAt": "2026-06-30T10:00:00.000Z",
  "updatedAt": "2026-06-30T10:00:00.000Z"
}
```

### Success — Paginated List

```json
{
  "data": [
    { "id": "clx123", "fullName": "Ahmad Khan" }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### Success — Create (201)

```json
{
  "id": "clx123",
  "fullName": "Ahmad Khan",
  "createdAt": "2026-06-30T10:00:00.000Z"
}
```

### Success — Delete (204)

No body. HTTP 204 No Content.

### Success — Action

```json
{
  "message": "Invitation sent successfully",
  "invitationId": "clx123"
}
```

## Error Format

All errors follow a consistent shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": {
    "fullName": ["String must contain at least 2 character(s)"],
    "phone": ["Invalid phone format"]
  }
}
```

### HTTP Status Codes

| Code | When |
|------|------|
| 200 | Successful GET, PATCH |
| 201 | Successful POST (create) |
| 204 | Successful DELETE |
| 400 | Validation error, bad input |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT but insufficient permissions or branch access |
| 404 | Resource not found (or not in user's branch) |
| 409 | Conflict (duplicate email, unique constraint) |
| 422 | Business rule violation (e.g. timetable conflict) |
| 429 | Rate limited |
| 500 | Internal server error |

**Security:** Return 404 (not 403) when resource exists but is in another branch — prevents information leakage.

### Global Exception Filter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return response.status(status).json(
        typeof body === 'string'
          ? { statusCode: status, message: body }
          : body,
      );
    }

    // Log unexpected errors, return generic 500
    this.logger.error(exception);
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}
```

## Authentication Endpoints

These may proxy Supabase or be handled client-side:

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/v1/auth/me` | GET | Current user + roles + permissions |
| `/api/v1/auth/sessions` | GET | List active sessions |
| `/api/v1/auth/sessions/:id` | DELETE | Revoke session |
| `/api/v1/invitations` | POST | Send invitation |
| `/api/v1/invitations/verify` | GET | Verify token |
| `/api/v1/invitations/accept` | POST | Accept invitation |

Login/password reset handled directly by Supabase client in Next.js.

## Module Endpoint Map

| Module | Base path |
|--------|-----------|
| Settings | `/api/v1/settings` |
| Branches | `/api/v1/branches` |
| Programs | `/api/v1/programs` |
| Batches | `/api/v1/batches` |
| Subjects | `/api/v1/subjects` |
| Academic Sessions | `/api/v1/academic-sessions` |
| Students | `/api/v1/students` |
| Parents | `/api/v1/parents` |
| Users | `/api/v1/users` |
| Attendance | `/api/v1/attendance` |
| Assessments | `/api/v1/assessments` |
| Assessment Records | `/api/v1/assessment-records` |
| Fee Types | `/api/v1/fee-types` |
| Fee Invoices | `/api/v1/fee-invoices` |
| Timetable | `/api/v1/timetable` |
| Notices | `/api/v1/notices` |
| Documents | `/api/v1/documents` |
| Analytics | `/api/v1/analytics` |
| Audit Logs | `/api/v1/audit-logs` |
| Form Builder | `/api/v1/form-fields` |

## OpenAPI / Swagger

- Enabled in development: `http://localhost:3001/api/docs`
- Disabled in production
- Generated from NestJS decorators + Zod schemas
- Use `@ApiTags`, `@ApiOperation`, `@ApiResponse` decorators

## Rate Limiting

| Endpoint type | Limit |
|---------------|-------|
| Auth-related | 10 req/min per IP |
| Read endpoints | 100 req/min per user |
| Write endpoints | 30 req/min per user |
| Bulk/report | 5 req/min per user |

Implement via `@nestjs/throttler`.

## CORS

```typescript
app.enableCors({
  origin: process.env.NEXT_PUBLIC_APP_URL,
  credentials: true,
});
```

## API Client (Frontend)

```typescript
// apps/web/src/lib/api-client.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token && {
        Authorization: `Bearer ${session.access_token}`,
      }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new ApiClientError(error);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}
```

## Related Documents

- [06-types-and-contracts.md](06-types-and-contracts.md) — request/response types
- [08-auth-and-rbac.md](08-auth-and-rbac.md) — auth headers and guards
- [11-backend-guidelines.md](11-backend-guidelines.md) — controller patterns
