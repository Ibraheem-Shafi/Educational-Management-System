"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ROLE_PERMISSIONS = exports.PERMISSIONS = void 0;
exports.PERMISSIONS = {
    BRANCHES_MANAGE: 'branches.manage',
    BRANCHES_READ: 'branches.read',
    STUDENTS_READ: 'students.read',
    STUDENTS_CREATE: 'students.create',
    STUDENTS_UPDATE: 'students.update',
    STUDENTS_DELETE: 'students.delete',
    ATTENDANCE_MARK: 'attendance.mark',
    ATTENDANCE_READ: 'attendance.read',
    ASSESSMENTS_MARKS_ENTER: 'assessments.marks.enter',
    ASSESSMENTS_READ: 'assessments.read',
    FEES_COLLECT: 'fees.collect',
    FEES_READ: 'fees.read',
    REPORTS_VIEW: 'reports.view',
    SETTINGS_MANAGE: 'settings.manage',
    USERS_MANAGE: 'users.manage',
    AUDIT_READ: 'audit.read',
};
exports.DEFAULT_ROLE_PERMISSIONS = {
    super_admin: Object.values(exports.PERMISSIONS),
    branch_admin: [
        exports.PERMISSIONS.BRANCHES_READ,
        exports.PERMISSIONS.BRANCHES_READ,
        exports.PERMISSIONS.STUDENTS_READ,
        exports.PERMISSIONS.STUDENTS_CREATE,
        exports.PERMISSIONS.STUDENTS_UPDATE,
        exports.PERMISSIONS.STUDENTS_DELETE,
        exports.PERMISSIONS.ATTENDANCE_MARK,
        exports.PERMISSIONS.ATTENDANCE_READ,
        exports.PERMISSIONS.ASSESSMENTS_MARKS_ENTER,
        exports.PERMISSIONS.ASSESSMENTS_READ,
        exports.PERMISSIONS.FEES_COLLECT,
        exports.PERMISSIONS.FEES_READ,
        exports.PERMISSIONS.REPORTS_VIEW,
        exports.PERMISSIONS.USERS_MANAGE,
        exports.PERMISSIONS.AUDIT_READ,
    ],
    teacher: [
        exports.PERMISSIONS.STUDENTS_READ,
        exports.PERMISSIONS.ATTENDANCE_READ,
        exports.PERMISSIONS.ASSESSMENTS_MARKS_ENTER,
        exports.PERMISSIONS.ASSESSMENTS_READ,
        exports.PERMISSIONS.REPORTS_VIEW,
    ],
    accountant: [
        exports.PERMISSIONS.STUDENTS_READ,
        exports.PERMISSIONS.FEES_COLLECT,
        exports.PERMISSIONS.FEES_READ,
        exports.PERMISSIONS.REPORTS_VIEW,
    ],
    receptionist: [
        exports.PERMISSIONS.STUDENTS_READ,
        exports.PERMISSIONS.STUDENTS_CREATE,
        exports.PERMISSIONS.STUDENTS_UPDATE,
        exports.PERMISSIONS.ATTENDANCE_READ,
    ],
    parent: [exports.PERMISSIONS.STUDENTS_READ, exports.PERMISSIONS.FEES_READ, exports.PERMISSIONS.ATTENDANCE_READ],
    student: [exports.PERMISSIONS.STUDENTS_READ, exports.PERMISSIONS.ATTENDANCE_READ, exports.PERMISSIONS.ASSESSMENTS_READ],
};
//# sourceMappingURL=permissions.js.map