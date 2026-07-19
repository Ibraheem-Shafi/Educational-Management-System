import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const transportVehicleStatuses = ['active', 'inactive'] as const;
export const transportStaffRoles = ['driver', 'conductor'] as const;
export const transportDirections = ['pickup', 'dropoff', 'both'] as const;
export const transportTripStatuses = ['scheduled', 'completed', 'cancelled'] as const;
export const transportAttendanceStatuses = ['present', 'absent', 'boarded'] as const;

const staffAssignmentSchema = z.object({
  userId: requiredId('User'),
  role: z.enum(transportStaffRoles, { errorMap: () => ({ message: MSG.select('role') }) }),
});

const stopSchema = z.object({
  name: requiredString('Stop name', 1, 200),
  sequence: z.number().int().min(1),
  pickupTime: optionalString(10).nullable(),
  dropoffTime: optionalString(10).nullable(),
});

export const listTransportVehiclesQuerySchema = z
  .object({
    branchId: z.string().optional(),
    status: z.enum(transportVehicleStatuses).optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListTransportVehiclesQuery = z.infer<typeof listTransportVehiclesQuerySchema>;

export const createTransportVehicleSchema = z.object({
  branchId: requiredId('Branch'),
  plateNumber: requiredString('Plate number', 1, 50),
  makeModel: optionalString(200).nullable(),
  capacity: z.number().int().min(1).max(200).optional().nullable(),
  status: z.enum(transportVehicleStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  gpsDeviceId: optionalString(100).nullable(),
  staff: z.array(staffAssignmentSchema).optional(),
});

export type CreateTransportVehicleInput = z.infer<typeof createTransportVehicleSchema>;

export const updateTransportVehicleSchema = createTransportVehicleSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    staff: z.array(staffAssignmentSchema).optional(),
  });

export type UpdateTransportVehicleInput = z.infer<typeof updateTransportVehicleSchema>;

export const createTransportVehicleDocumentSchema = z.object({
  title: requiredString('Title', 1, 200),
  storagePath: requiredString('Storage path', 1, 500),
  mimeType: optionalString(100).nullable(),
});

export type CreateTransportVehicleDocumentInput = z.infer<
  typeof createTransportVehicleDocumentSchema
>;

export const listTransportRoutesQuerySchema = z
  .object({
    branchId: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListTransportRoutesQuery = z.infer<typeof listTransportRoutesQuerySchema>;

export const createTransportRouteSchema = z.object({
  branchId: requiredId('Branch'),
  name: requiredString('Route name', 1, 200),
  code: optionalString(50).nullable(),
  isActive: z.boolean().optional(),
  stops: z.array(stopSchema).min(1),
});

export type CreateTransportRouteInput = z.infer<typeof createTransportRouteSchema>;

export const updateTransportRouteSchema = createTransportRouteSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    stops: z.array(stopSchema).optional(),
  });

export type UpdateTransportRouteInput = z.infer<typeof updateTransportRouteSchema>;

export const listStudentTransportQuerySchema = z
  .object({
    branchId: z.string().optional(),
    routeId: z.string().optional(),
    studentId: z.string().optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListStudentTransportQuery = z.infer<typeof listStudentTransportQuerySchema>;

export const createStudentTransportSchema = z.object({
  branchId: requiredId('Branch'),
  studentId: requiredId('Student'),
  routeId: requiredId('Route'),
  stopId: requiredId('Stop'),
  direction: z.enum(transportDirections, { errorMap: () => ({ message: MSG.select('direction') }) }),
});

export type CreateStudentTransportInput = z.infer<typeof createStudentTransportSchema>;

export const updateStudentTransportSchema = createStudentTransportSchema
  .omit({ branchId: true })
  .partial();

export type UpdateStudentTransportInput = z.infer<typeof updateStudentTransportSchema>;

export const listTransportTripsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    routeId: z.string().optional(),
    vehicleId: z.string().optional(),
    status: z.enum(transportTripStatuses).optional(),
    tripDate: z.string().optional(),
    direction: z.enum(transportDirections).optional(),
  })
  .merge(paginationQuerySchema);

export type ListTransportTripsQuery = z.infer<typeof listTransportTripsQuerySchema>;

export const createTransportTripSchema = z.object({
  branchId: requiredId('Branch'),
  routeId: requiredId('Route'),
  vehicleId: z.string().optional().nullable(),
  tripDate: requiredId('Trip date'),
  direction: z.enum(transportDirections, { errorMap: () => ({ message: MSG.select('direction') }) }),
  status: z.enum(transportTripStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
});

export type CreateTransportTripInput = z.infer<typeof createTransportTripSchema>;

export const updateTransportTripSchema = createTransportTripSchema
  .omit({ branchId: true })
  .partial();

export type UpdateTransportTripInput = z.infer<typeof updateTransportTripSchema>;

export const bulkTransportAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: requiredId('Student'),
        status: z.enum(transportAttendanceStatuses, {
          errorMap: () => ({ message: MSG.select('status') }),
        }),
        recordedAt: z.string().datetime({ message: MSG.invalidDate }).optional(),
      }),
    )
    .min(1),
});

export type BulkTransportAttendanceInput = z.infer<typeof bulkTransportAttendanceSchema>;

export const transportGpsWebhookSchema = z.object({
  deviceId: requiredString('Device ID', 1, 100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  recordedAt: z.string().datetime({ message: MSG.invalidDate }).optional(),
});

export type TransportGpsWebhookInput = z.infer<typeof transportGpsWebhookSchema>;
