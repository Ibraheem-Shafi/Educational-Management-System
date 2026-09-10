/**
 * Shahwali fee register import (session Apr 2026 – Mar 2027).
 *
 * Usage (repo root):
 *   npm run db:import:shahwali -w @eims/database -- --dry-run
 *   npm run db:import:shahwali -w @eims/database -- --catalog-only
 *   npm run db:import:shahwali -w @eims/database -- --apply
 *   npm run db:import:shahwali -w @eims/database -- --verify
 *
 * Optional: --file "path/to.xlsx"
 */
import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

/**
 * Long imports must NOT use the transaction pooler (:6543 / pgbouncer=true).
 * Prefer DIRECT_URL (session :5432 or db.*.supabase.co).
 */
function resolveImportDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  const pooled = process.env.DATABASE_URL?.trim();
  if (direct) {
    console.log('Import DB: DIRECT_URL (session) — recommended for bulk import');
    return direct;
  }
  if (pooled) {
    console.warn(
      'WARNING: DIRECT_URL is missing. Using DATABASE_URL (pooler) — connections may drop mid-import.',
    );
    return pooled;
  }
  throw new Error('Set DIRECT_URL (preferred) or DATABASE_URL in apps/api/.env');
}

const prisma = new PrismaClient({
  datasources: { db: { url: resolveImportDatabaseUrl() } },
});

const BRANCH_CODE = 'SWC';
const BRANCH_NAME = 'Shahwali Campus';
const SESSION_LABEL = '2026-2027';
const SESSION_START = new Date(Date.UTC(2026, 3, 1));
const SESSION_END = new Date(Date.UTC(2027, 2, 31));

/** Shahwali income heads (client catalog) plus extra heads used by the Excel register. */
const FEE_TYPES: Array<{ code: string; name: string }> = [
  { code: 'monthly', name: 'Tuition Fee' },
  { code: 'admission', name: 'Admission Fee' },
  { code: 'readmission', name: 'Re-Admission Fee' },
  { code: 'registration', name: 'Registration Fee' },
  { code: 'annual', name: 'Annual Charges' },
  { code: 'late_fee', name: 'Late Fee Charges' },
  { code: 'toppers_discount', name: 'Toppers Discount' },
  { code: 'siblings_discount', name: 'Siblings Discount' },
  { code: 'staff_child_discount', name: 'Staff Child Discount' },
  { code: 'referral_discount', name: 'Referral Discount' },
  { code: 'fee_discount', name: 'Fee Discount' },
  { code: 'fee_waiver', name: 'Fee Waive Off' },
  { code: 'annual_waiver', name: 'Annual Charges Waive Off' },
  { code: 'orphans_discount', name: 'Orphans Discount' },
  { code: 'board_registration', name: 'Board Registration Fee' },
  { code: 'board_admission', name: 'Board Admission Fee' },
  { code: 'sports', name: 'Sports Charges' },
  { code: 'annual_function', name: 'Annual Function Charges' },
  { code: 'id_card', name: 'ID Card Charges' },
  { code: 'fees_card', name: 'Fees Card Charges' },
  { code: 'trip', name: 'Trip Charges' },
  { code: 'uniform', name: 'Uniform Charges' },
  { code: 'copies', name: 'Copies Charges' },
  { code: 'diary', name: 'Diary Charges' },
  { code: 'security', name: 'Security Fee' },
  { code: 'party', name: 'Party Charges' },
];

const MONTHS: Array<{
  key: string;
  period: string;
  cols: {
    voucher: number;
    tuition: number;
    previous: number;
    annual?: number;
    party?: number;
    grand: number;
    paid: number;
    paidDate: number;
    due: number;
  };
}> = [
  {
    key: 'Apr',
    period: '2026-04',
    cols: { voucher: 21, tuition: 22, previous: 23, party: 24, annual: 25, grand: 26, paid: 27, paidDate: 28, due: 29 },
  },
  {
    key: 'May',
    period: '2026-05',
    cols: { voucher: 30, tuition: 31, previous: 32, annual: 33, party: 34, grand: 35, paid: 36, paidDate: 37, due: 38 },
  },
  {
    key: 'Jun',
    period: '2026-06',
    cols: { voucher: 39, tuition: 40, previous: 41, annual: 42, party: 43, grand: 44, paid: 45, paidDate: 46, due: 47 },
  },
  {
    key: 'Jul',
    period: '2026-07',
    cols: { voucher: 48, tuition: 49, previous: 50, annual: 51, grand: 52, paid: 53, paidDate: 54, due: 55 },
  },
  {
    key: 'Aug',
    period: '2026-08',
    cols: { voucher: 56, tuition: 57, previous: 58, annual: 59, grand: 60, paid: 61, paidDate: 62, due: 63 },
  },
  {
    key: 'Sep',
    period: '2026-09',
    cols: { voucher: 64, tuition: 67, previous: 68, annual: 69, grand: 70, paid: 71, paidDate: 72, due: 73 },
  },
  {
    key: 'Oct',
    period: '2026-10',
    cols: { voucher: 74, tuition: 75, previous: 76, annual: 77, grand: 78, paid: 79, paidDate: 80, due: 81 },
  },
  {
    key: 'Nov',
    period: '2026-11',
    cols: { voucher: 82, tuition: 83, previous: 84, annual: 85, grand: 86, paid: 87, paidDate: 88, due: 89 },
  },
  {
    key: 'Dec',
    period: '2026-12',
    cols: { voucher: 90, tuition: 91, previous: 92, annual: 93, grand: 94, paid: 95, paidDate: 96, due: 97 },
  },
  {
    key: 'Jan',
    period: '2027-01',
    cols: { voucher: 98, tuition: 99, previous: 100, annual: 101, grand: 102, paid: 103, paidDate: 104, due: 105 },
  },
  {
    key: 'Feb',
    period: '2027-02',
    cols: { voucher: 106, tuition: 107, previous: 108, annual: 109, grand: 110, paid: 111, paidDate: 112, due: 113 },
  },
  {
    key: 'Mar',
    period: '2027-03',
    cols: { voucher: 114, tuition: 115, previous: 116, annual: 117, grand: 118, paid: 119, paidDate: 120, due: 121 },
  },
];

type Cell = string | number | boolean | Date | null | undefined;

interface ParsedStudent {
  row: number;
  enrollmentNo: string;
  fullName: string;
  fatherName: string;
  className: string;
  oldClass: string | null;
  admissionDate: Date | null;
  dateOfBirth: Date | null;
  admissionFee: number;
  securityFee: number;
  registrationFee: number;
  annualCharges: number;
  monthlyFee: number;
  admissionPaid: number;
  admissionPaidDate: Date | null;
  admissionDue: number;
  admissionVoucher: string | null;
  contact: string | null;
  whatsapp: string | null;
  pending: number;
  months: Array<{
    period: string;
    voucherRaw: string | null;
    voucherNo: string | null;
    tuition: number;
    previous: number;
    annual: number;
    party: number;
    grand: number;
    paid: number;
    paidDate: Date | null;
    due: number;
  }>;
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argValue(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

function cell(row: Cell[], index0: number): Cell {
  return row[index0] ?? null;
}

function asString(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s.length ? s : null;
}

function asNumber(v: Cell): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/,/g, '').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: Cell): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = String(v).trim();
  if (!s || s.includes('?')) return null;
  // Excel serial
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      return new Date(epoch + serial * 86400000);
    }
  }
  // d/m/Y or d-m-Y
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    const d = Number(m1[1]);
    const mo = Number(m1[2]);
    let y = Number(m1[3]);
    if (y < 100) y += 2000;
    return new Date(Date.UTC(y, mo - 1, d));
  }
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  return null;
}

function classCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function isValidClass(name: string | null): name is string {
  if (!name) return false;
  if (/^\d+$/.test(name)) return false;
  const lower = name.toLowerCase();
  if (lower === 'total' || lower === 'blank') return false;
  return true;
}

function extractVoucher(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{3,})/);
  return m ? m[1] : raw.slice(0, 80);
}

function dueDateForPeriod(period: string): Date {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 10));
}

function money(n: number): Prisma.Decimal {
  return new Prisma.Decimal(Math.round(n * 100) / 100);
}

function defaultExcelPath(): string {
  const root = path.resolve(__dirname, '../../..');
  const candidates = [
    path.join(root, '1. Shahwali Fee Register April 25- March 27 (1).xlsx'),
    path.join(root, 'docs', '1. Shahwali Fee Register April 25- March 27 (1).xlsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function parseWorkbook(filePath: string): ParsedStudent[] {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: null, raw: true });
  const out: ParsedStudent[] = [];

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const fullName = asString(cell(row, 2));
    const enrollmentNo = asString(cell(row, 1));
    if (!fullName || !enrollmentNo) continue;
    const className = asString(cell(row, 5));
    if (!isValidClass(className)) continue;

    const months = MONTHS.map((m) => {
      const voucherRaw = asString(cell(row, m.cols.voucher));
      return {
        period: m.period,
        voucherRaw,
        voucherNo: extractVoucher(voucherRaw),
        tuition: asNumber(cell(row, m.cols.tuition)),
        previous: asNumber(cell(row, m.cols.previous)),
        annual: m.cols.annual !== undefined ? asNumber(cell(row, m.cols.annual)) : 0,
        party: m.cols.party !== undefined ? asNumber(cell(row, m.cols.party)) : 0,
        grand: asNumber(cell(row, m.cols.grand)),
        paid: asNumber(cell(row, m.cols.paid)),
        paidDate: parseDate(cell(row, m.cols.paidDate)),
        due: asNumber(cell(row, m.cols.due)),
      };
    });

    out.push({
      row: i + 1,
      enrollmentNo,
      fullName,
      fatherName: asString(cell(row, 3)) ?? 'Guardian',
      className,
      oldClass: asString(cell(row, 6)),
      admissionDate: parseDate(cell(row, 7)),
      dateOfBirth: parseDate(cell(row, 8)),
      admissionVoucher: extractVoucher(asString(cell(row, 9))),
      admissionFee: asNumber(cell(row, 10)),
      securityFee: asNumber(cell(row, 11)),
      registrationFee: asNumber(cell(row, 12)),
      annualCharges: asNumber(cell(row, 13)),
      monthlyFee: asNumber(cell(row, 14)),
      admissionPaid: asNumber(cell(row, 16)),
      admissionPaidDate: parseDate(cell(row, 17)),
      admissionDue: asNumber(cell(row, 18)),
      contact: asString(cell(row, 128)),
      whatsapp: asString(cell(row, 129)),
      pending: asNumber(cell(row, 126)),
      months,
    });
  }

  return out;
}

async function ensureCatalog() {
  const branch =
    (await prisma.branch.findUnique({ where: { code: BRANCH_CODE } })) ??
    (await prisma.branch.create({
      data: {
        name: BRANCH_NAME,
        code: BRANCH_CODE,
        city: 'Pakistan',
        isActive: true,
      },
    }));

  let session = await prisma.academicSession.findFirst({
    where: { name: SESSION_LABEL },
  });
  if (!session) {
    session = await prisma.academicSession.create({
      data: {
        name: SESSION_LABEL,
        startDate: SESSION_START,
        endDate: SESSION_END,
        isCurrent: true,
      },
    });
  }

  const feeTypeMap = new Map<string, string>();
  for (const ft of FEE_TYPES) {
    const row = await prisma.feeType.upsert({
      where: { code: ft.code },
      create: { name: ft.name, code: ft.code, isActive: true },
      update: { name: ft.name, isActive: true },
    });
    feeTypeMap.set(ft.code, row.id);
  }

  const studentActive = await prisma.lookupStatus.findFirst({
    where: { code: 'active', category: { code: 'student_status' } },
  });
  const feePending = await prisma.lookupStatus.findFirst({
    where: { code: 'pending', category: { code: 'fee_status' } },
  });
  const feePaid = await prisma.lookupStatus.findFirst({
    where: { code: 'paid', category: { code: 'fee_status' } },
  });
  const feePartial = await prisma.lookupStatus.findFirst({
    where: { code: 'partial', category: { code: 'fee_status' } },
  });

  if (!studentActive || !feePending || !feePaid) {
    throw new Error('Required lookup statuses missing (student active / fee pending / fee paid)');
  }

  return {
    branchId: branch.id,
    sessionId: session.id,
    feeTypeMap,
    studentActiveId: studentActive.id,
    feePendingId: feePending.id,
    feePaidId: feePaid.id,
    feePartialId: feePartial?.id ?? feePending.id,
  };
}

async function ensureClass(
  branchId: string,
  sessionId: string,
  className: string,
  cache: Map<string, { programId: string; batchId: string }>,
) {
  const key = className.trim();
  const hit = cache.get(key);
  if (hit) return hit;

  const code = classCode(key);
  let program = await prisma.program.findFirst({
    where: { branchId, OR: [{ code }, { name: key }], deletedAt: null },
  });
  if (!program) {
    program = await prisma.program.create({
      data: { branchId, name: key, code, isActive: true },
    });
  }

  let batch = await prisma.batch.findFirst({
    where: { branchId, programId: program.id, name: key, deletedAt: null },
  });
  if (!batch) {
    batch = await prisma.batch.create({
      data: {
        branchId,
        programId: program.id,
        name: key,
        code,
        sessionId,
        isActive: true,
      },
    });
  }

  const value = { programId: program.id, batchId: batch.id };
  cache.set(key, value);
  return value;
}

function firstPhone(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.replace(/\s+/g, ' ').match(/(\+?\d{10,15})/);
  return m ? m[1] : null;
}

function challanStatus(grand: number, paid: number, due: number): 'unpaid' | 'partial' | 'paid' {
  if (grand <= 0 || (paid >= grand && due <= 0)) return 'paid';
  if (paid > 0 && due > 0) return 'partial';
  if (paid > 0 && paid < grand) return 'partial';
  return due > 0 || paid <= 0 ? 'unpaid' : 'paid';
}

function invoiceStatusId(
  paid: number,
  due: number,
  net: number,
  ids: { feePendingId: string; feePaidId: string; feePartialId: string },
): string {
  if (net <= 0 || (paid >= net && due <= 0)) return ids.feePaidId;
  if (paid > 0 && paid < net) return ids.feePartialId;
  return ids.feePendingId;
}

async function upsertStudent(
  parsed: ParsedStudent,
  catalog: Awaited<ReturnType<typeof ensureCatalog>>,
  classCache: Map<string, { programId: string; batchId: string }>,
) {
  const cls = await ensureClass(catalog.branchId, catalog.sessionId, parsed.className, classCache);
  const phone = firstPhone(parsed.contact) ?? firstPhone(parsed.whatsapp);

  const existing = await prisma.student.findFirst({
    where: { branchId: catalog.branchId, admissionNumber: parsed.enrollmentNo, deletedAt: null },
  });

  const data = {
    fullName: parsed.fullName,
    dateOfBirth: parsed.dateOfBirth,
    phone,
    programId: cls.programId,
    batchId: cls.batchId,
    statusId: catalog.studentActiveId,
    admissionNumber: parsed.enrollmentNo,
    customFields: {
      shahwaliImport: true,
      oldClass: parsed.oldClass,
      whatsapp: parsed.whatsapp,
      contactRaw: parsed.contact,
      admissionDate: parsed.admissionDate?.toISOString() ?? null,
    } as Prisma.InputJsonValue,
  };

  const student = existing
    ? await prisma.student.update({ where: { id: existing.id }, data })
    : await prisma.student.create({
        data: { branchId: catalog.branchId, ...data },
      });

  let parent = await prisma.parent.findFirst({
    where: {
      fullName: parsed.fatherName,
      deletedAt: null,
      studentParents: { some: { studentId: student.id } },
    },
  });
  if (!parent) {
    parent = await prisma.parent.create({
      data: {
        fullName: parsed.fatherName,
        phone: firstPhone(parsed.whatsapp) ?? phone,
      },
    });
  }
  const link = await prisma.studentParent.findFirst({
    where: { studentId: student.id, parentId: parent.id },
  });
  if (!link) {
    await prisma.studentParent.create({
      data: { studentId: student.id, parentId: parent.id, relationshipCode: 'father' },
    });
  }

  return student;
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function isTransientDbError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === 'P1017' || code === 'P1001' || code === 'P1002' || code === 'P1008';
}

async function reconnectPrisma() {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  await prisma.$connect();
}

async function withDbRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransientDbError(err) || i === attempts) throw err;
      log(`Transient DB error on ${label} (attempt ${i}/${attempts}) — reconnecting…`);
      await new Promise((r) => setTimeout(r, 1200 * i));
      await reconnectPrisma();
    }
  }
  throw last;
}

async function upsertInvoice(
  tx: Prisma.TransactionClient,
  opts: {
    branchId: string;
    studentId: string;
    enrollmentNo: string;
    feeTypeId: string;
    feeTypeCode: string;
    billingPeriod: string | null;
    voucherNo: string | null;
    amount: number;
    paid: number;
    due: number;
    dueDate: Date | null;
    paidAt: Date | null;
    remarks: string;
    catalog: Awaited<ReturnType<typeof ensureCatalog>>;
  },
) {
  if (opts.amount <= 0) return null;

  const statusId = invoiceStatusId(opts.paid, opts.due, opts.amount, opts.catalog);
  const paidAt =
    statusId === opts.catalog.feePaidId || statusId === opts.catalog.feePartialId
      ? opts.paidAt ?? opts.dueDate
      : null;

  const invoiceNo = opts.billingPeriod
    ? `SWC-${opts.enrollmentNo}-${opts.billingPeriod}-${opts.feeTypeCode}`
    : `SWC-${opts.enrollmentNo}-ADM-${opts.feeTypeCode}`;

  const payload = {
    branchId: opts.branchId,
    studentId: opts.studentId,
    feeTypeId: opts.feeTypeId,
    billingPeriod: opts.billingPeriod,
    voucherNo: opts.voucherNo,
    amount: money(opts.amount),
    discount: money(0),
    fine: money(0),
    netAmount: money(opts.amount),
    dueDate: opts.dueDate,
    paidAt,
    statusId,
    remarks: opts.remarks,
  };

  const invoice = await tx.feeInvoice.upsert({
    where: { branchId_invoiceNo: { branchId: opts.branchId, invoiceNo } },
    create: { ...payload, invoiceNo },
    update: payload,
  });

  await tx.feePayment.deleteMany({ where: { invoiceId: invoice.id } });
  if (opts.paid > 0) {
    await tx.feePayment.create({
      data: {
        invoiceId: invoice.id,
        branchId: opts.branchId,
        amount: money(Math.min(opts.paid, opts.amount)),
        method: 'other',
        provider: 'shahwali_import',
        status: 'succeeded',
        paidAt: opts.paidAt ?? opts.dueDate ?? new Date(),
        meta: { source: 'shahwali_fee_register' },
      },
    });
  }

  return invoice;
}

async function importStudent(
  parsed: ParsedStudent,
  catalog: Awaited<ReturnType<typeof ensureCatalog>>,
  classCache: Map<string, { programId: string; batchId: string }>,
) {
  // Resolve class outside the long transaction (creates programs/batches once)
  const cls = await ensureClass(catalog.branchId, catalog.sessionId, parsed.className, classCache);
  const phone = firstPhone(parsed.contact) ?? firstPhone(parsed.whatsapp);
  const ft = catalog.feeTypeMap;

  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.student.findFirst({
        where: { branchId: catalog.branchId, admissionNumber: parsed.enrollmentNo, deletedAt: null },
      });

      const studentData = {
        fullName: parsed.fullName,
        dateOfBirth: parsed.dateOfBirth,
        phone,
        programId: cls.programId,
        batchId: cls.batchId,
        statusId: catalog.studentActiveId,
        admissionNumber: parsed.enrollmentNo,
        customFields: {
          shahwaliImport: true,
          oldClass: parsed.oldClass,
          whatsapp: parsed.whatsapp,
          contactRaw: parsed.contact,
          admissionDate: parsed.admissionDate?.toISOString() ?? null,
        } as Prisma.InputJsonValue,
      };

      const student = existing
        ? await tx.student.update({ where: { id: existing.id }, data: studentData })
        : await tx.student.create({
            data: { branchId: catalog.branchId, ...studentData },
          });

      let parent = await tx.parent.findFirst({
        where: {
          fullName: parsed.fatherName,
          deletedAt: null,
          studentParents: { some: { studentId: student.id } },
        },
      });
      if (!parent) {
        parent = await tx.parent.create({
          data: {
            fullName: parsed.fatherName,
            phone: firstPhone(parsed.whatsapp) ?? phone,
          },
        });
      }
      const link = await tx.studentParent.findFirst({
        where: { studentId: student.id, parentId: parent.id },
      });
      if (!link) {
        await tx.studentParent.create({
          data: { studentId: student.id, parentId: parent.id, relationshipCode: 'father' },
        });
      }

      const admissionItems: Array<{ code: string; amount: number }> = [
        { code: 'admission', amount: parsed.admissionFee },
        { code: 'security', amount: parsed.securityFee },
        { code: 'registration', amount: parsed.registrationFee },
        { code: 'annual', amount: parsed.annualCharges },
      ];

      let remainingAdmissionPaid = parsed.admissionPaid;
      for (const item of admissionItems) {
        if (item.amount <= 0) continue;
        const applyPaid = Math.min(remainingAdmissionPaid, item.amount);
        remainingAdmissionPaid -= applyPaid;
        await upsertInvoice(tx, {
          branchId: catalog.branchId,
          studentId: student.id,
          enrollmentNo: parsed.enrollmentNo,
          feeTypeId: ft.get(item.code)!,
          feeTypeCode: item.code,
          billingPeriod: null,
          voucherNo: parsed.admissionVoucher,
          amount: item.amount,
          paid: applyPaid,
          due: Math.max(0, item.amount - applyPaid),
          dueDate: parsed.admissionPaidDate ?? parsed.admissionDate,
          paidAt: applyPaid > 0 ? parsed.admissionPaidDate : null,
          remarks: `shahwali:admission:${item.code}`,
          catalog,
        });
      }

      for (const month of parsed.months) {
        const hasActivity =
          month.tuition > 0 ||
          month.annual > 0 ||
          month.party > 0 ||
          month.previous > 0 ||
          month.paid > 0 ||
          !!month.voucherNo;
        if (!hasActivity) continue;

        const dueDate = dueDateForPeriod(month.period);
        const lineDefs: Array<{
          code: 'monthly' | 'arrears' | 'annual' | 'party';
          label: string;
          amount: number;
          feeTypeCode: string | null;
        }> = [
          { code: 'monthly', label: 'Tuition Fee', amount: month.tuition, feeTypeCode: 'monthly' },
          { code: 'arrears', label: 'Arrears', amount: month.previous, feeTypeCode: null },
          { code: 'annual', label: 'Annual Charges', amount: month.annual, feeTypeCode: 'annual' },
          { code: 'party', label: 'Party Charges', amount: month.party, feeTypeCode: 'party' },
        ];

        const activeLines = lineDefs.filter((l) => l.amount > 0);
        if (!activeLines.length && month.grand <= 0) continue;

        const invoiceIds = new Map<string, string>();
        let remainingPaid = month.paid;
        for (const line of activeLines) {
          if (!line.feeTypeCode) continue;
          const applyPaid = Math.min(remainingPaid, line.amount);
          remainingPaid -= applyPaid;
          const inv = await upsertInvoice(tx, {
            branchId: catalog.branchId,
            studentId: student.id,
            enrollmentNo: parsed.enrollmentNo,
            feeTypeId: ft.get(line.feeTypeCode)!,
            feeTypeCode: line.feeTypeCode,
            billingPeriod: month.period,
            voucherNo: month.voucherNo,
            amount: line.amount,
            paid: applyPaid,
            due: Math.max(0, line.amount - applyPaid),
            dueDate,
            paidAt: applyPaid > 0 ? month.paidDate : null,
            remarks: `shahwali:${month.period}:${line.feeTypeCode}`,
            catalog,
          });
          if (inv) invoiceIds.set(line.code, inv.id);
        }

        const grandTotal =
          month.grand > 0 ? month.grand : activeLines.reduce((s, l) => s + l.amount, 0);
        const paidAmount = month.paid;
        const dueAmount = month.due > 0 ? month.due : Math.max(0, grandTotal - paidAmount);
        const status = challanStatus(grandTotal, paidAmount, dueAmount);
        const challanNo = `SWC-${parsed.enrollmentNo}-${month.period}`;

        const challan = await tx.feeChallan.upsert({
          where: {
            branchId_studentId_billingPeriod: {
              branchId: catalog.branchId,
              studentId: student.id,
              billingPeriod: month.period,
            },
          },
          create: {
            branchId: catalog.branchId,
            studentId: student.id,
            billingPeriod: month.period,
            challanNo,
            dueDate,
            status,
            grandTotal: money(grandTotal),
            paidAmount: money(paidAmount),
            dueAmount: money(dueAmount),
            sessionLabel: SESSION_LABEL,
            meta: {
              source: 'shahwali_fee_register',
              voucherRaw: month.voucherRaw,
              voucherNo: month.voucherNo,
              enrollmentNo: parsed.enrollmentNo,
            },
          },
          update: {
            challanNo,
            dueDate,
            status,
            grandTotal: money(grandTotal),
            paidAmount: money(paidAmount),
            dueAmount: money(dueAmount),
            sessionLabel: SESSION_LABEL,
            meta: {
              source: 'shahwali_fee_register',
              voucherRaw: month.voucherRaw,
              voucherNo: month.voucherNo,
              enrollmentNo: parsed.enrollmentNo,
            },
          },
        });

        await tx.feeChallanLine.deleteMany({ where: { challanId: challan.id } });
        const lineCreates = lineDefs
          .filter((l) => l.amount > 0)
          .map((line, sortOrder) => ({
            challanId: challan.id,
            code: line.code,
            label: line.label,
            amount: money(line.amount),
            sortOrder,
            feeInvoiceId: invoiceIds.get(line.code) ?? null,
          }));
        if (lineCreates.length) {
          await tx.feeChallanLine.createMany({ data: lineCreates });
        }
      }
    },
    { timeout: 180_000, maxWait: 30_000 },
  );
}

async function runDryRun(students: ParsedStudent[]) {
  const classes = new Map<string, number>();
  let monthChallans = 0;
  let pendingSum = 0;
  for (const s of students) {
    classes.set(s.className, (classes.get(s.className) ?? 0) + 1);
    pendingSum += s.pending;
    for (const m of s.months) {
      if (m.tuition > 0 || m.annual > 0 || m.party > 0 || m.previous > 0 || m.paid > 0 || m.voucherNo) {
        monthChallans += 1;
      }
    }
  }
  console.log(`Students: ${students.length}`);
  console.log(`Projected monthly challans: ${monthChallans}`);
  console.log(`Excel pending sum: ${pendingSum}`);
  console.log('Classes:');
  for (const [k, v] of [...classes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v}\t${k}`);
  }
}

async function runApply(students: ParsedStudent[], limit: number | null) {
  const list = limit && limit > 0 ? students.slice(0, limit) : students;
  log(`Connecting to database…`);
  await prisma.$connect();
  log(`Connected. Preparing Shahwali catalog (branch/fee types/classes)…`);
  const catalog = await withDbRetry('catalog', () => ensureCatalog());
  log(`Catalog ready (branch=${BRANCH_CODE}). Importing ${list.length} students…`);

  // Warm class cache
  const classCache = new Map<string, { programId: string; batchId: string }>();
  const classNames = [...new Set(list.map((s) => s.className))];
  for (const name of classNames) {
    await withDbRetry(`class:${name}`, () =>
      ensureClass(catalog.branchId, catalog.sessionId, name, classCache),
    );
  }
  log(`Classes ready (${classNames.length}). Starting student rows…`);

  let ok = 0;
  let failed = 0;
  const started = Date.now();
  for (const s of list) {
    try {
      await withDbRetry(`student:${s.enrollmentNo}`, () => importStudent(s, catalog, classCache));
      ok += 1;
      log(`OK ${ok}/${list.length} ${s.enrollmentNo} ${s.fullName}`);
      // Proactively refresh the connection every 10 students (avoids idle pooler drops)
      if (ok % 10 === 0) {
        await reconnectPrisma();
      }
    } catch (err) {
      failed += 1;
      const code = (err as { code?: string } | null)?.code;
      console.error(`FAIL row ${s.row} ${s.enrollmentNo} ${s.fullName}${code ? ` [${code}]` : ''}:`, err);
      // Keep going after reconnect so a single drop doesn't kill the whole run
      try {
        await reconnectPrisma();
      } catch {
        // ignore
      }
    }
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  log(`Done in ${secs}s. ok=${ok} failed=${failed} branch=${BRANCH_CODE}`);
  if (failed > 0) {
    log(`Re-run the same --apply command to retry failures (idempotent).`);
  }
}

async function runVerify(students: ParsedStudent[]) {
  const branch = await prisma.branch.findUnique({ where: { code: BRANCH_CODE } });
  if (!branch) {
    console.error('Branch SWC not found — run --apply first');
    return;
  }
  const dbCount = await prisma.student.count({
    where: { branchId: branch.id, deletedAt: null },
  });
  const challanCount = await prisma.feeChallan.count({ where: { branchId: branch.id } });
  console.log(`DB students: ${dbCount} (excel named ${students.length})`);
  console.log(`DB challans: ${challanCount}`);

  const samples = students.filter((s) => s.fullName).slice(0, 10);
  for (const s of samples) {
    const st = await prisma.student.findFirst({
      where: { branchId: branch.id, admissionNumber: s.enrollmentNo },
    });
    if (!st) {
      console.log(`MISSING ${s.enrollmentNo} ${s.fullName}`);
      continue;
    }
    const challans = await prisma.feeChallan.findMany({
      where: { studentId: st.id },
      include: { lines: true },
      orderBy: { billingPeriod: 'asc' },
    });
    const excelMonths = s.months.filter(
      (m) => m.tuition > 0 || m.paid > 0 || m.voucherNo || m.previous > 0,
    ).length;
    console.log(
      `${s.enrollmentNo} ${s.fullName}: excelMonths=${excelMonths} dbChallans=${challans.length} pendingExcel=${s.pending}`,
    );
  }
}

async function runCatalogOnly() {
  log('Connecting to database…');
  await prisma.$connect();
  log('Upserting Shahwali income heads (fee types)…');
  const catalog = await withDbRetry('catalog', () => ensureCatalog());
  log(`Catalog ready. ${catalog.feeTypeMap.size} fee types on branch ${BRANCH_CODE}.`);
  for (const ft of FEE_TYPES) {
    console.log(`  ${ft.code}\t${ft.name}`);
  }
}

async function main() {
  const catalogOnly = argFlag('--catalog-only');
  const dryRun = argFlag('--dry-run') || (!argFlag('--apply') && !argFlag('--verify') && !catalogOnly);
  const apply = argFlag('--apply');
  const verify = argFlag('--verify');
  const limitRaw = argValue('--limit');
  const limit = limitRaw ? Number(limitRaw) : null;

  if (catalogOnly) {
    await runCatalogOnly();
    return;
  }

  const filePath = path.resolve(argValue('--file') ?? defaultExcelPath());

  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel not found: ${filePath}`);
  }
  console.log(`Reading ${filePath}`);
  const students = parseWorkbook(filePath);
  console.log(`Parsed ${students.length} students`);

  if (dryRun && !apply && !verify) {
    await runDryRun(students);
    return;
  }
  if (apply) await runApply(students, Number.isFinite(limit) ? limit : null);
  if (verify) await runVerify(students);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
