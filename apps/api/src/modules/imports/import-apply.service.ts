import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import type {
  FeeWideMonthGroup,
  ImportJobOptionsInput,
  ImportMappingPayload,
  ImportPipelineType,
} from '@eims/shared';
import { ImportPrismaService } from './import-prisma.service';
import {
  asMapping,
  cellToNumber,
  looksLikeHeaderMappedRow,
  mapRow,
  normalizeImportPhone,
  normalizeTime,
  parseBool,
  parseDayOfWeek,
  parseFlexibleDate,
  randomTempPassword,
  type RawSheetRow,
} from './import-row.util';

export type RowApplyResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; field?: string; message: string; code?: string };

type ProgramBatchIds = { programId: string; batchId: string };

@Injectable()
export class ImportApplyService {
  private supabaseAdmin: SupabaseClient | null = null;
  private statusCache = new Map<string, string>();
  private feeTypeCache = new Map<string, string>();
  private programBatchCache = new Map<string, ProgramBatchIds>();
  private programBatchInflight = new Map<string, Promise<ProgramBatchIds>>();
  private parentCache = new Map<string, string>();
  private parentInflight = new Map<string, Promise<string>>();

  constructor(
    private readonly prisma: ImportPrismaService,
    private readonly config: ConfigService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) this.supabaseAdmin = createClient(url, key);
  }

  /** Clear job-scoped caches at the start of each import job. */
  beginJob(): void {
    this.programBatchCache.clear();
    this.programBatchInflight.clear();
    this.parentCache.clear();
    this.parentInflight.clear();
    // Keep status/feeType caches warm across jobs in this process
  }

  endJob(): void {
    this.programBatchCache.clear();
    this.programBatchInflight.clear();
    this.parentCache.clear();
    this.parentInflight.clear();
  }

  /**
   * Prefetch existing students for a chunk (one query). Used to warm lookups;
   * upserts remain the write path for correctness under concurrency.
   */
  async prefetchStudents(branchId: string, admissionNumbers: string[]): Promise<void> {
    const unique = [...new Set(admissionNumbers.map((a) => a.trim()).filter(Boolean))];
    if (!unique.length) return;
    await this.prisma.student.findMany({
      where: { branchId, admissionNumber: { in: unique }, deletedAt: null },
      select: { id: true, admissionNumber: true },
    });
  }

  /** Ensure distinct class labels are resolved once before parallel row apply. */
  async prefetchProgramBatches(
    branchId: string,
    pairs: Array<{ programName: string; batchName: string }>,
  ): Promise<void> {
    const seen = new Set<string>();
    const tasks: Promise<unknown>[] = [];
    for (const p of pairs) {
      const programName = p.programName.trim();
      const batchName = p.batchName.trim();
      if (!programName || !batchName) continue;
      const key = this.programBatchKey(branchId, programName, batchName);
      if (seen.has(key)) continue;
      seen.add(key);
      tasks.push(this.ensureProgramBatch(branchId, programName, batchName));
    }
    await Promise.all(tasks);
  }

  private programBatchKey(branchId: string, programName: string, batchName: string): string {
    return `${branchId}|${programName.toLowerCase()}|${batchName.toLowerCase()}`;
  }

  private parentKey(fullName: string, phone?: string | null): string {
    return `${fullName.trim().toLowerCase()}|${(phone ?? '').trim()}`;
  }

  async applyRow(input: {
    pipeline: ImportPipelineType;
    branchId: string;
    raw: RawSheetRow;
    mapping: unknown;
    options: unknown;
    createdById: string;
  }): Promise<RowApplyResult> {
    const mapping = asMapping(input.mapping);
    const options = (input.options ?? {}) as ImportJobOptionsInput;
    const mapped = mapRow(input.raw, mapping.columns);

    try {
      switch (input.pipeline) {
        case 'academic':
          return await this.applyAcademic(input.branchId, mapped);
        case 'students':
          return await this.applyStudent(input.branchId, mapped);
        case 'fee_register':
          return await this.applyFeeRegister(input.branchId, mapped, mapping, options, input.raw);
        case 'staff':
          return await this.applyStaff(input.branchId, mapped, options, input.createdById);
        case 'timetable':
          return await this.applyTimetable(input.branchId, mapped);
        case 'notices':
          return await this.applyNotice(input.branchId, mapped, input.createdById);
        default:
          return { ok: false, message: `Unknown pipeline: ${input.pipeline}` };
      }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        code: 'apply_error',
      };
    }
  }

  validateMappedRow(
    pipeline: ImportPipelineType,
    mapped: Record<string, string>,
    mapping: ImportMappingPayload,
    options: ImportJobOptionsInput,
  ): RowApplyResult | null {
    const req: Record<ImportPipelineType, string[]> = {
      academic: ['programName', 'batchName'],
      students: ['fullName', 'admissionNumber'],
      fee_register: ['admissionNumber'],
      staff: ['fullName'],
      timetable: ['batchName', 'subjectName', 'dayOfWeek', 'startTime', 'endTime'],
      notices: ['title', 'body', 'audience'],
    };
    if (
      (pipeline === 'students' || pipeline === 'fee_register') &&
      looksLikeHeaderMappedRow(mapped)
    ) {
      return { ok: true, skipped: true };
    }
    for (const key of req[pipeline]) {
      if (!mapped[key]?.trim()) {
        return { ok: false, field: key, message: `${key} is required`, code: 'required' };
      }
    }
    if (pipeline === 'staff' && !mapped.email?.trim() && !mapped.phone?.trim()) {
      return {
        ok: false,
        field: 'email',
        message: 'Enter an email or a phone number',
        code: 'required',
      };
    }
    if (pipeline === 'fee_register' && (options.feeMode ?? 'flat') === 'flat') {
      if (!mapped.billingPeriod?.trim()) {
        return {
          ok: false,
          field: 'billingPeriod',
          message: 'billingPeriod is required in flat mode',
          code: 'required',
        };
      }
    }
    if (pipeline === 'fee_register' && options.feeMode === 'wide') {
      if (!mapping.monthGroups?.length) {
        return {
          ok: false,
          message: 'Wide fee mode requires at least one month group in the mapping',
          code: 'mapping',
        };
      }
    }
    return null;
  }

  private async lookupStatusId(categoryCode: string, statusCode: string): Promise<string | null> {
    const key = `${categoryCode}:${statusCode}`;
    const cached = this.statusCache.get(key);
    if (cached) return cached;
    const row = await this.prisma.lookupStatus.findFirst({
      where: {
        code: statusCode,
        isActive: true,
        category: { code: categoryCode },
      },
      select: { id: true },
    });
    if (!row) return null;
    this.statusCache.set(key, row.id);
    return row.id;
  }

  private async ensureFeeType(code: string, name: string): Promise<string> {
    const cached = this.feeTypeCache.get(code);
    if (cached) return cached;
    const existing = await this.prisma.feeType.findUnique({ where: { code } });
    if (existing) {
      this.feeTypeCache.set(code, existing.id);
      return existing.id;
    }
    const created = await this.prisma.feeType.create({
      data: { code, name, isActive: true },
    });
    this.feeTypeCache.set(code, created.id);
    return created.id;
  }

  private async ensureProgramBatch(
    branchId: string,
    programName: string,
    batchName: string,
    programCode?: string,
    batchCode?: string,
    sessionName?: string,
  ) {
    const cacheKey = this.programBatchKey(branchId, programName, batchName);
    // Session-aware keys still use cache only when no session override (common path)
    if (!sessionName?.trim()) {
      const cached = this.programBatchCache.get(cacheKey);
      if (cached) {
        return {
          program: { id: cached.programId },
          batch: { id: cached.batchId },
        };
      }
      const inflight = this.programBatchInflight.get(cacheKey);
      if (inflight) {
        const ids = await inflight;
        return { program: { id: ids.programId }, batch: { id: ids.batchId } };
      }
    }

    const run = async (): Promise<ProgramBatchIds> => {
      let sessionId: string | undefined;
      if (sessionName?.trim()) {
        let session = await this.prisma.academicSession.findFirst({
          where: { name: sessionName.trim() },
        });
        if (!session) {
          const year = new Date().getFullYear();
          session = await this.prisma.academicSession.create({
            data: {
              name: sessionName.trim(),
              startDate: new Date(`${year}-04-01`),
              endDate: new Date(`${year + 1}-03-31`),
              isCurrent: false,
            },
          });
        }
        sessionId = session.id;
      }

      let program = await this.prisma.program.findFirst({
        where: {
          branchId,
          deletedAt: null,
          OR: [
            { name: { equals: programName, mode: 'insensitive' } },
            ...(programCode ? [{ code: programCode }] : []),
          ],
        },
      });
      if (!program) {
        program = await this.prisma.program.create({
          data: {
            branchId,
            name: programName,
            code: programCode || null,
          },
        });
      }

      let batch = await this.prisma.batch.findFirst({
        where: {
          branchId,
          programId: program.id,
          deletedAt: null,
          name: { equals: batchName, mode: 'insensitive' },
        },
      });
      if (!batch) {
        batch = await this.prisma.batch.create({
          data: {
            branchId,
            programId: program.id,
            name: batchName,
            code: batchCode || null,
            sessionId: sessionId ?? null,
          },
        });
      }

      const ids = { programId: program.id, batchId: batch.id };
      if (!sessionName?.trim()) {
        this.programBatchCache.set(cacheKey, ids);
      }
      return ids;
    };

    if (!sessionName?.trim()) {
      const promise = run().finally(() => this.programBatchInflight.delete(cacheKey));
      this.programBatchInflight.set(cacheKey, promise);
      const ids = await promise;
      return { program: { id: ids.programId }, batch: { id: ids.batchId } };
    }

    const ids = await run();
    return { program: { id: ids.programId }, batch: { id: ids.batchId } };
  }

  private async applyAcademic(
    branchId: string,
    mapped: Record<string, string>,
  ): Promise<RowApplyResult> {
    const { batch } = await this.ensureProgramBatch(
      branchId,
      mapped.programName!,
      mapped.batchName!,
      mapped.programCode,
      mapped.batchCode,
      mapped.sessionName,
    );

    const subjectName = mapped.subjectName?.trim();
    if (subjectName) {
      let subject = await this.prisma.subject.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { name: { equals: subjectName, mode: 'insensitive' } },
            ...(mapped.subjectCode ? [{ code: mapped.subjectCode }] : []),
          ],
        },
      });
      if (!subject) {
        subject = await this.prisma.subject.create({
          data: {
            name: subjectName,
            code: mapped.subjectCode || null,
          },
        });
      }
      const link = parseBool(mapped.linkSubjectToBatch ?? 'yes');
      if (link) {
        await this.prisma.batchSubject.upsert({
          where: { batchId_subjectId: { batchId: batch.id, subjectId: subject.id } },
          create: { batchId: batch.id, subjectId: subject.id },
          update: {},
        });
      }
    }
    return { ok: true };
  }

  private async applyStudent(
    branchId: string,
    mapped: Record<string, string>,
  ): Promise<RowApplyResult> {
    if (looksLikeHeaderMappedRow(mapped)) {
      return { ok: true, skipped: true };
    }

    const statusId =
      (await this.lookupStatusId('student_status', mapped.statusCode?.trim() || 'active')) ??
      (await this.lookupStatusId('student_status', 'active'));
    if (!statusId) {
      return { ok: false, field: 'statusCode', message: 'Student status lookup missing', code: 'lookup' };
    }

    let programId: string | undefined;
    let batchId: string | undefined;
    if (mapped.programName?.trim() && mapped.batchName?.trim()) {
      const { program, batch } = await this.ensureProgramBatch(
        branchId,
        mapped.programName,
        mapped.batchName,
      );
      programId = program.id;
      batchId = batch.id;
    } else if (mapped.batchName?.trim()) {
      // A class column alone is enough: create the program and batch from that label.
      const { program, batch } = await this.ensureProgramBatch(
        branchId,
        mapped.batchName.trim(),
        mapped.batchName.trim(),
      );
      programId = program.id;
      batchId = batch.id;
    }

    const admissionNumber = mapped.admissionNumber!.trim();
    const dateOfBirth = parseFlexibleDate(mapped.dateOfBirth);
    const phone = normalizeImportPhone(mapped.phone);
    const guardianPhone = normalizeImportPhone(mapped.guardianPhone) ?? phone;

    const student = await this.prisma.student.upsert({
      where: {
        branchId_admissionNumber: { branchId, admissionNumber },
      },
      create: {
        branchId,
        fullName: mapped.fullName!.trim(),
        admissionNumber,
        rollNumber: mapped.rollNumber?.trim() || null,
        statusId,
        programId: programId ?? null,
        batchId: batchId ?? null,
        phone,
        email: mapped.email?.trim() || null,
        address: mapped.address?.trim() || null,
        cnicOrBForm: mapped.cnic?.trim() || null,
        gender: mapped.gender?.trim() || null,
        dateOfBirth,
      },
      update: {
        fullName: mapped.fullName!.trim(),
        rollNumber: mapped.rollNumber?.trim() || undefined,
        programId: programId ?? undefined,
        batchId: batchId ?? undefined,
        phone: phone ?? undefined,
        email: mapped.email?.trim() || undefined,
        address: mapped.address?.trim() || undefined,
        cnicOrBForm: mapped.cnic?.trim() || undefined,
        gender: mapped.gender?.trim() || undefined,
        dateOfBirth: dateOfBirth ?? undefined,
      },
    });

    await this.linkGuardian(student.id, mapped.fatherName, 'father', guardianPhone ?? undefined);
    await this.linkGuardian(student.id, mapped.motherName, 'mother', guardianPhone ?? undefined);
    return { ok: true };
  }

  private async linkGuardian(
    studentId: string,
    name: string | undefined,
    relationshipCode: 'father' | 'mother' | 'guardian',
    phone?: string,
  ) {
    const fullName = name?.trim();
    if (!fullName) return;
    const phoneNorm = phone?.trim() || null;
    const cacheKey = this.parentKey(fullName, phoneNorm);

    let parentId = this.parentCache.get(cacheKey);
    if (!parentId) {
      let inflight = this.parentInflight.get(cacheKey);
      if (!inflight) {
        inflight = (async () => {
          let parent = await this.prisma.parent.findFirst({
            where: {
              deletedAt: null,
              fullName: { equals: fullName, mode: 'insensitive' },
              ...(phoneNorm ? { phone: phoneNorm } : {}),
            },
          });
          if (!parent) {
            parent = await this.prisma.parent.create({
              data: {
                fullName,
                phone: phoneNorm,
              },
            });
          }
          this.parentCache.set(cacheKey, parent.id);
          return parent.id;
        })().finally(() => this.parentInflight.delete(cacheKey));
        this.parentInflight.set(cacheKey, inflight);
      }
      parentId = await inflight;
    }

    await this.prisma.studentParent.upsert({
      where: {
        studentId_parentId: { studentId, parentId },
      },
      create: { studentId, parentId, relationshipCode },
      update: { relationshipCode },
    });
  }

  private async applyFeeRegister(
    branchId: string,
    mapped: Record<string, string>,
    mapping: ImportMappingPayload,
    options: ImportJobOptionsInput,
    raw: RawSheetRow,
  ): Promise<RowApplyResult> {
    const admissionNumber = mapped.admissionNumber!.trim();
    let student = await this.prisma.student.findFirst({
      where: { branchId, admissionNumber, deletedAt: null },
    });

    if (!student) {
      if (!options.createMissingStudents) {
        return {
          ok: false,
          field: 'admissionNumber',
          message: `Student ${admissionNumber} not found (enable create-missing to auto-create)`,
          code: 'not_found',
        };
      }
      const created = await this.applyStudent(branchId, {
        fullName: mapped.fullName || admissionNumber,
        admissionNumber,
        fatherName: mapped.fatherName ?? '',
        batchName: mapped.className ?? '',
        programName: mapped.className ?? '',
        phone: mapped.phone ?? '',
      });
      if (!created.ok) return created;
      student = await this.prisma.student.findFirst({
        where: { branchId, admissionNumber, deletedAt: null },
      });
      if (!student) {
        return { ok: false, message: 'Student create failed', code: 'create_failed' };
      }
    }

    const mode = options.feeMode ?? 'flat';
    if (mode === 'wide') {
      for (const group of mapping.monthGroups ?? []) {
        const periodAmounts = this.amountsFromMonthGroup(raw, group);
        await this.upsertChallanMonth(branchId, student.id, group.billingPeriod, periodAmounts, mapped.voucherNo);
      }
      return { ok: true };
    }

    const period = mapped.billingPeriod!.trim();
    await this.upsertChallanMonth(
      branchId,
      student.id,
      period,
      {
        tuition: cellToNumber(mapped.tuition) ?? 0,
        arrears: cellToNumber(mapped.arrears) ?? 0,
        paid: cellToNumber(mapped.paid) ?? 0,
        due: cellToNumber(mapped.due),
        annual: cellToNumber(mapped.annual) ?? 0,
        party: cellToNumber(mapped.party) ?? 0,
        voucherNo: mapped.voucherNo,
      },
      mapped.voucherNo,
    );
    return { ok: true };
  }

  private amountsFromMonthGroup(raw: RawSheetRow, group: FeeWideMonthGroup) {
    const col = group.columns;
    return {
      tuition: col.tuition ? cellToNumber(raw[col.tuition]) ?? 0 : 0,
      arrears: col.arrears ? cellToNumber(raw[col.arrears]) ?? 0 : 0,
      paid: col.paid ? cellToNumber(raw[col.paid]) ?? 0 : 0,
      due: col.due ? cellToNumber(raw[col.due]) : null,
      annual: col.annual ? cellToNumber(raw[col.annual]) ?? 0 : 0,
      party: col.party ? cellToNumber(raw[col.party]) ?? 0 : 0,
      voucherNo: col.voucherNo ? String(raw[col.voucherNo] ?? '').trim() : undefined,
    };
  }

  private async upsertChallanMonth(
    branchId: string,
    studentId: string,
    billingPeriod: string,
    amounts: {
      tuition: number;
      arrears: number;
      paid: number;
      due: number | null;
      annual: number;
      party: number;
      voucherNo?: string;
    },
    fallbackVoucher?: string,
  ) {
    const lines: { code: string; label: string; amount: number; sortOrder: number }[] = [];
    if (amounts.tuition) lines.push({ code: 'monthly', label: 'Monthly tuition', amount: amounts.tuition, sortOrder: 1 });
    if (amounts.arrears) lines.push({ code: 'arrears', label: 'Arrears', amount: amounts.arrears, sortOrder: 2 });
    if (amounts.annual) lines.push({ code: 'annual', label: 'Annual', amount: amounts.annual, sortOrder: 3 });
    if (amounts.party) lines.push({ code: 'party', label: 'Party / other', amount: amounts.party, sortOrder: 4 });
    if (!lines.length && (amounts.paid || amounts.due)) {
      lines.push({
        code: 'monthly',
        label: 'Monthly tuition',
        amount: amounts.due ?? amounts.paid,
        sortOrder: 1,
      });
    }
    if (!lines.length) return;

    const grandTotal = lines.reduce((s, l) => s + l.amount, 0);
    const paidAmount = Math.min(amounts.paid, grandTotal);
    const dueAmount = amounts.due != null ? amounts.due : Math.max(grandTotal - paidAmount, 0);
    const status = paidAmount <= 0 ? 'unpaid' : paidAmount >= grandTotal ? 'paid' : 'partial';
    const voucherNo = amounts.voucherNo || fallbackVoucher || null;

    const existing = await this.prisma.feeChallan.findUnique({
      where: {
        branchId_studentId_billingPeriod: { branchId, studentId, billingPeriod },
      },
    });

    if (existing) {
      await this.prisma.feeChallanLine.deleteMany({ where: { challanId: existing.id } });
      await this.prisma.feeChallan.update({
        where: { id: existing.id },
        data: {
          grandTotal,
          paidAmount,
          dueAmount,
          status,
          challanNo: voucherNo || existing.challanNo,
          lines: {
            create: lines.map((l) => ({
              code: l.code,
              label: l.label,
              amount: new Prisma.Decimal(l.amount),
              sortOrder: l.sortOrder,
            })),
          },
        },
      });
    } else {
      await this.prisma.feeChallan.create({
        data: {
          branchId,
          studentId,
          billingPeriod,
          challanNo: voucherNo,
          grandTotal,
          paidAmount,
          dueAmount,
          status,
          lines: {
            create: lines.map((l) => ({
              code: l.code,
              label: l.label,
              amount: new Prisma.Decimal(l.amount),
              sortOrder: l.sortOrder,
            })),
          },
        },
      });
    }

    // Mirror a monthly invoice when tuition present (for payments / reports)
    if (amounts.tuition > 0) {
      const feeTypeId = await this.ensureFeeType('monthly', 'Monthly tuition');
      const pendingId = await this.lookupStatusId('fee_status', 'pending');
      const paidId = await this.lookupStatusId('fee_status', 'paid');
      const partialId = await this.lookupStatusId('fee_status', 'partial');
      const statusId =
        (status === 'paid' ? paidId : status === 'partial' ? partialId : pendingId) ?? pendingId;
      if (!statusId) return;

      const invoiceNo = `IMP-${billingPeriod}-${studentId.slice(-6)}`;
      const existingInv = await this.prisma.feeInvoice.findFirst({
        where: { branchId, studentId, billingPeriod, feeTypeId },
      });
      const netAmount = amounts.tuition;
      if (existingInv) {
        await this.prisma.feeInvoice.update({
          where: { id: existingInv.id },
          data: {
            amount: netAmount,
            netAmount,
            statusId,
            voucherNo: voucherNo || undefined,
            paidAt: status === 'paid' ? new Date() : null,
          },
        });
      } else {
        await this.prisma.feeInvoice.create({
          data: {
            branchId,
            studentId,
            feeTypeId,
            invoiceNo,
            billingPeriod,
            voucherNo,
            amount: netAmount,
            netAmount,
            statusId,
            paidAt: status === 'paid' ? new Date() : null,
          },
        });
      }
    }
  }

  private async applyStaff(
    branchId: string,
    mapped: Record<string, string>,
    options: ImportJobOptionsInput,
    _createdById: string,
  ): Promise<RowApplyResult> {
    if (!this.supabaseAdmin) {
      return { ok: false, message: 'Supabase admin is not configured for staff import', code: 'config' };
    }

    const fullName = mapped.fullName!.trim();
    const phone = mapped.phone?.trim() || null;
    const roleCode = (mapped.roleCode?.trim() || options.defaultRoleCode || 'teacher').toLowerCase();
    const role = await this.prisma.role.findFirst({ where: { code: roleCode } });
    if (!role) {
      return { ok: false, field: 'roleCode', message: `Unknown role: ${roleCode}`, code: 'lookup' };
    }

    const email = await this.resolveImportedStaffEmail(fullName, mapped.email, phone);

    const existing = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          ...(phone ? [{ phone }] : []),
        ],
      },
    });
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName,
          phone: phone ?? undefined,
          branchId,
          designation: mapped.designation?.trim() || undefined,
          gender: mapped.gender?.trim() || undefined,
          cnic: mapped.cnic?.trim() || undefined,
          department: mapped.department?.trim() || undefined,
        },
      });
      const existingRole = await this.prisma.userRole.findFirst({
        where: { userId: existing.id, roleId: role.id, branchId },
      });
      if (!existingRole) {
        await this.prisma.userRole.create({
          data: { userId: existing.id, roleId: role.id, branchId },
        });
      }
      return { ok: true };
    }

    const password = options.generateStaffPasswords === false ? 'Nexium@2026!' : randomTempPassword();
    const { data: authData, error: authError } = await this.supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullName },
    });
    if (authError || !authData.user) {
      return {
        ok: false,
        message: authError?.message ?? 'Auth user create failed',
        code: 'auth',
      };
    }

    await this.prisma.user.create({
      data: {
        supabaseUserId: authData.user.id,
        email,
        fullName,
        phone,
        branchId,
        designation: mapped.designation?.trim() || null,
        gender: mapped.gender?.trim() || null,
        cnic: mapped.cnic?.trim() || null,
        department: mapped.department?.trim() || null,
        isActive: true,
        userRoles: { create: { roleId: role.id, branchId } },
      },
    });
    return { ok: true };
  }

  private async applyTimetable(
    branchId: string,
    mapped: Record<string, string>,
  ): Promise<RowApplyResult> {
    const batch = await this.prisma.batch.findFirst({
      where: {
        branchId,
        deletedAt: null,
        name: { equals: mapped.batchName!.trim(), mode: 'insensitive' },
      },
    });
    if (!batch) {
      return { ok: false, field: 'batchName', message: `Batch not found: ${mapped.batchName}`, code: 'not_found' };
    }

    let subject = await this.prisma.subject.findFirst({
      where: {
        deletedAt: null,
        name: { equals: mapped.subjectName!.trim(), mode: 'insensitive' },
      },
    });
    if (!subject) {
      subject = await this.prisma.subject.create({
        data: { name: mapped.subjectName!.trim() },
      });
    }

    const dayOfWeek = parseDayOfWeek(mapped.dayOfWeek!);
    if (!dayOfWeek) {
      return { ok: false, field: 'dayOfWeek', message: 'Invalid day of week', code: 'invalid' };
    }
    const startTime = normalizeTime(mapped.startTime!);
    const endTime = normalizeTime(mapped.endTime!);
    if (!startTime || !endTime) {
      return { ok: false, field: 'startTime', message: 'Invalid start/end time (use HH:MM)', code: 'invalid' };
    }

    let teacherId: string | undefined;
    const teacherKey = mapped.teacherPhoneOrEmail?.trim();
    if (teacherKey) {
      const teacher = await this.prisma.user.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { phone: teacherKey },
            { email: { equals: teacherKey, mode: 'insensitive' } },
          ],
        },
      });
      teacherId = teacher?.id;
    }

    await this.prisma.timetableSlot.create({
      data: {
        branchId,
        batchId: batch.id,
        subjectId: subject.id,
        teacherId: teacherId ?? null,
        dayOfWeek,
        startTime,
        endTime,
        room: mapped.room?.trim() || null,
      },
    });
    return { ok: true };
  }

  private async applyNotice(
    branchId: string,
    mapped: Record<string, string>,
    createdById: string,
  ): Promise<RowApplyResult> {
    const audience = mapped.audience!.trim().toLowerCase();
    const allowed = ['all', 'parents', 'students', 'staff', 'teachers'];
    if (!allowed.includes(audience)) {
      return {
        ok: false,
        field: 'audience',
        message: `Audience must be one of: ${allowed.join(', ')}`,
        code: 'invalid',
      };
    }
    const publishedAt = mapped.publishedAt ? new Date(mapped.publishedAt) : new Date();
    await this.prisma.notice.create({
      data: {
        branchId,
        title: mapped.title!.trim(),
        body: mapped.body!.trim(),
        audience,
        isPublished: true,
        publishedAt,
        createdById,
      },
    });
    return { ok: true };
  }

  private async resolveImportedStaffEmail(
    fullName: string,
    provided: string | undefined,
    phone: string | null,
  ): Promise<string> {
    if (provided?.trim()) return provided.trim().toLowerCase();

    const settings = await this.prisma.institutionSettings.findUnique({ where: { id: 'default' } });
    const domain =
      settings?.email?.split('@')[1]?.toLowerCase() ||
      this.config.get<string>('STAFF_EMAIL_DOMAIN') ||
      'nexium.edu.pk';
    const local =
      phone?.replace(/\D/g, '') ||
      fullName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.|\.$/g, '') ||
      'staff';
    return `${local}@${domain}`;
  }

  /** Before timetable append/replace job starts. */
  async prepareTimetableJob(branchId: string, mode: 'append' | 'replace' | undefined) {
    if (mode === 'replace') {
      await this.prisma.timetableSlot.deleteMany({ where: { branchId } });
    }
  }
}
