"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInstitutionSettingsSchema = exports.featureFlagsSchema = exports.terminologySchema = void 0;
const zod_1 = require("zod");
exports.terminologySchema = zod_1.z.object({
    batch: zod_1.z.string(),
    program: zod_1.z.string(),
    assessment: zod_1.z.string(),
    session: zod_1.z.string(),
});
exports.featureFlagsSchema = zod_1.z.object({
    timetable: zod_1.z.boolean(),
    formBuilder: zod_1.z.boolean(),
    aiAttendance: zod_1.z.boolean(),
    parentPortal: zod_1.z.boolean(),
    studentPortal: zod_1.z.boolean(),
    rankings: zod_1.z.boolean(),
    assessmentSeries: zod_1.z.boolean(),
});
exports.updateInstitutionSettingsSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(200).optional(),
    logoUrl: zod_1.z.string().url().nullable().optional(),
    faviconUrl: zod_1.z.string().url().nullable().optional(),
    primaryColor: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    address: zod_1.z.string().max(500).nullable().optional(),
    city: zod_1.z.string().max(100).nullable().optional(),
    province: zod_1.z.string().max(100).nullable().optional(),
    phone: zod_1.z.string().nullable().optional(),
    email: zod_1.z.string().email().nullable().optional(),
    website: zod_1.z.string().url().nullable().optional(),
    terminology: exports.terminologySchema.partial().optional(),
    featureFlags: exports.featureFlagsSchema.partial().optional(),
});
//# sourceMappingURL=institution.schema.js.map