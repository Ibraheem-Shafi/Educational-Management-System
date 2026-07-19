import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { LIBRARY_FINE_PER_DAY_PKR } from '@eims/shared';
import {
  configuredBranchCodes,
  featuredStudentDemoKey,
  secondaryStudentDemoKey,
  staffUserId,
} from '../branch-helpers';
import type { DemoContext } from '../types';

function categoryName(branchCode: string): string {
  return `CSS & PMS Reference [${branchCode}]`;
}

function demoBooks(branchCode: string) {
  const prefix = branchCode === 'LAHORE' ? 'LHR' : 'ISB';
  return [
    {
      title: 'Pakistan Affairs',
      author: 'Ikram Rabbani',
      accessionNo: `LIB-${prefix}-001`,
      copies: [`${prefix}-PA-001`, `${prefix}-PA-002`],
    },
    {
      title: 'English Precis & Composition',
      author: 'Jahangir Books',
      accessionNo: `LIB-${prefix}-002`,
      copies: [`${prefix}-EP-001`, `${prefix}-EP-002`],
    },
  ] as const;
}

export const ALL_DEMO_ACCESSION_NOS = [
  ...demoBooks('MAIN').map((b) => b.accessionNo),
  ...demoBooks('LAHORE').map((b) => b.accessionNo),
];

export async function seedLibrary(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;

  for (const branchCode of configuredBranchCodes(ctx)) {
    const branchId = ctx.branchMap.get(branchCode)!;
    const books = demoBooks(branchCode);
    const issuedById = staffUserId(ctx, branchCode, 'receptionist') ?? adminId;
    const studentOne = ctx.studentIds.get(featuredStudentDemoKey(branchCode));
    const studentTwo = ctx.studentIds.get(secondaryStudentDemoKey(branchCode));

    const existingBooks = await prisma.libraryBook.findMany({
      where: { accessionNo: { in: books.map((b) => b.accessionNo) } },
      select: { id: true },
    });
    if (existingBooks.length > 0) {
      const bookIds = existingBooks.map((b) => b.id);
      await prisma.libraryFine.deleteMany({
        where: { loan: { copy: { bookId: { in: bookIds } } } },
      });
      await prisma.libraryLoan.deleteMany({
        where: { copy: { bookId: { in: bookIds } } },
      });
      await prisma.libraryReservation.deleteMany({ where: { bookId: { in: bookIds } } });
      await prisma.libraryCopy.deleteMany({ where: { bookId: { in: bookIds } } });
      await prisma.libraryBook.deleteMany({ where: { id: { in: bookIds } } });
    }

    await prisma.libraryCategory.deleteMany({
      where: { branchId, name: categoryName(branchCode) },
    });

    const category = await prisma.libraryCategory.create({
      data: { branchId, name: categoryName(branchCode) },
    });

    const bookRecords: Array<{ id: string; copies: { id: string; copyCode: string }[] }> = [];

    for (const demo of books) {
      const book = await prisma.libraryBook.create({
        data: {
          branchId,
          categoryId: category.id,
          title: demo.title,
          author: demo.author,
          accessionNo: demo.accessionNo,
          publisher: 'Demo Publisher',
        },
      });

      const copies: { id: string; copyCode: string }[] = [];
      for (const copyCode of demo.copies) {
        const copy = await prisma.libraryCopy.create({
          data: { bookId: book.id, copyCode, status: 'available' },
        });
        copies.push(copy);
      }
      bookRecords.push({ id: book.id, copies });
    }

    if (!studentOne || bookRecords.length === 0) continue;

    const activeCopy = bookRecords[0]!.copies[0]!;
    const dueSoon = new Date(Date.now() + 7 * 86400000);

    await prisma.libraryCopy.update({
      where: { id: activeCopy.id },
      data: { status: 'issued' },
    });

    await prisma.libraryLoan.create({
      data: {
        copyId: activeCopy.id,
        borrowerType: 'student',
        studentId: studentOne,
        dueAt: dueSoon,
        issuedById,
        branchId,
      },
    });

    const overdueCopy = bookRecords[1]?.copies[0];
    if (overdueCopy) {
      const daysOverdue = 3;
      const dueAt = new Date(Date.now() - daysOverdue * 86400000);
      const returnedAt = new Date();

      await prisma.libraryCopy.update({
        where: { id: overdueCopy.id },
        data: { status: 'available' },
      });

      const overdueLoan = await prisma.libraryLoan.create({
        data: {
          copyId: overdueCopy.id,
          borrowerType: 'student',
          studentId: studentOne,
          dueAt,
          returnedAt,
          issuedById,
          branchId,
        },
      });

      await prisma.libraryFine.create({
        data: {
          loanId: overdueLoan.id,
          branchId,
          amount: new Prisma.Decimal(daysOverdue * LIBRARY_FINE_PER_DAY_PKR),
          status: 'unpaid',
          reason: `${daysOverdue} day(s) overdue @ PKR ${LIBRARY_FINE_PER_DAY_PKR}/day`,
        },
      });
    }

    if (studentTwo && bookRecords[0]) {
      await prisma.libraryReservation.create({
        data: {
          bookId: bookRecords[0].id,
          borrowerType: 'student',
          studentId: studentTwo,
          status: 'active',
          branchId,
        },
      });
    }
  }
}
