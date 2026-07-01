import { z } from 'zod';
export declare const createStudentSchema: z.ZodObject<{
    branchId: z.ZodString;
    fullName: z.ZodString;
    dateOfBirth: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<["male", "female", "other"]>>;
    cnicOrBForm: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    programId: z.ZodOptional<z.ZodString>;
    batchId: z.ZodOptional<z.ZodString>;
    statusId: z.ZodString;
    subjectIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    branchId: string;
    statusId: string;
    address?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: "male" | "female" | "other" | undefined;
    cnicOrBForm?: string | undefined;
    programId?: string | undefined;
    batchId?: string | undefined;
    subjectIds?: string[] | undefined;
}, {
    fullName: string;
    branchId: string;
    statusId: string;
    address?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: "male" | "female" | "other" | undefined;
    cnicOrBForm?: string | undefined;
    programId?: string | undefined;
    batchId?: string | undefined;
    subjectIds?: string[] | undefined;
}>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export declare const listStudentsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    batchId: z.ZodOptional<z.ZodString>;
    statusId: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["fullName", "createdAt"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortBy: "createdAt" | "fullName";
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    batchId?: string | undefined;
    statusId?: string | undefined;
}, {
    search?: string | undefined;
    batchId?: string | undefined;
    statusId?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: "createdAt" | "fullName" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
//# sourceMappingURL=student.schema.d.ts.map