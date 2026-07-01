"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStudentsQuerySchema = exports.createStudentSchema = void 0;
const zod_1 = require("zod");
const pakistan_1 = require("../constants/pakistan");
exports.createStudentSchema = zod_1.z.object({
    branchId: zod_1.z.string().min(1),
    fullName: zod_1.z.string().min(2).max(200),
    dateOfBirth: zod_1.z.string().datetime().optional(),
    gender: zod_1.z.enum(['male', 'female', 'other']).optional(),
    cnicOrBForm: zod_1.z.string().regex(pakistan_1.CNIC_REGEX).optional(),
    phone: zod_1.z.string().regex(pakistan_1.PHONE_REGEX).optional(),
    email: zod_1.z.string().email().optional(),
    address: zod_1.z.string().max(500).optional(),
    programId: zod_1.z.string().optional(),
    batchId: zod_1.z.string().optional(),
    statusId: zod_1.z.string().min(1),
    subjectIds: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.listStudentsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().optional(),
    batchId: zod_1.z.string().optional(),
    statusId: zod_1.z.string().optional(),
    sortBy: zod_1.z.enum(['fullName', 'createdAt']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=student.schema.js.map