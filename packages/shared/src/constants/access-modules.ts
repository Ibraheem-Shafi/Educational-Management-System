import { PERMISSIONS } from './permissions';

export const PORTAL_ROLE_CODES = ['parent', 'student'] as const;
export const LOCKED_STAFF_ROLE_CODES = ['super_admin'] as const;

export type PortalRoleCode = (typeof PORTAL_ROLE_CODES)[number];
export type LockedStaffRoleCode = (typeof LOCKED_STAFF_ROLE_CODES)[number];

export type AccessModuleGroupId =
  | 'people'
  | 'academics'
  | 'finance'
  | 'operations'
  | 'insights'
  | 'communication'
  | 'administration';

export interface AccessModuleDefinition {
  id: string;
  label: string;
  group: AccessModuleGroupId;
  groupLabel: string;
  viewCodes: readonly string[];
  /** Extra write codes. Empty means the module is view-only in the matrix. */
  editCodes: readonly string[];
}

export interface AccessModuleFlag {
  moduleId: string;
  view: boolean;
  edit: boolean;
}

export const ACCESS_MODULE_GROUPS: { id: AccessModuleGroupId; label: string }[] = [
  { id: 'people', label: 'People' },
  { id: 'academics', label: 'Academics' },
  { id: 'finance', label: 'Finance' },
  { id: 'operations', label: 'Operations' },
  { id: 'insights', label: 'Insights' },
  { id: 'communication', label: 'Communication' },
  { id: 'administration', label: 'Administration' },
];

const GROUP_LABEL: Record<AccessModuleGroupId, string> = {
  people: 'People',
  academics: 'Academics',
  finance: 'Finance',
  operations: 'Operations',
  insights: 'Insights',
  communication: 'Communication',
  administration: 'Administration',
};

function defineModule(
  id: string,
  label: string,
  group: AccessModuleGroupId,
  viewCodes: readonly string[],
  editCodes: readonly string[] = [],
): AccessModuleDefinition {
  return { id, label, group, groupLabel: GROUP_LABEL[group], viewCodes, editCodes };
}

export const ACCESS_MODULES: AccessModuleDefinition[] = [
  defineModule('students', 'Students', 'people', [PERMISSIONS.STUDENTS_READ], [
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.STUDENTS_DELETE,
  ]),
  defineModule('users', 'Users', 'people', [PERMISSIONS.USERS_MANAGE], [PERMISSIONS.USERS_MANAGE]),
  defineModule('hr', 'HR operations', 'people', [PERMISSIONS.HR_READ], [PERMISSIONS.HR_MANAGE]),
  defineModule(
    'front_office',
    'Front office',
    'people',
    [PERMISSIONS.FRONT_OFFICE_READ],
    [PERMISSIONS.FRONT_OFFICE_MANAGE],
  ),
  defineModule('academic', 'Academic', 'academics', [PERMISSIONS.ACADEMIC_READ], [
    PERMISSIONS.ACADEMIC_MANAGE,
  ]),
  defineModule('assessments', 'Assessments', 'academics', [PERMISSIONS.ASSESSMENTS_READ], [
    PERMISSIONS.ASSESSMENTS_MARKS_ENTER,
    PERMISSIONS.ASSESSMENTS_PUBLISH,
  ]),
  defineModule('timetable', 'Timetable', 'academics', [PERMISSIONS.TIMETABLE_READ], [
    PERMISSIONS.TIMETABLE_MANAGE,
  ]),
  defineModule('learning', 'Learning', 'academics', [PERMISSIONS.LEARNING_READ], [
    PERMISSIONS.LEARNING_PUBLISH,
  ]),
  defineModule('attendance', 'Attendance', 'academics', [PERMISSIONS.ATTENDANCE_READ], [
    PERMISSIONS.ATTENDANCE_MARK,
  ]),
  defineModule(
    'leave',
    'Leave requests',
    'academics',
    [PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_REQUEST],
    [PERMISSIONS.LEAVE_MANAGE],
  ),
  defineModule('fees', 'Fees', 'finance', [PERMISSIONS.FEES_READ], [PERMISSIONS.FEES_COLLECT]),
  defineModule('accounting', 'Accounting', 'finance', [PERMISSIONS.ACCOUNTING_READ], [
    PERMISSIONS.ACCOUNTING_MANAGE,
  ]),
  defineModule('payroll', 'Payroll', 'finance', [PERMISSIONS.PAYROLL_READ], [
    PERMISSIONS.PAYROLL_MANAGE,
    PERMISSIONS.PAYROLL_APPROVE,
  ]),
  defineModule('library', 'Library', 'operations', [PERMISSIONS.LIBRARY_READ], [
    PERMISSIONS.LIBRARY_MANAGE,
  ]),
  defineModule('transport', 'Transport', 'operations', [PERMISSIONS.TRANSPORT_READ], [
    PERMISSIONS.TRANSPORT_MANAGE,
  ]),
  defineModule('biometric', 'Biometric', 'operations', [PERMISSIONS.BIOMETRIC_READ], [
    PERMISSIONS.BIOMETRIC_MANAGE,
  ]),
  defineModule('documents', 'Documents', 'operations', [PERMISSIONS.DOCUMENTS_READ], [
    PERMISSIONS.DOCUMENTS_UPLOAD,
  ]),
  defineModule('certificates', 'Certificates', 'operations', [PERMISSIONS.CERTIFICATES_READ], [
    PERMISSIONS.CERTIFICATES_ISSUE,
  ]),
  defineModule('analytics', 'Analytics', 'insights', [PERMISSIONS.ANALYTICS_READ]),
  defineModule('reports', 'Reports', 'insights', [PERMISSIONS.REPORTS_VIEW]),
  defineModule('ai_insights', 'AI Insights', 'insights', [PERMISSIONS.AI_INSIGHTS_READ]),
  defineModule('ai_attendance', 'AI Attendance', 'insights', [PERMISSIONS.AI_ATTENDANCE_USE]),
  defineModule('communications', 'Communications', 'communication', [
    PERMISSIONS.COMMUNICATIONS_SEND,
  ]),
  defineModule('branches', 'Branches', 'administration', [PERMISSIONS.BRANCHES_READ], [
    PERMISSIONS.BRANCHES_MANAGE,
  ]),
  defineModule('audit', 'Audit', 'administration', [PERMISSIONS.AUDIT_READ]),
  defineModule('settings', 'Settings', 'administration', [PERMISSIONS.SETTINGS_MANAGE]),
  defineModule('form_fields', 'Form fields', 'administration', [PERMISSIONS.FORM_FIELDS_MANAGE]),
];

const MODULE_BY_ID = new Map(ACCESS_MODULES.map((module) => [module.id, module]));

export function isPortalRoleCode(code: string): boolean {
  return (PORTAL_ROLE_CODES as readonly string[]).includes(code);
}

export function isLockedStaffRoleCode(code: string): boolean {
  return (LOCKED_STAFF_ROLE_CODES as readonly string[]).includes(code);
}

export function isViewOnlyModule(module: AccessModuleDefinition): boolean {
  return writeCodesOf(module).length === 0;
}

export function writeCodesOf(module: AccessModuleDefinition): string[] {
  return module.editCodes.filter((code) => !module.viewCodes.includes(code));
}

export function catalogPermissionCodeSet(): Set<string> {
  const codes = new Set<string>();
  for (const module of ACCESS_MODULES) {
    for (const code of module.viewCodes) codes.add(code);
    for (const code of module.editCodes) codes.add(code);
  }
  return codes;
}

export function getAccessModule(id: string): AccessModuleDefinition | undefined {
  return MODULE_BY_ID.get(id);
}

export function normalizeAccessFlags(flags: AccessModuleFlag[]): AccessModuleFlag[] {
  const byId = new Map(flags.map((flag) => [flag.moduleId, flag]));
  return ACCESS_MODULES.map((module) => {
    const current = byId.get(module.id);
    const edit = Boolean(current?.edit) && !isViewOnlyModule(module);
    const view = edit || Boolean(current?.view);
    return { moduleId: module.id, view, edit };
  });
}

export function codesFromAccessFlags(flags: AccessModuleFlag[]): string[] {
  const codes = new Set<string>();
  const normalized = normalizeAccessFlags(flags);
  for (const flag of normalized) {
    const module = MODULE_BY_ID.get(flag.moduleId);
    if (!module) continue;
    if (flag.edit) {
      for (const code of module.viewCodes) codes.add(code);
      for (const code of module.editCodes) codes.add(code);
    } else if (flag.view) {
      for (const code of module.viewCodes) codes.add(code);
    }
  }
  return [...codes];
}

export function accessFlagsFromCodes(codes: Iterable<string>): AccessModuleFlag[] {
  const set = new Set(codes);
  return ACCESS_MODULES.map((module) => {
    const writes = writeCodesOf(module);
    const hasAllWrites = writes.length > 0 && writes.every((code) => set.has(code));
    const hasAnyView = module.viewCodes.some((code) => set.has(code));
    const hasAllView = module.viewCodes.every((code) => set.has(code));
    const view = hasAllWrites || hasAllView || hasAnyView;
    const edit = writes.length === 0 ? false : hasAllWrites;
    return { moduleId: module.id, view, edit };
  });
}

export function ensureCatalogViewCodes(codes: Iterable<string>): string[] {
  const set = new Set(codes);
  for (const module of ACCESS_MODULES) {
    const writes = writeCodesOf(module);
    if (writes.some((code) => set.has(code))) {
      for (const code of module.viewCodes) set.add(code);
    }
  }
  return [...set];
}

export function resolveEffectivePermissionCodes(input: {
  isSuperAdmin: boolean;
  roleCodes: Iterable<string>;
  grants?: Iterable<string>;
  denies?: Iterable<string>;
}): string[] {
  if (input.isSuperAdmin) {
    return Object.values(PERMISSIONS);
  }
  const set = new Set(input.roleCodes);
  if (input.grants) {
    for (const code of input.grants) set.add(code);
  }
  if (input.denies) {
    for (const code of input.denies) set.delete(code);
  }
  return ensureCatalogViewCodes(set);
}

export function catalogOverrideDiff(
  templateCodes: Iterable<string>,
  desiredCodes: Iterable<string>,
): { grants: string[]; denies: string[] } {
  const catalog = catalogPermissionCodeSet();
  const template = new Set([...templateCodes].filter((code) => catalog.has(code)));
  const desired = new Set([...desiredCodes].filter((code) => catalog.has(code)));
  const grants: string[] = [];
  const denies: string[] = [];
  for (const code of desired) {
    if (!template.has(code)) grants.push(code);
  }
  for (const code of template) {
    if (!desired.has(code)) denies.push(code);
  }
  return { grants, denies };
}

export function uncataloguedPermissionCodes(codes: Iterable<string>): string[] {
  const catalog = catalogPermissionCodeSet();
  return [...new Set(codes)].filter((code) => !catalog.has(code));
}
