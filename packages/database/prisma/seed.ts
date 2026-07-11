import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from '@eims/shared';
import { runDemoSeed } from './seed-demo';

const prisma = new PrismaClient();

interface SeedConfig {
  institution: {
    name: string;
    institutionType: string;
    primaryColor: string;
    logoPath?: string | null;
    faviconPath?: string | null;
    address?: string;
    city?: string;
    province?: string;
    country?: string;
    phone?: string;
    email?: string;
    website?: string;
    timezone?: string;
    currency?: string;
    terminology?: Record<string, string>;
    featureFlags?: Record<string, boolean>;
  };
  branches: Array<{
    name: string;
    code: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string;
  }>;
  superAdmin: { email: string; fullName: string };
  lookupStatuses?: Record<string, Array<{ code: string; label: string; sortOrder: number }>>;
  roles?: string[];
  academicSessions?: Array<{
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }>;
  subjects?: Array<{ name: string; code: string }>;
  programs?: Array<{ name: string; code: string; branchCode: string }>;
  assessmentTypes?: Array<{ name: string; code: string }>;
  assessmentSeries?: Array<{ name: string; code: string }>;
  feeTypes?: Array<{ name: string; code: string }>;
  demo?: { enabled?: boolean; password?: string };
}

function loadConfig(): SeedConfig {
  const configArg = process.argv.find((a) => a.startsWith('--config='));
  const configPath = configArg
    ? configArg.replace('--config=', '')
    : process.env.SEED_CONFIG_PATH || '../../../docs/templates/rekhta.institution.json';

  const resolved = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(__dirname, configPath);

  const raw = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(raw) as SeedConfig;
}

const PERMISSION_LABELS: Record<string, { name: string; module: string }> = {
  [PERMISSIONS.BRANCHES_MANAGE]: { name: 'Manage Branches', module: 'branches' },
  [PERMISSIONS.BRANCHES_READ]: { name: 'View Branches', module: 'branches' },
  [PERMISSIONS.STUDENTS_READ]: { name: 'View Students', module: 'students' },
  [PERMISSIONS.STUDENTS_CREATE]: { name: 'Create Students', module: 'students' },
  [PERMISSIONS.STUDENTS_UPDATE]: { name: 'Update Students', module: 'students' },
  [PERMISSIONS.STUDENTS_DELETE]: { name: 'Delete Students', module: 'students' },
  [PERMISSIONS.ATTENDANCE_MARK]: { name: 'Mark Attendance', module: 'attendance' },
  [PERMISSIONS.ATTENDANCE_READ]: { name: 'View Attendance', module: 'attendance' },
  [PERMISSIONS.ASSESSMENTS_MARKS_ENTER]: { name: 'Enter Marks', module: 'assessments' },
  [PERMISSIONS.ASSESSMENTS_READ]: { name: 'View Assessments', module: 'assessments' },
  [PERMISSIONS.FEES_COLLECT]: { name: 'Collect Fees', module: 'fees' },
  [PERMISSIONS.FEES_READ]: { name: 'View Fees', module: 'fees' },
  [PERMISSIONS.REPORTS_VIEW]: { name: 'View Reports', module: 'reports' },
  [PERMISSIONS.SETTINGS_MANAGE]: { name: 'Manage Settings', module: 'settings' },
  [PERMISSIONS.ACADEMIC_READ]: { name: 'View Academic Data', module: 'academic' },
  [PERMISSIONS.ACADEMIC_MANAGE]: { name: 'Manage Academic Data', module: 'academic' },
  [PERMISSIONS.USERS_MANAGE]: { name: 'Manage Users', module: 'users' },
  [PERMISSIONS.AUDIT_READ]: { name: 'View Audit Logs', module: 'audit' },
  [PERMISSIONS.TIMETABLE_READ]: { name: 'View Timetable', module: 'timetable' },
  [PERMISSIONS.TIMETABLE_MANAGE]: { name: 'Manage Timetable', module: 'timetable' },
  [PERMISSIONS.FORM_FIELDS_MANAGE]: { name: 'Manage Form Fields', module: 'form-builder' },
  [PERMISSIONS.ANALYTICS_READ]: { name: 'View Analytics', module: 'analytics' },
  [PERMISSIONS.DOCUMENTS_READ]: { name: 'View Documents', module: 'documents' },
  [PERMISSIONS.DOCUMENTS_UPLOAD]: { name: 'Upload Documents', module: 'documents' },
  [PERMISSIONS.LEARNING_READ]: { name: 'View Learning Content', module: 'learning' },
  [PERMISSIONS.LEARNING_PUBLISH]: { name: 'Publish Learning Content', module: 'learning' },
  [PERMISSIONS.AI_ATTENDANCE_USE]: { name: 'Use AI Attendance OCR', module: 'ai-attendance' },
  [PERMISSIONS.COMMUNICATIONS_SEND]: { name: 'Send SMS/WhatsApp', module: 'communications' },
  [PERMISSIONS.AI_INSIGHTS_READ]: { name: 'View AI Insights', module: 'ai-insights' },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  branch_admin: 'Branch Admin',
  teacher: 'Teacher',
  accountant: 'Accountant',
  receptionist: 'Receptionist',
  parent: 'Parent',
  student: 'Student',
};

async function main() {
  const config = loadConfig();
  console.log(`Seeding institution: ${config.institution.name}`);

  await prisma.institutionSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      name: config.institution.name,
      institutionType: config.institution.institutionType,
      primaryColor: config.institution.primaryColor,
      address: config.institution.address,
      city: config.institution.city,
      province: config.institution.province,
      country: config.institution.country ?? 'Pakistan',
      phone: config.institution.phone,
      email: config.institution.email,
      website: config.institution.website,
      timezone: config.institution.timezone ?? 'Asia/Karachi',
      currency: config.institution.currency ?? 'PKR',
      terminology: config.institution.terminology ?? {},
      featureFlags: config.institution.featureFlags ?? {},
      logoUrl: config.institution.logoPath
        ? `storage://${config.institution.logoPath}`
        : null,
    },
    update: {
      name: config.institution.name,
      institutionType: config.institution.institutionType,
      primaryColor: config.institution.primaryColor,
      terminology: config.institution.terminology ?? {},
      featureFlags: config.institution.featureFlags ?? {},
    },
  });

  const permissionMap = new Map<string, string>();
  // Seed every code in PERMISSIONS (labels are optional metadata; missing labels must not skip codes).
  for (const code of Object.values(PERMISSIONS)) {
    const meta = PERMISSION_LABELS[code] ?? {
      name: code.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      module: code.split('.')[0] ?? 'general',
    };
    const perm = await prisma.permission.upsert({
      where: { code },
      create: { code, name: meta.name, module: meta.module },
      update: { name: meta.name, module: meta.module },
    });
    permissionMap.set(code, perm.id);
  }

  const roleCodes = config.roles ?? Object.keys(DEFAULT_ROLE_PERMISSIONS);
  const roleMap = new Map<string, string>();

  for (const code of roleCodes) {
    const role = await prisma.role.upsert({
      where: { code },
      create: {
        code,
        name: ROLE_LABELS[code] ?? code,
        isSystem: true,
      },
      update: { name: ROLE_LABELS[code] ?? code },
    });
    roleMap.set(code, role.id);

    const permCodes = DEFAULT_ROLE_PERMISSIONS[code] ?? [];
    for (const permCode of permCodes) {
      const permissionId = permissionMap.get(permCode);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }

  const branchMap = new Map<string, string>();
  for (const b of config.branches) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      create: {
        name: b.name,
        code: b.code,
        address: b.address,
        city: b.city,
        phone: b.phone,
        email: b.email,
      },
      update: {
        name: b.name,
        address: b.address,
        city: b.city,
        phone: b.phone,
        email: b.email,
      },
    });
    branchMap.set(b.code, branch.id);
  }

  if (config.lookupStatuses) {
    for (const [categoryCode, statuses] of Object.entries(config.lookupStatuses)) {
      const category = await prisma.lookupCategory.upsert({
        where: { code: categoryCode },
        create: {
          code: categoryCode,
          name: categoryCode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        },
        update: {},
      });
      for (const s of statuses) {
        await prisma.lookupStatus.upsert({
          where: {
            categoryId_code: { categoryId: category.id, code: s.code },
          },
          create: {
            categoryId: category.id,
            code: s.code,
            label: s.label,
            sortOrder: s.sortOrder,
          },
          update: { label: s.label, sortOrder: s.sortOrder },
        });
      }
    }
  }

  for (const session of config.academicSessions ?? []) {
    const existing = await prisma.academicSession.findFirst({
      where: { name: session.name },
    });
    if (!existing) {
      await prisma.academicSession.create({
        data: {
          name: session.name,
          startDate: new Date(session.startDate),
          endDate: new Date(session.endDate),
          isCurrent: session.isCurrent,
        },
      });
    }
  }

  for (const subject of config.subjects ?? []) {
    await prisma.subject.upsert({
      where: { code: subject.code },
      create: { name: subject.name, code: subject.code },
      update: { name: subject.name },
    });
  }

  for (const program of config.programs ?? []) {
    const branchId = branchMap.get(program.branchCode);
    if (!branchId) continue;
    const existing = await prisma.program.findFirst({
      where: { branchId, code: program.code },
    });
    if (!existing) {
      await prisma.program.create({
        data: {
          branchId,
          name: program.name,
          code: program.code,
        },
      });
    }
  }

  for (const at of config.assessmentTypes ?? []) {
    await prisma.assessmentType.upsert({
      where: { code: at.code },
      create: { name: at.name, code: at.code },
      update: { name: at.name },
    });
  }

  for (const s of config.assessmentSeries ?? []) {
    await prisma.assessmentSeries.upsert({
      where: { code: s.code },
      create: { name: s.name, code: s.code },
      update: { name: s.name },
    });
  }

  for (const ft of config.feeTypes ?? []) {
    await prisma.feeType.upsert({
      where: { code: ft.code },
      create: { name: ft.name, code: ft.code },
      update: { name: ft.name },
    });
  }

  const superAdminRoleId = roleMap.get('super_admin');
  if (superAdminRoleId) {
    const existingInvite = await prisma.invitation.findFirst({
      where: { email: config.superAdmin.email, acceptedAt: null },
    });
    const token = existingInvite?.token ?? randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (existingInvite) {
      await prisma.invitation.update({
        where: { id: existingInvite.id },
        data: { expiresAt, roleId: superAdminRoleId },
      });
    } else {
      await prisma.invitation.create({
        data: {
          email: config.superAdmin.email,
          roleId: superAdminRoleId,
          token,
          expiresAt,
        },
      });
    }
    console.log(`Super Admin invitation: ${config.superAdmin.email}`);
  }

  const defaultFormFields = [
    { code: 'previous_school', label: 'Previous School', fieldType: 'text', sortOrder: 1 },
    { code: 'board', label: 'Board', fieldType: 'dropdown', options: ['Federal', 'Punjab', 'Sindh', 'KPK', 'Balochistan'], sortOrder: 2 },
    { code: 'emergency_contact', label: 'Emergency Contact', fieldType: 'text', sortOrder: 3 },
  ];
  for (const field of defaultFormFields) {
    await prisma.formField.upsert({
      where: { code: field.code },
      create: {
        code: field.code,
        label: field.label,
        fieldType: field.fieldType,
        options: 'options' in field ? field.options : undefined,
        sortOrder: field.sortOrder,
      },
      update: { label: field.label, fieldType: field.fieldType, sortOrder: field.sortOrder },
    });
  }

  const demoEnabled = config.demo?.enabled !== false;
  if (demoEnabled) {
    console.log('');
    console.log('--- Phase 2: Demo dataset ---');
    await runDemoSeed(prisma, branchMap, roleMap, {
      force: process.argv.includes('--force-demo'),
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
