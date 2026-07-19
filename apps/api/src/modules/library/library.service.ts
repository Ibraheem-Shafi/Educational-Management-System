import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import { paginatedResult } from '../../common/utils/pagination.util';
import { countWithTrend, thirtyDaysAgo } from '../../common/utils/stats.util';
import type { AuthUser, CountWithTrend } from '@eims/types';
import {
  LIBRARY_DEFAULT_LOAN_DAYS,
  LIBRARY_FINE_PER_DAY_PKR,
  LIBRARY_MAX_RENEWALS,
  LIBRARY_RENEWAL_DAYS,
} from '@eims/shared';
import type {
  CreateLibraryBookInput,
  CreateLibraryCategoryInput,
  CreateLibraryCopyInput,
  CreateLibraryReservationInput,
  IssueLibraryLoanInput,
  ListLibraryBooksQuery,
  ListLibraryCategoriesQuery,
  ListLibraryFinesQuery,
  ListLibraryLoansQuery,
  ListLibraryReservationsQuery,
  UpdateLibraryBookInput,
  UpdateLibraryCategoryInput,
  UpdateLibraryCopyInput,
  UpdateLibraryFineInput,
  UpdateLibraryReservationInput,
} from '@eims/shared';

const STATS_CACHE_TTL_MS = 45_000;

export interface LibraryStatsResponse {
  totalBooks: CountWithTrend;
  totalCopies: CountWithTrend;
  activeLoans: CountWithTrend;
  overdueLoans: CountWithTrend;
  activeReservations: CountWithTrend;
  unpaidFines: CountWithTrend;
}

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  private invalidateStats(branchId: string | null) {
    this.ttlCache.delete(`library:stats:${branchId ?? 'all'}`);
  }

  private async assertBorrower(
    branchId: string,
    borrowerType: 'student' | 'user',
    studentId?: string,
    userId?: string,
  ) {
    if (borrowerType === 'student') {
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, branchId, deletedAt: null },
      });
      if (!student) throw new NotFoundException('Student not found');
      return;
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
  }

  // --- Categories ---

  async findAllCategories(query: ListLibraryCategoriesQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const where = {
      deletedAt: null,
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [categories, total] = await Promise.all([
      this.prisma.libraryCategory.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { books: { where: { deletedAt: null } } } } },
      }),
      this.prisma.libraryCategory.count({ where }),
    ]);

    return paginatedResult(categories, total, page, limit);
  }

  async findOneCategory(id: string, branchId: string | null) {
    const category = await this.prisma.libraryCategory.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: { _count: { select: { books: { where: { deletedAt: null } } } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async createCategory(input: CreateLibraryCategoryInput, user: AuthUser) {
    const category = await this.prisma.libraryCategory.create({
      data: { branchId: input.branchId, name: input.name },
    });
    await this.audit.log({
      userId: user.id,
      action: 'library.category.created',
      entityType: 'LibraryCategory',
      entityId: category.id,
      newValue: category,
    });
    this.invalidateStats(input.branchId);
    return category;
  }

  async updateCategory(
    id: string,
    input: UpdateLibraryCategoryInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.libraryCategory.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const category = await this.prisma.libraryCategory.update({
      where: { id },
      data: { ...(input.name !== undefined ? { name: input.name } : {}) },
    });
    await this.audit.log({
      userId: user.id,
      action: 'library.category.updated',
      entityType: 'LibraryCategory',
      entityId: id,
      previousValue: existing,
      newValue: category,
    });
    this.invalidateStats(existing.branchId);
    return category;
  }

  async removeCategory(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.libraryCategory.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const category = await this.prisma.libraryCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      userId: user.id,
      action: 'library.category.deleted',
      entityType: 'LibraryCategory',
      entityId: id,
      previousValue: existing,
    });
    this.invalidateStats(existing.branchId);
    return category;
  }

  // --- Books ---

  async findAllBooks(query: ListLibraryBooksQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const where = {
      deletedAt: null,
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { author: { contains: query.search, mode: 'insensitive' as const } },
              { isbn: { contains: query.search, mode: 'insensitive' as const } },
              { accessionNo: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [books, total] = await Promise.all([
      this.prisma.libraryBook.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          copies: { where: { deletedAt: null }, select: { id: true, copyCode: true, status: true } },
          _count: { select: { reservations: { where: { deletedAt: null, status: 'active' } } } },
        },
      }),
      this.prisma.libraryBook.count({ where }),
    ]);

    return paginatedResult(books, total, page, limit);
  }

  async findOneBook(id: string, branchId: string | null) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: {
        category: { select: { id: true, name: true } },
        copies: { where: { deletedAt: null } },
      },
    });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async createBook(input: CreateLibraryBookInput, user: AuthUser) {
    if (input.categoryId) {
      const category = await this.prisma.libraryCategory.findFirst({
        where: { id: input.categoryId, branchId: input.branchId, deletedAt: null },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    const book = await this.prisma.libraryBook.create({
      data: {
        branchId: input.branchId,
        categoryId: input.categoryId ?? undefined,
        title: input.title,
        author: input.author,
        publisher: input.publisher,
        edition: input.edition,
        isbn: input.isbn,
        accessionNo: input.accessionNo,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      userId: user.id,
      action: 'library.book.created',
      entityType: 'LibraryBook',
      entityId: book.id,
      newValue: book,
    });
    this.invalidateStats(input.branchId);
    return book;
  }

  async updateBook(
    id: string,
    input: UpdateLibraryBookInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.libraryBook.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Book not found');

    if (input.categoryId) {
      const category = await this.prisma.libraryCategory.findFirst({
        where: { id: input.categoryId, branchId: existing.branchId, deletedAt: null },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    const book = await this.prisma.libraryBook.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.author !== undefined ? { author: input.author } : {}),
        ...(input.publisher !== undefined ? { publisher: input.publisher } : {}),
        ...(input.edition !== undefined ? { edition: input.edition } : {}),
        ...(input.isbn !== undefined ? { isbn: input.isbn } : {}),
        ...(input.accessionNo !== undefined ? { accessionNo: input.accessionNo } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
    });
    await this.audit.log({
      userId: user.id,
      action: 'library.book.updated',
      entityType: 'LibraryBook',
      entityId: id,
      previousValue: existing,
      newValue: book,
    });
    this.invalidateStats(existing.branchId);
    return book;
  }

  async removeBook(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.libraryBook.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Book not found');

    const activeLoan = await this.prisma.libraryLoan.findFirst({
      where: {
        returnedAt: null,
        copy: { bookId: id, deletedAt: null },
      },
    });
    if (activeLoan) {
      throw new BadRequestException('Cannot delete book with active loans');
    }

    const book = await this.prisma.libraryBook.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      userId: user.id,
      action: 'library.book.deleted',
      entityType: 'LibraryBook',
      entityId: id,
      previousValue: existing,
    });
    this.invalidateStats(existing.branchId);
    return book;
  }

  // --- Copies ---

  async createCopy(input: CreateLibraryCopyInput, user: AuthUser, branchId: string | null) {
    const book = await this.prisma.libraryBook.findFirst({
      where: {
        id: input.bookId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
    });
    if (!book) throw new NotFoundException('Book not found');

    const copy = await this.prisma.libraryCopy.create({
      data: {
        bookId: input.bookId,
        copyCode: input.copyCode,
        status: input.status ?? 'available',
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'library.copy.created',
      entityType: 'LibraryCopy',
      entityId: copy.id,
      newValue: copy,
    });
    this.invalidateStats(book.branchId);
    return copy;
  }

  async updateCopy(
    id: string,
    input: UpdateLibraryCopyInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.libraryCopy.findFirst({
      where: {
        id,
        deletedAt: null,
        book: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      },
      include: { book: { select: { branchId: true } } },
    });
    if (!existing) throw new NotFoundException('Copy not found');

    const copy = await this.prisma.libraryCopy.update({
      where: { id },
      data: {
        ...(input.copyCode !== undefined ? { copyCode: input.copyCode } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'library.copy.updated',
      entityType: 'LibraryCopy',
      entityId: id,
      previousValue: existing,
      newValue: copy,
    });
    this.invalidateStats(existing.book.branchId);
    return copy;
  }

  // --- Loans ---

  async findAllLoans(query: ListLibraryLoansQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const now = new Date();
    const where = {
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(query.activeOnly ? { returnedAt: null } : {}),
      ...(query.borrowerType ? { borrowerType: query.borrowerType } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.overdueOnly
        ? { returnedAt: null, dueAt: { lt: now } }
        : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [loans, total] = await Promise.all([
      this.prisma.libraryLoan.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          copy: {
            include: {
              book: { select: { id: true, title: true, author: true } },
            },
          },
          student: { select: { id: true, fullName: true } },
          user: { select: { id: true, fullName: true } },
          issuedBy: { select: { id: true, fullName: true } },
          fines: true,
        },
      }),
      this.prisma.libraryLoan.count({ where }),
    ]);

    return paginatedResult(loans, total, page, limit);
  }

  async issueLoan(input: IssueLibraryLoanInput, user: AuthUser) {
    const copy = await this.prisma.libraryCopy.findFirst({
      where: {
        id: input.copyId,
        deletedAt: null,
        status: 'available',
        book: { branchId: input.branchId, deletedAt: null },
      },
      include: { book: true },
    });
    if (!copy) throw new BadRequestException('Copy not available for issue');

    await this.assertBorrower(
      input.branchId,
      input.borrowerType,
      input.studentId,
      input.userId,
    );

    const dueAt = input.dueAt
      ? new Date(input.dueAt)
      : new Date(Date.now() + LIBRARY_DEFAULT_LOAN_DAYS * 86400000);

    const loan = await this.prisma.$transaction(async (tx) => {
      await tx.libraryCopy.update({
        where: { id: input.copyId },
        data: { status: 'issued' },
      });
      return tx.libraryLoan.create({
        data: {
          copyId: input.copyId,
          borrowerType: input.borrowerType,
          studentId: input.studentId,
          userId: input.userId,
          dueAt,
          issuedById: user.id,
          branchId: input.branchId,
        },
        include: {
          copy: { include: { book: { select: { id: true, title: true } } } },
          student: { select: { id: true, fullName: true } },
          user: { select: { id: true, fullName: true } },
        },
      });
    });

    await this.audit.log({
      userId: user.id,
      action: 'library.loan.issued',
      entityType: 'LibraryLoan',
      entityId: loan.id,
      newValue: loan,
    });
    this.invalidateStats(input.branchId);
    return loan;
  }

  async returnLoan(id: string, user: AuthUser, branchId: string | null) {
    const loan = await this.prisma.libraryLoan.findFirst({
      where: {
        id,
        returnedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      include: { copy: true },
    });
    if (!loan) throw new NotFoundException('Active loan not found');

    const returnedAt = new Date();
    const daysOverdue = Math.max(
      0,
      Math.ceil((returnedAt.getTime() - loan.dueAt.getTime()) / 86400000),
    );

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.libraryLoan.update({
        where: { id },
        data: { returnedAt },
      }),
      this.prisma.libraryCopy.update({
        where: { id: loan.copyId },
        data: { status: 'available' },
      }),
    ];

    if (daysOverdue > 0) {
      ops.push(
        this.prisma.libraryFine.create({
          data: {
            loanId: id,
            branchId: loan.branchId,
            amount: new Prisma.Decimal(daysOverdue * LIBRARY_FINE_PER_DAY_PKR),
            status: 'unpaid',
            reason: `${daysOverdue} day(s) overdue @ PKR ${LIBRARY_FINE_PER_DAY_PKR}/day`,
          },
        }),
      );
    }

    const results = await this.prisma.$transaction(ops);
    const updatedLoan = results[0];

    await this.audit.log({
      userId: user.id,
      action: 'library.loan.returned',
      entityType: 'LibraryLoan',
      entityId: id,
      newValue: { returnedAt, daysOverdue },
    });
    this.invalidateStats(loan.branchId);
    return updatedLoan;
  }

  async renewLoan(id: string, user: AuthUser, branchId: string | null) {
    const loan = await this.prisma.libraryLoan.findFirst({
      where: {
        id,
        returnedAt: null,
        ...(branchId ? { branchId } : {}),
      },
    });
    if (!loan) throw new NotFoundException('Active loan not found');
    if (loan.renewedCount >= LIBRARY_MAX_RENEWALS) {
      throw new BadRequestException(`Maximum ${LIBRARY_MAX_RENEWALS} renewals allowed`);
    }

    const dueAt = new Date(loan.dueAt.getTime() + LIBRARY_RENEWAL_DAYS * 86400000);
    const updated = await this.prisma.libraryLoan.update({
      where: { id },
      data: {
        dueAt,
        renewedCount: loan.renewedCount + 1,
      },
      include: {
        copy: { include: { book: { select: { id: true, title: true } } } },
        student: { select: { id: true, fullName: true } },
        user: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'library.loan.renewed',
      entityType: 'LibraryLoan',
      entityId: id,
      newValue: { dueAt, renewedCount: updated.renewedCount },
    });
    this.invalidateStats(loan.branchId);
    return updated;
  }

  // --- Reservations ---

  async findAllReservations(query: ListLibraryReservationsQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const where = {
      deletedAt: null,
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.bookId ? { bookId: query.bookId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [reservations, total] = await Promise.all([
      this.prisma.libraryReservation.findMany({
        where,
        orderBy: { reservedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          book: { select: { id: true, title: true, author: true } },
          student: { select: { id: true, fullName: true } },
          user: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.libraryReservation.count({ where }),
    ]);

    return paginatedResult(reservations, total, page, limit);
  }

  async createReservation(input: CreateLibraryReservationInput, user: AuthUser) {
    const book = await this.prisma.libraryBook.findFirst({
      where: { id: input.bookId, branchId: input.branchId, deletedAt: null },
    });
    if (!book) throw new NotFoundException('Book not found');

    await this.assertBorrower(
      input.branchId,
      input.borrowerType,
      input.studentId,
      input.userId,
    );

    const reservation = await this.prisma.libraryReservation.create({
      data: {
        bookId: input.bookId,
        borrowerType: input.borrowerType,
        studentId: input.studentId,
        userId: input.userId,
        branchId: input.branchId,
        status: 'active',
      },
      include: {
        book: { select: { id: true, title: true, author: true } },
        student: { select: { id: true, fullName: true } },
        user: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'library.reservation.created',
      entityType: 'LibraryReservation',
      entityId: reservation.id,
      newValue: reservation,
    });
    this.invalidateStats(input.branchId);
    return reservation;
  }

  async updateReservation(
    id: string,
    input: UpdateLibraryReservationInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.libraryReservation.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Reservation not found');

    const reservation = await this.prisma.libraryReservation.update({
      where: { id },
      data: { ...(input.status !== undefined ? { status: input.status } : {}) },
      include: {
        book: { select: { id: true, title: true, author: true } },
        student: { select: { id: true, fullName: true } },
        user: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'library.reservation.updated',
      entityType: 'LibraryReservation',
      entityId: id,
      previousValue: existing,
      newValue: reservation,
    });
    this.invalidateStats(existing.branchId);
    return reservation;
  }

  async removeReservation(id: string, user: AuthUser, branchId: string | null) {
    const existing = await this.prisma.libraryReservation.findFirst({
      where: { id, deletedAt: null, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Reservation not found');

    const reservation = await this.prisma.libraryReservation.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'cancelled' },
    });

    await this.audit.log({
      userId: user.id,
      action: 'library.reservation.deleted',
      entityType: 'LibraryReservation',
      entityId: id,
      previousValue: existing,
    });
    this.invalidateStats(existing.branchId);
    return reservation;
  }

  // --- Fines ---

  async findAllFines(query: ListLibraryFinesQuery, branchId: string | null) {
    const effectiveBranchId = branchId ?? query.branchId;
    const where = {
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.loanId ? { loanId: query.loanId } : {}),
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 8;

    const [fines, total] = await Promise.all([
      this.prisma.libraryFine.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          loan: {
            include: {
              copy: { include: { book: { select: { id: true, title: true } } } },
              student: { select: { id: true, fullName: true } },
              user: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
      this.prisma.libraryFine.count({ where }),
    ]);

    return paginatedResult(fines, total, page, limit);
  }

  async updateFine(
    id: string,
    input: UpdateLibraryFineInput,
    user: AuthUser,
    branchId: string | null,
  ) {
    const existing = await this.prisma.libraryFine.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Fine not found');

    const fine = await this.prisma.libraryFine.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      },
      include: {
        loan: {
          include: {
            copy: { include: { book: { select: { id: true, title: true } } } },
            student: { select: { id: true, fullName: true } },
            user: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    await this.audit.log({
      userId: user.id,
      action: 'library.fine.updated',
      entityType: 'LibraryFine',
      entityId: id,
      previousValue: existing,
      newValue: fine,
    });
    this.invalidateStats(existing.branchId);
    return fine;
  }

  // --- Stats ---

  async getStats(branchId: string | null): Promise<LibraryStatsResponse> {
    const cacheKey = `library:stats:${branchId ?? 'all'}`;
    const cached = this.ttlCache.get<LibraryStatsResponse>(cacheKey);
    if (cached) return cached;

    const branchFilter = branchId ? { branchId } : {};
    const now = new Date();
    const thirtyAgo = thirtyDaysAgo();

    const bookBase = { deletedAt: null, ...branchFilter };
    const copyBase = { deletedAt: null, book: { deletedAt: null, ...branchFilter } };
    const loanBase = { ...branchFilter };
    const reservationBase = { deletedAt: null, status: 'active', ...branchFilter };

    const [
      totalBooks,
      totalBooksPrev,
      totalCopies,
      totalCopiesPrev,
      activeLoans,
      activeLoansPrev,
      overdueLoans,
      activeReservations,
      activeReservationsPrev,
      unpaidFines,
      unpaidFinesPrev,
    ] = await Promise.all([
      this.prisma.libraryBook.count({ where: bookBase }),
      this.prisma.libraryBook.count({
        where: { ...bookBase, createdAt: { lte: thirtyAgo } },
      }),
      this.prisma.libraryCopy.count({ where: copyBase }),
      this.prisma.libraryCopy.count({
        where: { ...copyBase, createdAt: { lte: thirtyAgo } },
      }),
      this.prisma.libraryLoan.count({ where: { ...loanBase, returnedAt: null } }),
      this.prisma.libraryLoan.count({
        where: { ...loanBase, returnedAt: null, issuedAt: { lte: thirtyAgo } },
      }),
      this.prisma.libraryLoan.count({
        where: { ...loanBase, returnedAt: null, dueAt: { lt: now } },
      }),
      this.prisma.libraryReservation.count({ where: reservationBase }),
      this.prisma.libraryReservation.count({
        where: { ...reservationBase, reservedAt: { lte: thirtyAgo } },
      }),
      this.prisma.libraryFine.count({ where: { ...branchFilter, status: 'unpaid' } }),
      this.prisma.libraryFine.count({
        where: {
          ...branchFilter,
          status: 'unpaid',
          createdAt: { lte: thirtyAgo },
        },
      }),
    ]);

    const result: LibraryStatsResponse = {
      totalBooks: countWithTrend(totalBooks, totalBooksPrev),
      totalCopies: countWithTrend(totalCopies, totalCopiesPrev),
      activeLoans: countWithTrend(activeLoans, activeLoansPrev),
      overdueLoans: countWithTrend(overdueLoans, 0),
      activeReservations: countWithTrend(activeReservations, activeReservationsPrev),
      unpaidFines: countWithTrend(unpaidFines, unpaidFinesPrev),
    };

    this.ttlCache.set(cacheKey, result, STATS_CACHE_TTL_MS);
    return result;
  }
}
