import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from './permissions';
import {
  accessFlagsFromCodes,
  catalogOverrideDiff,
  codesFromAccessFlags,
  resolveEffectivePermissionCodes,
} from './access-modules';

describe('access modules', () => {
  it('treats edit as implying view when expanding flags', () => {
    const codes = codesFromAccessFlags([{ moduleId: 'fees', view: false, edit: true }]);
    expect(codes).toEqual(expect.arrayContaining([PERMISSIONS.FEES_READ, PERMISSIONS.FEES_COLLECT]));
  });

  it('reads partial existing templates as view without full edit', () => {
    const flags = accessFlagsFromCodes([PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_UPDATE]);
    const students = flags.find((flag) => flag.moduleId === 'students');
    expect(students).toEqual({ moduleId: 'students', view: true, edit: false });
  });

  it('computes grant and deny diffs against a template', () => {
    const template = [PERMISSIONS.FEES_READ, PERMISSIONS.FEES_COLLECT, PERMISSIONS.HR_READ];
    const desired = [PERMISSIONS.FEES_READ, PERMISSIONS.HR_READ, PERMISSIONS.HR_MANAGE];
    expect(catalogOverrideDiff(template, desired)).toEqual({
      grants: [PERMISSIONS.HR_MANAGE],
      denies: [PERMISSIONS.FEES_COLLECT],
    });
  });

  it('gives super admin every permission and applies grant/deny for staff', () => {
    const all = resolveEffectivePermissionCodes({
      isSuperAdmin: true,
      roleCodes: [],
    });
    expect(all).toContain(PERMISSIONS.BRANCHES_MANAGE);
    expect(all.length).toBe(Object.values(PERMISSIONS).length);

    const staff = resolveEffectivePermissionCodes({
      isSuperAdmin: false,
      roleCodes: [PERMISSIONS.FEES_READ, PERMISSIONS.FEES_COLLECT],
      grants: [PERMISSIONS.HR_READ],
      denies: [PERMISSIONS.FEES_COLLECT],
    });
    expect(staff).toEqual(expect.arrayContaining([PERMISSIONS.FEES_READ, PERMISSIONS.HR_READ]));
    expect(staff).not.toContain(PERMISSIONS.FEES_COLLECT);
  });
});
