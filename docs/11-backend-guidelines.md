# Backend Guidelines

## Overview

The backend is a **NestJS 11** REST API. Each domain is a self-contained module with controller, service, and DTOs. Business logic lives in services; controllers are thin.

## Module Structure

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

### Module Registration

```typescript
// students.module.ts
@Module({
  imports: [PrismaModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
```

### Controller (thin)

```typescript
@Controller('students')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
@ApiTags('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Permissions('students.read')
  findAll(
    @Query(new ZodValidationPipe(listStudentsQuerySchema)) query: ListStudentsQuery,
    @CurrentUser() user: AppUser,
    @BranchId() branchId: string | null,
  ) {
    return this.studentsService.findAll(query, branchId);
  }

  @Post()
  @Permissions('students.create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createStudentSchema)) body: CreateStudentInput,
    @CurrentUser() user: AppUser,
  ) {
    return this.studentsService.create(body, user);
  }
}
```

### Service (business logic)

```typescript
@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: ListStudentsQuery, branchId: string | null) {
    const where = {
      deletedAt: null,
      ...(branchId && { branchId }),
      ...(query.batchId && { batchId: query.batchId }),
      ...(query.search && {
        fullName: { contains: query.search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: { batch: true, program: true },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: data.map(this.toResponse),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(input: CreateStudentInput, user: AppUser) {
    const student = await this.prisma.student.create({
      data: {
        ...input,
        createdById: user.id,
      },
      include: { batch: true },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'student.created',
      entityType: 'Student',
      entityId: student.id,
      newValue: student,
    });

    return this.toResponse(student);
  }

  private toResponse(student: StudentWithRelations): StudentResponse {
    return {
      id: student.id,
      branchId: student.branchId,
      fullName: student.fullName,
      // ... map all fields
      batch: student.batch ? { id: student.batch.id, name: student.batch.name } : undefined,
    };
  }
}
```

## Global Setup

### main.ts

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: process.env.NEXT_PUBLIC_APP_URL, credentials: true });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ZodValidationPipe()); // default for body

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('EIMS API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3001);
}
```

## Guards & Decorators

Apply in this order on controllers:

1. `AuthGuard` — verify JWT, load user
2. `BranchGuard` — resolve branch scope
3. `PermissionsGuard` — check permission codes

### Custom Decorators

```typescript
// @CurrentUser() — extracts request.user
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);

// @BranchId() — extracts request.branchId
export const BranchId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().branchId,
);

// @Permissions('students.read')
export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
```

## Audit Logging

Every critical mutation must be audited. Use an interceptor or explicit calls in services.

### AuditService

```typescript
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: {
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    previousValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({ data: entry });
  }
}
```

### What to Audit

| Action | Entity |
|--------|--------|
| `student.created` / `student.updated` | Student |
| `attendance.marked` / `attendance.updated` | AttendanceRecord |
| `assessment.marks.updated` | AssessmentRecord |
| `fee.invoice.created` / `fee.payment.recorded` | FeeInvoice |
| `user.created` / `user.role.changed` | User |
| `permission.changed` | RolePermission |
| `settings.updated` | InstitutionSettings |
| `auth.login` / `auth.login_failed` | User |

### Audit Interceptor (optional for automatic capture)

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const auditMeta = this.reflector.get('audit', context.getHandler());
    if (!auditMeta) return next.handle();

    // Capture before state, execute, capture after state, log
    return next.handle().pipe(
      tap((result) => this.auditService.log({ /* ... */ })),
    );
  }
}
```

## Prisma Service

```typescript
// prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### Transaction Pattern

Use transactions for multi-entity operations:

```typescript
async admitStudent(input: AdmitStudentInput, user: AppUser) {
  return this.prisma.$transaction(async (tx) => {
    const student = await tx.student.create({ data: { ... } });
    if (input.parent) {
      const parent = await tx.parent.upsert({ ... });
      await tx.studentParent.create({ data: { studentId: student.id, parentId: parent.id } });
    }
    return student;
  });
}
```

## Error Handling

Throw NestJS HTTP exceptions with consistent shape:

```typescript
throw new NotFoundException('Student not found');
throw new BadRequestException({ message: 'Validation failed', details: errors });
throw new ForbiddenException('Insufficient permissions');
throw new ConflictException('Email already registered');
```

Return 404 (not 403) for cross-branch access attempts.

## Validation

- All request bodies validated with Zod schemas from `@eims/shared`
- Query params validated with Zod via `ZodValidationPipe`
- Business rules validated in service layer (e.g. "batch must belong to same branch")

```typescript
async create(input: CreateStudentInput, user: AppUser) {
  if (input.batchId) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, branchId: input.branchId, deletedAt: null },
    });
    if (!batch) throw new BadRequestException('Invalid batch for this branch');
  }
  // ...
}
```

## Pagination Helper

```typescript
// common/utils/pagination.ts
export function paginate<T>(data: T[], total: number, query: PaginationQuery) {
  return {
    data,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
```

## Module Guidelines

### Each Module Should

- Own its controller, service, and DTOs
- Export service if other modules need it
- Not import another module's controller
- Use `AuditService` for mutations
- Map Prisma types to API response types in service

### Cross-Module Communication

- Import the other module and inject its **service** (not controller)
- Or use NestJS events for loose coupling:

```typescript
// events/student-admitted.event.ts
export class StudentAdmittedEvent {
  constructor(public readonly studentId: string, public readonly branchId: string) {}
}

// fees module listens and creates admission fee invoice
@OnEvent('student.admitted')
handleStudentAdmitted(event: StudentAdmittedEvent) { /* ... */ }
```

## Testing

### Unit Tests (Vitest)

```typescript
describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new StudentsService(prisma, mockAuditService);
  });

  it('should filter by branchId', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);
    await service.findAll({ page: 1, limit: 20 }, 'branch-1');
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: 'branch-1' }) }),
    );
  });
});
```

### What to Test

| Layer | Focus |
|-------|-------|
| Service | Business logic, branch filtering, validation |
| Guard | Permission checks, branch resolution |
| Controller | Integration with service (e2e) |

## Related Documents

- [08-auth-and-rbac.md](08-auth-and-rbac.md) — guards and permissions
- [09-api-design.md](09-api-design.md) — endpoint conventions
- [07-database-design.md](07-database-design.md) — Prisma models
- [16-coding-standards.md](16-coding-standards.md) — testing and linting
