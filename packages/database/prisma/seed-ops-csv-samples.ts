import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MARK = 'SAMPLE-CSV-CHECK';
const today = new Date();
today.setHours(0, 0, 0, 0);

async function main() {
  const branch =
    (await prisma.branch.findFirst({ where: { code: 'SWC' } })) ??
    (await prisma.branch.findFirst({
      where: { name: { contains: 'Islamabad', mode: 'insensitive' } },
    })) ??
    (await prisma.branch.findFirst({ where: { code: 'MAIN' } })) ??
    (await prisma.branch.findFirst({ where: { deletedAt: null } }));
  if (!branch) throw new Error('No branch found');

  const subject = await prisma.subject.findFirst({ where: { deletedAt: null, isActive: true } });
  const batch = await prisma.batch.findFirst({
    where: { branchId: branch.id, deletedAt: null, isActive: true },
  });
  const teacher = await prisma.user.findFirst({
    where: { deletedAt: null, isActive: true, OR: [{ branchId: branch.id }, { branchId: null }] },
    orderBy: { createdAt: 'asc' },
  });
  const student = await prisma.student.findFirst({
    where: { branchId: branch.id, deletedAt: null },
  });
  const budget = await prisma.budget.findFirst({
    where: { OR: [{ branchId: branch.id }, { branchId: null }] },
    orderBy: { year: 'desc' },
  });

  if (!subject) throw new Error('No subject found');
  if (!batch) throw new Error('No batch found for branch');
  if (!teacher) throw new Error('No staff user found');
  if (!student) throw new Error('No student found for branch');

  await prisma.syllabusUnit.deleteMany({ where: { title: { contains: MARK } } });
  await prisma.lessonPlan.deleteMany({ where: { title: { contains: MARK } } });
  await prisma.classroomObservation.deleteMany({ where: { summary: { contains: MARK } } });
  await prisma.schoolEvent.deleteMany({ where: { title: { contains: MARK } } });
  await prisma.disciplineIncident.deleteMany({ where: { notes: { contains: MARK } } });
  await prisma.academicAction.deleteMany({ where: { title: { contains: MARK } } });
  await prisma.staffTraining.deleteMany({ where: { title: { contains: MARK } } });
  await prisma.applicant.deleteMany({ where: { fullName: { contains: MARK } } });
  await prisma.workOrder.deleteMany({ where: { issue: { contains: MARK } } });
  await prisma.safetyIncident.deleteMany({ where: { summary: { contains: MARK } } });
  await prisma.itOutage.deleteMany({ where: { summary: { contains: MARK } } });
  await prisma.complianceControl.deleteMany({ where: { title: { contains: MARK } } });
  await prisma.pettyCashVoucher.deleteMany({ where: { description: { contains: MARK } } });
  await prisma.pettyCashFund.deleteMany({ where: { name: { contains: MARK } } });
  await prisma.bankStatementLine.deleteMany({
    where: { OR: [{ chequeNumber: { startsWith: '462678' } }, { payee: { contains: MARK } }] },
  });
  await prisma.bankStatement.deleteMany({
    where: { OR: [{ bankName: 'Al Flah Bank' }, { lines: { none: {} }, branchId: branch.id, status: 'open' }] },
  });
  await prisma.ownerDrawing.deleteMany({ where: { payee: { contains: 'Saeed Butt' } } });
  await prisma.purchaseOrder.deleteMany({ where: { poNo: { startsWith: 'SAMPLE-CSV' } } });
  await prisma.fixedAsset.deleteMany({ where: { name: { contains: MARK } } });
  await prisma.vendorBill.deleteMany({ where: { description: { contains: MARK } } });
  await prisma.vendor.deleteMany({ where: { name: { contains: MARK } } });
  if (budget) {
    await prisma.budgetForecastLine.deleteMany({
      where: { budgetId: budget.id, amount: 123456.78 },
    });
  }

  await prisma.syllabusUnit.create({
    data: {
      branchId: branch.id,
      subjectId: subject.id,
      batchId: batch.id,
      title: `${MARK} Algebra coverage`,
      plannedTopics: 10,
      completedTopics: 4,
      status: 'in_progress',
    },
  });

  await prisma.lessonPlan.create({
    data: {
      branchId: branch.id,
      date: today,
      batchId: batch.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      title: `${MARK} Quadratic equations`,
      status: 'taught',
    },
  });

  await prisma.classroomObservation.create({
    data: {
      branchId: branch.id,
      observedAt: today,
      teacherId: teacher.id,
      summary: `${MARK} Clear board work and pacing`,
      score: 82,
    },
  });

  await prisma.schoolEvent.createMany({
    data: [
      {
        branchId: branch.id,
        kind: 'co_curricular',
        title: `${MARK} Sports day`,
        eventDate: today,
        attendeeCount: 40,
      },
      {
        branchId: branch.id,
        kind: 'ptm',
        title: `${MARK} Term PTM`,
        eventDate: today,
        attendeeCount: 25,
      },
    ],
  });

  await prisma.disciplineIncident.create({
    data: {
      branchId: branch.id,
      studentId: student.id,
      incidentDate: today,
      type: 'late',
      action: 'warning',
      notes: `${MARK} arrived 20 minutes late`,
    },
  });

  await prisma.academicAction.createMany({
    data: [
      {
        branchId: branch.id,
        kind: 'improvement_plan',
        title: `${MARK} Math support plan`,
        status: 'open',
      },
      {
        branchId: branch.id,
        kind: 'challenge',
        title: `${MARK} Weak algebra group`,
        status: 'in_progress',
      },
    ],
  });

  await prisma.staffTraining.create({
    data: {
      branchId: branch.id,
      userId: teacher.id,
      title: `${MARK} Classroom management PD`,
      trainedAt: today,
      hours: 2,
    },
  });

  const vendor = await prisma.vendor.create({
    data: { branchId: branch.id, name: `${MARK} City Supplies` },
  });

  await prisma.vendorBill.createMany({
    data: [
      {
        branchId: branch.id,
        vendorId: vendor.id,
        billDate: today,
        amount: 18500,
        category: 'electricity',
        description: `${MARK} electricity bill`,
        status: 'open',
      },
      {
        branchId: branch.id,
        vendorId: vendor.id,
        billDate: today,
        amount: 9200,
        category: 'gas',
        description: `${MARK} gas bill`,
        status: 'open',
      },
      {
        branchId: branch.id,
        vendorId: vendor.id,
        billDate: today,
        amount: 4100,
        category: 'water',
        description: `${MARK} water bill`,
        status: 'open',
      },
      {
        branchId: branch.id,
        vendorId: vendor.id,
        billDate: today,
        amount: 5000,
        category: 'phone',
        description: `${MARK} mobile + ptcl bill`,
        status: 'open',
      },
      {
        branchId: branch.id,
        vendorId: vendor.id,
        billDate: today,
        amount: 2200,
        category: 'maintenance',
        description: `${MARK} AC service`,
        status: 'open',
      },
      {
        branchId: branch.id,
        vendorId: vendor.id,
        billDate: today,
        amount: 800,
        category: 'general',
        description: `${MARK} stationery AP`,
        status: 'open',
      },
    ],
  });

  const fund = await prisma.pettyCashFund.create({
    data: { branchId: branch.id, name: `${MARK} Front office float`, openingBalance: 5000 },
  });
  await prisma.pettyCashVoucher.create({
    data: {
      branchId: branch.id,
      fundId: fund.id,
      voucherDate: today,
      amount: 350,
      payee: 'Corner stationery',
      description: `${MARK} pens and registers`,
    },
  });

  const existingRegister = await prisma.bankStatement.findFirst({
    where: { branchId: branch.id, year: 2026, month: 8, bankName: 'Al Flah Bank', deletedAt: null },
  });
  const statement =
    existingRegister ??
    (await prisma.bankStatement.create({
      data: {
        branchId: branch.id,
        year: 2026,
        month: 8,
        bankName: 'Al Flah Bank',
        chequeBookNo: '',
        chequeBookSerialFrom: '46267817',
        chequeBookSerialTo: '46267825',
        status: 'open',
      },
    }));
  if (!existingRegister) {
    await prisma.bankStatementLine.createMany({
    data: [
      {
        statementId: statement.id,
        issueDate: new Date('2026-08-04'),
        chequeNumber: '46267817',
        payee: 'Bakhshish Ellahi',
        onAccountOf: 'Salary',
        amount: 18500,
      },
      {
        statementId: statement.id,
        issueDate: new Date('2026-08-10'),
        chequeNumber: '46267818',
        payee: 'Nosheen',
        onAccountOf: 'Salary Staff',
        amount: 112400,
      },
      {
        statementId: statement.id,
        issueDate: new Date('2026-08-11'),
        chequeNumber: '46267819',
        payee: 'Nosheen',
        onAccountOf: 'Petty Cash',
        amount: 10000,
      },
      {
        statementId: statement.id,
        issueDate: new Date('2026-08-11'),
        chequeNumber: '46267820',
        payee: 'Nosheen',
        onAccountOf: 'Mobile + Ptcl',
        amount: 5000,
      },
      {
        statementId: statement.id,
        issueDate: new Date('2026-08-13'),
        chequeNumber: '46267821',
        payee: 'Nosheen',
        onAccountOf: 'Staff Salary',
        amount: 30350,
      },
      {
        statementId: statement.id,
        issueDate: new Date('2026-08-20'),
        chequeNumber: '46267822',
        payee: 'Zahid Hussain',
        onAccountOf: 'Building Rent',
        amount: 95000,
      },
      {
        statementId: statement.id,
        issueDate: new Date('2026-08-21'),
        chequeNumber: '46267823',
        payee: 'Hasham Ali',
        onAccountOf: 'Labour Work',
        amount: 33400,
      },
      {
        statementId: statement.id,
        issueDate: new Date('2026-08-24'),
        chequeNumber: '46267824',
        payee: 'Bakhshish Ellahi',
        onAccountOf: 'Advance Salary',
        amount: 18500,
      },
      {
        statementId: statement.id,
        issueDate: new Date('2026-08-25'),
        chequeNumber: '46267825',
        payee: 'Saeed Butt',
        onAccountOf: 'By Sir Anjum',
        amount: 20000,
      },
    ],
  });
  }

  const existingDrawing = await prisma.ownerDrawing.findFirst({
    where: { branchId: branch.id, chequeNumber: '46267825', deletedAt: null },
  });
  if (!existingDrawing) {
    const created = await prisma.ownerDrawing.create({
      data: {
        branchId: branch.id,
        drawingDate: new Date('2026-08-25'),
        payee: 'Saeed Butt',
        amount: 20000,
        method: 'cheque',
        chequeNumber: '46267825',
        notes: 'By Sir Anjum',
      },
    });
    const drawingsAccount =
      (await prisma.account.findFirst({ where: { code: '3000', branchId: null, deletedAt: null } })) ??
      (await prisma.account.create({
        data: { code: '3000', name: 'Drawings', type: 'equity', branchId: null, isSystem: true, isActive: true },
      }));
    const bankAccount =
      (await prisma.account.findFirst({ where: { code: '1100', branchId: null, deletedAt: null } })) ??
      (await prisma.account.create({
        data: { code: '1100', name: 'Bank', type: 'asset', branchId: null, isSystem: true, isActive: true },
      }));
    const voucherNo = `PAY-DRAW-${branch.code ?? branch.id.slice(0, 6)}`;
    const existingVoucher = await prisma.journalVoucher.findFirst({
      where: { branchId: branch.id, voucherNo },
    });
    if (!existingVoucher) {
      const voucher = await prisma.journalVoucher.create({
        data: {
          branchId: branch.id,
          voucherType: 'payment',
          voucherNo,
          voucherDate: new Date('2026-08-25'),
          narration: 'Owner drawing — Saeed Butt (By Sir Anjum)',
          status: 'posted',
          sourceType: 'owner_drawing',
          sourceId: created.id,
          postedAt: new Date('2026-08-25'),
          lines: {
            create: [
              { accountId: drawingsAccount.id, debit: 20000, credit: 0 },
              { accountId: bankAccount.id, debit: 0, credit: 20000 },
            ],
          },
        },
      });
      await prisma.ownerDrawing.update({
        where: { id: created.id },
        data: { journalVoucherId: voucher.id },
      });
    }
  }

  await prisma.purchaseOrder.create({
    data: {
      branchId: branch.id,
      vendorId: vendor.id,
      poNo: 'SAMPLE-CSV-PO-1',
      orderDate: today,
      status: 'sent',
      lines: {
        create: [{ description: `${MARK} whiteboard markers`, quantity: 10, unitCost: 40 }],
      },
    },
  });

  await prisma.fixedAsset.create({
    data: {
      branchId: branch.id,
      name: `${MARK} Classroom projector`,
      category: 'electronics',
      scope: 'school',
      quantity: 1,
      purchaseDate: today,
      cost: 45000,
      status: 'active',
    },
  });
  await prisma.fixedAsset.createMany({
    data: [
      {
        branchId: branch.id,
        name: `${MARK} Student chairs`,
        category: 'chairs',
        scope: 'class',
        quantity: 40,
        batchId: batch.id,
        purchaseDate: today,
        cost: 48000,
        status: 'active',
      },
      {
        branchId: branch.id,
        name: `${MARK} Teacher desk set`,
        category: 'furniture',
        scope: 'class',
        quantity: 4,
        batchId: batch.id,
        purchaseDate: today,
        cost: 22000,
        status: 'active',
      },
      {
        branchId: branch.id,
        name: `${MARK} Science lab kits`,
        category: 'equipment',
        scope: 'class',
        quantity: 8,
        batchId: batch.id,
        purchaseDate: today,
        cost: 16000,
        status: 'active',
      },
    ],
  });

  if (budget) {
    await prisma.budgetForecastLine.upsert({
      where: { budgetId_month: { budgetId: budget.id, month: today.getMonth() + 1 } },
      update: { amount: 123456.78 },
      create: { budgetId: budget.id, month: today.getMonth() + 1, amount: 123456.78 },
    });
  }

  await prisma.applicant.create({
    data: {
      branchId: branch.id,
      fullName: `${MARK} Ayesha Applicant`,
      roleApplied: 'Teacher',
      stage: 'interview',
      appliedAt: today,
    },
  });

  await prisma.workOrder.create({
    data: {
      branchId: branch.id,
      location: 'Block A washroom',
      issue: `${MARK} leaking tap`,
      reportedAt: today,
      status: 'open',
      cost: 1500,
    },
  });

  await prisma.safetyIncident.create({
    data: {
      branchId: branch.id,
      incidentDate: today,
      severity: 'low',
      summary: `${MARK} wet floor near stairs`,
      action: 'placed caution sign',
    },
  });

  await prisma.itOutage.create({
    data: {
      branchId: branch.id,
      startedAt: new Date(),
      system: 'ERP',
      summary: `${MARK} brief Wi-Fi drop`,
      resolved: true,
      endedAt: new Date(),
    },
  });

  await prisma.complianceControl.create({
    data: {
      branchId: branch.id,
      title: `${MARK} fire drill log`,
      category: 'safety',
      status: 'open',
    },
  });

  console.log(
    JSON.stringify({
      branch: branch.name,
      subject: subject.name,
      batch: batch.name,
      teacher: teacher.fullName,
      student: student.fullName,
      budget: budget?.name ?? null,
      mark: MARK,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
