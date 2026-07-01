import { z } from 'zod';
export declare const terminologySchema: z.ZodObject<{
    batch: z.ZodString;
    program: z.ZodString;
    assessment: z.ZodString;
    session: z.ZodString;
}, "strip", z.ZodTypeAny, {
    program: string;
    batch: string;
    assessment: string;
    session: string;
}, {
    program: string;
    batch: string;
    assessment: string;
    session: string;
}>;
export declare const featureFlagsSchema: z.ZodObject<{
    timetable: z.ZodBoolean;
    formBuilder: z.ZodBoolean;
    aiAttendance: z.ZodBoolean;
    parentPortal: z.ZodBoolean;
    studentPortal: z.ZodBoolean;
    rankings: z.ZodBoolean;
    assessmentSeries: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    assessmentSeries: boolean;
    timetable: boolean;
    formBuilder: boolean;
    aiAttendance: boolean;
    parentPortal: boolean;
    studentPortal: boolean;
    rankings: boolean;
}, {
    assessmentSeries: boolean;
    timetable: boolean;
    formBuilder: boolean;
    aiAttendance: boolean;
    parentPortal: boolean;
    studentPortal: boolean;
    rankings: boolean;
}>;
export declare const updateInstitutionSettingsSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    logoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    faviconUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    primaryColor: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    city: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    province: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    website: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    terminology: z.ZodOptional<z.ZodObject<{
        batch: z.ZodOptional<z.ZodString>;
        program: z.ZodOptional<z.ZodString>;
        assessment: z.ZodOptional<z.ZodString>;
        session: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        program?: string | undefined;
        batch?: string | undefined;
        assessment?: string | undefined;
        session?: string | undefined;
    }, {
        program?: string | undefined;
        batch?: string | undefined;
        assessment?: string | undefined;
        session?: string | undefined;
    }>>;
    featureFlags: z.ZodOptional<z.ZodObject<{
        timetable: z.ZodOptional<z.ZodBoolean>;
        formBuilder: z.ZodOptional<z.ZodBoolean>;
        aiAttendance: z.ZodOptional<z.ZodBoolean>;
        parentPortal: z.ZodOptional<z.ZodBoolean>;
        studentPortal: z.ZodOptional<z.ZodBoolean>;
        rankings: z.ZodOptional<z.ZodBoolean>;
        assessmentSeries: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        assessmentSeries?: boolean | undefined;
        timetable?: boolean | undefined;
        formBuilder?: boolean | undefined;
        aiAttendance?: boolean | undefined;
        parentPortal?: boolean | undefined;
        studentPortal?: boolean | undefined;
        rankings?: boolean | undefined;
    }, {
        assessmentSeries?: boolean | undefined;
        timetable?: boolean | undefined;
        formBuilder?: boolean | undefined;
        aiAttendance?: boolean | undefined;
        parentPortal?: boolean | undefined;
        studentPortal?: boolean | undefined;
        rankings?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    terminology?: {
        program?: string | undefined;
        batch?: string | undefined;
        assessment?: string | undefined;
        session?: string | undefined;
    } | undefined;
    featureFlags?: {
        assessmentSeries?: boolean | undefined;
        timetable?: boolean | undefined;
        formBuilder?: boolean | undefined;
        aiAttendance?: boolean | undefined;
        parentPortal?: boolean | undefined;
        studentPortal?: boolean | undefined;
        rankings?: boolean | undefined;
    } | undefined;
    name?: string | undefined;
    logoUrl?: string | null | undefined;
    faviconUrl?: string | null | undefined;
    primaryColor?: string | undefined;
    address?: string | null | undefined;
    city?: string | null | undefined;
    province?: string | null | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    website?: string | null | undefined;
}, {
    terminology?: {
        program?: string | undefined;
        batch?: string | undefined;
        assessment?: string | undefined;
        session?: string | undefined;
    } | undefined;
    featureFlags?: {
        assessmentSeries?: boolean | undefined;
        timetable?: boolean | undefined;
        formBuilder?: boolean | undefined;
        aiAttendance?: boolean | undefined;
        parentPortal?: boolean | undefined;
        studentPortal?: boolean | undefined;
        rankings?: boolean | undefined;
    } | undefined;
    name?: string | undefined;
    logoUrl?: string | null | undefined;
    faviconUrl?: string | null | undefined;
    primaryColor?: string | undefined;
    address?: string | null | undefined;
    city?: string | null | undefined;
    province?: string | null | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    website?: string | null | undefined;
}>;
export type UpdateInstitutionSettingsInput = z.infer<typeof updateInstitutionSettingsSchema>;
//# sourceMappingURL=institution.schema.d.ts.map