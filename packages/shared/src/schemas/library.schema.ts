import { z } from 'zod';

export const LIBRARY_FINE_PER_DAY_PKR = 50;
export const LIBRARY_MAX_RENEWALS = 2;
export const LIBRARY_RENEWAL_DAYS = 7;
export const LIBRARY_DEFAULT_LOAN_DAYS = 14;

export const libraryCopyStatuses = ['available', 'issued', 'reserved', 'lost'] as const;
export const libraryBorrowerTypes = ['student', 'user'] as const;
export const libraryReservationStatuses = ['active', 'fulfilled', 'cancelled'] as const;
export const libraryFineStatuses = ['unpaid', 'paid', 'waived'] as const;

const borrowerRefSchema = z
  .object({
    borrowerType: z.enum(libraryBorrowerTypes),
    studentId: z.string().optional(),
    userId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.borrowerType === 'student' && !data.studentId) {
      ctx.addIssue({ code: 'custom', message: 'studentId is required for student borrowers', path: ['studentId'] });
    }
    if (data.borrowerType === 'user' && !data.userId) {
      ctx.addIssue({ code: 'custom', message: 'userId is required for user borrowers', path: ['userId'] });
    }
  });

export const createLibraryCategorySchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(1).max(200),
});

export type CreateLibraryCategoryInput = z.infer<typeof createLibraryCategorySchema>;

export const updateLibraryCategorySchema = createLibraryCategorySchema.omit({ branchId: true }).partial();

export type UpdateLibraryCategoryInput = z.infer<typeof updateLibraryCategorySchema>;

export const listLibraryCategoriesQuerySchema = z.object({
  branchId: z.string().optional(),
  search: z.string().optional(),
});

export type ListLibraryCategoriesQuery = z.infer<typeof listLibraryCategoriesQuerySchema>;

export const createLibraryBookSchema = z.object({
  branchId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  title: z.string().min(1).max(300),
  author: z.string().min(1).max(200),
  publisher: z.string().optional(),
  edition: z.string().optional(),
  isbn: z.string().optional(),
  accessionNo: z.string().optional(),
});

export type CreateLibraryBookInput = z.infer<typeof createLibraryBookSchema>;

export const updateLibraryBookSchema = createLibraryBookSchema.omit({ branchId: true }).partial();

export type UpdateLibraryBookInput = z.infer<typeof updateLibraryBookSchema>;

export const listLibraryBooksQuerySchema = z.object({
  branchId: z.string().optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
});

export type ListLibraryBooksQuery = z.infer<typeof listLibraryBooksQuerySchema>;

export const createLibraryCopySchema = z.object({
  bookId: z.string().min(1),
  copyCode: z.string().min(1).max(50),
  status: z.enum(libraryCopyStatuses).optional(),
});

export type CreateLibraryCopyInput = z.infer<typeof createLibraryCopySchema>;

export const updateLibraryCopySchema = z.object({
  copyCode: z.string().min(1).max(50).optional(),
  status: z.enum(libraryCopyStatuses).optional(),
});

export type UpdateLibraryCopyInput = z.infer<typeof updateLibraryCopySchema>;

export const issueLibraryLoanSchema = borrowerRefSchema.and(
  z.object({
    branchId: z.string().min(1),
    copyId: z.string().min(1),
    dueAt: z.string().datetime().optional(),
  }),
);

export type IssueLibraryLoanInput = z.infer<typeof issueLibraryLoanSchema>;

export const listLibraryLoansQuerySchema = z.object({
  branchId: z.string().optional(),
  activeOnly: z.coerce.boolean().optional(),
  borrowerType: z.enum(libraryBorrowerTypes).optional(),
  studentId: z.string().optional(),
  userId: z.string().optional(),
  overdueOnly: z.coerce.boolean().optional(),
});

export type ListLibraryLoansQuery = z.infer<typeof listLibraryLoansQuerySchema>;

export const createLibraryReservationSchema = borrowerRefSchema.and(
  z.object({
    branchId: z.string().min(1),
    bookId: z.string().min(1),
  }),
);

export type CreateLibraryReservationInput = z.infer<typeof createLibraryReservationSchema>;

export const updateLibraryReservationSchema = z.object({
  status: z.enum(libraryReservationStatuses).optional(),
});

export type UpdateLibraryReservationInput = z.infer<typeof updateLibraryReservationSchema>;

export const listLibraryReservationsQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.enum(libraryReservationStatuses).optional(),
  bookId: z.string().optional(),
  studentId: z.string().optional(),
  userId: z.string().optional(),
});

export type ListLibraryReservationsQuery = z.infer<typeof listLibraryReservationsQuerySchema>;

export const listLibraryFinesQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.enum(libraryFineStatuses).optional(),
  loanId: z.string().optional(),
});

export type ListLibraryFinesQuery = z.infer<typeof listLibraryFinesQuerySchema>;

export const updateLibraryFineSchema = z.object({
  status: z.enum(libraryFineStatuses),
  reason: z.string().optional(),
});

export type UpdateLibraryFineInput = z.infer<typeof updateLibraryFineSchema>;

export const libraryStatsQuerySchema = z.object({
  branchId: z.string().optional(),
});

export type LibraryStatsQuery = z.infer<typeof libraryStatsQuerySchema>;
