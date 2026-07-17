import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { LIBRARY_FINE_PER_DAY_PKR } from '@eims/shared';
import type { DemoContext } from '../types';

const DEMO_CATEGORY_NAME = 'CSS & PMS Reference';
const DEMO_BOOKS = [
  {
    title: 'Pakistan Affairs',
    author: 'Ikram Rabbani',
    accessionNo: 'LIB-DEMO-001',
    copies: ['PA-001', 'PA-002'],
  },
  {
    title: 'English Precis & Composition',
    author: 'Jahangir Books',
    accessionNo: 'LIB-DEMO-002',
    copies: ['EP-001', 'EP-002'],
  },
] as const;

export async function seedLibrary(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const branchId =
    ctx.branchMap.get('MAIN') ?? ctx.branchMap.values().next().value ?? null;
  if (!branchId) return;

  const adminId = ctx.userIds.get('admin@nexium.edu.pk') ?? null;
  const firstStudentId =
    ctx.studentIds.values().next().value ??
    [...ctx.studentIds.values()][0] ??
    null;

  // Clean prior demo library rows by accession numbers
  const demoBooks = await prisma.libraryBook.findMany({
    where: { accessionNo: { in: DEMO_BOOKS.map((b) => b.accessionNo) } },
    select: { id: true },
  });
  if (demoBooks.length > 0) {
    const bookIds = demoBooks.map((b) => b.id);
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
    where: { branchId, name: DEMO_CATEGORY_NAME },
  });

  const category = await prisma.libraryCategory.create({
    data: { branchId, name: DEMO_CATEGORY_NAME },
  });

  const bookRecords: Array<{ id: string; copies: { id: string; copyCode: string }[] }> = [];

  for (const demo of DEMO_BOOKS) {
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

  if (!firstStudentId || bookRecords.length === 0) return;

  // Active loan on first copy of first book
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
      studentId: firstStudentId,
      dueAt: dueSoon,
      issuedById: adminId,
      branchId,
    },
  });

  // Returned overdue loan with fine on first copy of second book
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
        studentId: firstStudentId,
        dueAt,
        returnedAt,
        issuedById: adminId,
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
}
